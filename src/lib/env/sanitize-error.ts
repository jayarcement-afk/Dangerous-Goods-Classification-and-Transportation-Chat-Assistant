/** Strip secrets from error messages before returning to the client. */
export function sanitizeClientErrorMessage(message: string): string {
  return message
    .replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***")
    .replace(/Incorrect API key provided:[^\n.]*/i, "Incorrect API key provided.")
    .trim();
}

export function toClientSafeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown error";

  if (/incorrect api key|invalid_api_key|401/i.test(raw)) {
    return (
      "OpenAI rejected the API key (401). In Vercel → Settings → Environment Variables, " +
      "delete OPENAI_API_KEY, paste a fresh key from https://platform.openai.com/api-keys " +
      "(no quotes or spaces), apply to Production, then Redeploy. Do not use OPENAI_API_KEY_FILE on Vercel."
    );
  }

  return sanitizeClientErrorMessage(raw);
}
