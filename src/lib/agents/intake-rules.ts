import { extractChemicalNamesFromText } from "@/lib/agents/chemical-names";
import { extractUnNumbersFromText } from "@/lib/agents/un-entries";
import {
  isExampleStarterPrompt,
  SUBSTANCE_IDENTITY_CLARIFICATION,
} from "@/lib/constants";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type IntakeIntent =
  | "lookup_rule"
  | "classify_item"
  | "explain_requirement"
  | "show_source_sections"
  | "unsupported";

const VAGUE_PHRASES =
  /\b(this|that|these|it|my product|our product|the chemical|the material|something|a liquid|a gas|a solid)\b/i;

const COMMON_CHEMICAL_NAMES =
  /\b(gasoline|petrol|motor\s+spirit|diesel|fuel\s+oil|kerosene|ethanol|methanol|acetone|ammonia|chlorine|hydrogen|propane|butane|lpg|paint|varnish|adhesive|battery|lithium|cyclohexane)\b/i;

const HAS_SUBSTANCE_IDENTITY =
  /\b(un\s*\d{4}|proper shipping name|psn|cas\s*[\d-]+|trade name|product name|chemical name|composition|ingredient|contains?\s+\d|solution of|mixture of)\b/i;

/** Bare 4-digit number in the 1000–3600 UN range (common in follow-up messages) */
const BARE_UN_LIKE = /(?:^|[\s(,;])(\d{4})(?:[\s),.;:!?]|$)/;

/** User message is primarily a UN number lookup */
const UN_ONLY_OR_PRIMARY = /\b(?:what\s+is|tell\s+me\s+about|details?\s+(?:for|on)|properties?\s+(?:of|for)|info(?:rmation)?\s+(?:on|for))?\s*(?:UN\s*)?\d{4}\b/i;

const TRANSPORT_REQUIREMENTS_QUERY =
  /\b(transport|transportation|requirements?|provisions?|carriage|packaging|packing|marking|labeling|labelling|placard|documentation)\b/i;

const HAS_PHYSICAL_STATE =
  /\b(liquid|solid|gas|vapou?r|aerosol|powder|paste|gel|granule|flake)\b/i;

const HAS_HAZARD_HINT =
  /\b(flash point|boiling point|ph\b|corrosive|flammable|toxic|oxidiz|explosive|self[- ]?react|water[- ]?react|lithium|battery|radioactive|infectious|marine pollutant|hazard|class\s*\d|packing group|pg\s*(i|ii|iii)\b)/i;

const HAS_TRANSPORT_CONTEXT =
  /\b(ship|transport|road|rail|air|sea|vessel|aircraft|quantity|package|drum|barrel|jerrican|can|ibc|tank|excepted quantity|limited quantity|plastic)\b/i;

const SPECIFIC_LOOKUP =
  /\b(class\s*[1-9]|division\s*\d|packing group|un\s*\d{4}|chapter\s*\d|part\s*\d|lithium|battery|excepted quantit|limited quantit|placard|label|segregat|competent authority)\b/i;

/** Topics covered by the loaded UN Model Regulations corpus */
const ORANGE_BOOK_IN_SCOPE =
  /\b(orange book|model regulations?|un recommendations|dangerous goods|hazard class|class\s*[1-9]|division\s*\d|packing group|proper shipping name|un\s*\d{4}|excepted quantit|limited quantit|transport document|marking|label|placard|segregat|packaging|lithium|battery|radioactive|infectious|marine pollutant|competent authority|chapter\s*\d|part\s*\d)\b/i;

/** User wants a different regulation instead of (or only) the Orange Book */
const OTHER_REGULATION_ONLY =
  /\b((?:only|exclusively|under|per|according to)\s+(?:49\s*cfr|title\s*49|\bdot\b|iata\s+dgr|icao\s+technical instructions|imdg|adr)|(?:49\s*cfr|title\s*49|iata\s+dgr|imdg\s+code|adr\s+agreement)\s+(?:only|instead))\b/i;

