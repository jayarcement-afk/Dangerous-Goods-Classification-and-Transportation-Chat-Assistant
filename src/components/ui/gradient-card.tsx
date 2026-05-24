import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type GradientCardProps = {
  children: ReactNode;
  className?: string;
};

export function GradientCard({ children, className }: GradientCardProps) {
  return (
    <div className={cn("ul-gradient-card rounded-xl p-[1px] shadow-lg", className)}>
      <div className="rounded-[11px] bg-white">{children}</div>
    </div>
  );
}
