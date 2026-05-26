import { createAdminClient } from "@/lib/supabase/admin";
import { embedQuery } from "@/lib/openai/client";
import { DOCUMENT_TYPE_DANGEROUS_GOODS_LIST } from "@/lib/constants";
import type { Citation, RetrievedChunk } from "@/lib/types/citations";
import type { IntakeIntent } from "@/lib/agents/intake-rules";
import type { SubstanceProfile } from "@/lib/agents/substance-profile";
import { findDgListChunksByUnExact } from "@/lib/retrieval/dangerous-goods-list";

export const RETRIEVAL_MATCH_COUNT = 12;
export const RETRIEVAL_MATCH_THRESHOLD = 0.18;
export const MIN_CHUNKS_TO_ANSWER = 2;
export const MIN_TOP_SIMILARITY = 0.28;

type RetrieveOptions = {
  matchCount?: number;
  matchThreshold?: number;
  filterDocumentType?: string | null;
};

/** Enrich embedding query so regulatory terms align with Orange Book chunk wording */
export function expandSearchQuery(message: string, context?: string): string {
  const base = context ? `${message}\n${context}` : message;
  const extras: string[] = [
    "UN Model Regulations Orange Book dangerous goods transport",
  ];

  if (/\bclass\s*3\b/i.test(message) || /flammable\s+liquid/i.test(message)) {
    extras.push("Class 3 flammable liquids classification criteria packing group flash point");
  }
  if (/packing\s+group/i.test(message)) {
    extras.push("packing group assignment criteria PG I PG II PG III");
  }
  if (/class\s*[1-9]/i.test(message)) {
    const m = message.match(/class\s*([1-9])/i);
    if (m) extras.push(`Class ${m[1]} classification division hazard`);
  }
  if (/excepted\s+quantit/i.test(message)) extras.push("excepted quantities provisions");
  if (/limited\s+quantit/i.test(message)) extras.push("limited quantities provisions marking");
  if (/lithium|battery/i.test(message)) extras.push("lithium batteries special provisions");
  if (/\bUN\s*\d{4}\b/i.test(message)) {
    const unMatch = message.match(/\bUN\s*0*(\d{4})\b/i);
    if (unMatch) {
      extras.push(
        `UN ${unMatch[1]} dangerous goods list proper shipping name hazard class packing group special provisions`,
      );
    }
  }
  if (/gasoline|petrol|motor\s+spirit/i.test(message)) {
    extras.push("UN 1203 gasoline motor spirit Class 3 flammable liquid packaging drums road transport");
  }
  if (/barrel|drum|jerrican/i.test(message)) {
    extras.push("packaging provisions drums jerricans plastic road transport");
  }

  return `${base}\n${extras.join(" ")}`;
}

export function expandSearchQueryWithSubstance(
  message: string,
  context?: string,
  profile?: SubstanceProfile,
): string {
  let query = expandSearchQuery(message, context);
  if (!profile?.applicable) return query;

  if (profile.retrievalHints) query += `\n${profile.retrievalHints}`;
  for (const un of profile.identifiers.unNumbers) {
    query += `\nUN ${un} proper shipping name dangerous goods list`;
  }
  for (const psn of profile.identifiers.properShippingNames) {
    query += `\n${psn} classification packing group special provisions`;
  }
  return query;
}

/** Text passed to the embedding model (trim noise that does not help vector recall). */
export function textForEmbedding(
  query: string,
  context?: string,
  profile?: SubstanceProfile,
): string {
  const base = expandSearchQueryWithSubstance(query, context, profile);
  return base.replace(/\?+$/g, "").trim();
}

