import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Collections } from "@/components/landing/collections";
import { FoundationStats } from "@/components/landing/foundation-stats";
import { AgentHero } from "@/components/landing/agent-hero";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <AgentHero />
      <main>
        <Collections />
        <FoundationStats />
      </main>
      <SiteFooter />
    </>
  );
}
