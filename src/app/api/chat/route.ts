import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildStarterPromptClarification } from "@/lib/agents/starter-prompts";
import { runChatOrchestrator } from "@/lib/agents/orchestrator";
import { getChatEnvError } from "@/lib/env/validate-chat";
import { toClientSafeError } from "@/lib/env/sanitize-error";
import { PROMPT_VERSION } from "@/lib/agents/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const historySchema = z.array(
  z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(8000),
  }),
);

const bodySchema = z.object({
  message: z.string().min(3).max(8000),
  history: historySchema.max(20).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());

    const starterClarification = buildStarterPromptClarification(body.message);
    if (starterClarification) {
      return NextResponse.json(starterClarification);
    }

    const envError = getChatEnvError();
    if (envError) {
      return NextResponse.json(
        {
          status: "refusal",
          refusalReason: `Server configuration error: ${envError} Add the missing variables in Vercel → Project → Settings → Environment Variables, then redeploy.`,
          modelVersion: "unknown",
          promptVersion: PROMPT_VERSION,
        },
        { status: 503 },
      );
    }

    const response = await runChatOrchestrator(body.message, {
      history: body.history,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    console.error("[/api/chat]", error);
    const detail = toClientSafeError(error);
    return NextResponse.json(
      {
        status: "refusal",
        refusalReason: `A system error occurred: ${detail}`,
        modelVersion: "unknown",
        promptVersion: PROMPT_VERSION,
      },
      { status: 500 },
    );
  }
}
