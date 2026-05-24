export function TrustBox() {
  return (
    <aside
      className="rounded-lg border border-[var(--color-ul-neutral-200)] bg-white p-6 shadow-[var(--shadow-ul-card)] lg:sticky lg:top-24"
      aria-labelledby="trust-box-heading"
    >
      <h2 id="trust-box-heading" className="text-lg font-semibold text-[var(--color-ul-maroon-dark)]">
        Scope, authority, and safety
      </h2>
      <ul className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--color-ul-neutral-700)]">
        <li>
          <strong className="text-[var(--color-ul-maroon-dark)]">Informational only.</strong> This tool does
          not replace expert judgment, legal advice, certification, or formal regulatory review.
        </li>
        <li>
          <strong className="text-[var(--color-ul-maroon-dark)]">Source-grounded.</strong> Answers are
          provided only when the system can cite passages from the approved UN Orange Book corpus.
        </li>
        <li>
          <strong className="text-[var(--color-ul-maroon-dark)]">Conservative by design.</strong> Ambiguous or
          incomplete requests trigger clarification or refusal — not speculation.
        </li>
        <li>
          <strong className="text-[var(--color-ul-neutral-900)]">Data caution.</strong> Do not enter
          sensitive personal, confidential shipment, or customer information unless your environment is
          approved for that data.
        </li>
      </ul>
    </aside>
  );
}
