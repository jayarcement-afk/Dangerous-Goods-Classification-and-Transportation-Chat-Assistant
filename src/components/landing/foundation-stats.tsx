const stats = [
  {
    value: "130+",
    label: "Years of safety science heritage",
    detail: "UL Solutions trust and expertise inform conservative, source-backed responses.",
  },
  {
    value: "2",
    label: "Active Orange Book volumes",
    detail: "UN Model Regulations Rev. 24 — Volume I and Volume II in the retrieval corpus.",
  },
  {
    value: "2,896",
    label: "Indexed source passages",
    detail: "Chunk-level retrieval with mandatory citations for every substantive answer.",
  },
];

export function FoundationStats() {
  return (
    <section
      className="border-y border-[var(--color-ul-neutral-200)] bg-[var(--color-ul-neutral-100)] py-16 sm:py-20"
      aria-labelledby="foundation-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 id="foundation-heading" className="ul-section-title text-center">
          Trusted, source-grounded dangerous goods guidance
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--color-ul-neutral-700)]">
          Built for teams who need practical Orange Book answers with traceable citations — not generic
          model speculation.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-4xl font-semibold text-[var(--color-ul-maroon-dark)] sm:text-5xl">{stat.value}</p>
              <p className="mt-3 text-base font-semibold text-[var(--color-ul-neutral-900)]">{stat.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ul-neutral-700)]">{stat.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
