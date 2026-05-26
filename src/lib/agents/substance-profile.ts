import { getOpenAI, CHAT_MODEL } from "@/lib/openai/client";
import type { ChatTurn, IntakeIntent } from "@/lib/agents/intake-rules";
import {
  buildConversationContext,
  extractUnNumbersFromUserContext,
  extractUserMessagesFromContext,
  hasConcreteSubstanceIdentity,
} from "@/lib/agents/intake-rules";
import { isExampleStarterPrompt } from "@/lib/constants";
import {
  extractUnNumbersFromMessage,
  getCuratedUnEntry,
  isInvalidPsnForUn,
  isPrimarilyUnNumberQuery,
  UN_ENTRY_LOOKUP,
  type UnEntryLookup,
} from "@/lib/agents/un-entries";
import {
  extractChemicalNamesFromText,
  isPrimarilyChemicalLookupQuery,
  pickPrimaryChemicalName,
} from "@/lib/agents/chemical-names";
import {
  isDangerousGoodsListIngested,
  lookupChemicalFromDangerousGoodsList,
  lookupUnFromDangerousGoodsList,
} from "@/lib/retrieval/dangerous-goods-list";
import { scoreChemicalMatch } from "@/lib/retrieval/table-c-parse";
import { retrieveChunks } from "@/lib/retrieval/search";
import { DOCUMENT_TYPE_ORANGE_BOOK } from "@/lib/constants";

export type SubstanceProfileStatus = "not_applicable" | "ambiguous" | "inferred" | "user_provided";

export type SubstanceAssumption = {
  field: string;
  value: string;
  confidence: "high" | "medium" | "low";
};

export type DisambiguationCandidate = {
  un: string;
  psn: string;
  hazardClass: string;
};

export type SubstanceProfile = {
  applicable: boolean;
  status: SubstanceProfileStatus;
  /** Short label for the substance or UN entry being discussed */
  label: string;
  identifiers: {
    unNumbers: string[];
    properShippingNames: string[];
    chemicalName?: string;
    casNumber?: string;
  };
  workingAssumptions: SubstanceAssumption[];
  ambiguities: string[];
  clarifyingQuestions: string[];
  /** Clickable options when multiple Table C matches exist */
  disambiguationCandidates?: DisambiguationCandidate[];
  /** Extra phrases to improve Orange Book vector search */
  retrievalHints: string;
  /** Shown to the user so they can correct details in chat */
  confirmationNotice: string;
  mustClarifyBeforeAnswer: boolean;
  userCorrectionsNoted: boolean;
};

const UN_NUMBER_PATTERN = /\bUN\s*0*\d{4}\b/i;

function messageHasUnNumber(text: string): boolean {
  if (UN_NUMBER_PATTERN.test(text)) return true;
  const bare = /(?:^|[\s(,;])(\d{4})(?:[\s),.;:!?]|$)/.exec(text);
  if (bare?.[1]) {
    const n = parseInt(bare[1], 10);
    if (n >= 1000 && n <= 3600) return true;
  }
  return false;
}

/** Well-known chemicals/products the user may name without a UN number */
export const COMMON_CHEMICAL_NAMES =
  /\b(gasoline|petrol|motor\s+spirit|diesel|fuel\s+oil|kerosene|aviation\s+kerosene|jet\s+fuel|ethanol|methanol|acetone|ammonia|chlorine|hydrogen|oxygen|nitrogen|propane|butane|lpg|paint|varnish|adhesive|resin|batteries|lithium|acid|caustic|bleach|peroxide)\b/i;

