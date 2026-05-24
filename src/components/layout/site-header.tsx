import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-ul-neutral-200)] bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/ultrus-logo.png"
            alt="ULTRUS"
            width={160}
            height={40}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main">
          <Link
            href="/"
            className="rounded px-3 py-2 text-sm font-medium text-[var(--color-ul-neutral-700)] transition hover:bg-[var(--color-ul-neutral-100)] hover:text-[var(--color-ul-maroon-dark)]"
          >
            Overview
          </Link>
          <Link
            href="/chat"
            className="ml-2 rounded bg-[var(--color-ul-red)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-ul-red-hover)]"
          >
            Get started
          </Link>
        </nav>
      </div>
      <p className="sr-only">{APP_NAME}</p>
    </header>
  );
}
