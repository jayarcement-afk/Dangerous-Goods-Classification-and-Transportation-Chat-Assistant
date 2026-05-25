import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/** Read a secret from env var or from a file path (one line, trimmed). */
export function readSecret(envName: string, fileEnvName?: string): string | undefined {
  const direct = process.env[envName]?.trim().replace(/^['"]|['"]$/g, "");
  if (direct) return direct;

  const fileVar = fileEnvName ?? `${envName}_FILE`;
  const filePath = process.env[fileVar]?.trim();
  if (!filePath) return undefined;

  const absolute = resolve(process.cwd(), filePath);
  if (!existsSync(absolute)) {
    console.warn(`[secrets] ${fileVar} points to missing file: ${absolute}`);
    return undefined;
  }

  return readFileSync(absolute, "utf8").trim();
}
