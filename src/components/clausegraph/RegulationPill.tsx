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
      className="group inline-flex items-center gap-2 rounded-full border border-brass/40 px-2.5 py-1 text-[11.5px] transition-all duration-150 ease-out hover:border-brass hover:bg-[rgba(201,166,107,0.08)]"
    >
      <span className="font-mono text-[10px] text-brass">{regId}</span>
      <span className="h-3 w-px bg-brass/30" />
      <span className="text-foreground/90 group-hover:text-foreground">{title}</span>
    </Link>
  );
}
