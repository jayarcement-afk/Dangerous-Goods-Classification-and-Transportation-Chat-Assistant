import { goldenEvalSet } from "./golden-set";
import { scoreHarnessItem, summarizeResults } from "./scorer";

const CI_MODE = process.argv.includes("--ci");
const MIN_ITEMS = 50;
const PHASE1_MIN_PASS_RATE = 1; // harness structural validation only

function main() {
  if (goldenEvalSet.length < MIN_ITEMS) {
    console.error(`Golden set has ${goldenEvalSet.length} items; expected at least ${MIN_ITEMS}.`);
    process.exit(1);
  }

  const results = goldenEvalSet.map(scoreHarnessItem);
  const summary = summarizeResults(goldenEvalSet, results);

  const pendingReview = goldenEvalSet.filter((i) => !i.reviewerApproved).length;

  console.log("DG Chat Assistant — Evaluation Harness (Phase 1)");
  console.log("─".repeat(50));
  console.log(`Items:      ${summary.total}`);
  console.log(`Passed:     ${summary.passed}`);
  console.log(`Pass rate:  ${(summary.passRate * 100).toFixed(1)}%`);
  console.log(`Pending domain review: ${pendingReview}`);
  console.log("");
  console.log("By category:");
  for (const [cat, stats] of Object.entries(summary.byCategory)) {
    console.log(`  ${cat.padEnd(10)} ${stats.passed}/${stats.total}`);
  }

  if (summary.failures.length > 0) {
    console.log("\nFailures:");
    for (const f of summary.failures) {
      console.log(`  [${f.id}] ${f.notes}`);
    }
  }

  if (CI_MODE && summary.passRate < PHASE1_MIN_PASS_RATE) {
    process.exit(1);
  }

  console.log("\nNote: Live RAG evaluation runs in Phase 2 after /api/chat is implemented.");
}

main();