const SUBSTANCE_PROBE =
  /\b(un\s*\d{4}|proper\s+shipping\s+name|\bpsn\b|cas\s*#?\s*[\d-]+|trade\s+name|chemical\s+(?:name|identity)|composition|solution\s+of|mixture\s+of|article\s+name)\b/i;

const SUBSTANCE_PROFILE_PROMPT = `You are the Substance Identification Agent for a UN Orange Book (dangerous goods) assistant.
The user may name a chemical, product, or UN number. Use your general dangerous-goods knowledge ONLY to build a working profile that helps search the Orange Book and frame the conversation — NOT as a final regulatory determination.

Analyze the full conversation. The user may correct or override any assumption in later messages; apply corrections from the latest message first.

Return JSON only:
{
  "applicable": boolean,
  "status": "not_applicable" | "ambiguous" | "inferred" | "user_provided",
  "label": string,
  "identifiers": {
    "unNumbers": string[],
    "properShippingNames": string[],
    "chemicalName": string | null,
    "casNumber": string | null
  },
  "workingAssumptions": [{ "field": string, "value": string, "confidence": "high" | "medium" | "low" }],
  "ambiguities": string[],
  "clarifyingQuestions": string[],
  "retrievalHints": string,
  "confirmationNotice": string,
  "mustClarifyBeforeAnswer": boolean,
  "userCorrectionsNoted": boolean
}

Rules:
- applicable TRUE when the user mentions a UN number (e.g. UN 1203), chemical/substance/product name, composition, or asks to classify/identify a specific material.
- applicable FALSE for purely generic Orange Book topics with no specific material (e.g. "nine hazard classes", "excepted quantities definition").
- **UN number provided (priority):** Look up the UN entry and populate properShippingNames, chemicalName (if known), hazard class/division, typical packing group, physical state, and key hazard properties (flash point range, toxicity, corrosivity, etc.) in workingAssumptions. Set status "inferred" and mustClarifyBeforeAnswer FALSE when the UN maps to a single well-defined entry.
- For generic n.o.s. UN entries (e.g. UN 1993, UN 3082) with multiple possible substances: status "ambiguous", list ambiguities, ask only what is needed to identify the actual substance (technical name, concentration, flash point).
- Never ask "what is the UN number" or "what is the substance name" when the user already gave a UN number — resolve the name and properties yourself.
- status "user_provided" when the user has given definitive identity/state/hazard facts and no material ambiguity remains.
- status "inferred" when you can reasonably pre-fill details (e.g. gasoline → UN 1203 MOTOR SPIRIT, Class 3, PG II typical) for a common, well-defined entry — set mustClarifyBeforeAnswer FALSE.
- For transport/packaging requirement questions (road, drum, barrel, IBC, etc.) with a common named substance: infer UN/PSN/class/PG, include packaging type from the user's words, set clarifyingQuestions to [] and mustClarifyBeforeAnswer FALSE. Do NOT ask for UN number, flash point, quantity, or vehicle type you can reasonably assume — state assumptions in workingAssumptions and confirmationNotice instead.
- status "ambiguous" ONLY when the name/UN could match multiple distinct proper shipping names or packing groups AND the answer would change materially — set mustClarifyBeforeAnswer TRUE. Do NOT ask generic questions.
- For uncommon chemicals, mixtures without composition, or "n.o.s." / generic names, prefer ambiguous and ask 2–4 targeted questions (concentration, physical state, flash point, water content, battery chemistry, etc.).
- clarifyingQuestions: empty array when status is inferred. Never ask "what UN number" if you can infer it from a common name like gasoline.
- workingAssumptions: list only fields you are using as working facts; mark confidence low when uncertain.
- confirmationNotice: one short paragraph inviting the user to correct anything wrong via chat (e.g. "I'm working from: … Reply to correct any detail.").
- retrievalHints: space-separated Orange Book search terms (UN number, PSN, class, division, special provisions).
- userCorrectionsNoted TRUE if the latest user message corrects or refines earlier assumptions.
- If the user confirms your assumptions ("yes", "that's correct"), treat as user_provided where appropriate.`;

const UN_LOOKUP_PROMPT = `You are a UN dangerous goods list lookup assistant.
Given a UN number, return the correct proper shipping name(s) and hazard properties from the UN Model Regulations dangerous goods list.

Return JSON only:
{
  "label": string,
  "properShippingNames": string[],
  "chemicalName": string | null,
  "hazardClass": string,
  "division": string | null,
  "typicalPackingGroup": string | null,
  "physicalState": string,
  "hazardProperties": string[],
  "ambiguous": boolean,
  "ambiguityNote": string | null
}

Critical — do NOT confuse these entries:
- UN 1791 = HYPOCHLORITE SOLUTION (e.g. sodium hypochlorite / liquid bleach). NOT acetic acid.
- UN 3212 = HYPOCHLORITES, INORGANIC, N.O.S. (oxidizing). NOT hydrogen fluoride or hydrofluoric acid.
- UN 2789 = ACETIC ACID, GLACIAL. NOT hypochlorite or bleach.
- UN 1789 = HYDROCHLORIC ACID.
- UN 1052 = HYDROGEN FLUORIDE, ANHYDROUS. UN 1790 = HYDROFLUORIC ACID.

If the UN number is generic (n.o.s.) or has many possible substances, set ambiguous true and explain what the user must specify.
If you are not certain of the UN-to-PSN mapping, set ambiguous true rather than guessing.
Never assign a PSN from a different UN number (e.g. do not answer UN 3212 with hydrogen fluoride).`;

const UN_CORPUS_EXTRACT_PROMPT = `Extract dangerous goods list information for the requested UN number using ONLY the provided Orange Book excerpts.
The proper shipping name MUST appear in the excerpts together with or near that UN number.
If the excerpts do not clearly state the proper shipping name for that UN number, return {"found": false}.
Do NOT use outside knowledge. Do NOT assign a PSN from a different UN number.

Return JSON only:
{
  "found": boolean,
  "label": string,
  "properShippingNames": string[],
  "chemicalName": string | null,
  "hazardClass": string,
  "division": string | null,
  "typicalPackingGroup": string | null,
  "physicalState": string,
  "hazardProperties": string[],
  "ambiguous": boolean,
  "ambiguityNote": string | null
}`;

export function mentionsSubstanceOrUn(message: string, fullContext: string): boolean {
  const text = `${fullContext}\n${message}`;
  if (messageHasUnNumber(text)) return true;
  if (COMMON_CHEMICAL_NAMES.test(text)) return true;
  if (extractChemicalNamesFromText(text).length > 0) return true;
  return SUBSTANCE_PROBE.test(text);
}

export function emptySubstanceProfile(): SubstanceProfile {
  return {
    applicable: false,
    status: "not_applicable",
    label: "",
    identifiers: { unNumbers: [], properShippingNames: [] },
    workingAssumptions: [],
    ambiguities: [],
    clarifyingQuestions: [],
    retrievalHints: "",
    confirmationNotice: "",
    mustClarifyBeforeAnswer: false,
    userCorrectionsNoted: false,
  };
}

const DISAMBIGUATION_REPLY =
  /\b(pure\s+substance|pure\s+formulation|not\s+a\s+mixture|mixture|concentration|\d+\s*%|liquid|solid|gas|refrigerated|anhydrous|solution|aqueous)\b/i;

function isDisambiguationReply(message: string): boolean {
  return DISAMBIGUATION_REPLY.test(message);
}

export async function runSubstanceProfileAssessment(
  message: string,
  options?: { history?: ChatTurn[]; fullContext?: string },
): Promise<SubstanceProfile> {
  const fullContext = options?.fullContext ?? buildConversationContext(message, options?.history);

  if (!mentionsSubstanceOrUn(message, fullContext)) {
    return emptySubstanceProfile();
  }

  const userText = extractUserMessagesFromContext(fullContext, message);
  const userUnNumbers = extractUnNumbersFromUserContext(fullContext, message);
  const chemicals = extractChemicalNamesFromText(userText);
  const primaryChemical = pickPrimaryChemicalName(chemicals);

  const messageUnNumbers = extractUnNumbersFromMessage(message);
  if (messageUnNumbers.length === 1) {
    return resolveUnProfileFromAuthoritativeSources(messageUnNumbers[0]);
  }

  if (userUnNumbers.length === 1 && isPrimarilyUnNumberQuery(message, fullContext)) {
    return resolveUnProfileFromAuthoritativeSources(userUnNumbers[0]);
  }

  if (primaryChemical && userUnNumbers.length === 0) {
    if (isDisambiguationReply(message)) {
      const narrowed = await resolveChemicalProfileWithHints(primaryChemical, message);
      if (narrowed) return narrowed;
    }

    const messageIsSubstanceName =
      message.trim().replace(new RegExp(primaryChemical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").trim()
        .length < 30;

    const userAskedAboutSubstance =
      messageIsSubstanceName ||
      isPrimarilyChemicalLookupQuery(message, userText) ||
      /\b(classif|dangerous\s+good|hazard|contains?|has\s+[A-Z])/i.test(userText);

    if (userAskedAboutSubstance) {
      const fromChemical = await resolveChemicalProfileFromTableC(primaryChemical);
      if (fromChemical.applicable) return fromChemical;
    }
  }

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SUBSTANCE_PROFILE_PROMPT },
      { role: "user", content: fullContext },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as Partial<SubstanceProfile> & {
      identifiers?: Partial<SubstanceProfile["identifiers"]>;
    };
    let profile = applyKnownSubstanceHeuristics(
      message,
      fullContext,
      normalizeSubstanceProfile(parsed),
    );
    profile = await enrichProfileFromUnNumbers(message, fullContext, profile);
    profile = await enrichProfileFromChemicalNames(message, fullContext, profile);
    return finalizeUnProfile(profile, message, fullContext);
  } catch {
    let profile = applyKnownSubstanceHeuristics(message, fullContext, {
      ...emptySubstanceProfile(),
      applicable: true,
      status: "ambiguous",
      label: "Unknown substance",
    });
    profile = await enrichProfileFromUnNumbers(message, fullContext, profile);
    profile = await enrichProfileFromChemicalNames(message, fullContext, profile);
    return finalizeUnProfile(profile, message, fullContext);
  }
}

async function enrichProfileFromChemicalNames(
  message: string,
  fullContext: string,
  profile: SubstanceProfile,
): Promise<SubstanceProfile> {
  if (profile.identifiers.unNumbers.length > 0) return profile;

  const primaryChemical = pickPrimaryChemicalName(
    extractChemicalNamesFromText(`${fullContext}\n${message}`),
  );
  if (!primaryChemical) return profile;

  const lookup = await lookupChemicalFromDangerousGoodsList(primaryChemical);
  if (!lookup?.entry) return profile;

  const row = lookup.matchingRows[0];
  return buildProfileFromUnEntry(row.un, lookup.entry)!;
}

async function resolveChemicalProfileWithHints(
  chemical: string,
  message: string,
): Promise<SubstanceProfile | null> {
  const lookup = await lookupChemicalFromDangerousGoodsList(chemical);
  if (!lookup?.entry) return null;

  let rows = lookup.matchingRows;
  const text = message.toLowerCase();

  if (/\bpure\b|pure\s+substance|not\s+a\s+mixture/i.test(text)) {
    const exact = rows.filter((r) => scoreChemicalMatch(r, chemical) >= 90);
    if (exact.length > 0) rows = exact;
  }
  if (/\bliquid\b/i.test(text)) {
    const liquid = rows.filter((r) => /liquid|refrigerated|molten/i.test(r.psn));
    if (liquid.length > 0) rows = liquid;
  }
  if (/\bgas\b/i.test(text)) {
    const gas = rows.filter((r) => /\bgas\b|liquefied/i.test(r.psn));
    if (gas.length > 0) rows = gas;
  }
  if (/\bsolid\b/i.test(text)) {
    const solid = rows.filter((r) => /\bsolid\b|powder|flake/i.test(r.psn));
    if (solid.length > 0) rows = solid;
  }

  const uniqueUn = [...new Set(rows.map((r) => r.un))];
  if (uniqueUn.length !== 1) return null;

  const row = rows[0];
  const entry = lookup.entry;
  const profile = buildProfileFromUnEntry(row.un, {
    ...entry,
    properShippingNames: [row.psn],
    label: row.psn.slice(0, 80),
  })!;

  return {
    ...profile,
    applicable: true,
    status: "inferred",
    label: `${chemical} → ${row.psn}`,
    identifiers: {
      unNumbers: [row.un],
      properShippingNames: [row.psn],
      chemicalName: chemical,
    },
    workingAssumptions: [
      { field: "Chemical name (user)", value: chemical, confidence: "high" },
      { field: "UN number", value: `UN ${row.un}`, confidence: "high" },
      { field: "Proper shipping name", value: row.psn, confidence: "high" },
      ...(text.includes("liquid")
        ? [{ field: "Physical state", value: "Liquid (user)", confidence: "high" as const }]
        : []),
      ...(text.includes("pure")
        ? [{ field: "Form", value: "Pure substance (user)", confidence: "high" as const }]
        : []),
    ],
    ambiguities: [],
    clarifyingQuestions: [],
    confirmationNotice: `Using UN ${row.un}, ${row.psn} for ${chemical} based on your clarification. Reply in chat to correct any detail.`,
    mustClarifyBeforeAnswer: false,
    retrievalHints: `${chemical} UN ${row.un} ${row.psn} Table C`,
  };
}

async function resolveChemicalProfileFromTableC(chemical: string): Promise<SubstanceProfile> {
  const lookup = await lookupChemicalFromDangerousGoodsList(chemical);
  if (!lookup?.entry) {
    if (await isDangerousGoodsListIngested()) {
      return {
        ...emptySubstanceProfile(),
        applicable: true,
        status: "ambiguous",
        label: chemical,
        identifiers: { unNumbers: [], properShippingNames: [], chemicalName: chemical },
        ambiguities: [`${chemical} was not found in the indexed Table C dangerous goods list.`],
        clarifyingQuestions: [
          "Can you provide the UN number if known, or confirm the spelling of the chemical name?",
        ],
        confirmationNotice: "",
        mustClarifyBeforeAnswer: true,
      };
    }
    return emptySubstanceProfile();
  }

  const row = lookup.matchingRows[0];
  const entry = lookup.entry;
  const profile = buildProfileFromUnEntry(row.un, entry)!;

  const mustClarify = lookup.ambiguous;

  const candidates: DisambiguationCandidate[] | undefined = lookup.ambiguous
    ? deduplicateDisambiguationCandidates(lookup.matchingRows)
    : undefined;

  return {
    ...profile,
    applicable: true,
    status: lookup.ambiguous ? "ambiguous" : "inferred",
    label: `${chemical} → ${entry.properShippingNames[0]}`,
    identifiers: {
      unNumbers: [row.un],
      properShippingNames: [row.psn],
      chemicalName: chemical,
    },
    workingAssumptions: [
      { field: "Chemical name (user)", value: chemical, confidence: "high" },
      { field: "UN number", value: `UN ${row.un}`, confidence: "high" },
      { field: "Proper shipping name", value: entry.properShippingNames[0], confidence: "high" },
      {
        field: "Hazard class",
        value: entry.division ? `Class ${entry.hazardClass} (${entry.division})` : `Class ${entry.hazardClass}`,
        confidence: "high",
      },
      ...profile.workingAssumptions,
    ],
    ambiguities: lookup.ambiguous && lookup.ambiguityNote ? [lookup.ambiguityNote] : [],
    clarifyingQuestions: lookup.ambiguous
      ? ["Select the correct entry below, or choose Other for more help."]
      : [],
    disambiguationCandidates: candidates,
    confirmationNotice: `Looked up ${chemical} in ADN Table C: UN ${row.un}, ${entry.properShippingNames[0]}. Reply in chat to correct any detail.`,
    mustClarifyBeforeAnswer: mustClarify,
    retrievalHints: `${chemical} UN ${row.un} ${entry.properShippingNames.join(" ")} Class ${entry.hazardClass} Table C`,
  };
}

function deduplicateDisambiguationCandidates(rows: { un: string; psn: string; hazardClass: string }[]): DisambiguationCandidate[] {
  const seen = new Set<string>();
  const result: DisambiguationCandidate[] = [];
  for (const r of rows) {
    const key = `${r.un}:${r.psn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ un: r.un, psn: r.psn, hazardClass: r.hazardClass });
  }
  return result;
}

/**
 * Resolve UN → PSN using ADN Table C (default), curated fallbacks, Orange Book, then LLM.
 */
async function resolveUnProfileFromAuthoritativeSources(un: string): Promise<SubstanceProfile> {
  const tableCIndexed = await isDangerousGoodsListIngested();

  const fromDgList = await lookupUnFromDangerousGoodsList(un);
  if (fromDgList && !isInvalidPsnForUn(un, fromDgList)) {
    const profile = buildProfileFromUnEntry(un, fromDgList)!;
    return {
      ...profile,
      confirmationNotice: `${profile.confirmationNotice} Source: ADN Table C dangerous goods list.`,
      retrievalHints: `${profile.retrievalHints} ADN Table C UN ${un} dangerous goods list`,
    };
  }

  if (tableCIndexed) {
    return (
      buildProfileFromUnEntry(un, {
        label: `UN ${un}`,
        properShippingNames: [],
        hazardClass: "unknown",
        physicalState: "Unknown",
        hazardProperties: [],
        ambiguous: true,
        ambiguityNote: `UN ${un} was not found in the indexed Table C PDF. Re-run ingest after updating table-c-adn.pdf, or confirm the UN number.`,
      }) ?? emptySubstanceProfile()
    );
  }

  const curated = getCuratedUnEntry(un);
  if (curated) return buildProfileFromUnEntry(un, curated)!;

  const fromCorpus = await lookupUnFromCorpus(un);
  if (fromCorpus && !isInvalidPsnForUn(un, fromCorpus)) {
    return buildProfileFromUnEntry(un, fromCorpus)!;
  }

  const fromOpenAi = await lookupUnNumberViaOpenAI(un);
  if (fromOpenAi && !isInvalidPsnForUn(un, fromOpenAi)) {
    return buildProfileFromUnEntry(un, fromOpenAi)!;
  }

  return (
    buildProfileFromUnEntry(un, {
      label: `UN ${un}`,
      properShippingNames: [],
      hazardClass: "unknown",
      physicalState: "Unknown",
      hazardProperties: [],
      ambiguous: true,
      ambiguityNote:
        "This UN number could not be verified. Ingest Table C with `npm run ingest:table-c`.",
    }) ?? emptySubstanceProfile()
  );
}

async function finalizeUnProfile(
  profile: SubstanceProfile,
  message: string,
  fullContext: string,
): Promise<SubstanceProfile> {
  const unNumbers = extractUnNumbersFromUserContext(fullContext, message);
  if (unNumbers.length !== 1) {
    return overrideProfileWithCuratedUn(profile, message, fullContext);
  }

  const un = unNumbers[0];
  const authoritative = await resolveUnProfileFromAuthoritativeSources(un);
  const llmWrong =
    profile.identifiers.properShippingNames.length > 0 &&
    isInvalidPsnForUn(un, profileToUnEntry(profile));
  const llmMissingPsn = profile.identifiers.properShippingNames.length === 0;

  if (getCuratedUnEntry(un) || llmWrong || llmMissingPsn) {
    return authoritative;
  }

  return overrideProfileWithCuratedUn(profile, message, fullContext);
}

/** Authoritative curated mapping — skips LLM when we have a verified UN entry */
function resolveCuratedUnProfile(message: string, fullContext: string): SubstanceProfile | null {
  const unNumbers = extractUnNumbersFromUserContext(fullContext, message);
  if (unNumbers.length !== 1) return null;
  const entry = getCuratedUnEntry(unNumbers[0]);
  if (!entry) return null;
  return buildProfileFromUnEntry(unNumbers[0], entry);
}

/** Never let a wrong LLM PSN override a curated UN table entry */
function overrideProfileWithCuratedUn(
  profile: SubstanceProfile,
  message: string,
  fullContext: string,
): SubstanceProfile {
  const unNumbers = extractUnNumbersFromUserContext(fullContext, message);
  if (unNumbers.length !== 1) return profile;

  const un = unNumbers[0];
  const curated = getCuratedUnEntry(un);
  if (!curated) {
    if (profile.identifiers.unNumbers.includes(un) && isInvalidPsnForUn(un, profileToUnEntry(profile))) {
      return buildProfileFromUnEntry(un, {
        label: `UN ${un}`,
        properShippingNames: [],
        hazardClass: "unknown",
        physicalState: "Unknown",
        hazardProperties: [],
        ambiguous: true,
        ambiguityNote:
          "Could not verify proper shipping name — please confirm the substance or check the dangerous goods list.",
      })!;
    }
    return profile;
  }

  const psnText = profile.identifiers.properShippingNames.join(" ");
  if (
    !psnText ||
    isInvalidPsnForUn(un, profileToUnEntry(profile)) ||
    !psnMatchesCurated(curated, profile)
  ) {
    return buildProfileFromUnEntry(un, curated)!;
  }

  return profile;
}

function profileToUnEntry(profile: SubstanceProfile): UnEntryLookup {
  const hazardClass =
    profile.workingAssumptions.find((a) => /hazard class/i.test(a.field))?.value.match(/Class\s*(\d+)/i)?.[1] ??
    "";
  return {
    label: profile.label,
    properShippingNames: profile.identifiers.properShippingNames,
    chemicalName: profile.identifiers.chemicalName,
    hazardClass,
    physicalState: "Unknown",
    hazardProperties: profile.workingAssumptions.map((a) => a.value),
  };
}

function psnMatchesCurated(curated: UnEntryLookup, profile: SubstanceProfile): boolean {
  const profilePsns = profile.identifiers.properShippingNames.map((p) => p.toUpperCase());
  return curated.properShippingNames.some((c) =>
    profilePsns.some((p) => p.includes(c.toUpperCase().slice(0, 12)) || c.toUpperCase().includes(p.slice(0, 12))),
  );
}

/** Fill gaps when user gave UN number(s) but the model omitted PSN/properties */
async function enrichProfileFromUnNumbers(
  message: string,
  fullContext: string,
  profile: SubstanceProfile,
): Promise<SubstanceProfile> {
  const unNumbers = extractUnNumbersFromUserContext(fullContext, message);
  if (unNumbers.length === 0) return profile;

  if (unNumbers.length === 1) {
    return resolveUnProfileFromAuthoritativeSources(unNumbers[0]);
  }

  const mergedUn = [...new Set([...profile.identifiers.unNumbers, ...unNumbers])];
  return {
    ...profile,
    applicable: true,
    identifiers: { ...profile.identifiers, unNumbers: mergedUn },
  };
}

async function lookupUnFromCorpus(un: string): Promise<UnEntryLookup | null> {
  try {
    const chunks = await retrieveChunks(
      `UN ${un} ${un} proper shipping name dangerous goods list table 3.2 Chapter 3.2`,
      undefined,
      {
        matchCount: 16,
        matchThreshold: 0.1,
        filterDocumentType: DOCUMENT_TYPE_ORANGE_BOOK,
      },
    );
    if (chunks.length === 0) return null;

    const unInCorpus = chunks.some((c) =>
      new RegExp(`\\bUN\\s*0*${un}\\b`, "i").test(c.content),
    );
    if (!unInCorpus) return null;

    const evidence = chunks
      .slice(0, 8)
      .map((c, i) => `[${i + 1}] ${c.content.slice(0, 900)}`)
      .join("\n\n---\n\n");

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: UN_CORPUS_EXTRACT_PROMPT },
        { role: "user", content: `UN number: ${un}\n\nExcerpts:\n${evidence}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as UnEntryLookup & { found?: boolean; properShippingNames?: string[] };
    if (parsed.found === false || !parsed.properShippingNames?.length) return null;

    const entry: UnEntryLookup = {
      label: parsed.label ?? `UN ${un}`,
      properShippingNames: parsed.properShippingNames ?? [],
      chemicalName: parsed.chemicalName,
      hazardClass: parsed.hazardClass ?? "",
      division: parsed.division,
      typicalPackingGroup: parsed.typicalPackingGroup,
      physicalState: parsed.physicalState ?? "Liquid",
      hazardProperties: parsed.hazardProperties ?? [],
      ambiguous: parsed.ambiguous,
      ambiguityNote: parsed.ambiguityNote,
    };

    return isInvalidPsnForUn(un, entry) ? null : entry;
  } catch {
    return null;
  }
}

async function lookupUnNumberViaOpenAI(un: string): Promise<UnEntryLookup | null> {
  try {
    const curated = getCuratedUnEntry(un);
    if (curated) return curated;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: UN_LOOKUP_PROMPT },
        {
          role: "user",
          content: `Resolve UN ${un}. Return only the correct dangerous goods list entry for this exact UN number.`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as UnEntryLookup & { properShippingNames?: string[] };
    if (!parsed.properShippingNames?.length && !parsed.label) return null;

    const entry: UnEntryLookup = {
      label: parsed.label ?? `UN ${un}`,
      properShippingNames: parsed.properShippingNames ?? [],
      chemicalName: parsed.chemicalName,
      hazardClass: parsed.hazardClass ?? "",
      division: parsed.division,
      typicalPackingGroup: parsed.typicalPackingGroup,
      physicalState: parsed.physicalState ?? "Unknown",
      hazardProperties: parsed.hazardProperties ?? [],
      ambiguous: parsed.ambiguous,
      ambiguityNote: parsed.ambiguityNote,
    };

    if (isInvalidPsnForUn(un, entry)) return null;
    return entry;
  } catch {
    return null;
  }
}

function mergeUnLookupIntoProfile(
  base: SubstanceProfile,
  un: string,
  entry: UnEntryLookup,
): SubstanceProfile {
  const built = buildProfileFromUnEntry(un, entry);
  if (!built) return base;
  return {
    ...built,
    userCorrectionsNoted: base.userCorrectionsNoted,
    clarifyingQuestions: entry.ambiguous ? built.clarifyingQuestions : [],
    mustClarifyBeforeAnswer: Boolean(entry.ambiguous),
  };
}

function buildProfileFromUnEntry(un: string, entry: UnEntryLookup | undefined): SubstanceProfile | null {
  if (!entry) return null;

  const workingAssumptions: SubstanceAssumption[] = [
    { field: "UN number", value: `UN ${un}`, confidence: "high" },
    {
      field: "Hazard class",
      value: entry.division
        ? `Class ${entry.hazardClass} (Division ${entry.division})`
        : `Class ${entry.hazardClass}`,
      confidence: "high",
    },
    { field: "Physical state", value: entry.physicalState, confidence: "high" },
  ];

  if (entry.typicalPackingGroup) {
    workingAssumptions.push({
      field: "Typical packing group",
      value: entry.typicalPackingGroup,
      confidence: entry.ambiguous ? "medium" : "high",
    });
  }

  for (const prop of entry.hazardProperties) {
    workingAssumptions.push({
      field: "Hazard property",
      value: prop,
      confidence: entry.ambiguous ? "medium" : "high",
    });
  }

  const psnList = entry.properShippingNames.join("; ");
  const confirmationNotice = entry.ambiguous
    ? `UN ${un} may match: ${psnList}. ${entry.ambiguityNote ?? ""} Reply in chat with the technical name, concentration, or other details to narrow the entry.`
    : `I'm working from UN ${un} (${entry.label}): ${psnList}, Class ${entry.hazardClass}. Reply in chat to correct the proper shipping name, packing group, or properties.`;

  const clarifyingQuestions: string[] = [];
  if (entry.ambiguous) {
    if (/n\.o\.s|1993|3082|3077|2814/i.test(un) || entry.ambiguityNote) {
      clarifyingQuestions.push(
        "What is the technical name or chemical identity of the material (as it would appear on the transport document)?",
      );
    }
    if (/1993|1170/i.test(un)) {
      clarifyingQuestions.push(
        "What is the flash point (or approximate range) and concentration, if applicable?",
      );
    }
  }

  return {
    applicable: true,
    status: entry.ambiguous ? "ambiguous" : "inferred",
    label: entry.label,
    identifiers: {
      unNumbers: [un],
      properShippingNames: entry.properShippingNames,
      chemicalName: entry.chemicalName,
    },
    workingAssumptions,
    ambiguities: entry.ambiguous && entry.ambiguityNote ? [entry.ambiguityNote] : [],
    clarifyingQuestions,
    retrievalHints: [
      `UN ${un}`,
      ...entry.properShippingNames,
      `Class ${entry.hazardClass}`,
      entry.division ? `Division ${entry.division}` : "",
      "dangerous goods list proper shipping name packing group",
    ]
      .filter(Boolean)
      .join(" "),
    confirmationNotice,
    mustClarifyBeforeAnswer: Boolean(entry.ambiguous),
    userCorrectionsNoted: false,
  };
}

/** Deterministic fallbacks when the model is overly cautious on common products */
function applyKnownSubstanceHeuristics(
  message: string,
  fullContext: string,
  profile: SubstanceProfile,
): SubstanceProfile {
  const userText = extractUserMessagesFromContext(fullContext, message);
  const textLower = userText.toLowerCase();
  const unNumbers = extractUnNumbersFromUserContext(fullContext, message);

  if (unNumbers.length === 1) {
    const fromUn = buildProfileFromUnEntry(unNumbers[0], UN_ENTRY_LOOKUP[unNumbers[0]]);
    if (fromUn) return { ...fromUn, userCorrectionsNoted: profile.userCorrectionsNoted };
  }

  if (unNumbers.length > 1) {
    return {
      applicable: true,
      status: "ambiguous",
      label: `Multiple UN numbers: ${unNumbers.join(", ")}`,
      identifiers: { unNumbers, properShippingNames: [] },
      workingAssumptions: unNumbers.map((u) => ({
        field: "UN number",
        value: `UN ${u}`,
        confidence: "high" as const,
      })),
      ambiguities: ["More than one UN number mentioned — which entry applies to this shipment?"],
      clarifyingQuestions: [
        "Which single UN number applies to the material you are asking about?",
      ],
      retrievalHints: unNumbers.map((u) => `UN ${u}`).join(" "),
      confirmationNotice:
        "You mentioned multiple UN numbers. Reply in chat with the one UN entry to use for this question.",
      mustClarifyBeforeAnswer: true,
      userCorrectionsNoted: profile.userCorrectionsNoted,
    };
  }

  const isTransportQuery =
    /\b(transport|transportation|requirements?|provisions?|packaging|packing|marking|label|placard|carriage|ship|road|rail|air|sea)\b/i.test(
      textLower,
    );

  if (/\b(gasoline|petrol|motor\s+spirit)\b/.test(textLower)) {
    const packaging = /\b(barrel|drum|jerrican|can|tank|ibc|package|bottle)\b/i.exec(textLower)?.[0];
    const mode = /\b(road|rail|air|sea|vessel|aircraft)\b/i.exec(textLower)?.[0];
    const workingAssumptions: SubstanceAssumption[] = [
      { field: "UN number", value: "UN 1203", confidence: "high" },
      { field: "Class", value: "3 (Flammable liquids)", confidence: "high" },
      {
        field: "Typical packing group",
        value: "II (verify flash point for final PG)",
        confidence: "medium",
      },
      { field: "Physical state", value: "Liquid", confidence: "high" },
    ];
    if (packaging) {
      workingAssumptions.push({
        field: "Packaging mentioned",
        value: packaging,
        confidence: "high",
      });
    }
    if (mode) {
      workingAssumptions.push({
        field: "Transport mode mentioned",
        value: mode,
        confidence: "high",
      });
    }
    return {
      applicable: true,
      status: "inferred",
      label: "Gasoline (motor spirit)",
      identifiers: {
        unNumbers: ["1203"],
        properShippingNames: ["GASOLINE", "MOTOR SPIRIT"],
        chemicalName: "Gasoline",
      },
      workingAssumptions,
      ambiguities: [],
      clarifyingQuestions: [],
      retrievalHints:
        "UN 1203 gasoline motor spirit Class 3 flammable liquid packing group packaging road transport plastic drum barrel",
      confirmationNotice:
        "I'm working from UN 1203 (gasoline / motor spirit), Class 3 flammable liquid, typical PG II. Reply in chat to correct UN entry, packing group, packaging, quantity, or mode.",
      mustClarifyBeforeAnswer: false,
      userCorrectionsNoted: profile.userCorrectionsNoted,
    };
  }

  if (profile.applicable && isTransportQuery && profile.status === "inferred") {
    return {
      ...profile,
      clarifyingQuestions: [],
      mustClarifyBeforeAnswer: false,
    };
  }

  return profile;
}

function normalizeSubstanceProfile(parsed: Partial<SubstanceProfile>): SubstanceProfile {
  const ids = parsed.identifiers ?? {
    unNumbers: [],
    properShippingNames: [],
  };
  return {
    applicable: Boolean(parsed.applicable),
    status: (parsed.status ?? "not_applicable") as SubstanceProfileStatus,
    label: parsed.label ?? "",
    identifiers: {
      unNumbers: ids.unNumbers ?? [],
      properShippingNames: ids.properShippingNames ?? [],
      chemicalName: ids.chemicalName ?? undefined,
      casNumber: ids.casNumber ?? undefined,
    },
    workingAssumptions: parsed.workingAssumptions ?? [],
    ambiguities: parsed.ambiguities ?? [],
    clarifyingQuestions: parsed.clarifyingQuestions ?? [],
    retrievalHints: parsed.retrievalHints ?? "",
    confirmationNotice: parsed.confirmationNotice ?? "",
    mustClarifyBeforeAnswer: Boolean(parsed.mustClarifyBeforeAnswer),
    userCorrectionsNoted: Boolean(parsed.userCorrectionsNoted),
  };
}

export function buildSubstanceContextBlock(profile: SubstanceProfile): string {
  if (!profile.applicable) return "";

  const lines: string[] = ["Working substance profile (preliminary — user may correct in chat):"];
  if (profile.label) lines.push(`Label: ${profile.label}`);
  if (profile.identifiers.unNumbers.length) {
    lines.push(`UN number(s): ${profile.identifiers.unNumbers.join(", ")}`);
  }
  if (profile.identifiers.properShippingNames.length) {
    lines.push(`Proper shipping name(s): ${profile.identifiers.properShippingNames.join("; ")}`);
  }
  if (profile.identifiers.chemicalName) lines.push(`Chemical name: ${profile.identifiers.chemicalName}`);
  if (profile.identifiers.casNumber) lines.push(`CAS: ${profile.identifiers.casNumber}`);
  for (const a of profile.workingAssumptions) {
    lines.push(`- ${a.field}: ${a.value} (${a.confidence} confidence)`);
  }
  if (profile.ambiguities.length) {
    lines.push(`Ambiguities: ${profile.ambiguities.join("; ")}`);
  }
  if (profile.confirmationNotice) lines.push(profile.confirmationNotice);
  return lines.join("\n");
}

export function appendSubstanceToContext(baseContext: string, profile: SubstanceProfile): string {
  const block = buildSubstanceContextBlock(profile);
  if (!block) return baseContext;
  return `${baseContext}\n\n${block}`;
}

/** Drop intake questions already covered by a high-confidence working assumption */
export function filterClarificationsGivenProfile(
  questions: string[],
  profile: SubstanceProfile,
): string[] {
  if (!profile.applicable) return questions;

  const singleResolvedUn =
    profile.identifiers.unNumbers.length === 1 &&
    profile.workingAssumptions.some((a) => /un number/i.test(a.field));

  if (profile.status === "ambiguous" && !singleResolvedUn) return questions;

  const highFields = new Set(
    profile.workingAssumptions
      .filter((a) => a.confidence === "high")
      .map((a) => a.field.toLowerCase()),
  );

  const hasIdentity =
    Boolean(profile.label) ||
    profile.identifiers.unNumbers.length > 0 ||
    profile.identifiers.properShippingNames.length > 0 ||
    profile.identifiers.chemicalName ||
    highFields.has("identity") ||
    highFields.has("substance") ||
    highFields.has("composition");

  const hasState =
    highFields.has("physical state") ||
    highFields.has("state of matter") ||
    profile.workingAssumptions.some((a) => /solid|liquid|gas|aerosol/i.test(a.value));

  const hasHazard =
    highFields.has("hazard") ||
    profile.workingAssumptions.some((a) =>
      /flash|ph\b|toxic|corrosive|flammable|class\s*\d|packing group/i.test(`${a.field} ${a.value}`),
    );

  const hasTransport =
    highFields.has("transport") ||
    highFields.has("packaging") ||
    highFields.has("quantity");

  return questions.filter((q) => {
    const lower = q.toLowerCase();
    if (hasIdentity && /substance|article|identity|composition|un number|proper shipping/i.test(lower)) {
      return false;
    }
    if (hasState && /physical state/i.test(lower)) return false;
    if (hasHazard && /hazard propert|test data|flash point/i.test(lower)) return false;
    if (hasTransport && /transport context|packaging|quantity/i.test(lower)) return false;
    return true;
  });
}

export function mergeClarifyingQuestions(
  intakeQuestions: string[],
  profile: SubstanceProfile,
): string[] {
  const combined = [
    ...profile.clarifyingQuestions,
    ...intakeQuestions,
  ].filter(Boolean);
  return [...new Set(combined)];
}

/**
 * When we have a confident inferred substance profile, skip intake boilerplate
 * and proceed to retrieval + cited answer (user can correct via chat).
 */
export function resolveClarifyingQuestions(
  intakeQuestions: string[],
  profile: SubstanceProfile,
): string[] {
  if (
    profile.applicable &&
    !profile.mustClarifyBeforeAnswer &&
    (profile.status === "inferred" || profile.status === "user_provided")
  ) {
    return profile.clarifyingQuestions;
  }

  if (profile.applicable && profile.status === "ambiguous" && profile.mustClarifyBeforeAnswer) {
    return filterClarificationsGivenProfile(
      mergeClarifyingQuestions(
        intakeQuestions.filter((q) => !isGenericIntakeQuestion(q)),
        profile,
      ),
      profile,
    );
  }

  return filterClarificationsGivenProfile(
    mergeClarifyingQuestions(intakeQuestions, profile),
    profile,
  );
}

function isGenericIntakeQuestion(q: string): boolean {
  const lower = q.toLowerCase();
  return (
    /specific regulations or guidelines you are already aware/.test(lower) ||
    /type of vehicle/.test(lower) ||
    /quantity of/.test(lower) && /being transported/.test(lower)
  );
}

const CLASS_OR_PG_LOOKUP =
  /\b(?:what\s+(?:is|'s)\s+the\s+)?(?:(?:hazard\s+)?class|packing\s+group|pg|proper\s+shipping\s+name|un\s+number)\s+(?:for|of)\b/i;

export function shouldBlockForClarification(
  intent: IntakeIntent,
  profile: SubstanceProfile,
  questions: string[],
  options?: { message?: string; fullContext?: string },
): boolean {
  if (questions.length === 0) return false;

  const message = options?.message ?? "";
  const contextText = options?.fullContext
    ? `${options.fullContext}\n${message}`
    : message;

  if (
    message &&
    isExampleStarterPrompt(message) &&
    !hasConcreteSubstanceIdentity(contextText)
  ) {
    return true;
  }

  if (
    message &&
    CLASS_OR_PG_LOOKUP.test(message) &&
    !profile.disambiguationCandidates?.length &&
    (profile.identifiers.unNumbers.length > 0 ||
      extractChemicalNamesFromText(contextText).length > 0)
  ) {
    return false;
  }

  if (
    profile.applicable &&
    !profile.mustClarifyBeforeAnswer &&
    (profile.status === "inferred" || profile.status === "user_provided")
  ) {
    return profile.clarifyingQuestions.length > 0;
  }

  if (profile.applicable && profile.status === "ambiguous" && profile.mustClarifyBeforeAnswer) {
    return true;
  }

  return shouldPreferClarificationFromIntake(intent, questions.length);
}

function shouldPreferClarificationFromIntake(intent: IntakeIntent, questionCount: number): boolean {
  if (questionCount === 0) return false;
  if (intent === "classify_item") return true;
  if (intent === "explain_requirement") return questionCount >= 3;
  if (intent === "lookup_rule" || intent === "show_source_sections") return questionCount >= 4;
  return questionCount >= 3;
}
