import { createAdminClient } from "@/lib/supabase/admin";
import { CHAT_MODEL, embedQuery, getOpenAI } from "@/lib/openai/client";
import { DOCUMENT_TYPE_DANGEROUS_GOODS_LIST, DOCUMENT_TYPE_ORANGE_BOOK } from "@/lib/constants";
import type { UnEntryLookup } from "@/lib/agents/un-entries";
import { isInvalidPsnForUn } from "@/lib/agents/un-entries";
import type { RetrievedChunk } from "@/lib/types/citations";
import {
  parseUnRowFromTableC,
  extractAllTableCRows,
  selectBestRowForUn,
  selectRowsForChemical,
  tableCRowToUnEntry,
  type TableCRow,
} from "@/lib/retrieval/table-c-parse";
export { parseUnRowFromTableC } from "@/lib/retrieval/table-c-parse";

const DG_LIST_EXTRACT_PROMPT = `Extract the dangerous goods list row for the requested UN number using ONLY the provided Table C excerpts.
Copy the proper shipping name EXACTLY as written next to that UN number. Do not use outside knowledge.
If the excerpts do not contain that UN number with a proper shipping name, return {"found": false}.

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

const DG_LIST_MATCH_COUNT = 24;
const DG_LIST_MATCH_THRESHOLD = 0.05;

type ChunkRow = {
  id: string;
  document_id: string;
  content: string;
  chapter: string | null;
  section: string | null;
  page_reference: string | null;
  table_reference: string | null;
  metadata: Record<string, unknown>;
};

function toRetrievedChunk(row: ChunkRow, similarity = 1): RetrievedChunk {
  return {
    chunk_id: row.id,
    document_id: row.document_id,
    content: row.content,
    chapter: row.chapter,
    section: row.section,
    page_reference: row.page_reference,
    table_reference: row.table_reference,
    metadata: row.metadata ?? {},
    similarity,
  };
}

export async function getActiveDangerousGoodsListDocumentId(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("documents")
    .select("id")
    .eq("is_active", true)
    .eq("metadata->>document_type", DOCUMENT_TYPE_DANGEROUS_GOODS_LIST)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

export async function isDangerousGoodsListIngested(): Promise<boolean> {
  return (await getActiveDangerousGoodsListDocumentId()) !== null;
}

/** Exact row lookup by UN — primary path (no semantic guessing). */
export async function findDgListChunksByUnExact(un: string): Promise<RetrievedChunk[]> {
  const docId = await getActiveDangerousGoodsListDocumentId();
  if (!docId) return [];

  const supabase = createAdminClient();
  const seen = new Set<string>();
  const results: RetrievedChunk[] = [];

  const { data: bySection } = await supabase
    .from("chunks")
    .select("id, document_id, content, chapter, section, page_reference, table_reference, metadata")
    .eq("document_id", docId)
    .eq("section", un);

  for (const row of bySection ?? []) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      results.push(toRetrievedChunk(row as ChunkRow, 1));
    }
  }

  const { data: byContent } = await supabase
    .from("chunks")
    .select("id, document_id, content, chapter, section, page_reference, table_reference, metadata")
    .eq("document_id", docId)
    .or(`content.ilike.% ${un} %,content.ilike.%UN ${un}%`);

  for (const row of byContent ?? []) {
    if (!seen.has(row.id) && new RegExp(`\\b${un}\\b`).test(row.content)) {
      seen.add(row.id);
      results.push(toRetrievedChunk(row as ChunkRow, 0.95));
    }
  }

  return results;
}

export async function retrieveDangerousGoodsListChunks(
  query: string,
): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(
    `${query}\nUN number proper shipping name hazard class packing group Table C dangerous goods list`,
  );
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: DG_LIST_MATCH_COUNT,
    match_threshold: DG_LIST_MATCH_THRESHOLD,
    filter_document_type: DOCUMENT_TYPE_DANGEROUS_GOODS_LIST,
  });

  if (error) {
    throw new Error(`Dangerous goods list retrieval failed: ${error.message}`);
  }

  return (data ?? []) as RetrievedChunk[];
}

/** PSN must literally appear in the Table C chunk text (prevents cross-row LLM hallucination). */
export function entryMatchesChunkEvidence(entry: UnEntryLookup, chunks: RetrievedChunk[]): boolean {
  const haystack = chunks.map((c) => c.content.toUpperCase()).join("\n");
  return entry.properShippingNames.some((psn) => {
    const token = psn.slice(0, Math.min(24, psn.length));
    return haystack.includes(token);
  });
}

async function extractUnFromDgListChunksStrict(
  un: string,
  chunks: RetrievedChunk[],
): Promise<UnEntryLookup | null> {
  const relevant = chunks.filter((c) => new RegExp(`\\b${un}\\b`).test(c.content));
  if (relevant.length === 0) return null;

  const allRows = relevant.flatMap((c) => extractAllTableCRows(c.content));
  const bestRow = selectBestRowForUn(allRows, un);
  if (bestRow) {
    const parsed = parseUnRowFromTableC(un, relevant.map((c) => c.content).join(" "));
    if (parsed && entryMatchesChunkEvidence(parsed, relevant)) {
      return parsed;
    }
  }

  for (const chunk of relevant) {
    const parsed = parseUnRowFromTableC(un, chunk.content);
    if (parsed && entryMatchesChunkEvidence(parsed, [chunk])) {
      return parsed;
    }
  }

  const evidence = relevant
    .slice(0, 6)
    .map((c, i) => `[${i + 1}] ${c.content.slice(0, 1000)}`)
    .join("\n\n---\n\n");

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: DG_LIST_EXTRACT_PROMPT },
        { role: "user", content: `UN number: ${un}\n\nTable C excerpts:\n${evidence}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as UnEntryLookup & { found?: boolean; properShippingNames?: string[] };
    if (parsed.found === false || !parsed.properShippingNames?.length) return null;

    const entry: UnEntryLookup = {
      label: parsed.label ?? parsed.properShippingNames[0],
      properShippingNames: parsed.properShippingNames.map((p) => p.toUpperCase()),
      chemicalName: parsed.chemicalName,
      hazardClass: parsed.hazardClass ?? "",
      division: parsed.division,
      typicalPackingGroup: parsed.typicalPackingGroup,
      physicalState: parsed.physicalState ?? "See dangerous goods list",
      hazardProperties: parsed.hazardProperties ?? ["From ADN Table C dangerous goods list"],
      ambiguous: parsed.ambiguous,
      ambiguityNote: parsed.ambiguityNote,
    };

    if (isInvalidPsnForUn(un, entry)) return null;
    if (!entryMatchesChunkEvidence(entry, relevant)) return null;
    return entry;
  } catch {
    return null;
  }
}

