import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runChatOrchestrator } from "@/lib/agents/orchestrator";

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
    const response = await runChatOrchestrator(body.message, {
      history: body.history,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    console.error("[/api/chat]", error);
    return NextResponse.json(
      {
        status: "refusal",
        refusalReason: "A system error occurred. No answer was generated.",
        modelVersion: "unknown",
        promptVersion: "phase2-v1",
      },
      { status: 500 },
    );
  }
}
