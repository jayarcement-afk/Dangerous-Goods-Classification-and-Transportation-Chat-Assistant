/**
 * Extract chemical / proper-shipping-name tokens from user messages for Table C lookup.
 */

const NOT_CHEMICAL = new Set([
  "YOUR",
  "PRODUCT",
  "MY",
  "OUR",
  "THE",
  "AND",
  "FOR",
  "ARE",
  "NOT",
  "ALL",
  "ANY",
  "CAN",
  "WILL",
  "HAS",
  "HAVE",
  "WITH",
  "THAT",
  "THIS",
  "FROM",
  "INTO",
  "CLASS",
  "HAZARD",
  "DANGEROUS",
  "GOOD",
  "GOODS",
  "CLASSIFIED",
  "CLASSIFICATION",
  "TRANSPORT",
  "ORANGE",
  "BOOK",
  "UN",
  "NUMBER",
  "WHAT",
  "WHEN",
  "WHERE",
  "HOW",
  "DOES",
  "WANT",
  "NEED",
  "KNOW",
  "ABOUT",
  "LIKE",
  "JUST",
  "ONLY",
  "ALSO",
  "VERY",
  "MUCH",
  "SOME",
  "MORE",
  "THAN",
  "THEY",
  "THEM",
  "WOULD",
  "COULD",
  "SHOULD",
  "BEEN",
  "BEING",
  "THERE",
  "THEIR",
  "WHICH",
  "WHILE",
  "AFTER",
  "BEFORE",
  "OTHER",
  "THESE",
  "THOSE",
  "THEN",
  "WELL",
  "MAKE",
  "MADE",
  "MOST",
  "MANY",
  "SUCH",
  "OVER",
  "UNDER",
  "PER",
]);

/** Second word of a PSN that is not meaningful alone (e.g. ETHER in DIETHYL ETHER). */
const WEAK_STANDALONE_CHEMICAL = new Set([
  "ETHER",
  "GLYCOL",
  "ALCOHOL",
  "KETONE",
  "ESTER",
  "AMINE",
  "OXIDE",
  "CHLORIDE",
  "BROMIDE",
  "IODIDE",
  "FLUORIDE",
  "NITRATE",
  "SULFATE",
  "HYDRIDE",
  "ACID",
  "BASE",
  "SALT",
  "LIQUID",
  "GAS",
  "SOLID",
]);

/** e.g. AMMONIA, ANHYDROUS, DEEPLY REFRIGERATED; ACRYLONITRILE, STABILIZED */
const ALLCAPS_COMMA_PSN =
  /\b([A-Z][A-Z0-9-]{2,}(?:,\s*[A-Z][A-Z0-9-]+(?:\s+[A-Z][A-Z0-9-]+)*)+)\b/g;

/** e.g. DIETHYL ETHER, ETHYLENE GLYCOL, SODIUM HYDROXIDE SOLUTION */
const ALLCAPS_MULTI_WORD =
  /\b([A-Z][A-Z0-9-]{2,}(?:\s+[A-Z][A-Z0-9-]{2,}){1,3})\b/g;

/** e.g. CYCLOHEXANE, ACETONE, SODIUM-HYPOCHLORITE */
const ALLCAPS_CHEMICAL =
  /\b([A-Z][A-Z0-9-]{3,}(?:,\s*[A-Z][A-Z0-9-]+)*)\b/g;

/** e.g. "has cyclohexane in it", "contains 30% acetone" */
const EMBEDDED_CHEMICAL =
  /\b(?:contains?|has|with|including|compris(?:ed|ing)?\s+of)\s+(?:\d+(?:\.\d+)?\s*%?\s*)?([A-Za-z][A-Za-z0-9, \-()]{3,}?)(?:\s+in\b|\s+and\b|\s+or\b|,|\.|$)/gi;

export function normalizeChemicalName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

function isLikelyChemicalToken(token: string): boolean {
  const upper = normalizeChemicalName(token);
  if (upper.length < 4 || upper.length > 120) return false;
  const parts = upper.split(/[\s,]+/).filter(Boolean);
  if (parts.some((p) => NOT_CHEMICAL.has(p))) return false;
  if (parts.length === 1 && WEAK_STANDALONE_CHEMICAL.has(parts[0])) return false;
  if (/^\d+$/.test(upper)) return false;
  if (/^UN\d/.test(upper)) return false;
  return /^[A-Z]/.test(upper);
}