export async function retrieveChunks(
  query: string,
  context?: string,
  options?: RetrieveOptions & { substanceProfile?: SubstanceProfile },
): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(
    textForEmbedding(query, context, options?.substanceProfile),
  );
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: options?.matchCount ?? RETRIEVAL_MATCH_COUNT,
    match_threshold: options?.matchThreshold ?? RETRIEVAL_MATCH_THRESHOLD,
    filter_document_type: options?.filterDocumentType ?? null,
  });

  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`);
  }

  return (data ?? []) as RetrievedChunk[];
}

/** Second pass with looser threshold when the first pass is thin */
export async function retrieveWithFallback(
  query: string,
  context?: string,
  substanceProfile?: SubstanceProfile,
): Promise<RetrievedChunk[]> {
  const retrieveOpts = substanceProfile ? { substanceProfile } : undefined;
  const primary = await retrieveChunks(query, context, retrieveOpts);
  if (primary.length >= 3 && (primary[0]?.similarity ?? 0) >= 0.22) {
    const withTableC = await mergeDangerousGoodsListChunks(primary, substanceProfile);
    return withTableC.sort((a, b) => b.similarity - a.similarity).slice(0, RETRIEVAL_MATCH_COUNT);
  }

  const fallback = await retrieveChunks(query, context, {
    matchCount: 16,
    matchThreshold: 0.1,
    ...retrieveOpts,
  });

  const seen = new Set<string>();
  const merged: RetrievedChunk[] = [];
  for (const chunk of [...primary, ...fallback]) {
    if (!seen.has(chunk.chunk_id)) {
      seen.add(chunk.chunk_id);
      merged.push(chunk);
    }
  }
  const withTableC = await mergeDangerousGoodsListChunks(merged, substanceProfile);
  return withTableC.sort((a, b) => b.similarity - a.similarity).slice(0, RETRIEVAL_MATCH_COUNT);
}

/** Pin ADN Table C rows for known UN numbers so UN lookups always have citable excerpts. */
export async function mergeDangerousGoodsListChunks(
  chunks: RetrievedChunk[],
  profile?: SubstanceProfile,
): Promise<RetrievedChunk[]> {
  const uns = profile?.identifiers.unNumbers ?? [];
  if (uns.length === 0) return chunks;

  const seen = new Set(chunks.map((c) => c.chunk_id));
  const pinned: RetrievedChunk[] = [];

  for (const un of uns.slice(0, 2)) {
    const dgChunks = await findDgListChunksByUnExact(un);
    for (const chunk of dgChunks) {
      if (seen.has(chunk.chunk_id)) continue;
      seen.add(chunk.chunk_id);
      pinned.push({
        ...chunk,
        similarity: Math.max(chunk.similarity ?? 0, 0.99),
        metadata: {
          ...chunk.metadata,
          document_type: DOCUMENT_TYPE_DANGEROUS_GOODS_LIST,
        },
      });
    }
  }

  return [...pinned, ...chunks];
}

function chunkContainsUn(chunk: RetrievedChunk, un: string): boolean {
  return (
    chunk.section === un ||
    (chunk.metadata?.document_type === DOCUMENT_TYPE_DANGEROUS_GOODS_LIST &&
      new RegExp(`\\b${un}\\b`).test(chunk.content))
  );
}

export function hasTableCEvidenceForUn(chunks: RetrievedChunk[], un: string): boolean {
  return chunks.some((c) => chunkContainsUn(c, un));
}

export function chunksToCitations(
  chunks: RetrievedChunk[],
  documentTitles?: Map<string, string>,
): Citation[] {
  return chunks.map((c) => ({
    chunkId: c.chunk_id,
    documentId: c.document_id,
    documentTitle: documentTitles?.get(c.document_id),
    excerpt: c.content.slice(0, 500),
    chapter: c.chapter,
    section: c.section,
    pageReference: c.page_reference,
    tableReference: c.table_reference,
    similarity: c.similarity,
  }));
}

export function hasSufficientEvidence(
  chunks: RetrievedChunk[],
  intent?: IntakeIntent,
  options?: { unNumbers?: string[] },
): boolean {
  if (chunks.length === 0) return false;

  if (options?.unNumbers?.some((un) => hasTableCEvidenceForUn(chunks, un))) {
    return true;
  }

  const isLookup =
    intent === "lookup_rule" ||
    intent === "show_source_sections" ||
    intent === "explain_requirement";

  const minChunks = isLookup ? 1 : MIN_CHUNKS_TO_ANSWER;
  const minTop = isLookup ? 0.2 : MIN_TOP_SIMILARITY;

  if (chunks.length < minChunks) return false;
  const top = chunks[0]?.similarity ?? 0;
  return top >= minTop;
}

export async function loadDocumentTitles(
  documentIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (documentIds.length === 0) return map;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("documents")
    .select("id, title")
    .in("id", [...new Set(documentIds)]);

  for (const row of data ?? []) {
    map.set(row.id as string, row.title as string);
  }
  return map;
}
