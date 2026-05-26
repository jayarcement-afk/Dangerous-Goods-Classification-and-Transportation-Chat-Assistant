export type Citation = {
  chunkId: string;
  documentId: string;
  documentTitle?: string;
  excerpt: string;
  chapter?: string | null;
  section?: string | null;
  pageReference?: string | null;
  tableReference?: string | null;
  similarity: number;
};

export type RetrievedChunk = {
  chunk_id: string;
  document_id: string;
  content: string;
  chapter: string | null;
  section: string | null;
  page_reference: string | null;
  table_reference: string | null;
  metadata: Record<string, unknown>;
  similarity: number;
};

export type WorkingSubstanceSummary = {
  label: string;
  status: string;
  assumptions: string[];
  confirmationNotice: string;
};

export type DisambiguationOption = {
  un: string;
  psn: string;
  hazardClass: string;
};

export type ChatResponse = {
  status: "answer" | "clarification" | "refusal";
  answer?: string;
  citations?: Citation[];
  clarifyingQuestions?: string[];
  disambiguationOptions?: DisambiguationOption[];
  refusalReason?: string;
  limitations?: string;
  intent?: string;
  substanceProfile?: WorkingSubstanceSummary;
  modelVersion: string;
  promptVersion: string;
};
