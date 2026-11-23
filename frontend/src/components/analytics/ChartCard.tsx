import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function ChartCard({ title, hint, action, children, className }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card flex flex-col p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-fg2">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3 min-h-0 flex-1">{children}</div>
    </section>
  );
}
