import { createFileRoute } from "@tanstack/react-router";
import { verifyCitations, mapDbRegulationToMetadata } from "@/lib/citation-verifier";
import { AUTHORITATIVE_LEGAL_CORPUS } from "@/lib/citation-corpus";
import { query } from "@/lib/db.server";

export const Route = createFileRoute("/api/public/verify-citations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { text?: unknown };
          const text = typeof body.text === "string" ? body.text.trim() : "";

          if (!text) {
            return Response.json(
              { error: "Missing 'text' field in request payload." },
              { status: 400 }
            );
          }

          if (text.length > 50000) {
            return Response.json(
              { error: "Payload text exceeds 50,000 characters." },
              { status: 400 }
            );
          }

          let dbMetadata: any[] = [];
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

          const result = verifyCitations(text, dbMetadata);

          return Response.json({
            ok: true,
            data: result,
          });
        } catch (err) {
          console.error("[api/public/verify-citations] error:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Internal verification error" },
            { status: 500 }
          );
        }
      },
      GET: async () => {
        return Response.json({
          ok: true,
          corpus_size: AUTHORITATIVE_LEGAL_CORPUS.length,
          corpus: AUTHORITATIVE_LEGAL_CORPUS.map((c) => ({
            id: c.id,
            actTitle: c.actTitle,
            shortTitle: c.shortTitle,
            jurisdiction: c.jurisdiction,
            section: c.section,
            year: c.year,
            effectiveDate: c.effectiveDate,
            amendmentStatus: c.amendmentStatus,
            repealedDate: c.repealedDate,
            amendedDate: c.amendedDate,
            supersededBy: c.supersededBy,
            officialSourceUrl: c.officialSourceUrl,
          })),
        });
      },
    },
  },
});
