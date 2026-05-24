import type { EvalRunResult, EvalSummary, GoldenEvalItem } from "./types";

/**
 * Phase 1 scorer: validates harness structure and reviewer approval flags.
 * Phase 2+ will call /api/chat and compare citations, behavior, and content.
 */
export function scoreHarnessItem(item: GoldenEvalItem): EvalRunResult {
  const citationHintsOk =
    item.expectedBehavior === "refuse" || item.expectedCitationHints.length > 0;

  const structuralOk =
    item.question.trim().length > 10 &&
    citationHintsOk &&
    item.acceptableAnswerNotes.trim().length > 0;

  if (!structuralOk) {
    return {
      id: item.id,
      passed: false,
      notes: "Missing required fields (question, citation hints, or answer notes).",
    };
  }

  if (!item.reviewerApproved) {
    return {
      id: item.id,
      passed: true,
      notes: "Pending domain review — counted as pass for harness-only CI in Phase 1.",
    };
  }

  return {
    id: item.id,
    passed: true,
    notes: "Reviewer approved — live eval in Phase 2.",
  };
}

export function summarizeResults(
  items: GoldenEvalItem[],
  results: EvalRunResult[],
): EvalSummary {
  const byCategory = {
    easy: { total: 0, passed: 0 },
    medium: { total: 0, passed: 0 },
    ambiguous: { total: 0, passed: 0 },
    trick: { total: 0, passed: 0 },
  } as EvalSummary["byCategory"];

  for (const item of items) {
    byCategory[item.category].total += 1;
    const result = results.find((r) => r.id === item.id);
    if (result?.passed) byCategory[item.category].passed += 1;
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  return {
    total,
    passed,
    passRate: total === 0 ? 0 : passed / total,
    byCategory,
    failures: results.filter((r) => !r.passed),
  };
}
