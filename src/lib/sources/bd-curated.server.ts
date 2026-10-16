// src/lib/sources/bd-curated.server.ts
// Curated authoritative adapter for Bangladeshi legislation and gazette notifications (Phase 4 T4.5)

import { query } from "../db.server";

export interface BdCuratedEvent {
  externalId: string;
  instrumentId: string;
  sourceId: "bd-bdlaws" | "bd-bangladesh-bank";
  title: string;
  eventType: "published" | "adopted" | "repealed" | "effective";
  publishedOn: string;
  effectiveOn?: string | null;
  officialUrl: string;
  isVerified: boolean;
  notes: string;
}

export const CURATED_BD_EVENTS: BdCuratedEvent[] = [
  {
    externalId: "bd-cso-2025-promulgation",
    instrumentId: "bd-cyber-security-ordinance-2025",
    sourceId: "bd-bdlaws",
    title: "Cyber Security Ordinance 2025 (Ordinance No. 25 of 2025) Promulgated",
    eventType: "published",
    publishedOn: "2025-05-21",
    effectiveOn: "2025-05-21",
    officialUrl: "https://dpp.gov.bd/bgpress/index.php/document/extraordinary",
    isVerified: true,
    notes:
      "Promulgated by the President, published in the Bangladesh Gazette Extraordinary. Repeals Cyber Security Act 2023.",
  },
  {
    externalId: "bd-csa-2023-repeal",
    instrumentId: "bd-cyber-security-act-2023",
    sourceId: "bd-bdlaws",
    title: "Cyber Security Act 2023 Repealed by Ordinance No. 25 of 2025",
    eventType: "repealed",
    publishedOn: "2025-05-21",
    effectiveOn: "2025-05-21",
    officialUrl: "https://dpp.gov.bd/bgpress/index.php/document/extraordinary",
    isVerified: true,
    notes: "Repealed and replaced by Cyber Security Ordinance 2025.",
  },
  {
    externalId: "bd-pdpo-2025-council-approval",
    instrumentId: "bd-personal-data-protection-ordinance-2025",
    sourceId: "bd-bdlaws",
    title: "Draft Personal Data Protection Ordinance 2025 Approved by Council of Advisers",
    eventType: "adopted",
    publishedOn: "2025-10-09",
    effectiveOn: null,
    officialUrl: "https://cabinet.gov.bd",
    isVerified: false,
    notes:
      "Approved in principle by Interim Government Council of Advisers on 9 Oct 2025; gazette publication pending.",
  },
  {
    externalId: "bd-bb-psd-2023-circular",
    instrumentId: "bd-bangladesh-bank-dps-2023",
    sourceId: "bd-bangladesh-bank",
    title: "Bangladesh Bank PSD Circular: Security Guidelines for Digital Payment Infrastructure",
    eventType: "effective",
    publishedOn: "2023-04-12",
    effectiveOn: "2023-06-01",
    officialUrl: "https://www.bb.org.bd/en/index.php/about/rules",
    isVerified: true,
    notes: "Payment Systems Department circular mandating 2FA and 6-hour incident disclosure.",
  },
];

/**
 * Ingests curated Bangladeshi legal events with provenance and verification status.
 */
export async function syncBdCuratedEvents(): Promise<{
  totalSynced: number;
  newEvents: number;
}> {
  let newEvents = 0;

  for (const ev of CURATED_BD_EVENTS) {
    const res = await query<{ inserted: boolean }>(
      `INSERT INTO public.regulatory_events (
         source_id, external_id, instrument_id, event_type,
         title, url, published_on, effective_on, raw, is_synthetic, triage_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, false, 'relevant')
       ON CONFLICT (source_id, external_id) DO UPDATE
       SET title = EXCLUDED.title,
           effective_on = EXCLUDED.effective_on,
           raw = EXCLUDED.raw
       RETURNING true AS inserted`,
      [
        ev.sourceId,
        ev.externalId,
        ev.instrumentId,
        ev.eventType,
        ev.title,
        ev.officialUrl,
        ev.publishedOn,
        ev.effectiveOn || null,
        JSON.stringify(ev),
      ],
    );

    if (res.length > 0) newEvents++;
  }

  await query(
    `UPDATE public.sources
     SET last_success_at = now()
     WHERE id IN ('bd-bdlaws', 'bd-bangladesh-bank')`,
  );

  return { totalSynced: CURATED_BD_EVENTS.length, newEvents };
}

export const syncBangladeshCuratedSources = syncBdCuratedEvents;
