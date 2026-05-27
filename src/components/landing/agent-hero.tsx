"use client";

import Image from "next/image";
import { AGENT_DESCRIPTION, AGENT_NAME } from "@/lib/constants";
import { AgentChatPanel } from "@/components/chat/agent-chat-panel";
import { SparkleIcon } from "@/components/ui/sparkle-icon";

export function AgentHero() {
  return (
    <section className="bg-white pb-4 pt-6 sm:pb-5 sm:pt-8 lg:pb-6 lg:pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-12 lg:gap-16">
          <div className="relative w-[160px] shrink-0 sm:w-[180px] md:w-[200px] lg:w-[220px]">
            <Image
              src="/ultrus-dg-agent-robot.png"
              alt="ULTRUS Dangerous Goods Agent robot assistant"
              width={605}
              height={699}
              priority
              className="h-auto w-full object-contain"
              sizes="(max-width: 768px) 160px, 220px"
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-1/3 min-w-[3rem] bg-gradient-to-l from-white to-transparent"
              aria-hidden
            />
          </div>

          <div className="w-full min-w-0 flex-1 text-left">
            <h1 className="ul-section-title flex items-start gap-3 md:flex-nowrap">
              <SparkleIcon className="h-7 w-8 shrink-0 text-[var(--color-ul-maroon-dark)]" />
              <span>{AGENT_NAME}</span>
            </h1>
            <p className="mt-4 max-w-3xl text-[var(--color-ul-neutral-700)]">{AGENT_DESCRIPTION}</p>
          </div>
        </div>

        <div className="mt-8 lg:mt-10">
          <AgentChatPanel />
        </div>
      </div>
    </section>
  );
}
