import { createFileRoute } from "@tanstack/react-router";
import { checkDbHealth } from "@/lib/db.server";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const start = Date.now();
        const dbHealth = await checkDbHealth();
        return Response.json({
          ok: dbHealth.ok,
          db_connected: dbHealth.ok,
          db_ms: dbHealth.latencyMs,
          engine: "PostgreSQL 16+",
          uptime_ms: Date.now() - start,
          ts: new Date().toISOString(),
        });
      },
    },
  },
});