/** Search Table C chunks containing a chemical name (e.g. CYCLOHEXANE). */
export async function findDgListChunksByChemicalName(
  chemical: string,
): Promise<RetrievedChunk[]> {
  const docId = await getActiveDangerousGoodsListDocumentId();
  if (!docId) return [];

  const needle = chemical.toUpperCase().replace(/\s+/g, " ");
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("chunks")
    .select("id, document_id, content, chapter, section, page_reference, table_reference, metadata")
    .eq("document_id", docId)
    .ilike("content", `%${needle}%`);

  const pattern = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return (data ?? [])
    .filter((row) => pattern.test(row.content))
    .map((row) => toRetrievedChunk(row as ChunkRow, 0.98));
}

export type ChemicalLookupResult = {
  chemical: string;
  matchingRows: TableCRow[];
  entry: UnEntryLookup | null;
  ambiguous: boolean;
  ambiguityNote?: string;
};

/** Look up chemical name in Table C + Orange Book → UN, PSN, class. */
export async function lookupChemicalFromDangerousGoodsList(
  chemical: string,
): Promise<ChemicalLookupResult | null> {
  if (!(await isDangerousGoodsListIngested())) return null;

  const normalized = chemical.toUpperCase().replace(/\s+/g, " ");
  let chunks = await findDgListChunksByChemicalName(normalized);

  if (chunks.length === 0) {
    chunks = await retrieveDangerousGoodsListChunks(
      `${normalized} proper shipping name dangerous goods list Table C`,
    );
    const pattern = new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    chunks = chunks.filter((c) => pattern.test(c.content));
  }

  const orangeBookChunks = await retrieveOrangeBookChunksForChemical(normalized);
  const allChunks = [...chunks, ...orangeBookChunks];

  const allRows = allChunks.flatMap((c) => extractAllTableCRows(c.content));
  const matchingRows = deduplicateTableCRows(selectRowsForChemical(allRows, normalized));
  if (matchingRows.length === 0) return null;

  if (matchingRows.length === 1) {
    const row = matchingRows[0];
    const entry = tableCRowToUnEntry(row, normalized);
    if (isInvalidPsnForUn(row.un, entry)) return null;
    return {
      chemical: normalized,
      matchingRows,
      entry,
      ambiguous: false,
    };
  }

  const uniqueUn = [...new Set(matchingRows.map((r) => r.un))];
  const entry = tableCRowToUnEntry(matchingRows[0], normalized);
  return {
    chemical: normalized,
    matchingRows,
    entry,
    ambiguous: uniqueUn.length > 1,
    ambiguityNote:
      uniqueUn.length > 1
        ? `Multiple UN entries match ${normalized}: ${matchingRows
            .slice(0, 6)
            .map((r) => `UN ${r.un} (${r.psn})`)
            .join("; ")}. Select the correct one or provide more details.`
        : undefined,
  };
}