const CERTIFICATION_REQUEST =
  /\b(certif(?:y|ication)\s+(?:that|this|my)|provide\s+(?:a\s+)?certification|legal\s+(?:advice|opinion)|confirm\s+(?:that\s+)?(?:it\s+is\s+)?compliant)\b/i;

export function buildConversationContext(message: string, history?: ChatTurn[]): string {
  const parts: string[] = [];
  if (history?.length) {
    const recent = history.slice(-8);
    parts.push(
      "Conversation:\n" +
        recent.map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`).join("\n"),
    );
  }
  parts.push(`Latest user message:\n${message}`);
  return parts.join("\n\n");
}

/** User-authored text only — excludes assistant messages that may list multiple UN numbers. */
export function extractUserMessagesFromContext(fullContext: string, message?: string): string {
  const parts: string[] = [];
  const conversationMatch = fullContext.match(
    /Conversation:\n([\s\S]*?)(?:\n\nLatest user message:|$)/,
  );
  if (conversationMatch) {
    for (const line of conversationMatch[1].split("\n")) {
      if (line.startsWith("User:")) parts.push(line.slice(5).trim());
    }
  }
  const latestMatch = fullContext.match(/Latest user message:\n([\s\S]*)$/);
  if (latestMatch) parts.push(latestMatch[1].trim());
  else if (message) parts.push(message.trim());
  return parts.join("\n");
}

export function extractUnNumbersFromUserContext(fullContext: string, message: string): string[] {
  return extractUnNumbersFromText(extractUserMessagesFromContext(fullContext, message));
}

export function hasNamedSubstance(text: string): boolean {
  return (
    HAS_SUBSTANCE_IDENTITY.test(text) ||
    COMMON_CHEMICAL_NAMES.test(text) ||
    extractChemicalNamesFromText(text).length > 0
  );
}

/** User provided an actual material identity (not only asking about PSN/UN in general). */
export function hasConcreteSubstanceIdentity(text: string): boolean {
  if (/\bUN\s*\d{4}\b/i.test(text)) return true;
  if (looksLikeBareUnNumber(text)) return true;
  if (extractChemicalNamesFromText(text).length > 0) return true;
  if (COMMON_CHEMICAL_NAMES.test(text)) return true;
  if (/\bcas\s*#?\s*[\d-]+/i.test(text)) return true;
  if (/\b(?:trade|product|brand)\s+name\s*[:=]\s*\S+/i.test(text)) return true;
  return false;
}

function looksLikeBareUnNumber(text: string): boolean {
  const m = BARE_UN_LIKE.exec(text);
  if (!m || !m[1]) return false;
  const n = parseInt(m[1], 10);
  if (n < 1000 || n > 3600) return false;
  if (n >= 1900 && n <= 2100 && text.trim().length > 20) return false;
  return true;
}

const CLASS_OR_PG_LOOKUP =
  /\b(?:what\s+(?:is|'s)\s+the\s+)?(?:(?:hazard\s+)?class|packing\s+group|pg|proper\s+shipping\s+name|un\s+number)\s+(?:for|of)\b/i;

export function detectHeuristicClarification(
  message: string,
  intent: IntakeIntent,
  fullContext: string,
): string[] {
  const questions: string[] = [];
  const rawText = `${fullContext}\n${message}`;
  const textLower = rawText.toLowerCase();

  if (
    isExampleStarterPrompt(message) &&
    !hasConcreteSubstanceIdentity(rawText)
  ) {
    return [SUBSTANCE_IDENTITY_CLARIFICATION];
  }

  const chemicals = extractChemicalNamesFromText(rawText);
  if (chemicals.length > 0) {
    return [];
  }

  if (CLASS_OR_PG_LOOKUP.test(message) && hasNamedSubstance(rawText)) {
    return [];
  }

  if (hasNamedSubstance(rawText) && TRANSPORT_REQUIREMENTS_QUERY.test(textLower)) {
    return [];
  }

  if (UN_ONLY_OR_PRIMARY.test(textLower) || /\bUN\s*\d{4}\b/i.test(message) || looksLikeBareUnNumber(message)) {
    return [];
  }

  if (intent === "lookup_rule" && hasNamedSubstance(rawText)) {
    return [];
  }

  if (intent === "classify_item" || intent === "explain_requirement") {
    if (!hasNamedSubstance(rawText)) {
      questions.push(
        "What is the substance or article (proper shipping name, UN number if known, or chemical identity/composition)?",
      );
    }
    if (!HAS_PHYSICAL_STATE.test(textLower)) {
      questions.push("What is the physical state (solid, liquid, gas, aerosol, etc.)?");
    }
    if (!HAS_HAZARD_HINT.test(textLower) && !COMMON_CHEMICAL_NAMES.test(textLower)) {
      questions.push(
        "What hazard properties or test data are known (e.g. flash point, pH, toxicity, corrosivity, lithium configuration)?",
      );
    }
    if (!HAS_TRANSPORT_CONTEXT.test(textLower)) {
      questions.push(
        "What is the intended transport context (mode, packaging type, and approximate quantity)?",
      );
    }
  }

  if (intent === "classify_item" && VAGUE_PHRASES.test(message) && !HAS_SUBSTANCE_IDENTITY.test(textLower)) {
    questions.push(
      "Can you provide specific identifiers (name, composition, or SDS details) instead of general terms like 'this product'?",
    );
  }

  if (message.trim().length < 35 && !SPECIFIC_LOOKUP.test(message)) {
    questions.push("Can you describe your question in more detail so I can locate the right Orange Book provisions?");
  }

  return [...new Set(questions)];
}

export function shouldPreferClarificationOverAnswer(
  intent: IntakeIntent,
  needsClarification: boolean,
  allQuestions: string[],
): boolean {
  if (!needsClarification || allQuestions.length === 0) return false;
  if (intent === "classify_item") return true;
  if (intent === "explain_requirement") return allQuestions.length >= 2;
  if (intent === "lookup_rule" || intent === "show_source_sections") {
    return allQuestions.length >= 2;
  }
  return true;
}

/**
 * Conservative out-of-scope: default to IN scope for dangerous-goods / Orange Book topics.
 * The LLM intake agent was over-flagging valid Model Regulations questions.
 */
export function resolveOutOfScope(
  llmSaysOutOfScope: boolean,
  message: string,
  fullContext: string,
): boolean {
  const text = `${fullContext}\n${message}`;

  if (ORANGE_BOOK_IN_SCOPE.test(text)) return false;

  if (OTHER_REGULATION_ONLY.test(text)) return true;
  if (CERTIFICATION_REQUEST.test(text)) return true;

  return llmSaysOutOfScope && OTHER_REGULATION_ONLY.test(message);
}

/** Map unsupported → lookup when the question is clearly about Orange Book content */
export function resolveIntent(llmIntent: IntakeIntent, message: string, fullContext: string): IntakeIntent {
  const text = `${fullContext}\n${message}`;
  if (llmIntent === "unsupported" && ORANGE_BOOK_IN_SCOPE.test(text)) {
    return SPECIFIC_LOOKUP.test(text) ? "show_source_sections" : "lookup_rule";
  }
  return llmIntent;
}

export function defaultClarificationQuestions(intent: IntakeIntent): string[] {
  if (intent === "classify_item") {
    return [
      "What is the substance or article identity and composition?",
      "What is the physical state and known hazard data (test results or SDS properties)?",
      "What packaging, quantity, and transport scenario apply?",
    ];
  }
  return [
    "What substance, scenario, or Orange Book topic should I focus on?",
    "What details are already known (physical state, hazard data, packaging, quantity)?",
  ];
}
