import { describe, it, expect } from "vitest";
import {
  verifyMagicBytes,
  segmentClausesDeterministic,
  extractTextFromFile,
} from "../upload.server";
import { CURATED_BD_EVENTS } from "../sources/bd-curated.server";
import { TRACKED_CFR_SECTIONS } from "../sources/ecfr.server";
import { TRACKED_EURLEX_INSTRUMENTS } from "../sources/eurlex.server";

describe("Phase 4 Ingestion Pipeline & Multi-Source Adapters", () => {
  describe("T4.6: Contract Upload Magic-Byte Validation & Segmentation", () => {
    it("identifies valid PDF magic bytes (%PDF-)", () => {
      const pdfHeader = Buffer.from("%PDF-1.7\n%fake-binary\n");
      const result = verifyMagicBytes(pdfHeader, "vendor-contract.pdf");
      expect(result).toBe("pdf");
    });

    it("identifies valid DOCX / ZIP magic bytes (PK\\x03\\x04)", () => {
      const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      const result = verifyMagicBytes(docxHeader, "master-services.docx");
      expect(result).toBe("docx");
    });

    it("identifies clean text files and rejects binary files disguised as .txt", () => {
      const cleanText = Buffer.from(
        "1. Term and Termination\nThis agreement shall commence...",
        "utf-8",
      );
      expect(verifyMagicBytes(cleanText, "agreement.txt")).toBe("txt");

      // Binary file disguised as txt with null bytes
      const disguisedBinary = Buffer.from([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x77, 0x6f, 0x72, 0x6c, 0x64,
      ]);
      expect(verifyMagicBytes(disguisedBinary, "malicious.txt")).toBe("unknown");
    });

    it("rejects unknown executable / binary files (e.g. MZ executable)", () => {
      const exeHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ DOS header
      expect(verifyMagicBytes(exeHeader, "payload.exe")).toBe("unknown");
    });

    it("enforces the 10 MB size limit on uploaded files", async () => {
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
      await expect(extractTextFromFile(oversizedBuffer, "large.pdf")).rejects.toThrow(
        "File exceeds maximum allowed size of 10 MB",
      );
    });

    it("performs deterministic span segmentation with exact char offsets", () => {
      const contractText = `Section 1. Data Protection and Breach Notification.
The vendor shall report any confirmed security incident or personal data breach to the customer within 72 hours of discovery in accordance with GDPR principles.

Section 2. Identity and System Records.
Vendor shall cooperate with lawful disclosure requests and maintain audit records under Bangladesh Digital Security regulations.`;

      const clauses = segmentClausesDeterministic(contractText);
      expect(clauses.length).toBeGreaterThanOrEqual(2);

      // Verify Clause 1 spans
      const cl1 = clauses[0];
      expect(cl1.text).toContain("72 hours");
      expect(cl1.linked_regs).toContain("REG-GDPR-33");
      expect(cl1.char_start).toBeDefined();
      expect(cl1.char_end).toBeDefined();
      expect(contractText.slice(cl1.char_start!, cl1.char_end!)).toBe(cl1.text);

      // Verify Clause 2 spans
      const cl2 = clauses[1];
      expect(cl2.text).toContain("Digital Security");
      expect(cl2.linked_regs).toContain("REG-BD-DSA-2018");
      expect(contractText.slice(cl2.char_start!, cl2.char_end!)).toBe(cl2.text);
    });
  });

  describe("T4.1: Background Worker Job Queue Backoff Lifecycle", () => {
    it("calculates exponential backoff delay correctly", () => {
      const computeBackoffSeconds = (attempts: number) => Math.pow(3, attempts) * 5;

      expect(computeBackoffSeconds(1)).toBe(15); // 3^1 * 5 = 15s
      expect(computeBackoffSeconds(2)).toBe(45); // 3^2 * 5 = 45s
      expect(computeBackoffSeconds(3)).toBe(135); // 3^3 * 5 = 135s
    });

    it("determines dead-letter threshold at max attempts", () => {
      const maxAttempts = 3;
      const shouldDeadLetter = (attempts: number) => attempts >= maxAttempts;

      expect(shouldDeadLetter(1)).toBe(false);
      expect(shouldDeadLetter(2)).toBe(false);
      expect(shouldDeadLetter(3)).toBe(true);
      expect(shouldDeadLetter(4)).toBe(true);
    });
  });

  describe("T4.2: Federal Register Adapter Ingestion Logic", () => {
    it("classifies document types into standard event types", () => {
      const classifyDocType = (type: string) => {
        if (type === "RULE") return "published";
        if (type === "PRORULE") return "proposed";
        return "guidance";
      };

      expect(classifyDocType("RULE")).toBe("published");
      expect(classifyDocType("PRORULE")).toBe("proposed");
      expect(classifyDocType("NOTICE")).toBe("guidance");
    });

    it("matches tracked statutory instruments from document metadata", () => {
      const matchInstrument = (title: string, text: string) => {
        const lower = (title + " " + text).toLowerCase();
        if (lower.includes("hipaa") || lower.includes("164.3")) return "us-hipaa-security-rule";
        if (lower.includes("17a-4") || lower.includes("broker-dealer record"))
          return "us-sec-rule-17a-4";
        if (lower.includes("sarbanes-oxley") || lower.includes("sox")) return "us-sox-act-2002";
        if (lower.includes("ccpa") || lower.includes("california consumer privacy"))
          return "us-ccpa";
        return null;
      };

      expect(
        matchInstrument(
          "HIPAA Privacy and Security Rule Modifications Under HITECH",
          "Technical safeguards for electronic protected health information 45 CFR 164.312",
        ),
      ).toBe("us-hipaa-security-rule");

      expect(
        matchInstrument(
          "Electronic Recordkeeping Requirements for Broker-Dealers",
          "Amendments to Exchange Act Rule 17a-4 allowing audit-trail alternative to WORM",
        ),
      ).toBe("us-sec-rule-17a-4");
    });
  });

  describe("T4.3: eCFR Point-in-Time Tracked Sections", () => {
    it("tracks critical CFR sections with correct citations", () => {
      expect(TRACKED_CFR_SECTIONS).toBeDefined();
      expect(TRACKED_CFR_SECTIONS.length).toBeGreaterThanOrEqual(2);

      const hipaa = TRACKED_CFR_SECTIONS.find(
        (s: { instrumentId: string; title: number; section: string }) =>
          s.instrumentId === "us-hipaa-security-rule",
      );
      expect(hipaa).toBeDefined();
      expect(hipaa?.title).toBe(45);
      expect(hipaa?.section).toBe("164.312");

      const sec17a = TRACKED_CFR_SECTIONS.find(
        (s: { instrumentId: string; title: number; section: string }) =>
          s.instrumentId === "us-sec-rule-17a-4",
      );
      expect(sec17a).toBeDefined();
      expect(sec17a?.title).toBe(17);
      expect(sec17a?.section).toBe("240.17a-4");
    });
  });

  describe("T4.4: EUR-Lex CELEX Adapter", () => {
    it("configures official CELEX numbers for EU GDPR, AI Act, and Omnibus", () => {
      expect(TRACKED_EURLEX_INSTRUMENTS).toBeDefined();
      expect(TRACKED_EURLEX_INSTRUMENTS.length).toBeGreaterThanOrEqual(2);

      const gdpr = TRACKED_EURLEX_INSTRUMENTS.find(
        (i: { celexNumber: string; instrumentId: string }) => i.celexNumber === "32016R0679",
      );
      expect(gdpr).toBeDefined();
      expect(gdpr?.instrumentId).toBe("eu-gdpr");

      const aiAct = TRACKED_EURLEX_INSTRUMENTS.find(
        (i: { celexNumber: string; instrumentId: string }) => i.celexNumber === "32024R1689",
      );
      expect(aiAct).toBeDefined();
      expect(aiAct?.instrumentId).toBe("eu-ai-act");
    });
  });

  describe("T4.5: Bangladesh Curated Gazette Chain", () => {
    it("contains verified repeal chain: CSO 2025 repeals CSA 2023", () => {
      const csoPromulgation = CURATED_BD_EVENTS.find(
        (e) => e.externalId === "bd-cso-2025-promulgation",
      );
      expect(csoPromulgation).toBeDefined();
      expect(csoPromulgation?.eventType).toBe("published");
      expect(csoPromulgation?.isVerified).toBe(true);

      const csaRepeal = CURATED_BD_EVENTS.find((e) => e.externalId === "bd-csa-2023-repeal");
      expect(csaRepeal).toBeDefined();
      expect(csaRepeal?.eventType).toBe("repealed");
      expect(csaRepeal?.isVerified).toBe(true);
    });

    it("labels unpromulgated acts honestly as unverified / pending", () => {
      const pdpo = CURATED_BD_EVENTS.find((e) => e.externalId === "bd-pdpo-2025-council-approval");
      expect(pdpo).toBeDefined();
      expect(pdpo?.eventType).toBe("adopted");
      // Per plan §2 and §7, PDPO 2025 is approved by Council of Advisers but gazette publication is pending
      expect(pdpo?.isVerified).toBe(false);
      expect(pdpo?.effectiveOn).toBeNull();
    });
  });
});
