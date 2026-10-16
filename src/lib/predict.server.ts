import type { Amendment, HypotheticalAmendment, ProbabilityBand } from "./predict.functions";

const MS_PER_DAY = 86_400_000;

export function daysBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY;
}

export function daysSince(date: string, now = Date.now()): number {
  return (now - new Date(date).getTime()) / MS_PER_DAY;
}

export function bandFor(p: number): ProbabilityBand {
  if (p >= 0.7) return "high";
  if (p >= 0.4) return "medium";
  return "low";
}

export function windowFor(
  avgIntervalDays: number | null,
  daysSinceLast: number | null,
): 3 | 6 | 12 | 18 {
  if (!avgIntervalDays || daysSinceLast === null) return 18;
  const remainingDays = Math.max(0, avgIntervalDays - daysSinceLast);
  const remainingMonths = remainingDays / 30;
  if (remainingMonths <= 3) return 3;
  if (remainingMonths <= 6) return 6;
  if (remainingMonths <= 12) return 12;
  return 18;
}

export function fallbackHypothetical(
  regulationId: string,
  title: string,
  history: Amendment[],
): HypotheticalAmendment {
  const patterns = history.slice(0, 3).map((h) => `${h.amended_on}: ${h.summary}`);
  return {
    regulation_id: regulationId,
    amendment_text: `PROPOSED AMENDMENT TO ${title}. Building on the historical trajectory of this instrument, obligations are further tightened: notification, disclosure and remediation windows are shortened by approximately one third, and the personal-scope of covered entities is expanded to include material affiliates and processors. Enforcement authorities may impose enhanced monetary penalties for repeated non-conformity. This adversarial what-if scenario is generated from public amendment history and is not an actual proposal.`,
    rationale:
      "Fallback narrative composed from the regulation's historical amendment pattern. Live model call was unavailable, so this scenario is inferred deterministically rather than generated per-request.",
    based_on_patterns: patterns,
    fallback: true,
  };
}
