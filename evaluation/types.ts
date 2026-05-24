export type EvalCategory = "easy" | "medium" | "ambiguous" | "trick";

export type ExpectedBehavior = "answer" | "ask_for_more_info" | "refuse";

export type EvalIntent =
  | "lookup_rule"
  | "classify_item"
  | "explain_requirement"
  | "show_source_sections"
  | "unsupported";

export type GoldenEvalItem = {
  id: string;
  category: EvalCategory;
  intent: EvalIntent;
  question: string;
  expectedBehavior: ExpectedBehavior;
  /** Section/chapter hints for domain reviewer — refine after ingestion */
  expectedCitationHints: string[];
  acceptableAnswerNotes: string;
  /** Set false until domain reviewer validates */
  reviewerApproved: boolean;
};

export type EvalRunResult = {
  id: string;
  passed: boolean;
  actualBehavior?: ExpectedBehavior;
  notes: string;
};

export type EvalSummary = {
  total: number;
  passed: number;
  passRate: number;
  byCategory: Record<EvalCategory, { total: number; passed: number }>;
  failures: EvalRunResult[];
};
