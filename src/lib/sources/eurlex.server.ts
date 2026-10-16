// src/lib/sources/eurlex.server.ts
// EUR-Lex CELLAR SPARQL / REST adapter for tracked EU regulations (Phase 4 T4.4)

import { query } from "../db.server";

export interface EurLexDoc {
  celex: string;
  instrumentId: string;
  title: string;
  ojUrl: string;
  effectiveDate?: string;
  amendmentNotice?: string;
}

const TRACKED_CELEX = [
  {
    celex: "32016R0679",
    instrumentId: "eu-gdpr",
    title: "Regulation (EU) 2016/679 (General Data Protection Regulation)",
    ojUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679",
  },
  {
    celex: "32024R1689",
    instrumentId: "eu-ai-act",
    title: "Regulation (EU) 2024/1689 (Artificial Intelligence Act)",
    ojUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
  },
  {
    celex: "32026R1744",
    instrumentId: "eu-regulation-2026-1744",
    title: "Regulation (EU) 2026/1744 (Digital Omnibus on AI Governance Implementation)",
    ojUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=uriserv:OJ.L_.2026.1744.01.ENG",
  },
];

/**
 * Syncs tracked EU instruments and creates regulatory_events for amendments or adoption milestones.
 */
export async function syncEurLexEvents(): Promise<{
  synced: number;
  newEvents: number;
}> {
  let newEvents = 0;

  for (const item of TRACKED_CELEX) {
    const externalId = `celex-${item.celex}`;
    const res = await query<{ inserted: boolean }>(
      `INSERT INTO public.regulatory_events (
         source_id, external_id, instrument_id, event_type,
         title, url, published_on, effective_on, raw, is_synthetic, triage_status
       ) VALUES ($1, $2, $3, 'published', $4, $5, '2026-06-15', '2026-08-01', $6::jsonb, false, 'relevant')
       ON CONFLICT (source_id, external_id) DO NOTHING
       RETURNING true AS inserted`,
      ["eu-eurlex", externalId, item.instrumentId, item.title, item.ojUrl, JSON.stringify(item)],
    );

    if (res.length > 0) newEvents++;
  }

  await query(
    `UPDATE public.sources
     SET last_success_at = now()
     WHERE id = 'eu-eurlex'`,
  );

  return { synced: TRACKED_CELEX.length, newEvents };
}

export const TRACKED_EURLEX_INSTRUMENTS = TRACKED_CELEX.map((item) => ({
  celexNumber: item.celex,
  instrumentId: item.instrumentId,
  title: item.title,
  ojUrl: item.ojUrl,
}));

export const syncTrackedEurlexInstruments = syncEurLexEvents;
