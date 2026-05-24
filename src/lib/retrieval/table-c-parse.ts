import type { UnEntryLookup } from "@/lib/agents/un-entries";
import { isInvalidPsnForUn } from "@/lib/agents/un-entries";

export type TableCRow = {
  un: string;
  psn: string;
  hazardClass: string;
  division?: string;
  classificationCode: string;
};

/**
 * ADN Table C row pattern: UN | Name | Class (3a) | Classification code (3b)
 * Example: 1093 ACRYLONITRILE, STABILIZED 3 FT1
 */
const TABLE_C_ROW_RE =
  /\b(\d{4})\s+([A-Z][A-Za-z0-9,().\- ]{4,120}?)\s+(\d(?:\.\d)?)\s+([A-Z0-9]{2,4})\b/g;

/** Fragments from broken PDF extraction — not valid proper shipping names alone */
const PSN_FRAGMENT_BLOCKLIST =
  /^(?:ABILIZED|STABILIZED|ANHYDROUS|RYLONITRILE|ACRYLONITRILE)$/i;

export function extractAllTableCRows(text: string): TableCRow[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const rows: TableCRow[] = [];
  TABLE_C_ROW_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TABLE_C_ROW_RE.exec(normalized)) !== null) {
    const un = match[1];
    const psn = match[2].trim().replace(/\s+/g, " ");
    const hazardClass = match[3];
    const classificationCode = match[4];

    if (!isPlausiblePsn(psn)) continue;

    rows.push({
      un,
      psn: psn.toUpperCase(),
      hazardClass: hazardClass.split(".")[0],
      division: hazardClass.includes(".") ? hazardClass : undefined,
      classificationCode,
    });
  }

  return rows;
}

export function isPlausiblePsn(psn: string): boolean {
  const upper = psn.toUpperCase().trim();
  if (upper.length < 5 || upper.length > 120) return false;
  if (PSN_FRAGMENT_BLOCKLIST.test(upper)) return false;
  if (/^\d/.test(upper)) return false;
  if (/\bUN\s*\d{4}\b/.test(upper)) return false;
  if (/\(\d+[A-Z]?\)/.test(upper)) return false;
  if (/\b\d{4}\b/.test(upper)) return false;
  // Single-word PSNs (e.g. CYCLOHEXANE, ACETONE) are valid; blocklist catches PDF fragments.
  if (upper.split(/\s+/).length === 1 && upper.length < 5) return false;
  return /^[A-Z]/.test(upper);
}

export function scoreTableCRow(row: TableCRow): number {
  let score = row.psn.length;
  if (row.psn.includes(",")) score += 20;
  if (row.psn.split(/\s+/).length >= 2) score += 10;
  if (/^[A-Z0-9]{2,4}$/.test(row.classificationCode)) score += 5;
  return score;
}

export function selectBestRowForUn(rows: TableCRow[], un: string): TableCRow | null {
  const candidates = rows.filter((r) => r.un === un);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => scoreTableCRow(b) - scoreTableCRow(a));
  return candidates[0];
}

/** Words after the base name that indicate a formulation of the same substance (not a different chemical). */
const FORMULATION_MODIFIER =
  /^(?:REFRIGERATED|MOLTEN|STABILIZED|LIQUID|GAS|SOLID|ANHYDROUS|PURE|AQUEOUS|COMPRESSED|LIQUEFIED|SOLUTION|MIXTURE|DECOMPOSITION)\b/i;

export function scoreChemicalMatch(row: TableCRow, chemical: string): number {
  const needle = chemical.toUpperCase().replace(/\s+/g, " ");
  const psn = row.psn.toUpperCase();
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordBoundary = new RegExp(`\\b${escaped}\\b`);

  if (psn === needle) return 100;
  if (psn.startsWith(`${needle},`)) return 95;
  if (needle.startsWith(psn) || psn.startsWith(needle)) return 96;

  const primary = psn.split(",")[0]?.trim() ?? psn;
  if (primary === needle) return 98;

  const primaryWords = primary.split(/\s+/);
  if (primaryWords[0] === needle) {
    if (primaryWords.length === 1) return 98;
    const rest = primaryWords.slice(1).join(" ");
    if (FORMULATION_MODIFIER.test(rest)) return 92;
    // Different chemical sharing a prefix (e.g. ETHYLENE DICHLORIDE, ETHYLENE GLYCOL)
    return 35;
  }

  if (wordBoundary.test(primary)) {
    const ratio = needle.length / primary.length;
    return ratio >= 0.75 ? 72 : 38;
  }

  const parenthetical = psn.match(/\(([^)]+)\)/)?.[1] ?? "";
  if (parenthetical && wordBoundary.test(parenthetical)) return 22;

  if (wordBoundary.test(psn)) return 30;
  return 0;
}

export function selectRowsForChemical(rows: TableCRow[], chemical: string): TableCRow[] {
  const scored = rows
    .map((row) => ({ row, score: scoreChemicalMatch(row, chemical) }))
    .filter((x) => x.score >= 50);
  scored.sort((a, b) => b.score - a.score || scoreTableCRow(b.row) - scoreTableCRow(a.row));
  if (scored.length === 0) return [];

  const topScore = scored[0].score;
  if (scored.length > 1 && topScore - scored[1].score >= 25) {
    return [scored[0].row];
  }

  const threshold = Math.max(50, topScore - 5);
  return scored.filter((x) => x.score >= threshold).map((x) => x.row);
}

export function tableCRowToUnEntry(row: TableCRow, chemicalName?: string): UnEntryLookup {
  return {
    label: row.psn.slice(0, 80),
    properShippingNames: [row.psn],
    chemicalName: chemicalName ?? row.psn.split(",")[0].trim(),
    hazardClass: row.hazardClass,
    division: row.division,
    physicalState: "See dangerous goods list entry",
    hazardProperties: [
      "From ADN Table C dangerous goods list",
      `Classification code: ${row.classificationCode}`,
    ],
  };
}

export function parseUnRowFromTableC(un: string, text: string): UnEntryLookup | null {
  if (!new RegExp(`\\b${un}\\b`).test(text)) return null;

  const rows = extractAllTableCRows(text);
  const best = selectBestRowForUn(rows, un);
  if (!best) return null;

  const entry: UnEntryLookup = {
    label: best.psn.slice(0, 80),
    properShippingNames: [best.psn],
    hazardClass: best.hazardClass,
    division: best.division,
    physicalState: "See dangerous goods list entry",
    hazardProperties: [
      `From ADN Table C dangerous goods list`,
      `Classification code: ${best.classificationCode}`,
    ],
  };

  if (isInvalidPsnForUn(un, entry)) return null;
  return entry;
}
