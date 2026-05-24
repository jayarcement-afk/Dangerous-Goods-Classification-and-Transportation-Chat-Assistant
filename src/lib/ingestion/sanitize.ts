/** Remove control chars and null bytes that break Postgres / JSON transport. */
export function sanitizeText(text: string | null | undefined): string | null {
  if (text == null) return null;
  const cleaned = text
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // PDF math/special fonts often yield lone surrogates (e.g. 𝑘) that break PostgREST inserts
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\uFFFD/g, "")
    .normalize("NFC")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Ensure jsonb-safe plain object (no undefined, NaN, etc.). */
export function sanitizeMetadata(meta: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    } else if (typeof value === "string") {
      const s = sanitizeText(value);
      if (s) out[key] = s.slice(0, 500);
    }
  }
  return JSON.parse(JSON.stringify(out)) as Record<string, string | number | boolean>;
}
