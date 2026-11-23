import { AlertTriangle, CheckCircle2, Clock, Download, Layers, MapPinned, Ruler } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EMPTY_FILTERS, ZONES } from "@/api/types";
import { exportUrl } from "@/api/client";
import { useAlerts, useDistrictStats, useInspectors, useSummary, useTimeline } from "@/api/hooks";
import { AXIS, GRID, TOOLTIP } from "@/components/analytics/chartTheme";
import { ChartCard } from "@/components/analytics/ChartCard";
import { KpiCard } from "@/components/analytics/KpiCard";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { useI18n, type I18nKey } from "@/i18n";
import { downloadText, fmtDateTime, fmtMonth, riskLevel, STATUS_HEX, toCsv, ZONE_HEX } from "@/lib/format";
import { pageVariants } from "@/lib/motion";

export function StatsPage({ onDistrict }: { onDistrict: (d: string) => void }) {
  const { t, lang } = useI18n();
  const s = useSummary();
  const d = useDistrictStats();
  const tl = useTimeline();
  const ins = useInspectors();
  const all = useAlerts(EMPTY_FILTERS);
  const items = all.data?.items ?? [];

  const cumulative = useMemo(() => {
    let c = 0;
    let a = 0;
    return (tl.data ?? []).map((p) => ({ count: (c += p.count), area: (a += p.area_ha) }));
  }, [tl.data]);

  const zoneData = useMemo(
    () => ZONES.map((z) => ({ zone: z, name: t(`z_${z}` as I18nKey), count: items.filter((a) => a.zones.includes(z)).length })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count),
    [items, t],
  );
  const statusData = useMemo(() => {
    const c = (st: string) => items.filter((a) => a.status === st).length;
    return [
      { key: "new", name: t("st_new"), v: c("new"), fill: STATUS_HEX.new },
      { key: "in_review", name: t("st_in_review"), v: c("in_review"), fill: STATUS_HEX.in_review },
      { key: "confirmed", name: t("st_confirmed"), v: c("confirmed"), fill: STATUS_HEX.confirmed },
      { key: "false_positive", name: t("st_false_positive"), v: c("false_positive"), fill: STATUS_HEX.false_positive },
    ];
  }, [items, t]);
  const heat = useMemo(() => {
    const by = new Map<string, { high: number; mid: number; low: number }>();
    items.forEach((a) => {
      const r = by.get(a.district) ?? { high: 0, mid: 0, low: 0 };
      r[riskLevel(a.risk_score)]++;
      by.set(a.district, r);
    });
    const rows = [...by.entries()].sort((a, b) => b[1].high - a[1].high || b[1].mid - a[1].mid);
    const max = Math.max(1, ...rows.flatMap(([, r]) => [r.high, r.mid, r.low]));
    return { rows, max };
  }, [items]);
  const maxReviewed = Math.max(1, ...(ins.data ?? []).map((x) => x.reviewed));
  const restrictedPct = s.data ? Math.round((s.data.in_restricted_zone / Math.max(1, s.data.total)) * 100) : 0;

  const exportCsv = () => {
    const url = exportUrl(EMPTY_FILTERS);
    if (url) window.open(url, "_blank");
    else downloadText("sitesentinel_alerts.csv", toCsv(items));
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1440px] space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("nav_stats")}</h2>
            <p className="text-xs text-fg2">2023 → 2025 · Toshkent</p>
          </div>
          <Button onClick={exportCsv}><Download size={14} /> {t("export_csv")}</Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard icon={<MapPinned size={15} />} label={t("k_total")} value={s.data?.total} sub={t("k_total_sub")} spark={cumulative.map((x) => x.count)} />
          <KpiCard icon={<Ruler size={15} />} label={t("k_area")} value={s.data?.area_ha} decimals={1} unit={t("ha")} sub={t("k_area_sub")} tone="blue" spark={cumulative.map((x) => x.area)} />
          <KpiCard icon={<Layers size={15} />} label={t("k_restricted")} value={s.data?.in_restricted_zone} sub={t("k_restricted_sub", { p: restrictedPct })} tone="accent" />
          <KpiCard icon={<AlertTriangle size={15} />} label={t("k_high")} value={s.data?.high_risk} sub={t("k_high_sub")} tone="high" />
          <KpiCard icon={<CheckCircle2 size={15} />} label={t("k_confirmed")} value={s.data?.confirmed} sub={t("k_confirmed_sub")} tone="violet" />
          <KpiCard icon={<Clock size={15} />} label={t("k_pending")} value={s.data?.pending} sub={t("k_pending_sub")} tone="mid" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title={t("by_district")} hint={t("by_district_hint")}>
            <div className="h-80">
              {d.data ? (
                <ResponsiveContainer>
                  <BarChart data={d.data.map((x) => ({ ...x, other: x.count - x.in_restricted_zone }))} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
                    <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="district" tick={AXIS} width={104} axisLine={false} tickLine={false} />
                    <Tooltip {...TOOLTIP} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar isAnimationActive={false} dataKey="in_restricted_zone" name={t("in_zone")} stackId="a" fill="#EF4444" cursor="pointer" onClick={(e: { district?: string }) => e.district && onDistrict(e.district)} />
                    <Bar isAnimationActive={false} dataKey="other" name={t("other")} stackId="a" fill="#3B82F6" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(e: { district?: string }) => e.district && onDistrict(e.district)} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Skeleton className="h-full" />}
            </div>
          </ChartCard>

          <ChartCard title={t("by_month")} hint={t("by_month_hint")}>
            <div className="h-80">
              {tl.data ? (
                <ResponsiveContainer>
                  <ComposedChart data={tl.data} margin={{ left: -16, right: 4 }}>
                    <defs>
                      <linearGradient id="bm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#22D3EE" stopOpacity={0.9} />
                        <stop offset="1" stopColor="#22D3EE" stopOpacity={0.25} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                    <XAxis dataKey="month" tick={{ ...AXIS, fontSize: 10 }} tickFormatter={(m: string) => fmtMonth(m, lang, true)} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis yAxisId="c" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis yAxisId="a" orientation="right" tick={AXIS} axisLine={false} tickLine={false} width={36} />
                    <Tooltip {...TOOLTIP} labelFormatter={(m: string) => fmtMonth(m, lang)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar isAnimationActive={false} yAxisId="c" dataKey="count" name={t("count")} fill="url(#bm)" radius={[4, 4, 0, 0]} />
                    <Line isAnimationActive={false} yAxisId="a" dataKey="area_ha" name={t("area_ha")} stroke="#F59E0B" strokeWidth={2} dot={false} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <Skeleton className="h-full" />}
            </div>
          </ChartCard>

          <ChartCard title={t("by_zone")} hint={t("by_zone_hint")}>
            <div className="h-72">
              {all.data ? (
                <ResponsiveContainer>
                  <BarChart data={zoneData} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
                    <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={AXIS} width={150} axisLine={false} tickLine={false} />
                    <Tooltip {...TOOLTIP} />
                    <Bar isAnimationActive={false} dataKey="count" name={t("count")} radius={[0, 4, 4, 0]} label={{ position: "right", fill: "rgb(148 163 184)", fontSize: 11 }}>
                      {zoneData.map((z) => <Cell key={z.zone} fill={ZONE_HEX[z.zone]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <Skeleton className="h-full" />}
            </div>
          </ChartCard>

          <ChartCard title={t("funnel")} hint={t("funnel_hint")}>
            <div className="space-y-3 pt-1">
              {statusData.map((x) => {
                const pct = items.length ? (x.v / items.length) * 100 : 0;
                return (
                  <div key={x.key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: x.fill }} />{x.name}</span>
                      <span className="tnum text-fg2"><b className="text-fg1">{x.v}</b> · {Math.round(pct)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-bg3">
                      <motion.div className="h-full rounded-full" style={{ background: x.fill }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5">
              <div className="section-title mb-2">{t("heat_table")} <span className="font-normal normal-case tracking-normal text-fg3">· {t("heat_hint")}</span></div>
              <div className="grid grid-cols-[1fr_repeat(3,52px)] gap-1 text-2xs">
                <span />
                {(["high", "mid", "low"] as const).map((l) => <span key={l} className="text-center text-fg2">{t(`lvl_${l}`)}</span>)}
                {heat.rows.slice(0, 8).map(([dist, r]) => (
                  <div key={dist} className="contents">
                    <button onClick={() => onDistrict(dist)} className="truncate text-left text-fg1 hover:text-accent">{dist}</button>
                    {(["high", "mid", "low"] as const).map((l) => {
                      const v = r[l];
                      const base = { high: "239 68 68", mid: "245 158 11", low: "234 179 8" }[l];
                      return (
                        <span key={l} className="tnum grid h-6 place-items-center rounded font-semibold" style={{ background: `rgb(${base} / ${v ? 0.12 + (v / heat.max) * 0.6 : 0.04})`, color: v ? "rgb(var(--fg-1))" : "rgb(var(--fg-3))" }}>
                          {v}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>

          <ChartCard title={t("inspectors")} hint={t("inspectors_hint")} className="lg:col-span-2">
            {ins.data?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[13px]">
                  <thead>
                    <tr className="text-left text-2xs uppercase tracking-wide text-fg3">
                      <th className="pb-2 font-medium">{t("i_user")}</th>
                      <th className="pb-2 font-medium">{t("i_reviewed")}</th>
                      <th className="pb-2 text-right font-medium">{t("i_confirmed")}</th>
                      <th className="pb-2 text-right font-medium">{t("i_fp")}</th>
                      <th className="pb-2 text-right font-medium">{t("i_last")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/10">
                    {ins.data.map((r) => (
                      <tr key={r.user}>
                        <td className="py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-accent2/15 text-[10px] font-bold uppercase text-accent2">{r.user.slice(0, 2)}</span>
                            <span className="font-mono text-xs">{r.user}</span>
                          </span>
                        </td>
                        <td className="w-[40%] py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg3"><span className="block h-full rounded-full bg-accent" style={{ width: `${(r.reviewed / maxReviewed) * 100}%` }} /></span>
                            <span className="tnum w-6 text-right font-semibold">{r.reviewed}</span>
                          </span>
                        </td>
                        <td className="tnum py-2.5 text-right text-st-confirmed">{r.confirmed}</td>
                        <td className="tnum py-2.5 text-right text-fg2">{r.false_positive}</td>
                        <td className="tnum py-2.5 text-right text-xs text-fg2">{fmtDateTime(r.last_action, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : ins.isLoading ? <Skeleton className="h-32" /> : <EmptyState title={t("no_history")} />}
          </ChartCard>
        </div>
      </div>
    </motion.div>
  );
}
