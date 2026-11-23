import { AlertTriangle } from "lucide-react";
import { setPreferredMode } from "@/app/mode";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export function ApiBanner({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="z-40 flex flex-wrap items-center gap-2 border-b border-risk-high/30 bg-risk-high/10 px-4 py-2 text-xs text-fg1" role="alert">
      <AlertTriangle size={14} className="text-risk-high" />
      <span className="flex-1">{t("offline_banner")}</span>
      <Button size="sm" variant="ghost" onClick={onRetry}>{t("retry")}</Button>
      <Button size="sm" onClick={() => { setPreferredMode("demo"); location.reload(); }}>{t("use_demo")}</Button>
    </div>
  );
}
