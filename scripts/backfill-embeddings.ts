/**
 * Embed chunks on active documents that have no embedding row.
 * Run after fixing ingestion alignment or partial ingest failures.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createAdminClient } from "../src/lib/supabase/admin";
import { EMBEDDING_MODEL, embedTexts } from "../src/lib/openai/client";

config({ path: resolve(process.cwd(), ".env.local") });

const EMBED_BATCH = 50;

async function main() {
  const supabase = createAdminClient();

  const { data: docs, error: docError } = await supabase
    .from("documents")
    .select("id, title")
    .eq("is_active", true);

  if (docError) throw new Error(docError.message);

  let totalMissing = 0;
  let totalEmbedded = 0;

  for (const doc of docs ?? []) {
    const documentId = doc.id as string;
    console.log(`\n${doc.title}`);

    const { data: chunks, error: chunkError } = await supabase
      .from("chunks")
      .select("id, content")
      .eq("document_id", documentId)
      .order("chunk_index");

    if (chunkError) throw new Error(chunkError.message);

    const missing: { id: string; content: string }[] = [];
    const chunkList = chunks ?? [];

    for (let i = 0; i < chunkList.length; i += 200) {
      const batch = chunkList.slice(i, i + 200);
      const ids = batch.map((c) => c.id as string);
      const { data: existing } = await supabase
        .from("embeddings")
        .select("chunk_id")
        .in("chunk_id", ids);

      const have = new Set((existing ?? []).map((e) => e.chunk_id as string));
      for (const c of batch) {
        if (!have.has(c.id as string)) {
          missing.push({ id: c.id as string, content: c.content as string });
        }
      }
    }

    console.log(`  missing embeddings: ${missing.length}`);
    totalMissing += missing.length;

    for (let i = 0; i < missing.length; i += EMBED_BATCH) {
      const batch = missing.slice(i, i + EMBED_BATCH);
      const vectors = await embedTexts(batch.map((c) => c.content));
      const rows = batch.map((chunk, idx) => ({
        chunk_id: chunk.id,
        embedding: vectors[idx],
        model: EMBEDDING_MODEL,
      }));

      const { error } = await supabase.from("embeddings").insert(rows);
      if (error) throw new Error(`Insert failed: ${error.message}`);
      totalEmbedded += rows.length;
      process.stdout.write(`  embedded ${Math.min(i + EMBED_BATCH, missing.length)}/${missing.length}\r`);
    }
    if (missing.length > 0) console.log("");
  }

  console.log(`\nDone. Missing found: ${totalMissing}, embedded: ${totalEmbedded}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
