import { V1_FLOWS } from "@/lib/constants";

const cards = [
  {
    title: "What it helps with",
    items: V1_FLOWS.map((f) => f.title),
  },
  {
    title: "What it uses",
    items: [
      "UN Orange Book (Model Regulations), Rev. 24 — Volumes I and II only",
      "Retrieval-first RAG with chunk-level citations",
    ],
  },
  {
    title: "What it will not do",
    items: [
      "Answer without citations from approved sources",
      "Provide legal advice or certification decisions",
      "Replace qualified dangerous goods expert review",
      "Cover jurisdictions or regulations outside the loaded corpus",
    ],
  },
];

export function OverviewCards() {
  return (
    <section className="bg-[var(--color-ul-neutral-50)] py-16 sm:py-20" aria-label="Product overview">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="ul-section-title">Scope and boundaries</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-lg border border-[var(--color-ul-neutral-200)] bg-white p-6 shadow-[var(--shadow-ul-card)]"
            >
              <h3 className="text-base font-semibold text-[var(--color-ul-maroon-dark)]">{card.title}</h3>
              <ul className="mt-4 space-y-3 text-sm text-[var(--color-ul-neutral-700)]">
                {card.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-ul-red)]" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