async function retrieveOrangeBookChunksForChemical(chemical: string): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(
    `${chemical} UN number proper shipping name dangerous goods list classification`,
  );
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: 8,
    match_threshold: 0.55,
    filter_document_type: DOCUMENT_TYPE_ORANGE_BOOK,
  });
  if (!data) return [];
  const pattern = new RegExp(`\\b${chemical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return (data as RetrievedChunk[]).filter((c) => pattern.test(c.content));
}

function deduplicateTableCRows(rows: TableCRow[]): TableCRow[] {
  const byUn = new Map<string, TableCRow>();
  for (const r of rows) {
    const existing = byUn.get(r.un);
    if (!existing) {
      byUn.set(r.un, r);
    } else {
      const existingClean = !/ \d+(\.\d)? /.test(existing.psn);
      const newClean = !/ \d+(\.\d)? /.test(r.psn);
      if (!existingClean && newClean) {
        byUn.set(r.un, r);
      } else if (existingClean === newClean && r.psn.length < existing.psn.length) {
        byUn.set(r.un, r);
      }
    }
  }
  return [...byUn.values()];
}

/** Default substance lookup: ADN Table C dangerous goods list (when ingested). */
export async function lookupUnFromDangerousGoodsList(un: string): Promise<UnEntryLookup | null> {
  if (!(await isDangerousGoodsListIngested())) return null;

  const exactChunks = await findDgListChunksByUnExact(un);
  const fromExact = await extractUnFromDgListChunksStrict(un, exactChunks);
  if (fromExact) return fromExact;

  const vectorChunks = await retrieveDangerousGoodsListChunks(`UN ${un} proper shipping name`);
  const withUn = vectorChunks.filter((c) => new RegExp(`\\b${un}\\b`).test(c.content));
  const fromVector = await extractUnFromDgListChunksStrict(un, withUn);
  if (fromVector) return fromVector;

  return null;
}

/** @deprecated Use parseUnRowFromTableC */
export function parseUnEntryFromDgListText(un: string, text: string): UnEntryLookup | null {
  return parseUnRowFromTableC(un, text);
}