function mergePairOfChemicalNames(a: string, b: string): string | null {
  if (a.includes(b)) return a;
  if (b.includes(a)) return b;

  const partsA = a.split(/,\s*/);
  const lastA = partsA[partsA.length - 1]?.trim() ?? "";
  const firstB = b.split(/\s+/)[0] ?? "";
  if (lastA && firstB && lastA.split(/\s+/).pop() === firstB) {
    return [...partsA.slice(0, -1), b].join(", ");
  }

  const partsB = b.split(/,\s*/);
  const lastB = partsB[partsB.length - 1]?.trim() ?? "";
  const firstA = a.split(/\s+/)[0] ?? "";
  if (lastB && firstA && lastB.split(/\s+/).pop() === firstA) {
    return [...partsB.slice(0, -1), a].join(", ");
  }

  return null;
}

function mergeOverlappingChemicalNames(names: string[]): string[] {
  let list = [...names];
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const merged = mergePairOfChemicalNames(list[i], list[j]);
        if (merged) {
          list = list.filter((_, k) => k !== i && k !== j);
          list.push(merged);
          changed = true;
          break outer;
        }
      }
    }
  }
  return list;
}

function chemicalNameQualityScore(name: string): number {
  let score = name.length;
  score += (name.match(/,/g)?.length ?? 0) * 20;
  if (/\b(REFRIGERATED|STABILIZED|ANHYDROUS|SOLUTION|MIXTURE)\b/i.test(name)) score += 15;
  if (/,\s*[A-Z]+\s*$/i.test(name) && !/\s/.test(name.split(",").pop()?.trim() ?? "")) {
    score -= 25;
  }
  return score;
}

/** Prefer the most complete PSN-style name (e.g. full comma-separated entry). */
export function pickPrimaryChemicalName(chemicals: string[]): string | null {
  if (chemicals.length === 0) return null;
  const merged = mergeOverlappingChemicalNames(chemicals);
  return merged.reduce((best, next) =>
    chemicalNameQualityScore(next) > chemicalNameQualityScore(best) ? next : best,
  );
}

export function extractChemicalNamesFromText(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const consumed: Array<{ start: number; end: number }> = [];

  const isInsideConsumed = (start: number, end: number) =>
    consumed.some((r) => start >= r.start && end <= r.end);

  const add = (raw: string, start?: number, end?: number) => {
    const name = normalizeChemicalName(raw);
    if (!isLikelyChemicalToken(name)) return;
    if (seen.has(name)) return;
    seen.add(name);
    found.push(name);
    if (start !== undefined && end !== undefined) {
      consumed.push({ start, end });
    }
  };

  EMBEDDED_CHEMICAL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EMBEDDED_CHEMICAL.exec(text)) !== null) {
    if (m[1]) add(m[1], m.index, m.index + m[0].length);
  }

  ALLCAPS_COMMA_PSN.lastIndex = 0;
  while ((m = ALLCAPS_COMMA_PSN.exec(text)) !== null) {
    if (m[1]) add(m[1], m.index, m.index + m[0].length);
  }

  ALLCAPS_MULTI_WORD.lastIndex = 0;
  while ((m = ALLCAPS_MULTI_WORD.exec(text)) !== null) {
    if (m[1]) add(m[1], m.index, m.index + m[0].length);
  }

  ALLCAPS_CHEMICAL.lastIndex = 0;
  while ((m = ALLCAPS_CHEMICAL.exec(text)) !== null) {
    if (!m[1]) continue;
    const start = m.index;
    const end = m.index + m[0].length;
    if (isInsideConsumed(start, end)) continue;
    add(m[1], start, end);
  }

  return found;
}

export function isPrimarilyChemicalLookupQuery(message: string, fullContext: string): boolean {
  const chemicals = extractChemicalNamesFromText(`${fullContext}\n${message}`);
  if (chemicals.length === 0) return false;
  if (/\bUN\s*\d{4}\b/i.test(message)) return false;

  const withoutChem = message.replace(
    new RegExp(chemicals.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi"),
    "",
  );
  return withoutChem.trim().length < 160;
}
