import { createAdminClient } from "@/lib/supabase/admin";
import { EMBEDDING_MODEL, embedTexts } from "@/lib/openai/client";
import { chunkPages, type TextChunk } from "@/lib/ingestion/chunk";
import { chunkDangerousGoodsListPages } from "@/lib/ingestion/chunk-dg-list";
import { DOCUMENT_TYPE_ORANGE_BOOK } from "@/lib/constants";
import { extractPdfPages, loadPdfBuffer } from "@/lib/ingestion/pdf";
import { sanitizeMetadata, sanitizeText } from "@/lib/ingestion/sanitize";

export type IngestSource = {
  id: string;
  title: string;
  edition: string;
  sourceUrl: string;
  documentType?: string;
  chunkStrategy?: "default" | "dangerous_goods_list";
};

export type IngestResult = {
  documentId: string;
  title: string;
  chunksCreated: number;
  embeddingsCreated: number;
};

const EMBED_BATCH = 50;
const INSERT_BATCH = 100;

export async function ingestPdfFromBuffer(
  source: IngestSource,
  buffer: Buffer,
): Promise<IngestResult> {
  const supabase = createAdminClient();
  const pages = await extractPdfPages(buffer);
  if (pages.length === 0) {
    throw new Error(`No text extracted from PDF: ${source.title}`);
  }

  const textChunks =
    source.chunkStrategy === "dangerous_goods_list"
      ? chunkDangerousGoodsListPages(pages)
      : chunkPages(pages);
  if (textChunks.length === 0) {
    throw new Error(`No chunks produced from PDF: ${source.title}`);
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      title: source.title,
      edition: source.edition,
      source_url: source.sourceUrl,
      upload_status: "processing",
      is_active: false,
      metadata: {
        page_count: pages.length,
        chunk_count: textChunks.length,
        document_type: source.documentType ?? DOCUMENT_TYPE_ORANGE_BOOK,
        corpus_role:
          source.chunkStrategy === "dangerous_goods_list"
            ? "substance_lookup_primary"
            : "regulatory_text",
      },
    })
    .select("id")
    .single();

  if (docError || !document) {
    throw new Error(`Failed to create document: ${docError?.message}`);
  }

  const documentId = document.id as string;

  try {
    const chunkRows = await insertChunks(supabase, documentId, textChunks);
    const embeddingsCreated = await insertEmbeddings(supabase, chunkRows);

    await supabase
      .from("documents")
      .update({ upload_status: "active", is_active: true })
      .eq("id", documentId);

    await supabase
      .from("documents")
      .update({ is_active: false, upload_status: "archived" })
      .eq("source_url", source.sourceUrl)
      .neq("id", documentId);

    return {
      documentId,
      title: source.title,
      chunksCreated: chunkRows.length,
      embeddingsCreated,
    };
  } catch (error) {
    await supabase
      .from("documents")
      .update({ upload_status: "failed" })
      .eq("id", documentId);
    throw error;
  }
}

export async function ingestPdfFromUrl(source: IngestSource): Promise<IngestResult> {
  const buffer = await loadPdfBuffer(source.id, source.sourceUrl);
  return ingestPdfFromBuffer(source, buffer);
}

type ChunkRow = { id: string; content: string };

async function insertChunks(
  supabase: ReturnType<typeof createAdminClient>,
  documentId: string,
  textChunks: TextChunk[],
): Promise<ChunkRow[]> {
  const rows: ChunkRow[] = [];

  for (let i = 0; i < textChunks.length; i += INSERT_BATCH) {
    const batch = textChunks.slice(i, i + INSERT_BATCH);
    const pending: { content: string; row: Record<string, unknown> }[] = [];

    for (const c of batch) {
      const content = sanitizeText(c.content);
      if (!content) continue;
      pending.push({
        content,
        row: {
          document_id: documentId,
          content,
          chapter: sanitizeText(c.chapter),
          section: sanitizeText(c.section),
          page_reference: sanitizeText(c.pageReference) ?? String(c.chunkIndex),
          table_reference: null,
          chunk_index: c.chunkIndex,
          metadata: sanitizeMetadata(c.metadata),
        },
      });
    }

    if (pending.length === 0) continue;

    const { data, error } = await supabase
      .from("chunks")
      .insert(pending.map((p) => p.row))
      .select("id");
    if (error) {
      throw new Error(
        `Chunk insert failed (batch ${i}-${i + batch.length}, index ~${textChunks[i]?.chunkIndex}): ${error.message}`,
      );
    }

    const ids = data?.map((r) => r.id as string) ?? [];
    if (ids.length !== pending.length) {
      throw new Error("Chunk insert returned unexpected id count");
    }
    for (let j = 0; j < ids.length; j++) {
      rows.push({ id: ids[j], content: pending[j].content });
    }
  }

  return rows;
}

async function insertEmbeddings(
  supabase: ReturnType<typeof createAdminClient>,
  chunkRows: ChunkRow[],
): Promise<number> {
  let total = 0;

  for (let i = 0; i < chunkRows.length; i += EMBED_BATCH) {
    const batch = chunkRows.slice(i, i + EMBED_BATCH);
    const vectors = await embedTexts(batch.map((c) => c.content));

    const rows = batch.map((chunk, idx) => ({
      chunk_id: chunk.id,
      embedding: vectors[idx],
      model: EMBEDDING_MODEL,
    }));

    const { error } = await supabase.from("embeddings").insert(rows);
    if (error) throw new Error(`Embedding insert failed: ${error.message}`);
    total += rows.length;
  }

  return total;
}
