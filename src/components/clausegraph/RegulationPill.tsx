import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { regulationsQuery } from "@/data/queries";

export function RegulationPill({ regId }: { regId: string }) {
  const { data: regs } = useQuery(regulationsQuery);
  const reg = regs?.find((r) => r.id === regId);
  const title = reg?.title ?? regId;
  return (
    <Link
      to="/regulations/$regId"
      params={{ regId }}
      className="group inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[color-mix(in_oklab,var(--brass)_8%,transparent)] px-3 py-1 text-[11.5px] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brass)] hover:bg-[color-mix(in_oklab,var(--brass)_18%,transparent)] hover:shadow-[0_4px_16px_-4px_rgba(94,234,212,0.35)]"
    >
      <ShieldCheck className="h-3.5 w-3.5 text-[var(--brass)] opacity-80 transition-opacity group-hover:opacity-100" />
      <span className="font-mono text-[10px] font-semibold text-[var(--brass)]">{regId}</span>
      <span className="h-3 w-px bg-[var(--hairline-strong)] group-hover:bg-[var(--brass)]" />
      <span className="font-medium text-foreground/90 transition-colors group-hover:text-foreground">
        {title}
      </span>
    </Link>
  );
}
