import Link from "next/link";
import { V1_FLOWS } from "@/lib/constants";

const accents: Record<string, { bar: string; icon: string }> = {
  classify: { bar: "bg-[var(--color-ul-maroon)]", icon: "📋" },
  intake: { bar: "bg-[var(--color-ul-maroon-light)]", icon: "✓" },
  lookup: { bar: "bg-[var(--color-ul-maroon-dark)]", icon: "📖" },
};

export function Collections() {
  return (
    <section className="bg-white pb-16 pt-6 sm:pb-20 sm:pt-8" aria-labelledby="collections-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="ul-section-eyebrow text-center">Capabilities</p>
        <h2 id="collections-heading" className="ul-section-title mt-2 text-center">
          DG Assistant collections
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--color-ul-neutral-700)]">
          Three focused workflows for classification, guided intake, and source lookup — each built on
          the same citation-first policy.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {V1_FLOWS.map((flow) => {
            const accent = accents[flow.id] ?? accents.lookup;
            return (
              <article
                key={flow.id}
                className="ul-card-lift flex flex-col overflow-hidden rounded-lg border border-[var(--color-ul-neutral-200)] bg-white shadow-[var(--shadow-ul-card)]"
              >
                <div className={`h-1.5 ${accent.bar}`} />
                <div className="flex flex-1 flex-col p-6 sm:p-8">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-ul-tint)] text-xl"
                    aria-hidden
                  >
                    {accent.icon}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-[var(--color-ul-maroon-dark)]">{flow.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--color-ul-neutral-700)]">
                    {flow.description}
                  </p>
                  <Link
                    href="/chat"
                    className="mt-6 inline-flex items-center text-sm font-semibold text-[var(--color-ul-red)] hover:text-[var(--color-ul-red-hover)]"
                  >
                    Explore
                    <span className="ml-1" aria-hidden>
                      →
                    </span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
