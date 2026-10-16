// src/lib/upload.server.ts
// Secure contract upload, magic-byte check, PDF extraction, and span segmentation (Phase 4 T4.6)

import { extractText } from "unpdf";
import { query, transaction } from "./db.server";
import { chatCompletion, resolveAiProvider } from "./ai.server";

export interface ExtractedClause {
  text: string;
  linked_regs: string[];
  char_start?: number;
  char_end?: number;
}

export type SupportedFileType = "pdf" | "docx" | "txt" | "unknown";

/**
 * Validates file magic bytes to prevent file extension spoofing (S-11 defense).
 */
export function verifyMagicBytes(buffer: Buffer, fileName: string): SupportedFileType {
  if (buffer.length < 4) return "unknown";

  // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "pdf";
  }

  // DOCX / ZIP magic bytes: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return "docx";
  }

  // Text / Markdown validation (no non-printable control bytes except newline, tab, cr)
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "txt" || ext === "md") {
    // Check first 512 bytes for binary/null characters
    const sample = buffer.subarray(0, Math.min(512, buffer.length));
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) return "unknown"; // null byte indicates binary
    }
    return "txt";
  }

  return "unknown";
}

/**
 * Extracts raw text from uploaded file buffer with size and format verification.
 */
export async function extractTextFromFile(buffer: Buffer, fileName: string): Promise<string> {
  const maxBytes = 10 * 1024 * 1024; // 10 MB limit per T4.6
  if (buffer.length > maxBytes) {
    throw new Error("File exceeds maximum allowed size of 10 MB");
  }

  const fileType = verifyMagicBytes(buffer, fileName);

  if (fileType === "pdf") {
    try {
      const { text } = await extractText(new Uint8Array(buffer));
      const clean = text.join("\n").trim();
      if (!clean) throw new Error("PDF contains no extractable text or is an image scan");
      return clean;
    } catch (err) {
      throw new Error(`Failed to parse PDF: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (fileType === "docx") {
    // Basic docx XML text extraction from word/document.xml stream
    const str = buffer.toString("utf-8");
    const textMatches = str.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    if (textMatches && textMatches.length > 0) {
      return textMatches.map((t) => t.replace(/<[^>]+>/g, "")).join(" ");
    }
    throw new Error("DOCX could not be parsed: missing text streams");
  }

  if (fileType === "txt") {
    return buffer.toString("utf-8");
  }

  throw new Error(
    `Unsupported or corrupted file format. Only valid PDF, DOCX, and TXT files under 10 MB are accepted.`,
  );
}

/**
 * Deterministic clause segmenter for offline or AI-unavailable scenarios.
 */
export function segmentClausesDeterministic(rawText: string): ExtractedClause[] {
  // Split on double newlines or numbered section patterns
  const paragraphs = rawText
    .split(/\n\s*\n|(?=(?:Section\s+\d+|Article\s+\d+|\d+\.\s+[A-Z]))/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 40);

  const clauses: ExtractedClause[] = [];
  const lowerText = rawText.toLowerCase();

  for (const para of paragraphs) {
    const linkedRegs: string[] = [];
    const lp = para.toLowerCase();

    if (lp.includes("gdpr") || lp.includes("72 hours") || lp.includes("breach")) {
      linkedRegs.push("REG-GDPR-33");
    }
    if (lp.includes("standard contractual") || lp.includes("transfer") || lp.includes("eea")) {
      linkedRegs.push("REG-GDPR-44");
    }
    if (lp.includes("hipaa") || lp.includes("phi") || lp.includes("health")) {
      linkedRegs.push("REG-HIPAA-SEC");
    }
    if (lp.includes("retention") || lp.includes("worm") || lp.includes("broker")) {
      linkedRegs.push("REG-SEC-17A4");
    }
    if (lp.includes("opt-out") || lp.includes("do not sell") || lp.includes("california")) {
      linkedRegs.push("REG-CCPA-1798.120");
    }
    if (
      lp.includes("notice") &&
      (lp.includes("terminate") || lp.includes("120 days") || lp.includes("labour"))
    ) {
      linkedRegs.push("REG-BD-LA-2006");
    }
    if (
      lp.includes("digital security") ||
      lp.includes("cyber security") ||
      lp.includes("identity")
    ) {
      linkedRegs.push("REG-BD-DSA-2018");
    }

    const start = rawText.indexOf(para);
    const end = start >= 0 ? start + para.length : undefined;

    clauses.push({
      text: para,
      linked_regs: linkedRegs,
      char_start: start >= 0 ? start : undefined,
      char_end: end,
    });
  }

  return clauses;
}

const SYSTEM = `You are a contracts analyst. Given a contract's raw text and a regulatory ontology, do TWO things:
1. Segment the contract into distinct clauses (numbered sections, obligations, definitions — merge tiny fragments; typical contract yields 5-20 clauses).
2. For each clause, list the IDs of any regulations in the ontology it plausibly cites or is governed by (linked_regs). Only include IDs that exist in the ontology. Empty array is fine.

Return STRICT JSON only:
{"clauses":[{"text":string,"linked_regs":string[]}]}`;

/**
 * Runs contract clause extraction, span calculation (char_start, char_end), and persistence.
 */
export async function runContractExtraction(contractId: string, rawText: string): Promise<void> {
  const provider = resolveAiProvider();

  try {
    let clauses: ExtractedClause[] = [];

    if (provider.kind !== "none") {
      const regs = await query<{
        id: string;
        jurisdiction: string;
        title: string;
        summary: string;
      }>(`SELECT id, jurisdiction, title, summary FROM public.regulations`);

      const ontology = (regs ?? []).map((r) => ({
        id: r.id,
        jurisdiction: r.jurisdiction,
        title: r.title,
        summary: r.summary,
      }));

      const content = await chatCompletion({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `REGULATORY ONTOLOGY:\n${JSON.stringify(ontology)}\n\nCONTRACT TEXT:\n${rawText}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        timeoutMs: 90_000,
      });

      if (content) {
        try {
          const parsed = JSON.parse(content) as { clauses?: ExtractedClause[] };
          const validRegIds = new Set(ontology.map((r) => r.id));
          clauses = (parsed.clauses ?? [])
            .filter((c) => c && typeof c.text === "string" && c.text.trim().length > 0)
            .map((c) => {
              const trimmed = c.text.trim();
              const start = rawText.indexOf(trimmed);
              return {
                text: trimmed,
                linked_regs: (c.linked_regs ?? []).filter((id) => validRegIds.has(id)),
                char_start: start >= 0 ? start : undefined,
                char_end: start >= 0 ? start + trimmed.length : undefined,
              };
            });
        } catch {
          clauses = [];
        }
      }
    }

    // Fall back to deterministic segmentation if AI was unavailable or returned empty
    if (clauses.length === 0) {
      clauses = segmentClausesDeterministic(rawText);
    }

    if (clauses.length === 0) {
      throw new Error("Unable to extract distinct clauses from uploaded document text");
    }

    // Insert extracted clauses with span coordinates in a transaction
    await transaction(async (client) => {
      for (let idx = 0; idx < clauses.length; idx++) {
        const c = clauses[idx];
        await client.query(
          `INSERT INTO public.clauses (
             contract_id, text, linked_regs, position, confidence, char_start, char_end
           ) VALUES ($1, $2, $3, $4, 0.9, $5, $6)`,
          [contractId, c.text, c.linked_regs, idx, c.char_start ?? null, c.char_end ?? null],
        );
      }

      await client.query(
        `UPDATE public.contracts 
         SET extraction_status = 'complete', extraction_error = null 
         WHERE id = $1`,
        [contractId],
      );
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload.server] Extraction failed:", contractId, msg);
    await query(
      `UPDATE public.contracts 
       SET extraction_status = 'failed', extraction_error = $1 
       WHERE id = $2`,
      [msg.slice(0, 500), contractId],
    );
  }
}
