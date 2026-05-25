import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AGENT_NAME, SOURCE_AUTHORITY, SOURCE_CORPUS } from "@/lib/constants";

export const metadata = {
  title: "Source corpus — DG Assistant",
  description: "Approved UN dangerous goods sources indexed for source-backed chat answers.",
};

export default function SourceCorpusPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-white pb-16 pt-10 sm:pb-20 sm:pt-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="ul-section-eyebrow">Policy</p>
          <h1 className="ul-section-title mt-2">Source corpus</h1>
          <p className="mt-4 text-[var(--color-ul-neutral-700)] leading-relaxed">
            {AGENT_NAME} indexes three official UN dangerous goods publications for retrieval and
            citation.
            Answers are grounded in the sources below. Each substantive claim in chat should cite
            retrieved passages from this corpus — not outside regulations or model-only guesses.
          </p>
          <p className="mt-3 text-sm text-[var(--color-ul-neutral-500)]">{SOURCE_AUTHORITY}</p>

          <ul className="mt-10 space-y-6">
            {SOURCE_CORPUS.map((source) => (
              <li
                key={source.id}
                className="rounded-lg border border-[var(--color-ul-neutral-200)] bg-white p-6 shadow-[var(--shadow-ul-card)]"
              >
                <h2 className="text-lg font-semibold text-[var(--color-ul-maroon-dark)]">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-[var(--color-ul-maroon)]/30 underline-offset-2 transition hover:text-[var(--color-ul-red)]"
                  >
                    {source.title}
                  </a>
                </h2>
                <p className="mt-1 text-sm font-medium text-[var(--color-ul-neutral-500)]">
                  {source.edition}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-ul-neutral-700)]">
                  {source.description}
                </p>
                <p className="mt-3 text-sm text-[var(--color-ul-neutral-700)]">
                  <span className="font-semibold text-[var(--color-ul-neutral-900)]">Used for: </span>
                  {source.usedFor}
                </p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex text-sm font-semibold text-[var(--color-ul-red)] hover:text-[var(--color-ul-red-hover)]"
                >
                  Open official PDF
                  <span className="ml-1" aria-hidden>
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-sm text-[var(--color-ul-neutral-700)]">
            <Link
              href="/chat"
              className="font-semibold text-[var(--color-ul-red)] hover:text-[var(--color-ul-red-hover)]"
            >
              Ask a question
            </Link>{" "}
            using this corpus, or return to the{" "}
            <Link href="/" className="font-semibold text-[var(--color-ul-red)] hover:text-[var(--color-ul-red-hover)]">
              overview
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
