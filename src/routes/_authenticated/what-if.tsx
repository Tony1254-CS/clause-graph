import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/what-if")({
  beforeLoad: () => {
    throw redirect({
      to: "/simulate",
      search: { tab: "what-if" },
    });
  },
  component: () => null,
});
