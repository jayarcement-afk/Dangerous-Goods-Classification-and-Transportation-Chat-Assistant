import {
  isExampleStarterPrompt,
  SUBSTANCE_IDENTITY_CLARIFICATION,
} from "@/lib/constants";
import { hasConcreteSubstanceIdentity } from "@/lib/agents/intake-rules";
import type { ChatResponse } from "@/lib/types/citations";
import { PROMPT_VERSION } from "@/lib/agents/prompts";

/** Example UI prompts that need a substance before any API-backed lookup. */
export function buildStarterPromptClarification(message: string): ChatResponse | null {
  if (!isExampleStarterPrompt(message)) return null;
  if (hasConcreteSubstanceIdentity(message)) return null;

  return {
    status: "clarification",
    clarifyingQuestions: [SUBSTANCE_IDENTITY_CLARIFICATION],
    limitations:
      "Additional details are needed before a source-backed answer can be provided. Please answer the questions below.",
    modelVersion: "starter-prompt",
    promptVersion: PROMPT_VERSION,
    intent: "classify_item",
  };
}
