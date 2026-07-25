import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const start = Date.now();
        let dbMs: number | null = null;
        try {
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const t0 = Date.now();
            const res = await fetch(`${url}/rest/v1/regulations?select=id&limit=1`, {
              headers: { apikey: key, Authorization: `Bearer ${key}` },
            });
            if (res.ok) dbMs = Date.now() - t0;
          }
        } catch {
          dbMs = null;
        }
        return Response.json({
          ok: true,
          db_ms: dbMs,
          uptime_ms: Date.now() - start,
          ts: new Date().toISOString(),
        });
      },
    },
  },
});
