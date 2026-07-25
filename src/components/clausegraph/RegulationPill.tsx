import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { regulationsQuery } from "@/data/queries";

export function RegulationPill({ regId }: { regId: string }) {
  const { data: regs } = useQuery(regulationsQuery);
  const reg = regs?.find((r) => r.id === regId);
  const title = reg?.title ?? regId;
  return (
    <Link
      to="/regulations/$regId"
      params={{ regId }}
      className="group inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[color-mix(in_oklab,var(--brass)_6%,transparent)] px-2.5 py-1 text-[11.5px] transition-all duration-200 ease-out hover:border-[var(--brass)] hover:bg-[color-mix(in_oklab,var(--brass)_12%,transparent)]"
    >
      <span className="font-mono text-[10px] text-[var(--brass)]">{regId}</span>
      <span className="h-3 w-px bg-[var(--hairline-strong)]" />
      <span className="text-foreground/90 group-hover:text-foreground">{title}</span>
    </Link>
  );
}
