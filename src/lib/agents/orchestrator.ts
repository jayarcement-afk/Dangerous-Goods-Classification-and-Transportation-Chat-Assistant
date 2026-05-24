import { getOpenAI, CHAT_MODEL } from "@/lib/openai/client";
import { runIntakeAssessment, type IntakeResult } from "@/lib/agents/intake";
import type { ChatTurn } from "@/lib/agents/intake-rules";
import { buildConversationContext } from "@/lib/agents/intake-rules";
import {
  buildEvidenceContext,
  buildSubstanceResponseAddendum,
  PROMPT_VERSION,
  RESPONSE_PROMPT,
  SYSTEM_GUARDRAILS,
} from "@/lib/agents/prompts";
import {
  appendSubstanceToContext,
  buildSubstanceContextBlock,
  resolveClarifyingQuestions,
  runSubstanceProfileAssessment,
  shouldBlockForClarification,
  type SubstanceProfile,
} from "@/lib/agents/substance-profile";
import {
  chunksToCitations,
  hasSufficientEvidence,
  loadDocumentTitles,
  retrieveWithFallback,
} from "@/lib/retrieval/search";
import { extractUnNumbersFromMessage } from "@/lib/agents/un-entries";
import type { ChatResponse } from "@/lib/types/citations";

export async function runChatOrchestrator(
  message: string,
  options?: { history?: ChatTurn[] },
): Promise<ChatResponse> {
  const modelVersion = CHAT_MODEL;
  const fullContext = buildConversationContext(message, options?.history);

  const [intake, substanceProfile] = await Promise.all([
    runIntakeAssessment(message, { history: options?.history, fullContext }),
    runSubstanceProfileAssessment(message, { history: options?.history, fullContext }),
  ]);

  const enrichedContext = appendSubstanceToContext(fullContext, substanceProfile);
  const allClarifyingQuestions = resolveClarifyingQuestions(
    intake.allClarifyingQuestions,
    substanceProfile,
  );

  if (intake.isPromptInjection) {
    return refusal(
      "I cannot change citation requirements or bypass source grounding. Ask a question about dangerous goods using the UN Orange Book.",
      intake,
      modelVersion,
    );
  }

  if (intake.isOutOfScope) {
    return refusal(
      "This question is outside the loaded UN Orange Book corpus (v1 covers Model Regulations Vol I & II only). I cannot answer from other regulations or unpublished sources.",
      intake,
      modelVersion,
    );
  }

  if (
    shouldBlockForClarification(intake.intent, substanceProfile, allClarifyingQuestions, {
      message,
      fullContext,
    })
  ) {
    return clarification(intake, modelVersion, {
      allClarifyingQuestions,
      substanceProfile,
    });
  }

  const chunks = await retrieveWithFallback(message, enrichedContext, substanceProfile);
  const messageUnNumbers = extractUnNumbersFromMessage(message);
  const profileUnNumbers = substanceProfile.identifiers.unNumbers;
  const lookupUns = [...new Set([...messageUnNumbers, ...profileUnNumbers])];

  const isTopicLookup =
    intake.intent === "lookup_rule" ||
    intake.intent === "show_source_sections" ||
    intake.intent === "explain_requirement";

  if (!hasSufficientEvidence(chunks, intake.intent, { unNumbers: lookupUns })) {
    if (allClarifyingQuestions.length > 0) {
      return clarification(intake, modelVersion, {
        allClarifyingQuestions,
        substanceProfile,
        limitations: isTopicLookup
          ? "I could not find strong enough cited passages for that topic yet. The details below may help narrow the search."
          : "I could not find strong enough cited passages yet. The details below will help me locate applicable Orange Book sections.",
      });
    }
    const allowBestEffort = isTopicLookup && chunks.length > 0;
    if (!allowBestEffort) {
      return refusal(
        isTopicLookup
          ? "I could not find sufficiently relevant passages in the loaded UN Orange Book volumes for that topic. Try naming a UN number, chapter, or a more specific requirement (e.g. packing, marking, or classification criteria)."
          : "I do not have enough cited support in the approved UN Orange Book sources to answer this question. Try rephrasing, narrowing the topic, or providing more substance details.",
        intake,
        modelVersion,
      );
    }
  }

  const docTitles = await loadDocumentTitles(chunks.map((c) => c.document_id));
  const citations = chunksToCitations(chunks, docTitles);

  const numbered = chunks.map((c, i) => ({
    index: i + 1,
    content: c.content,
    chapter: c.chapter,
    section: c.section,
    page: c.page_reference,
  }));

  const evidenceBlock = buildEvidenceContext(numbered);
  const substanceBlock = buildSubstanceContextBlock(substanceProfile);
  let answer = await runResponseAgent(message, enrichedContext, evidenceBlock, substanceBlock);

  if (!answer || !/\[\d+\]/.test(answer)) {
    const tableCAnswer = buildTableCCitedAnswer(substanceProfile, numbered, lookupUns);
    if (tableCAnswer) {
      answer = tableCAnswer;
    }
  }

  if (!answer || !/\[\d+\]/.test(answer)) {
    if (allClarifyingQuestions.length > 0) {
      return clarification(intake, modelVersion, {
        allClarifyingQuestions,
        substanceProfile,
        limitations:
          "Retrieved sources were not sufficient for a cited answer. Please provide the additional details below.",
      });
    }
    return refusal(
      "I could not produce a sufficiently cited answer from the retrieved sources. Please refine your question or consult a qualified dangerous goods expert.",
      intake,
      modelVersion,
    );
  }

  return {
    status: "answer",
    answer,
    citations,
    limitations:
      "This response is informational only and must be verified by qualified professionals before operational or regulatory use.",
    modelVersion,
    promptVersion: PROMPT_VERSION,
    intent: intake.intent,
    substanceProfile: substanceProfile.applicable
      ? summarizeProfile(substanceProfile)
      : undefined,
  };
}

