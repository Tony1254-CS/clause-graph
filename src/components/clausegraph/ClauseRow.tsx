import type { Clause } from "@/data/types";
import { RegulationPill } from "./RegulationPill";

export function ClauseRow({ clause }: { clause: Clause }) {
  return (
    <div className="glass-panel-sm p-5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {clause.id}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {clause.linked_regs.length} citation{clause.linked_regs.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-3 text-[14.5px] leading-[1.65] text-foreground/90 max-w-[68ch]">
        {clause.text}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {clause.linked_regs.map((regId) => (
          <RegulationPill key={regId} regId={regId} />
        ))}
      </div>
    </div>
  );
}
