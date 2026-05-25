import Link from "next/link";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "/" },
      { label: "Ask a question", href: "/chat" },
    ],
  },
  {
    title: "Policy",
    links: [{ label: "Source corpus", href: "/source-corpus" }],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-[var(--color-ul-maroon-dark)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-sm bg-[var(--color-ul-red)] text-sm font-bold"
                aria-hidden
              >
                UL
              </span>
              <div>
                <p className="text-lg font-semibold">DG Assistant</p>
                <p className="text-sm text-white/70">UL Solutions · Software portfolio style</p>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
              Source-backed dangerous goods guidance from the UN Orange Book. Internal prototype — not
              an official UL.com product page.
            </p>
          </div>
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/70 transition hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/15 pt-8 sm:flex-row">
          <p className="text-xs text-white/60">© {new Date().getFullYear()} Internal prototype. UI inspired by ULTRUS™.</p>
          <p className="text-xs text-white/60">UN Model Regulations (Orange Book), Rev. 24 — Volumes I &amp; II</p>
        </div>
      </div>
    </footer>
  );
}
