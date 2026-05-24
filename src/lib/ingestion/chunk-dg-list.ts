import type { PageText } from "./pdf";
import type { TextChunk } from "./chunk";
import { extractAllTableCRows } from "@/lib/retrieval/table-c-parse";

/** Smaller chunks improve recall for dense UN / PSN table rows */
const TARGET_CHARS = 700;
const OVERLAP_CHARS = 100;

/**
 * Chunk dangerous-goods list PDFs (e.g. ADN Table C) with UN-row awareness.
 */
export function chunkDangerousGoodsListPages(pages: PageText[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  let index = 0;

  for (const page of pages) {
    const normalized = page.text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
    if (!normalized) continue;

    const rowSegments = extractUnRowSegments(normalized);
    const segments = rowSegments.length > 0 ? rowSegments : splitFixed(normalized);

    for (const segment of segments) {
      const unMatch = segment.match(/\b(\d{4})\b/);
      chunks.push({
        content: `UN ${unMatch?.[1] ?? "?" } ${segment}`.replace(/^UN \? /, ""),
        pageReference: String(page.pageNumber),
        chapter: "Table C",
        section: unMatch?.[1] ?? null,
        chunkIndex: index++,
        metadata: {
          source_page: page.pageNumber,
          document_type: "dangerous_goods_list",
          un_number: unMatch?.[1] ?? null,
        },
      });
    }
  }

  return chunks;
}

function extractUnRowSegments(text: string): string[] {
  const rows = extractAllTableCRows(text);
  if (rows.length > 0) {
    return rows.map((r) => `${r.un} ${r.psn} ${r.hazardClass} ${r.classificationCode}`);
  }
  return [];
}

function splitFixed(text: string): string[] {
  const segments: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + TARGET_CHARS, text.length);
    if (end < text.length) {
      const breakAt = text.lastIndexOf(" ", start + TARGET_CHARS - 80);
      if (breakAt > start + 200) end = breakAt;
    }
    const slice = text.slice(start, end).trim();
    if (slice) segments.push(slice);
    if (end >= text.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }
  return segments;
}
