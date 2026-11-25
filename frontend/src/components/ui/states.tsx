import { AlertTriangle, SearchX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function EmptyState({ title, body, action, className, icon: Icon = SearchX, hint }: { title: string; body?: string; action?: ReactNode; className?: string; icon?: LucideIcon; hint?: ReactNode }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <div className="relative mb-1 grid h-14 w-14 place-items-center">
        <span className="absolute inset-0 rounded-2xl bg-accent/10 blur-md" aria-hidden />
        <span className="absolute inset-0 rounded-2xl border border-dashed border-accent/35" aria-hidden />
        <Icon size={22} className="relative text-accent" />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      {body && <p className="max-w-[270px] text-xs leading-relaxed text-fg2">{body}</p>}
      {action && <div className="mt-1.5">{action}</div>}
      {hint && <div className="mt-1 text-2xs text-fg3">{hint}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-risk-high/10 text-risk-high"><AlertTriangle size={18} /></div>
      <div className="text-sm font-medium">{t("error_title")}</div>
      <p className="max-w-[280px] text-xs text-fg2">{error instanceof Error ? error.message : String(error)}</p>
      {onRetry && <Button size="sm" onClick={onRetry}>{t("retry")}</Button>}
    </div>
  );
}
