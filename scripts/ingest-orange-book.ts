/**
 * Ingest UN Orange Book PDFs into Supabase.
 * Requires: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage: npm run ingest
 *        npm run ingest -- --source vol-1
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readSecret } from "../src/lib/env/secrets";
import { ALL_INGEST_SOURCES } from "../src/lib/constants";
import { ingestPdfFromUrl } from "../src/lib/ingestion/pipeline";

config({ path: resolve(process.cwd(), ".env.local") });

function requireEnv(): void {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!readSecret("OPENAI_API_KEY")) {
    missing.push("OPENAI_API_KEY (or OPENAI_API_KEY_FILE)");
  }

  if (missing.length > 0) {
    console.error("\nMissing or empty values in .env.local:\n");
    for (const key of missing) console.error(`  • ${key}`);
    console.error(
      "\nGet Supabase values: Dashboard → Project Settings → API\n" +
        "  • Project URL → NEXT_PUBLIC_SUPABASE_URL\n" +
        "  • service_role (secret) → SUPABASE_SERVICE_ROLE_KEY\n" +
        "OpenAI: create a new key at platform.openai.com/api-keys\n" +
        "  • Paste into OPENAI_API_KEY= in .env.local, OR\n" +
        "  • Save key in a file and set OPENAI_API_KEY_FILE=path/to/file\n" +
        "\nSave .env.local and run ingest again.\n",
    );
    process.exit(1);
  }
}

async function main() {
  requireEnv();
  const arg = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1]
    ?? (process.argv.includes("--source") ? process.argv[process.argv.indexOf("--source") + 1] : "all");

  const sources =
    arg === "all" ? ALL_INGEST_SOURCES : ALL_INGEST_SOURCES.filter((s) => s.id === arg);

  if (sources.length === 0) {
    console.error(`Unknown source: ${arg}. Use table-c-adn, vol-1, vol-2, or all.`);
    process.exit(1);
  }

  console.log(`Ingesting ${sources.length} document(s)...\n`);

  for (const source of sources) {
    console.log(`→ ${source.title}`);
    console.log(`  ${source.url}`);
    const start = Date.now();
    const result = await ingestPdfFromUrl({
      id: source.id,
      title: source.title,
      edition: source.edition,
      sourceUrl: source.url,
      documentType: source.documentType,
      chunkStrategy: source.chunkStrategy,
    });
    const sec = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  ✓ ${result.chunksCreated} chunks, ${result.embeddingsCreated} embeddings (${sec}s)\n`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
