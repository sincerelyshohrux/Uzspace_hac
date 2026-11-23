import type { AuditEntry } from "@/api/types";
import { StatusBadge } from "@/components/ui/badges";
import { Skeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n";
import { fmtDateTime } from "@/lib/format";

export function AuditTimeline({ items, loading }: { items: AuditEntry[] | undefined; loading: boolean }) {
  const { t, lang } = useI18n();
  if (loading) return <Skeleton className="h-16 w-full" />;
  if (!items?.length) return <p className="text-xs text-fg3">{t("no_history")}</p>;
  return (
    <ol className="relative space-y-3 border-l border-line/20 pl-4">
      {items.map((e) => (
        <li key={e.id} className="relative text-xs">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-bg1 bg-accent" />
          <div className="flex flex-wrap items-center gap-1.5">
            {e.old_status && <StatusBadge status={e.old_status} />}
            <span className="text-fg3">→</span>
            <StatusBadge status={e.new_status} />
          </div>
          <div className="mt-1 text-fg2">
            <span className="font-mono">{e.user}</span> · {fmtDateTime(e.ts, lang)}
          </div>
          {e.note && <div className="mt-1 rounded-md bg-bg2 px-2 py-1 italic text-fg1">“{e.note}”</div>}
        </li>
      ))}
    </ol>
  );
}
