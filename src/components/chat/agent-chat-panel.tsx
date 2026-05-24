"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AGENT_NAME, EXAMPLE_PROMPTS } from "@/lib/constants";
import { useChat } from "@/lib/hooks/use-chat";
import { SparkleIcon } from "@/components/ui/sparkle-icon";
import { cn } from "@/lib/utils";

type AgentChatPanelProps = {
  initialQuestion?: string;
  className?: string;
  inputId?: string;
};

export function AgentChatPanel({
  initialQuestion = "",
  className,
  inputId = "agent-question",
}: AgentChatPanelProps) {
  const { input, setInput, messages, citations, loading, error, submit, askPrompt } =
    useChat(initialQuestion);

  const [showAllCitations, setShowAllCitations] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageRef = useRef<HTMLDivElement>(null);
  const loadingIndicatorRef = useRef<HTMLParagraphElement>(null);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantIndex = messages.reduce(
    (idx, m, i) => (m.role === "assistant" ? i : idx),
    -1,
  );

  const scrollWithinChatBox = useCallback((target: HTMLElement | null) => {
    const container = messagesScrollRef.current;
    if (!container || !target) return;
    const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top, behavior: "smooth" });
  }, []);

  const scrollToLatestAgentMessage = useCallback(() => {
    if (lastAssistantMessageRef.current) {
      scrollWithinChatBox(lastAssistantMessageRef.current);
      return;
    }
    if (loading && loadingIndicatorRef.current) {
      scrollWithinChatBox(loadingIndicatorRef.current);
    }
  }, [loading, scrollWithinChatBox]);

  useEffect(() => {
    scrollToLatestAgentMessage();
  }, [messages, loading, scrollToLatestAgentMessage]);

  const visibleCitations = showAllCitations ? citations : citations.slice(0, 3);
  const hiddenCitationCount = Math.max(0, citations.length - 3);

  useEffect(() => {
    setShowAllCitations(false);
  }, [citations]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-[var(--color-ul-maroon)] shadow-lg",
        className,
      )}
    >
      <div className="flex max-h-[36rem] flex-col p-5 text-white sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SparkleIcon className="h-5 w-6 text-white" />
            <h2 className="text-sm font-semibold text-white">{AGENT_NAME}</h2>
          </div>
          {citations.length > 0 && (
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
              {citations.length} source{citations.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {messages.length === 0 && !loading && (
          <p className="mt-3 text-sm text-white/85">
            Give a UN number or substance name — the agent will look up proper shipping names and
            hazard properties (correct anything in chat). Ask about transport, packing, or Orange
            Book sections.
          </p>
        )}

        {(messages.length > 0 || loading) && (
          <div
            ref={messagesScrollRef}
            className={`mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto ${messages.length > 0 ? "border-t border-white/20 pt-4" : ""}`}
          >
            {loading && (
              <p ref={loadingIndicatorRef} className="text-sm text-white/85">
                Analyzing sources…
              </p>
            )}
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={i}
                  ref={i === lastAssistantIndex ? lastAssistantMessageRef : undefined}
                  className={
                    isUser
                      ? "rounded-lg bg-white/15 px-4 py-3 text-sm"
                      : "rounded-lg border border-[#e8d5c4] border-l-4 border-l-white bg-[#f5ebe0] px-4 py-3 text-sm"
                  }
                >
                  <p
                    className={
                      isUser
                        ? "text-xs font-semibold uppercase tracking-wider text-white/70"
                        : "text-xs font-semibold uppercase tracking-wider text-[var(--color-ul-neutral-700)]"
                    }
                  >
                    {isUser ? "You" : AGENT_NAME}
                  </p>
                  <p
                    className={
                      isUser
                        ? "mt-2 whitespace-pre-wrap text-white"
                        : "mt-2 whitespace-pre-wrap text-[var(--color-ul-neutral-900)]"
                    }
                  >
                    {m.content}
                  </p>
                </div>
              );
            })}

            {citations.length > 0 && lastAssistant && (
              <div className="rounded-lg border border-[#e8d5c4] bg-[#f5ebe0] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ul-neutral-700)]">
                  Cited passages
                </p>
                <ul className="mt-2 space-y-2">
                  {visibleCitations.map((c, i) => (
                    <li key={c.chunkId} className="text-xs text-[var(--color-ul-neutral-900)]">
                      <span className="font-semibold text-[var(--color-ul-red)]">[{i + 1}]</span>
                      {c.chapter && (
                        <span className="ml-2 text-[var(--color-ul-maroon-dark)]">{c.chapter}</span>
                      )}
                      <p className="mt-1 line-clamp-2">{c.excerpt}</p>
                    </li>
                  ))}
                </ul>
                {hiddenCitationCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCitations((expanded) => !expanded)}
                    className="mt-2 text-xs font-semibold text-[var(--color-ul-maroon-dark)] underline decoration-[var(--color-ul-maroon-dark)]/40 underline-offset-2 hover:text-[var(--color-ul-red)]"
                  >
                    {showAllCitations
                      ? "Show fewer sources"
                      : `Show ${hiddenCitationCount} more source${hiddenCitationCount === 1 ? "" : "s"}`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <form
          className="mt-4 rounded-lg bg-white p-4 text-[var(--color-ul-neutral-900)]"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {messages.length === 0 && (
            <div className="mb-3 flex flex-col gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => askPrompt(prompt)}
                  className="rounded-lg border border-[var(--color-ul-neutral-200)] bg-[var(--color-ul-neutral-50)] px-3 py-2 text-left text-xs leading-snug text-[var(--color-ul-neutral-700)] transition hover:border-[var(--color-ul-maroon)] hover:text-[var(--color-ul-maroon-dark)] disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <label className="sr-only" htmlFor={inputId}>
            Your question
          </label>
          <textarea
            id={inputId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!loading && input.trim()) {
                  void submit();
                }
              }
            }}
            rows={3}
            placeholder="Type your dangerous goods question…"
            className="w-full resize-none rounded-lg border border-[var(--color-ul-neutral-200)] bg-white p-3 text-sm text-[var(--color-ul-neutral-900)] placeholder:text-[var(--color-ul-neutral-500)] focus:border-[var(--color-ul-maroon)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ul-maroon)]/20"
            disabled={loading}
          />
          {error && <p className="mt-2 text-sm text-[var(--color-ul-red)]">{error}</p>}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-ul-red)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-ul-red-hover)] disabled:opacity-50"
          >
            <SparkleIcon className="h-4 w-5 text-white" />
            {loading ? "Thinking…" : `Ask ${AGENT_NAME}`}
          </button>
        </form>
      </div>
    </div>
  );
}
