export const APP_NAME =
  "Dangerous Goods Classification and Transportation Assistant";

export const AGENT_NAME = "ULTRUS DG Agent";

export const AGENT_DESCRIPTION =
  "ULTRUS DG Agent is your always-on dangerous goods compliance assistant, delivering trusted guidance for the safe transportation of hazardous materials. It empowers transportation, safety, and operations teams to move faster with greater accuracy, consistency, and confidence while helping protect people, cargo, and the environment.";

export const SOURCE_AUTHORITY =
  "UN Recommendations on the Transport of Dangerous Goods — Model Regulations (Orange Book), Rev. 24";

export const DOCUMENT_TYPE_ORANGE_BOOK = "orange_book";
export const DOCUMENT_TYPE_DANGEROUS_GOODS_LIST = "dangerous_goods_list";

/** Primary UN / PSN / classification lookup (UNECE ADN Table C) */
export const DANGEROUS_GOODS_LIST_SOURCE = {
  id: "table-c-adn",
  title: "ADN 2011 — Table C (Dangerous Goods List)",
  url: "https://unece.org/DAM/trans/danger/publi/adn/adn2011/English/7-TableC-E.pdf",
  edition: "ADN 2011",
  documentType: DOCUMENT_TYPE_DANGEROUS_GOODS_LIST,
  chunkStrategy: "dangerous_goods_list" as const,
};

export const ORANGE_BOOK_SOURCES = [
  {
    id: "vol-1",
    title: "Model Regulations — Volume I",
    url: "https://unece.org/sites/default/files/2025-09/ST_SG_AC10_1_Rev24e_Vol%20I_1.pdf",
    edition: "Rev. 24",
    documentType: DOCUMENT_TYPE_ORANGE_BOOK,
    chunkStrategy: "default" as const,
  },
  {
    id: "vol-2",
    title: "Model Regulations — Volume II",
    url: "https://unece.org/sites/default/files/2025-09/ST_SG_AC10_1_Rev24e_Vol_II_1.pdf",
    edition: "Rev. 24",
    documentType: DOCUMENT_TYPE_ORANGE_BOOK,
    chunkStrategy: "default" as const,
  },
] as const;

export type IngestSourceConfig = {
  id: string;
  title: string;
  url: string;
  edition: string;
  documentType: string;
  chunkStrategy: "default" | "dangerous_goods_list";
};

export const ALL_INGEST_SOURCES: IngestSourceConfig[] = [
  DANGEROUS_GOODS_LIST_SOURCE,
  ...ORANGE_BOOK_SOURCES,
];

export const V1_FLOWS = [
  {
    id: "classify",
    title: "Classify from substance details",
    description:
      "Given known substance properties, identify likely UN class/division and packing group considerations with cited rationale.",
  },
  {
    id: "intake",
    title: "Guided classification intake",
    description:
      "Determine what information is still needed before a classification-related answer can be supported by sources.",
  },
  {
    id: "lookup",
    title: "Show relevant Orange Book sections",
    description:
      "Retrieve and display source passages for a specific requirement, concept, or transportation question.",
  },
] as const;

export const EXAMPLE_PROMPTS = [
  "Is my product classified as a dangerous good?",
  "What is the correct Proper Shipping Name and UN Number?",
  "What is the Packing Group (PG)?",
] as const;

/** Shown when a starter example prompt is used without a named substance or UN number. */
export const SUBSTANCE_IDENTITY_CLARIFICATION =
  "What is the chemical name or UN number of the material?";

function normalizePromptText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[?.!]+$/g, "")
    .toLowerCase();
}

const NORMALIZED_EXAMPLE_PROMPTS = new Set(
  EXAMPLE_PROMPTS.map((p) => normalizePromptText(p)),
);

/** True when the user message matches one of the UI example starter prompts. */
export function isExampleStarterPrompt(message: string): boolean {
  return NORMALIZED_EXAMPLE_PROMPTS.has(normalizePromptText(message));
}
