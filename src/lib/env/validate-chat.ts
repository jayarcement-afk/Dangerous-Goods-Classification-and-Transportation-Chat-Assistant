/** Validate server env before chat orchestration (Vercel / production). */
export function getChatEnvError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL is not set on the server.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY is not set on the server.";
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const openaiFile = process.env.OPENAI_API_KEY_FILE?.trim();
  if (!openaiKey && !openaiFile) {
    return "OPENAI_API_KEY is not set on the server (do not use OPENAI_API_KEY_FILE on Vercel unless the file exists in the deployment).";
  }

  return null;
}
