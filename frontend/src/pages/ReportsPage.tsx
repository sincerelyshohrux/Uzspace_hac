// Area reports: one PDF for the whole city or a district, built by the backend from the same alerts.
import { Building2, CheckCircle2, Download, FileSpreadsheet, FileText, Image as ImageIcon, Layers, ListOrdered, Map as MapIcon, MapPinned, ScrollText } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EMPTY_FILTERS, type Alert, type Filters } from "@/api/types";
import { exportUrl, summaryReportUrl } from "@/api/client";
import { useAlerts, useMeta } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { downloadText, fmtHa, toCsv } from "@/lib/format";
import { pageVariants } from "@/lib/motion";

interface Area { key: string; name: string; items: Alert[] }

function stats(items: Alert[]) {
  return {
    n: items.length,
    ha: items.reduce((s, a) => s + a.area_m2, 0) / 1e4,
    restricted: items.filter((a) => a.zones.length).length,
    high: items.filter((a) => a.risk_score >= 60).length,
    confirmed: items.filter((a) => a.status === "confirmed").length,
  };
}

export function ReportsPage({ onOpen }: { onOpen: (f: Partial<Filters>) => void }) {
  const { t } = useI18n();
  const meta = useMeta();
  const all = useAlerts(EMPTY_FILTERS);
  const [sel, setSel] = useState("");

  const areas = useMemo<Area[]>(() => {
    const items = all.data?.items ?? [];
    const by = new Map<string, Alert[]>();
    items.forEach((a) => by.set(a.district, [...(by.get(a.district) ?? []), a]));
    return [
      { key: "", name: t("rep_city", { region: meta.data?.region ?? "Toshkent" }), items },
      ...[...by.entries()].sort((a, b) => b[1].length - a[1].length).map(([d, xs]) => ({ key: d, name: d, items: xs })),
    ];
  }, [all.data, meta.data, t]);

  if (all.isError) return <ErrorState error={all.error} onRetry={() => all.refetch()} className="flex-1" />;
  const cur = areas.find((a) => a.key === sel) ?? areas[0];
  const k = stats(cur?.items ?? []);
  const maxN = Math.max(1, ...areas.slice(1).map((a) => a.items.length));
  const pdfUrl = summaryReportUrl(sel || null);
  const top = [...(cur?.items ?? [])].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5);

  const pdf = () => {
    if (!pdfUrl) return toast.error(t("rep_api_only"));
    window.open(pdfUrl, "_blank");
    toast.success(t("rep_started"), { description: cur.name });
  };
  const csv = () => {
    const url = exportUrl({ ...EMPTY_FILTERS, district: sel });
    if (url) window.open(url, "_blank");
    else downloadText(`sitesentinel_${sel || "city"}.csv`, toCsv(cur.items));
  };

  const contents: [typeof Layers, string][] = [
    [Layers, t("rep_c_kpi")],
    ...(sel ? [] : [[Building2, t("rep_c_districts")] as [typeof Layers, string]]),
    [MapPinned, t("rep_c_zones")],
    [ListOrdered, t("rep_c_top")],
    [ImageIcon, t("rep_c_images")],
    [ScrollText, t("rep_c_method")],
  ];

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1280px] space-y-4 p-4 md:p-6">
        <div>
          <h2 className="text-lg font-semibold">{t("nav_reports")}</h2>
          <p className="text-xs text-fg2">{t("rep_sub")}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          {/* area picker */}
          <section className="card flex min-h-0 flex-col p-2" aria-label={t("rep_pick")}>
            <div className="hud-label px-2.5 pb-2 pt-2">{t("rep_pick")}</div>
            {!all.data ? (
              <div className="space-y-1.5 p-1">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
            ) : (
              <div role="listbox" aria-label={t("rep_pick")} className="space-y-0.5 lg:max-h-[640px] lg:overflow-y-auto">
                {areas.map((a, i) => {
                  const s = stats(a.items);
                  const on = a.key === sel;
                  return (
                    <button
                      key={a.key || "_city"}
                      role="option"
                      aria-selected={on}
                      onClick={() => setSel(a.key)}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_56px_36px] items-center sm:grid-cols-[minmax(0,1fr)_90px_44px] gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                        on ? "border-accent/50 bg-accent/[.08]" : "border-transparent hover:bg-bg3/60",
                        i === 0 && "mb-1.5",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", i === 0 ? "bg-accent2/15 text-accent2" : "bg-bg3 text-fg2", on && "text-accent")}>
                          {i === 0 ? <Building2 size={15} /> : <MapPinned size={15} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">{a.name}</span>
                          <span className="tnum block text-2xs text-fg3">{fmtHa(s.ha)} {t("ha")} · {t("rep_high_n", { n: s.high })}</span>
                        </span>
                      </span>
                      {i === 0 ? <span /> : (
                        <span className="h-1.5 overflow-hidden rounded-full bg-bg3" aria-hidden>
                          <span className="block h-full rounded-full bg-gradient-to-r from-accent2 to-accent" style={{ width: `${(a.items.length / maxN) * 100}%` }} />
                        </span>
                      )}
                      <span className="tnum text-right text-sm font-semibold">{s.n}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* preview */}
          <section className="card relative overflow-hidden p-5" aria-live="polite">
            <span className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/10 blur-3xl" aria-hidden />
            <div className="relative flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><FileText size={20} /></span>
              <div className="min-w-0">
                <div className="hud-label">{t("rep_doc")}</div>
                <h3 className="truncate text-base font-semibold">{t("rep_title", { area: cur?.name ?? "" })}</h3>
                <p className="tnum text-2xs text-fg3">{meta.data ? `${meta.data.period_t1} → ${meta.data.period_t2}` : ""}</p>
              </div>
            </div>

            <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [t("k_total"), k.n],
                [`${t("metric_area")}, ${t("ha")}`, fmtHa(k.ha)],
                [t("k_restricted"), k.restricted],
                [t("k_high"), k.high],
              ].map(([l, v]) => (
                <div key={String(l)} className="rounded-xl border bg-bg2/60 p-3">
                  <div className="tnum text-xl font-bold">{v}</div>
                  <div className="mt-0.5 text-2xs leading-snug text-fg2">{l}</div>
                </div>
              ))}
            </div>

            <div className="relative mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="section-title mb-2">{t("rep_contents")}</div>
                <ul className="space-y-1.5 text-[13px]">
                  {contents.map(([I, label]) => (
                    <li key={label} className="flex items-center gap-2"><CheckCircle2 size={14} className="shrink-0 text-ok" /><I size={13} className="shrink-0 text-fg3" />{label}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="section-title mb-2">{t("rep_top")}</div>
                <ol className="space-y-1 text-xs">
                  {top.map((a, i) => (
                    <li key={a.alert_id} className="flex items-center gap-2">
                      <span className="tnum w-4 text-fg3">{i + 1}</span>
                      <span className="font-mono">{a.alert_id}</span>
                      <span className="truncate text-fg3">{a.district}</span>
                      <span className="tnum ml-auto font-semibold text-risk-high">{a.risk_score}</span>
                    </li>
                  ))}
                  {!top.length && <li className="text-fg3">—</li>}
                </ol>
              </div>
            </div>

            <div className="relative mt-5 flex flex-wrap gap-2 border-t border-line/10 pt-4">
              <Button variant="primary" size="lg" onClick={pdf} disabled={!cur?.items.length}>
                <Download size={15} /> {t("rep_pdf")}
              </Button>
              <Button size="lg" onClick={csv} disabled={!cur?.items.length}><FileSpreadsheet size={15} /> {t("export_csv")}</Button>
              <Button size="lg" variant="ghost" onClick={() => onOpen({ district: sel })}><MapIcon size={15} /> {t("rep_on_map")}</Button>
            </div>
            {!pdfUrl && <p className="relative mt-2 text-2xs text-fg3">{t("rep_api_only")}</p>}
            <p className="relative mt-3 text-2xs leading-relaxed text-fg3">{t("rep_note")}</p>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
