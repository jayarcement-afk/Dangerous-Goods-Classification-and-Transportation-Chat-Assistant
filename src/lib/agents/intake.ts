import { getOpenAI, CHAT_MODEL } from "@/lib/openai/client";
import { INTAKE_PROMPT } from "@/lib/agents/prompts";
import {
  buildConversationContext,
  defaultClarificationQuestions,
  detectHeuristicClarification,
  hasConcreteSubstanceIdentity,
  resolveIntent,
  resolveOutOfScope,
  type ChatTurn,
  type IntakeIntent,
} from "@/lib/agents/intake-rules";
import { isExampleStarterPrompt } from "@/lib/constants";

export type IntakeResult = {
  intent: IntakeIntent;
  needsClarification: boolean;
  clarifyingQuestions: string[];
  isPromptInjection: boolean;
  isOutOfScope: boolean;
};

export async function runIntakeAssessment(
  message: string,
  options?: { history?: ChatTurn[]; fullContext?: string },
): Promise<IntakeResult & { allClarifyingQuestions: string[]; fullContext: string }> {
  const fullContext =
    options?.fullContext ?? buildConversationContext(message, options?.history);

  const heuristicQuestions = detectHeuristicClarification(
    message,
    "classify_item",
    fullContext,
  );

  if (
    isExampleStarterPrompt(message) &&
    !hasConcreteSubstanceIdentity(message) &&
    heuristicQuestions.length > 0
  ) {
    return {
      intent: "classify_item",
      needsClarification: true,
      clarifyingQuestions: heuristicQuestions,
      isPromptInjection: false,
      isOutOfScope: false,
      allClarifyingQuestions: heuristicQuestions,
      fullContext,
    };
  }

  const llmIntake = await runIntakeAgent(fullContext);
  const intent = resolveIntent(llmIntake.intent, message, fullContext);
  const isOutOfScope = resolveOutOfScope(llmIntake.isOutOfScope, message, fullContext);

  const allHeuristic = detectHeuristicClarification(message, intent, fullContext);
  const merged =
    allHeuristic.length > 0 && isExampleStarterPrompt(message)
      ? allHeuristic
      : [...new Set([...llmIntake.clarifyingQuestions, ...allHeuristic].filter(Boolean))];

  const needsClarification = llmIntake.needsClarification || allHeuristic.length > 0;

  const allClarifyingQuestions =
    merged.length > 0 ? merged : needsClarification ? defaultClarificationQuestions(intent) : [];

  return {
    ...llmIntake,
    intent,
    isOutOfScope,
    needsClarification,
    clarifyingQuestions: llmIntake.clarifyingQuestions,
    allClarifyingQuestions,
    fullContext,
  };
}

async function runIntakeAgent(fullContext: string): Promise<IntakeResult> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: INTAKE_PROMPT },
      { role: "user", content: fullContext },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as IntakeResult;
    return {
      intent: (parsed.intent ?? "lookup_rule") as IntakeIntent,
      needsClarification: Boolean(parsed.needsClarification),
      clarifyingQuestions: parsed.clarifyingQuestions ?? [],
      isPromptInjection: Boolean(parsed.isPromptInjection),
      isOutOfScope: Boolean(parsed.isOutOfScope),
    };
  } catch {
    return {
      intent: "lookup_rule",
      needsClarification: false,
      clarifyingQuestions: [],
      isPromptInjection: false,
      isOutOfScope: false,
    };
  }
}
