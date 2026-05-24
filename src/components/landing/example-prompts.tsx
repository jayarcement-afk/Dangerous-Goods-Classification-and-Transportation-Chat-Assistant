import Link from "next/link";
import { EXAMPLE_PROMPTS } from "@/lib/constants";

export function ExamplePrompts() {
  return (
    <section aria-labelledby="examples-heading">
      <h2 id="examples-heading" className="ul-section-title">
        Example prompts
      </h2>
      <p className="mt-2 text-sm text-[var(--color-ul-neutral-700)]">
        Click to open source lookup with a starter question.
      </p>
      <ul className="mt-6 space-y-3">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <Link
              href={`/chat?q=${encodeURIComponent(prompt)}`}
              className="ul-card-lift block rounded-lg border border-[var(--color-ul-neutral-200)] bg-white px-5 py-4 text-sm text-[var(--color-ul-neutral-700)] shadow-[var(--shadow-ul-card)] transition hover:border-[var(--color-ul-maroon)] hover:text-[var(--color-ul-maroon-dark)]"
            >
              {prompt}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
