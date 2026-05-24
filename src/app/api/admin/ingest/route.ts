import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyIngestAuth } from "@/lib/auth/ingest";
import { ingestPdfFromUrl } from "@/lib/ingestion/pipeline";
import { ALL_INGEST_SOURCES } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  sourceId: z.enum(["table-c-adn", "vol-1", "vol-2", "all"]).optional().default("all"),
});

export async function POST(request: NextRequest) {
  if (!verifyIngestAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sourceId: "table-c-adn" | "vol-1" | "vol-2" | "all" = "all";
  try {
    const json = await request.json().catch(() => ({}));
    sourceId = bodySchema.parse(json).sourceId;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const sources =
    sourceId === "all"
      ? ALL_INGEST_SOURCES
      : ALL_INGEST_SOURCES.filter((s) => s.id === sourceId);

  const results = [];
  const errors = [];

  for (const source of sources) {
    try {
      const result = await ingestPdfFromUrl({
        id: source.id,
        title: source.title,
        edition: source.edition,
        sourceUrl: source.url,
        documentType: source.documentType,
        chunkStrategy: source.chunkStrategy,
      });
      results.push(result);
    } catch (error) {
      errors.push({
        sourceId: source.id,
        title: source.title,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    results,
    errors,
  });
}
