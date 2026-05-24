"use client";

import { useState, useCallback } from "react";
import type { ChatResponse, Citation } from "@/lib/types/citations";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  response?: ChatResponse;
};

export function useChat(initialQuestion = "") {
  const [input, setInput] = useState(initialQuestion);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (questionOverride?: string) => {
      const question = (questionOverride ?? input).trim();
      if (!question || loading) return;

      setError(null);
      setLoading(true);
      setInput("");

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: "user", content: question }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question, history }),
        });

        const data = (await res.json()) as ChatResponse & { error?: string };

        if (!res.ok && !data.status) {
          throw new Error(data.error ?? "Request failed");
        }

        let assistantText = "";
        if (data.status === "answer" && data.answer) {
          assistantText = data.answer;
          setCitations(data.citations ?? []);
        } else if (data.status === "clarification") {
          const profileLines =
            data.substanceProfile?.assumptions?.length &&
            data.substanceProfile.status !== "ambiguous"
              ? [
                  "",
                  "Working assumptions (correct me in chat if anything is wrong):",
                  ...data.substanceProfile.assumptions.map((a) => `• ${a}`),
                ]
              : [];
          assistantText = [
            data.substanceProfile?.confirmationNotice ||
              "I need more information before I can provide a source-backed answer:",
            ...profileLines,
            "",
            ...(data.clarifyingQuestions ?? []).map((q) => `• ${q}`),
            "",
            data.limitations ?? "",
          ]
            .filter((line, i, arr) => line !== "" || (i > 0 && arr[i - 1] !== ""))
            .join("\n");
          setCitations([]);
        } else {
          assistantText = data.refusalReason ?? "I cannot answer without sufficient cited sources.";
          setCitations([]);
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantText, response: data },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages],
  );

  const askPrompt = useCallback(
    (prompt: string) => {
      void submit(prompt);
    },
    [submit],
  );

  return {
    input,
    setInput,
    messages,
    citations,
    loading,
    error,
    submit,
    askPrompt,
  };
}
