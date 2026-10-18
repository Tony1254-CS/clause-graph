// ============================================================================
// Scorer: Review Queue Routing Accuracy: evals/scorers/routing.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.2, §4.6)
// ============================================================================

export interface RoutingCase {
  id: string;
  isTrulyBreachedOrWrong: boolean;
  wasRoutedToReviewQueue: boolean;
  wasHumanRejectedOrEdited?: boolean;
}

export interface RoutingScores {
  routingRecall: number;
  routingPrecision: number;
  totalWrongOrBreached: number;
  totalRouted: number;
  correctlyRouted: number;
}

export function scoreRouting(cases: RoutingCase[]): RoutingScores {
  let wrongOrBreachedCount = 0;
  let routedCount = 0;
  let correctlyRoutedCount = 0;
  let validReviewHits = 0;

  for (const c of cases) {
    if (c.isTrulyBreachedOrWrong) {
      wrongOrBreachedCount++;
      if (c.wasRoutedToReviewQueue) {
        correctlyRoutedCount++;
      }
    }

    if (c.wasRoutedToReviewQueue) {
      routedCount++;
      if (c.isTrulyBreachedOrWrong || c.wasHumanRejectedOrEdited) {
        validReviewHits++;
      }
    }
  }

  const routingRecall =
    wrongOrBreachedCount === 0 ? 1.0 : correctlyRoutedCount / wrongOrBreachedCount;

  const routingPrecision =
    routedCount === 0 ? 1.0 : validReviewHits / routedCount;

  return {
    routingRecall,
    routingPrecision,
    totalWrongOrBreached: wrongOrBreachedCount,
    totalRouted: routedCount,
    correctlyRouted: correctlyRoutedCount,
  };
}
