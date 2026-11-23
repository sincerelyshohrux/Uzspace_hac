import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Segmented<T extends string>({ value, onChange, options, size = "sm", className, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; size?: "xs" | "sm"; className?: string; label: string;
}) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex rounded-lg border bg-bg2 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors",
              size === "xs" ? "h-6 px-2 text-2xs" : "h-7 px-2.5 text-xs",
              active ? "text-fg1" : "text-fg2 hover:text-fg1",
            )}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-md border border-line-strong/20 bg-bg1 shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative z-10 flex items-center gap-1.5">
              {o.label}
              {o.count != null && <span className={cn("tnum rounded px-1 text-[10px]", active ? "bg-accent/15 text-accent" : "bg-bg3 text-fg2")}>{o.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
