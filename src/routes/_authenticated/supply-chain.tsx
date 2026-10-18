import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/supply-chain")({
  beforeLoad: () => {
    throw redirect({
      to: "/simulate",
      search: { tab: "supply-chain" },
    });
  },
  component: () => null,
});
