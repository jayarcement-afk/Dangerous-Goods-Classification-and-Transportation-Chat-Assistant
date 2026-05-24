"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AgentChatPanel } from "@/components/chat/agent-chat-panel";

type ChatPageProps = {
  initialQuestion?: string;
};

export function ChatPage({ initialQuestion = "" }: ChatPageProps) {
  return (
    <>
      <SiteHeader />
      <main className="bg-white py-8 sm:py-10 lg:py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <AgentChatPanel initialQuestion={initialQuestion} inputId="chat-page-question" />
          <p className="mt-6 text-sm">
            <Link href="/" className="font-semibold text-[var(--color-ul-maroon)] hover:underline">
              ← Back to overview
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
