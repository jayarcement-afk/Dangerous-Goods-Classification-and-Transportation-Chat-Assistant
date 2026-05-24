import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";

export type PageText = {
  pageNumber: number;
  text: string;
};

/** Place manually downloaded Orange Book PDFs here when UNECE blocks automated fetch. */
export const LOCAL_PDF_PATHS: Record<string, string> = {
  "vol-1": "data/pdfs/vol-1.pdf",
  "vol-2": "data/pdfs/vol-2.pdf",
  "table-c-adn": "data/pdfs/table-c-adn.pdf",
};

/** Alternate locations users sometimes save to by mistake */
const LOCAL_PDF_FALLBACKS: Record<string, string[]> = {
  "vol-1": ["data/vol-1.pdf"],
  "vol-2": ["data/vol-2.pdf"],
  "table-c-adn": ["data/pdfs/7-TableC-E.pdf", "data/table-c-adn.pdf"],
};

export function getLocalPdfPath(sourceId: string): string {
  return path.join(process.cwd(), LOCAL_PDF_PATHS[sourceId] ?? `data/pdfs/${sourceId}.pdf`);
}

export function findLocalPdfPath(sourceId: string): string | null {
  const candidates = [
    getLocalPdfPath(sourceId),
    ...(LOCAL_PDF_FALLBACKS[sourceId] ?? []).map((p) => path.join(process.cwd(), p)),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function extractPdfPages(buffer: Buffer): Promise<PageText[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;
  const pages: PageText[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 0) {
      pages.push({ pageNumber: i, text });
    }
  }

  return pages;
}

export async function fetchPdfBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://unece.org/transport/dangerous-goods/un-model-regulations-rev24",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download PDF (${response.status}): ${url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(
      `URL returned HTML instead of a PDF (likely blocked). Download manually to data/pdfs/.`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function loadPdfBuffer(sourceId: string, url: string): Promise<Buffer> {
  const localPath = findLocalPdfPath(sourceId);

  if (localPath) {
    console.log(`  Using local PDF: ${localPath}`);
    return readFile(localPath);
  }

  const expectedPath = getLocalPdfPath(sourceId);

  try {
    console.log(`  Downloading from UNECE…`);
    return await fetchPdfBuffer(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}\n\nUNECE often blocks automated downloads (403). Please:\n` +
        `  1. Open ${url}\n` +
        `  2. Save the PDF as: ${expectedPath}\n` +
        `  3. Re-run: npm run ingest -- --source ${sourceId}`,
    );
  }
}
