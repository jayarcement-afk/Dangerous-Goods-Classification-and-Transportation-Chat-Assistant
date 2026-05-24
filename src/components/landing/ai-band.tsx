import { UlButton } from "@/components/ui/ul-button";

export function AiBand() {
  return (
    <section className="bg-[var(--color-ul-tint)] py-16 sm:py-20" aria-labelledby="ai-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ul-maroon)]">
              Source-backed AI
            </p>
            <h2 id="ai-heading" className="ul-section-title mt-2">
              Citation-first intelligence for dangerous goods
            </h2>
            <p className="mt-4 text-[var(--color-ul-neutral-700)] leading-relaxed">
              Intake, evidence retrieval, and response agents work together so you can:
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[var(--color-ul-neutral-700)]">
              <li>Classify substances with cited Orange Book rationale</li>
              <li>Identify missing data through guided intake questions</li>
              <li>Look up requirements with verifiable source excerpts</li>
            </ol>
            <div className="mt-8">
              <UlButton href="/chat" variant="ghost" className="!border-[var(--color-ul-maroon)] !text-[var(--color-ul-maroon)]">
                Try source lookup
              </UlButton>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-ul-tint-deep)] bg-white p-8 shadow-[var(--shadow-ul-card)]">
            <div className="space-y-4 text-sm">
              <div className="rounded-md bg-[var(--color-ul-neutral-100)] p-4">
                <p className="text-xs font-semibold uppercase text-[var(--color-ul-neutral-500)]">You</p>
                <p className="mt-1 text-[var(--color-ul-neutral-900)]">
                  What does the Orange Book say about Class 3 flammable liquids?
                </p>
              </div>
              <div className="rounded-md border-l-4 border-[var(--color-ul-red)] bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase text-[var(--color-ul-neutral-500)]">
                  Assistant · cited
                </p>
                <p className="mt-1 text-[var(--color-ul-neutral-700)]">
                  Answers draw from Chapter 2.3 and related provisions — with linked excerpts in the
                  sources panel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
