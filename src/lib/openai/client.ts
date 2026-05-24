import OpenAI from "openai";
import { readSecret } from "@/lib/env/secrets";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const CHAT_MODEL = "gpt-4o-mini";
export const EMBEDDING_DIMENSIONS = 1536;

let client: OpenAI | null = null;

export function getOpenAIApiKey(): string {
  const key = readSecret("OPENAI_API_KEY");
  if (!key) {
    throw new Error(
      "Missing OPENAI_API_KEY. Set it in .env.local or set OPENAI_API_KEY_FILE to a one-line key file.",
    );
  }
  return key;
}

export function getOpenAI(): OpenAI {
  const apiKey = getOpenAIApiKey();
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
