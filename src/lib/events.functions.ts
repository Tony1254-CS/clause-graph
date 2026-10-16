import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";

export const getRegulatoryEventsFn = createServerFn({ method: "GET" })
  .validator(
    (input?: {
      jurisdiction?: string;
      sourceId?: string;
      eventType?: string;
      verification?: string;
      triageStatus?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }) => input ?? {},
  )
  .handler(async ({ data }) => {
    const { getRegulatoryEvents } = await import("./events.server");
    return getRegulatoryEvents(data);
  });

export const updateEventTriageStatusFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (input: {
      eventId: string;
      triageStatus: "new" | "relevant" | "not_relevant" | "duplicate";
    }) => {
      if (!input?.eventId) throw new Error("Event ID required");
      const allowed = ["new", "relevant", "not_relevant", "duplicate"];
      if (!allowed.includes(input.triageStatus)) throw new Error("Invalid triage status");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { updateEventTriageStatus } = await import("./events.server");
    return updateEventTriageStatus(data.eventId, data.triageStatus, context.userId, context.orgId);
  });

export const triggerIngestionSyncFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (input?: { source?: "federal-register" | "ecfr" | "eurlex" | "bd-curated" | "all" }) => {
      return input?.source ?? "all";
    },
  )
  .handler(async ({ data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Record<string, any> = {};
    if (data === "federal-register" || data === "all") {
      try {
        const { syncFederalRegisterFeed } = await import("./sources/federal-register.server");
        results["federal-register"] = await syncFederalRegisterFeed();
      } catch (e) {
        results["federal-register"] = { error: e instanceof Error ? e.message : String(e) };
      }
    }
    if (data === "ecfr" || data === "all") {
      try {
        const { syncTrackedEcfrSections } = await import("./sources/ecfr.server");
        results["ecfr"] = await syncTrackedEcfrSections();
      } catch (e) {
        results["ecfr"] = { error: e instanceof Error ? e.message : String(e) };
      }
    }
    if (data === "eurlex" || data === "all") {
      try {
        const { syncTrackedEurlexInstruments } = await import("./sources/eurlex.server");
        results["eurlex"] = await syncTrackedEurlexInstruments();
      } catch (e) {
        results["eurlex"] = { error: e instanceof Error ? e.message : String(e) };
      }
    }
    if (data === "bd-curated" || data === "all") {
      try {
        const { syncBangladeshCuratedSources } = await import("./sources/bd-curated.server");
        results["bd-curated"] = await syncBangladeshCuratedSources();
      } catch (e) {
        results["bd-curated"] = { error: e instanceof Error ? e.message : String(e) };
      }
    }
    return results;
  });