function clarification(
  intake: IntakeResult,
  modelVersion: string,
  extra?: {
    limitations?: string;
    allClarifyingQuestions?: string[];
    substanceProfile?: SubstanceProfile;
  },
): ChatResponse {
  const questions = extra?.allClarifyingQuestions ?? [];
  const profile = extra?.substanceProfile;
  let limitations =
    extra?.limitations ??
    "Additional details are needed before a source-backed answer can be provided. Please answer the questions below.";

  if (profile?.applicable && profile.confirmationNotice) {
    limitations = `${profile.confirmationNotice}\n\n${limitations}`;
  }
  if (profile?.applicable && profile.ambiguities.length > 0) {
    limitations = `Possible variants: ${profile.ambiguities.join("; ")}\n\n${limitations}`;
  }

  return {
    status: "clarification",
    clarifyingQuestions: questions,
    limitations,
    modelVersion,
    promptVersion: PROMPT_VERSION,
    intent: intake.intent,
    substanceProfile: profile?.applicable ? summarizeProfile(profile) : undefined,
  };
}

function summarizeProfile(profile: SubstanceProfile): ChatResponse["substanceProfile"] {
  return {
    label: profile.label,
    status: profile.status,
    assumptions: profile.workingAssumptions.map((a) => `${a.field}: ${a.value}`),
    confirmationNotice: profile.confirmationNotice,
  };
}

function refusal(reason: string, intake: IntakeResult, modelVersion: string): ChatResponse {
  return {
    status: "refusal",
    refusalReason: reason,
    modelVersion,
    promptVersion: PROMPT_VERSION,
    intent: intake.intent,
  };
}

function buildTableCCitedAnswer(
  profile: SubstanceProfile,
  numbered: { index: number; content: string; chapter: string | null; section: string | null; page: string | null }[],
  lookupUns: string[],
): string | null {
  if (!profile.applicable || profile.identifiers.unNumbers.length === 0) return null;

  const un = lookupUns[0] ?? profile.identifiers.unNumbers[0];
  const psn = profile.identifiers.properShippingNames[0];
  if (!un || !psn) return null;

  const citeIndex =
    numbered.find((c) => c.section === un || new RegExp(`\\b${un}\\b`).test(c.content))?.index ?? 1;

  const hazardClass =
    profile.workingAssumptions.find((a) => /hazard class|^class$/i.test(a.field))?.value ??
    profile.workingAssumptions.find((a) => /class/i.test(a.field))?.value ??
    "";
  const packingGroup = profile.workingAssumptions.find((a) => /packing group/i.test(a.field))?.value;
  const classificationCode = profile.workingAssumptions.find((a) =>
    /classification code/i.test(a.field),
  )?.value;

  const lines = [
    "**Working from:**",
    `- UN number: UN ${un} [${citeIndex}]`,
    `- Proper shipping name: ${psn} [${citeIndex}]`,
  ];
  if (hazardClass) lines.push(`- Hazard class: ${hazardClass} [${citeIndex}]`);
  if (packingGroup) lines.push(`- Packing group: ${packingGroup} [${citeIndex}]`);
  if (classificationCode) lines.push(`- Classification code: ${classificationCode} [${citeIndex}]`);

  lines.push(
    "",
    `Per ADN Table C (dangerous goods list), UN ${un} is assigned the proper shipping name **${psn}** [${citeIndex}].`,
  );

  if (/\bpacking\s+group|\bpg\b/i.test(profile.retrievalHints + hazardClass)) {
    lines.push(
      `Packing group and packaging rules for this entry are in the Orange Book provisions cited above [${citeIndex}]. Reply in chat with concentration or physical state if you need packing group assignment for a specific formulation.`,
    );
  }

  lines.push("", "Reply in chat to correct any detail.");
  lines.push(
    "",
    "**Limitations:** This summary is from the indexed Table C dangerous goods list row. Confirm packaging, quantity limits, and transport mode requirements against the full Model Regulations before use.",
  );

  const hasCitableRow = numbered.some(
    (c) => c.section === un || new RegExp(`\\b${un}\\b`).test(c.content),
  );
  if (!hasCitableRow) return null;

  return lines.join("\n");
}

async function runResponseAgent(
  message: string,
  context: string,
  evidenceBlock: string,
  substanceBlock: string,
): Promise<string> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: `${SYSTEM_GUARDRAILS}\n\n${RESPONSE_PROMPT}` },
      {
        role: "user",
        content: `Sources:\n${evidenceBlock}${buildSubstanceResponseAddendum(substanceBlock)}\n\n${context}`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}
