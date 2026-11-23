import { AlertTriangle, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function EmptyState({ title, body, action, className }: { title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <div className="grid h-10 w-10 place-items-center rounded-xl border bg-bg2 text-fg2"><SearchX size={18} /></div>
      <div className="text-sm font-medium">{title}</div>
      {body && <p className="max-w-[260px] text-xs text-fg2">{body}</p>}
      {action}
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
