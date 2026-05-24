import { config } from "dotenv";
import { resolve } from "path";
import { createAdminClient } from "../src/lib/supabase/admin";
import { embedQuery } from "../src/lib/openai/client";
import {
  expandSearchQuery,
  hasSufficientEvidence,
  retrieveWithFallback,
  textForEmbedding,
} from "../src/lib/retrieval/search";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const supabase = createAdminClient();

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, is_active, upload_status")
    .eq("is_active", true);

  console.log("Active documents:", docs?.length ?? 0);
  for (const d of docs ?? []) {
    const { count } = await supabase
      .from("chunks")
      .select("*", { count: "exact", head: true })
      .eq("document_id", d.id);
    console.log(`  - ${d.title}: ${count ?? 0} chunks`);
  }

  const q = "What does the Orange Book say about Class 3 flammable liquids?";
  console.log("\nQuery:", q);
  console.log("Expanded:", expandSearchQuery(q).slice(0, 200), "...");

  const embedding = await embedQuery(textForEmbedding(q));
  console.log("Embedding dims:", embedding.length);

  for (const threshold of [0.5, 0.3, 0.18, 0.1, 0.05]) {
    const { data, error } = await supabase.rpc("match_chunks", {
      query_embedding: embedding,
      match_count: 12,
      match_threshold: threshold,
    });
    if (error) {
      console.log(`threshold ${threshold}: ERROR`, error.message);
    } else {
      console.log(`threshold ${threshold}: ${data?.length ?? 0} chunks, top sim=${data?.[0]?.similarity?.toFixed(3) ?? "n/a"}`);
    }
  }

  const chunks = await retrieveWithFallback(q);
  console.log("\nretrieveWithFallback:", chunks.length, "chunks");
  if (chunks[0]) {
    console.log("top similarity:", chunks[0].similarity);
    console.log("top excerpt:", chunks[0].content.slice(0, 150));
  }
  console.log("hasSufficientEvidence (lookup):", hasSufficientEvidence(chunks, "lookup_rule"));

  const { data: ilike } = await supabase
    .from("chunks")
    .select("id, content, chapter")
    .ilike("content", "%Class 3%")
    .limit(3);
  console.log("\nKeyword ilike '%Class 3%':", ilike?.length ?? 0, "sample rows");
}

main().catch(console.error);
