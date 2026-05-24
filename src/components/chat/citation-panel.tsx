import type { Citation } from "@/lib/types/citations";
import { cn } from "@/lib/utils";

type CitationPanelProps = {
  citations: Citation[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
};

export function CitationPanel({ citations, selectedIndex, onSelect }: CitationPanelProps) {
  if (citations.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-ul-neutral-200)] bg-[var(--color-ul-neutral-50)] shadow-[var(--shadow-ul-card)]">
        <div className="border-b border-[var(--color-ul-neutral-200)] bg-white px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ul-neutral-500)]">
            Sources
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm leading-relaxed text-[var(--color-ul-neutral-700)]">
            Source excerpts from the UN Orange Book will appear here after you submit a question.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-ul-neutral-200)] bg-white shadow-[var(--shadow-ul-card)]">
      <div className="border-b border-[var(--color-ul-neutral-200)] bg-[var(--color-ul-maroon-dark)] px-6 py-4">
        <h2 className="text-sm font-semibold text-white">Sources ({citations.length})</h2>
        <p className="mt-1 text-xs text-white/70">UN Orange Book — cited passages</p>
      </div>
      <ul className="max-h-[36rem] space-y-2 overflow-y-auto p-4">
        {citations.map((c, i) => (
          <li key={c.chunkId}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "w-full rounded-lg border p-4 text-left text-sm transition",
                selectedIndex === i
                  ? "border-[var(--color-ul-red)] bg-red-50/50 shadow-sm"
                  : "border-[var(--color-ul-neutral-200)] hover:border-[var(--color-ul-maroon)] hover:bg-[var(--color-ul-tint)]/50",
              )}
            >
              <span className="font-semibold text-[var(--color-ul-red)]">[{i + 1}]</span>
              {c.documentTitle && (
                <span className="ml-2 text-xs font-medium text-[var(--color-ul-maroon-dark)]">
                  {c.documentTitle}
                </span>
              )}
              <p className="mt-1 text-xs text-[var(--color-ul-neutral-500)]">
                {[c.chapter, c.section, c.pageReference && `p. ${c.pageReference}`]
                  .filter(Boolean)
                  .join(" · ")}
                {c.similarity > 0 && (
                  <span className="ml-2">· relevance {(c.similarity * 100).toFixed(0)}%</span>
                )}
              </p>
              <p className="mt-2 line-clamp-4 leading-relaxed text-[var(--color-ul-neutral-700)]">
                {c.excerpt}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
