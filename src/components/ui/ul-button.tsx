import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type UlButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

export function UlButton({ href, children, variant = "primary", className }: UlButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded px-6 py-3 text-sm font-semibold transition",
        variant === "primary" &&
          "bg-[var(--color-ul-red)] text-white hover:bg-[var(--color-ul-red-hover)]",
        variant === "secondary" &&
          "border-2 border-white bg-transparent text-white hover:bg-white/10",
        variant === "ghost" &&
          "border border-[var(--color-ul-neutral-300)] bg-white text-[var(--color-ul-maroon-dark)] hover:border-[var(--color-ul-maroon)] hover:text-[var(--color-ul-maroon)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
