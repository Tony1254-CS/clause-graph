import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import { verifyCitations, mapDbRegulationToMetadata } from "./citation-verifier";
import { AUTHORITATIVE_LEGAL_CORPUS } from "./citation-corpus";
import type {
  CitationVerificationSummary,
  LegalCitationMetadata,
} from "./citation-verify.types";

/**
 * Server function to verify any legal citation text or contract draft directly.
 */
export const verifyCitationText = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { text: string }) => {
    const text = String(input?.text ?? "").trim();
    if (!text) throw new Error("Text is required for citation verification");
    if (text.length > 50000) throw new Error("Text exceeds 50,000 characters limit");
    return { text };
  })
  .handler(async ({ data }): Promise<CitationVerificationSummary> => {
    const { query } = await import("./db.server");

    // Fetch database regulations to augment authoritative corpus
    let dbMetadata: LegalCitationMetadata[] = [];
    try {
      const regRows = await query(
        `SELECT id, jurisdiction, title, summary, obligations FROM public.regulations`
      );
      dbMetadata = (regRows ?? []).map((r: any) =>
        mapDbRegulationToMetadata({
          id: r.id,
          title: r.title,
          jurisdiction: r.jurisdiction,
          summary: r.summary,
          obligations: r.obligations,
        })
      );
    } catch (dbErr) {
      console.warn("[verifyCitationText] Could not query db regulations, falling back to static corpus:", dbErr);
    }

    return verifyCitations(data.text, dbMetadata);
  });

/**
 * Server function to list all registered authoritative legal documents.
 */
export const getAuthoritativeCorpus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<LegalCitationMetadata[]> => {
    const { query } = await import("./db.server");
    let dbMetadata: LegalCitationMetadata[] = [];
    try {
      const regRows = await query(
        `SELECT id, jurisdiction, title, summary, obligations FROM public.regulations`
      );
      dbMetadata = (regRows ?? []).map((r: any) =>
        mapDbRegulationToMetadata({
          id: r.id,
          title: r.title,
          jurisdiction: r.jurisdiction,
          summary: r.summary,
          obligations: r.obligations,
        })
      );
    } catch {
      /* ignore */
    }

    return [...AUTHORITATIVE_LEGAL_CORPUS, ...dbMetadata];
  });
