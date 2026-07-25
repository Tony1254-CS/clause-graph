import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/clausegraph/AppShell";

export const Route = createFileRoute("/contracts")({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
