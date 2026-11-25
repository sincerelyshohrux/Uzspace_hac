import { AnimatePresence } from "motion/react";
import { ArrowDownUp, ClipboardCheck, Download, Flame, Search, SlidersHorizontal, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import type { Alert, Filters } from "@/api/types";
import { exportUrl } from "@/api/client";
import { useBulkUpdate } from "@/api/hooks";
import { addMine, CURRENT_USER, type QueueTab, type SortKey } from "@/app/state";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Tip } from "@/components/ui/tooltip";
import { useI18n, type I18nKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { downloadText, fmtHa, toCsv } from "@/lib/format";
import { AlertRow } from "./AlertRow";
import { FiltersPanel } from "./FiltersPanel";

interface Props {
  items: Alert[];
  counts: Record<QueueTab, number>;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  filters: Filters;
  districts: string[];
  onFilters: (p: Partial<Filters>) => void;
  onReset: () => void;
  queue: QueueTab;
  onQueue: (q: QueueTab) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  searchRef?: React.RefObject<HTMLInputElement>;
  className?: string;
  /** highest-risk alert overall, offered from empty states */
  topId?: string;
}

export function AlertQueue(p: Props) {
  const { t } = useI18n();
  const listRef = useRef<HTMLUListElement>(null);
  const firstPaint = useRef(true);
  useEffect(() => {
    if (!p.loading) {
      const id = setTimeout(() => (firstPaint.current = false), 600);
      return () => clearTimeout(id);
    }
  }, [p.loading]);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const bulk = useBulkUpdate();
  // drop selections that left the list (filters changed)
  useEffect(() => {
    setChecked((c) => {
      const ids = new Set(p.items.map((a) => a.alert_id));
      const next = new Set([...c].filter((id) => ids.has(id)));
      return next.size === c.size ? c : next;
    });
  }, [p.items]);
  const toggle = (id: string, v: boolean) =>
    setChecked((c) => {
      const n = new Set(c);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  const takeIntoReview = () => {
    const rows = p.items.filter((a) => checked.has(a.alert_id) && a.status !== "in_review");
    if (!rows.length) return setChecked(new Set());
    const prev = rows.map((a) => ({ id: a.alert_id, body: { status: a.status, note: a.note, user: CURRENT_USER } }));
    bulk.mutate(
      rows.map((a) => ({ id: a.alert_id, body: { status: "in_review" as const, note: a.note, user: CURRENT_USER } })),
      {
        onSuccess: () => {
          rows.forEach((a) => addMine(a.alert_id));
          setChecked(new Set());
          toast.success(t("bulk_done", { n: rows.length }), {
            description: t("st_in_review"),
            action: { label: t("undo"), onClick: () => bulk.mutate(prev, { onSuccess: () => toast(t("undone")) }) },
            duration: 8000,
          });
        },
        onError: (e) => toast.error(t("save_failed", { e: e instanceof Error ? e.message : String(e) })),
      },
    );
  };

  useEffect(() => {
    if (p.selected) document.getElementById(`row-${p.selected}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [p.selected]);

  const activeChips = useMemo(() => {
    const f = p.filters;
    const out: { key: keyof Filters; label: string }[] = [];
    if (f.district) out.push({ key: "district", label: f.district });
    if (f.zone) out.push({ key: "zone", label: f.zone === "any_restricted" ? t("any_restricted") : t(`z_${f.zone}` as I18nKey) });
    if (f.changeType) out.push({ key: "changeType", label: t(`ct_${f.changeType}` as I18nKey) });
    if (f.status) out.push({ key: "status", label: t(`st_${f.status}` as I18nKey) });
    if (f.minRisk) out.push({ key: "minRisk", label: `${t("min_risk")} ≥ ${f.minRisk}` });
    return out;
  }, [p.filters, t]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && checked.size) {
      e.stopPropagation();
      return setChecked(new Set());
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = p.items.findIndex((a) => a.alert_id === p.selected);
    const n = e.key === "ArrowDown" ? Math.min(p.items.length - 1, i + 1) : Math.max(0, i - 1);
    if (p.items[n]) p.onSelect(p.items[n].alert_id);
  };

  const exportCsv = () => {
    const url = exportUrl(p.filters);
    if (url) window.open(url, "_blank");
    else downloadText("sitesentinel_alerts.csv", toCsv(p.items));
    toast.success(`CSV · ${p.items.length}`);
  };

  const area = p.items.reduce((s, a) => s + a.area_m2, 0) / 10000;

  return (
    <section className={cn("flex min-h-0 flex-col", p.className)} aria-label="Alerts">
      <div className="space-y-2.5 p-3 pb-2">
        <Segmented
          label="Queue"
          size="xs"
          className="flex w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          value={p.queue}
          onChange={p.onQueue}
          options={[
            { value: "all", label: t("q_all"), count: p.counts.all },
            { value: "critical", label: t("q_critical"), count: p.counts.critical },
            { value: "review", label: t("q_review"), count: p.counts.review },
            { value: "mine", label: t("q_mine"), count: p.counts.mine },
          ]}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg3" />
            <input
              ref={p.searchRef}
              className="field w-full pl-8 pr-7"
              placeholder={t("search_ph_queue")}
              value={p.filters.q}
              onChange={(e) => p.onFilters({ q: e.target.value })}
              aria-label={t("search_ph_queue")}
            />
            {p.filters.q && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-fg3 hover:text-fg1" onClick={() => p.onFilters({ q: "" })} aria-label={t("reset")}>
                <X size={14} />
              </button>
            )}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="md" className="relative" aria-label={t("filters")}>
                <SlidersHorizontal size={14} />
                <span className="hidden sm:inline">{t("filters")}</span>
                {activeChips.length > 0 && <span className="tnum absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-bg0">{activeChips.length}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[300px]">
              <FiltersPanel filters={p.filters} districts={p.districts} onChange={p.onFilters} onReset={p.onReset} />
            </PopoverContent>
          </Popover>
          <Popover>
            <Tip label={t("sort")}>
              <PopoverTrigger asChild>
                <Button size="icon" aria-label={t("sort")}><ArrowDownUp size={14} /></Button>
              </PopoverTrigger>
            </Tip>
            <PopoverContent align="end" className="w-44 p-1">
              {(["risk", "area", "new", "status"] as const).map((s) => (
                <button key={s} onClick={() => p.onSort(s)} className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-bg3", p.sort === s && "text-accent")}>
                  {t(`sort_${s}`)}
                  {p.sort === s && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activeChips.map((c) => (
              <button
                key={c.key}
                onClick={() => p.onFilters({ [c.key]: c.key === "minRisk" ? 0 : "" } as Partial<Filters>)}
                className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-2xs text-accent hover:bg-accent/20"
              >
                {c.label}
                <X size={11} />
              </button>
            ))}
            <button onClick={p.onReset} className="px-1 text-2xs text-fg2 underline-offset-2 hover:text-fg1 hover:underline">{t("reset")}</button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" onKeyDown={onKey}>
        {p.error ? (
          <ErrorState error={p.error} onRetry={p.onRetry} />
        ) : p.loading ? (
          <div className="space-y-2 px-1">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)}
          </div>
        ) : p.items.length === 0 ? (
          p.queue === "review" || p.queue === "mine" || p.queue === "critical" ? (
            <EmptyState
              icon={p.queue === "review" ? ClipboardCheck : p.queue === "mine" ? UserRound : Flame}
              title={t(`eq_${p.queue}_title`)}
              body={t(`eq_${p.queue}_body`)}
              action={
                p.topId && p.queue !== "critical" ? (
                  <Button size="sm" variant="primary" onClick={() => { p.onQueue("all"); p.onSelect(p.topId!); }}>{t("start_top")}</Button>
                ) : (
                  <Button size="sm" onClick={() => p.onQueue("all")}>{t("q_all")}</Button>
                )
              }
              hint={p.queue === "review" ? <span>{t("eq_hint_pre")} <span className="kbd">1</span> {t("eq_hint_post")}</span> : undefined}
            />
          ) : (
            <EmptyState title={t("empty_title")} body={t("empty_body")} action={<Button size="sm" onClick={p.onReset}>{t("reset")}</Button>} />
          )
        ) : (
          <ul ref={listRef} role="listbox" aria-label="Alerts" tabIndex={0} className="space-y-1 outline-none">
            <AnimatePresence initial={false}>
              {p.items.map((a, i) => (
                <AlertRow
                  key={a.alert_id}
                  a={a}
                  index={i}
                  animate={firstPaint.current}
                  selected={a.alert_id === p.selected}
                  hovered={a.alert_id === p.hovered}
                  onSelect={() => p.onSelect(a.alert_id)}
                  onHover={(h) => p.onHover(h ? a.alert_id : null)}
                  checked={checked.has(a.alert_id)}
                  selecting={checked.size > 0}
                  onCheck={(v) => toggle(a.alert_id, v)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {checked.size > 0 ? (
        <div className="flex items-center gap-1.5 border-t border-accent2/30 bg-accent2/[.07] px-2.5 py-2 text-xs">
          <Tip label={t("cancel")} kbd="Esc">
            <Button variant="ghost" size="icon-sm" onClick={() => setChecked(new Set())} aria-label={t("cancel")}><X size={15} /></Button>
          </Tip>
          <span className="tnum mr-auto whitespace-nowrap font-semibold text-fg1">{t("n_selected", { n: checked.size })}</span>
          <Button variant="primary" size="sm" className="whitespace-nowrap" onClick={takeIntoReview} disabled={bulk.isPending}>
            <ClipboardCheck size={13} /> {t("a_review")}
          </Button>
        </div>
      ) : (
      <div className="flex items-center justify-between border-t border-line/10 px-3 py-2 text-xs text-fg2">
        <span className="tnum">
          <b className="font-semibold text-fg1">{p.items.length}</b> · {fmtHa(area)} {t("ha")}
        </span>
        <Button variant="ghost" size="sm" onClick={exportCsv} disabled={!p.items.length}>
          <Download size={13} /> {t("export_csv")}
        </Button>
      </div>
      )}
    </section>
  );
}
