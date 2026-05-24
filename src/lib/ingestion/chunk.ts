import type { PageText } from "./pdf";

export type TextChunk = {
  content: string;
  pageReference: string;
  chapter: string | null;
  section: string | null;
  chunkIndex: number;
  metadata: Record<string, unknown>;
};

const TARGET_CHARS = 1200;
const OVERLAP_CHARS = 150;

const CHAPTER_RE = /\b(?:Chapter|CHAPTER|Part|PART)\s+[\d.A-Za-z]+(?:\s*[-–—]\s*[^\n]{0,80})?/g;
const SECTION_RE = /^\s*(\d+\.\d+(?:\.\d+)?)\s+/m;

function detectChapter(text: string): string | null {
  const matches = text.match(CHAPTER_RE);
  return matches?.[matches.length - 1]?.trim() ?? null;
}

function detectSection(text: string): string | null {
  const match = SECTION_RE.exec(text.slice(0, 200));
  return match?.[1] ?? null;
}

function splitPageIntoSegments(text: string): string[] {
  const normalized = text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= TARGET_CHARS) return [normalized];

  const segments: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + TARGET_CHARS, normalized.length);
    if (end < normalized.length) {
      const breakAt = normalized.lastIndexOf(". ", start + TARGET_CHARS - 200);
      if (breakAt > start + 400) end = breakAt + 1;
    }
    segments.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }
  return segments;
}

export function chunkPages(pages: PageText[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  let index = 0;
  let runningChapter: string | null = null;

  for (const page of pages) {
    const detected = detectChapter(page.text);
    const pageChapter: string | null = detected ?? runningChapter;
    if (detected) runningChapter = detected;

    for (const segment of splitPageIntoSegments(page.text)) {
      const section = detectSection(segment);
      chunks.push({
        content: segment,
        pageReference: String(page.pageNumber),
        chapter: pageChapter ?? runningChapter,
        section,
        chunkIndex: index++,
        metadata: { source_page: page.pageNumber },
      });
    }
  }

  return chunks;
}
