# Evaluation harness

Phase 1 ships the **golden question set** and a structural test runner. Live RAG evaluation begins in Phase 2.

## Golden set

- **50 questions** in `golden-set.ts`
- Categories: easy (15), medium (20), ambiguous (10), trick (5)
- Each item defines:
  - `expectedBehavior`: `answer` | `ask_for_more_info` | `refuse`
  - `expectedCitationHints`: section hints for domain reviewer (refine after ingestion)
  - `reviewerApproved`: set `true` after domain sign-off

## Run locally

```bash
npm run eval
npm run eval:ci   # for CI — fails on structural errors
```

## Domain reviewer checklist

1. Ingest Orange Book Vol I & II (Phase 2).
2. Update `expectedCitationHints` with real chapter/section/page references.
3. Set `reviewerApproved: true` on validated items.
4. Add `acceptableAnswerNotes` for edge cases discovered in review.

## Phase 2+ scoring

The harness will call `/api/chat` and assert:

- Citation coverage on substantive answers
- Correct behavior vs `expectedBehavior`
- Retrieval relevance (manual review queue for failures)

Target for stakeholder demo: **≥85% pass rate** on reviewer-approved items.
