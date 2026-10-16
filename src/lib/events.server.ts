import { query, queryOne } from "./db.server";

export interface RegulatoryEventRow {
  id: string;
  instrument_id: string | null;
  source_id: string;
  external_id: string | null;
  event_type:
    | "proposed"
    | "published"
    | "adopted"
    | "amended"
    | "repealed"
    | "effective"
    | "guidance"
    | "enforcement";
  title: string;
  url: string;
  published_on: string | null;
  effective_on: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: Record<string, any>;
  content_sha256: string | null;
  is_synthetic: boolean;
  verification: "verified" | "unverified" | "disputed";
  triage_status: "new" | "relevant" | "not_relevant" | "duplicate";
  created_at: string;
  instrument_short_name: string | null;
  instrument_full_name: string | null;
  instrument_jurisdiction: string | null;
  source_name: string | null;
  source_jurisdiction: string | null;
  provisions_count: number;
}

export interface GetEventsFilters {
  jurisdiction?: string;
  sourceId?: string;
  eventType?: string;
  verification?: string;
  triageStatus?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getRegulatoryEvents(
  filters: GetEventsFilters = {},
): Promise<RegulatoryEventRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters.jurisdiction && filters.jurisdiction !== "all") {
    conditions.push(`(s.jurisdiction = $${paramIdx} OR li.jurisdiction = $${paramIdx})`);
    params.push(filters.jurisdiction.toUpperCase());
    paramIdx++;
  }

  if (filters.sourceId && filters.sourceId !== "all") {
    conditions.push(`e.source_id = $${paramIdx}`);
    params.push(filters.sourceId);
    paramIdx++;
  }

  if (filters.eventType && filters.eventType !== "all") {
    conditions.push(`e.event_type = $${paramIdx}`);
    params.push(filters.eventType);
    paramIdx++;
  }

  if (filters.verification && filters.verification !== "all") {
    conditions.push(`e.verification = $${paramIdx}`);
    params.push(filters.verification);
    paramIdx++;
  }

  if (filters.triageStatus && filters.triageStatus !== "all") {
    conditions.push(`e.triage_status = $${paramIdx}`);
    params.push(filters.triageStatus);
    paramIdx++;
  }

  if (filters.search && filters.search.trim()) {
    conditions.push(
      `(e.title ILIKE $${paramIdx} OR COALESCE(li.short_name, '') ILIKE $${paramIdx} OR COALESCE(li.full_name, '') ILIKE $${paramIdx})`,
    );
    params.push(`%${filters.search.trim()}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(filters.limit ?? 100, 200);
  const offset = filters.offset ?? 0;

  params.push(limit);
  const limitIdx = paramIdx++;
  params.push(offset);
  const offsetIdx = paramIdx++;

  const sql = `
    SELECT 
      e.id,
      e.instrument_id,
      e.source_id,
      e.external_id,
      e.event_type,
      e.title,
      e.url,
      e.published_on::text,
      e.effective_on::text,
      e.raw,
      e.content_sha256,
      e.is_synthetic,
      e.verification,
      e.triage_status,
      e.created_at::text,
      li.short_name AS instrument_short_name,
      li.full_name AS instrument_full_name,
      li.jurisdiction AS instrument_jurisdiction,
      s.name AS source_name,
      s.jurisdiction AS source_jurisdiction,
      COALESCE((
        SELECT count(*)::int 
        FROM public.provisions p 
        WHERE p.instrument_id = e.instrument_id
      ), 0) AS provisions_count
    FROM public.regulatory_events e
    LEFT JOIN public.legal_instruments li ON li.id = e.instrument_id
    LEFT JOIN public.sources s ON s.id = e.source_id
    ${whereClause}
    ORDER BY COALESCE(e.published_on, e.created_at::date) DESC, e.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  return query<RegulatoryEventRow>(sql, params);
}

export async function updateEventTriageStatus(
  eventId: string,
  triageStatus: "new" | "relevant" | "not_relevant" | "duplicate",
  userId?: string,
  orgId?: string,
): Promise<RegulatoryEventRow | null> {
  const updated = await queryOne<RegulatoryEventRow>(
    `UPDATE public.regulatory_events 
     SET triage_status = $1 
     WHERE id = $2
     RETURNING *`,
    [triageStatus, eventId],
  );

  if (orgId) {
    try {
      await query(
        `INSERT INTO public.audit_log (org_id, actor_id, action, target_type, target_id, details)
         VALUES ($1, $2, 'event.triage', 'regulatory_event', $3, $4::jsonb)`,
        [orgId, userId ?? null, eventId, JSON.stringify({ triage_status: triageStatus })],
      );
    } catch (auditErr) {
      console.warn("[events.server] audit log write failed (continuing)", auditErr);
    }
  }

  return updated;
}
