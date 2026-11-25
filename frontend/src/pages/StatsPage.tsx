import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, Download, Layers, Lightbulb, MapPinned, MousePointerClick, Ruler, UsersRound, X } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EMPTY_FILTERS, STATUSES, ZONES, type Alert, type Filters, type Status } from "@/api/types";
import { exportUrl } from "@/api/client";
import { useAlerts, useInspectors, useMeta } from "@/api/hooks";
import { AXIS, GRID, TOOLTIP } from "@/components/analytics/chartTheme";
import { ChartCard } from "@/components/analytics/ChartCard";
import { KpiCard } from "@/components/analytics/KpiCard";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useI18n, type I18nKey } from "@/i18n";
import { downloadText, fmtDateTime, fmtHa, fmtMonth, RISK_HEX, riskLevel, STATUS_HEX, toCsv, ZONE_HEX } from "@/lib/format";
import { isDemoUser } from "@/lib/demoActivity";
import { pageVariants } from "@/lib/motion";
import { quarterlyCumulative } from "@/components/ui/Spark";

type Scope = { district: string; zone: string; status: string };
const ALL: Scope = { district: "", zone: "", status: "" };

function inScope(a: Alert, s: Scope) {
  if (s.district && a.district !== s.district) return false;
  if (s.zone === "any_restricted" && !a.zones.length) return false;
  if (s.zone && s.zone !== "any_restricted" && !a.zones.includes(s.zone as Alert["zones"][number])) return false;
  if (s.status && a.status !== s.status) return false;
  return true;
}

const Hint = ({ text }: { text: string }) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap text-2xs text-fg3"><MousePointerClick size={11} />{text}</span>
);

/** Analytics over the current alert set. Every number is computed from the API's alerts; filters apply to all charts. */
export function StatsPage({ onOpen }: { onOpen: (f: Partial<Filters>) => void }) {
  const { t, lang } = useI18n();
  const meta = useMeta();
  const all = useAlerts(EMPTY_FILTERS);
  const ins = useInspectors();
  const [scope, setScope] = useState<Scope>(ALL);
  const [metric, setMetric] = useState<"count" | "area">("count");
  const items = useMemo(() => (all.data?.items ?? []).filter((a) => inScope(a, scope)), [all.data, scope]);
  const scoped = !!(scope.district || scope.zone || scope.status);
  // drill-down keeps the page filters and adds the clicked value
  const open = (patch: Partial<Filters>) => onOpen({ district: scope.district, zone: scope.zone, status: scope.status, ...patch });

  const k = useMemo(() => {
    const area = items.reduce((s, a) => s + a.area_m2, 0) / 1e4;
    const restricted = items.filter((a) => a.zones.length).length;
    return {
      total: items.length,
      area,
      restricted,
      restrictedPct: items.length ? Math.round((restricted / items.length) * 100) : 0,
      high: items.filter((a) => riskLevel(a.risk_score) === "high").length,
      confirmed: items.filter((a) => a.status === "confirmed").length,
      pending: items.filter((a) => a.status === "new" || a.status === "in_review").length,
    };
  }, [items]);

  const byDistrict = useMemo(() => {
    const m = new Map<string, { district: string; restricted: number; other: number; area: number }>();
    items.forEach((a) => {
      const r = m.get(a.district) ?? { district: a.district, restricted: 0, other: 0, area: 0 };
      if (a.zones.length) r.restricted++;
      else r.other++;
      r.area += a.area_m2 / 1e4;
      m.set(a.district, r);
    });
    return [...m.values()].sort((a, b) => b.restricted + b.other - (a.restricted + a.other));
  }, [items]);

  const byMonth = useMemo(() => {
    const m = new Map<string, { month: string; count: number; area: number }>();
    items.forEach((a) => {
      if (!a.start_month) return;
      const r = m.get(a.start_month) ?? { month: a.start_month, count: 0, area: 0 };
      r.count++;
      r.area += a.area_m2 / 1e4;
      m.set(a.start_month, r);
    });
    return [...m.values()].sort((a, b) => a.month.localeCompare(b.month)).map((r) => ({ ...r, area: +r.area.toFixed(2) }));
  }, [items]);

  const riskBins = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const lo = i * 10;
        return { lo, label: `${lo}–${lo + 9}`, count: items.filter((a) => a.risk_score >= lo && a.risk_score < lo + 10 + (i === 9 ? 1 : 0)).length };
      }),
    [items],
  );

  const zoneData = useMemo(
    () => ZONES.map((z) => ({ zone: z, name: t(`z_${z}` as I18nKey), count: items.filter((a) => a.zones.includes(z)).length })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count),
    [items, t],
  );
  const statusData = useMemo(() => STATUSES.map((st) => ({ key: st, name: t(`st_${st}` as I18nKey), v: items.filter((a) => a.status === st).length, fill: STATUS_HEX[st] })), [items, t]);
  const heat = useMemo(() => {
    const by = new Map<string, { high: number; mid: number; low: number }>();
    items.forEach((a) => {
      const r = by.get(a.district) ?? { high: 0, mid: 0, low: 0 };
      r[riskLevel(a.risk_score)]++;
      by.set(a.district, r);
    });
    const rows = [...by.entries()].sort((a, b) => b[1].high - a[1].high || b[1].mid - a[1].mid);
    return { rows, max: Math.max(1, ...rows.flatMap(([, r]) => [r.high, r.mid, r.low])) };
  }, [items]);
  const maxReviewed = Math.max(1, ...(ins.data ?? []).map((x) => x.reviewed));

  // Plain-language findings computed from the same alerts as the charts (no model claims)
  const insights = useMemo(() => {
    const out: { text: string; go: Partial<Filters> }[] = [];
    const high = items.filter((a) => riskLevel(a.risk_score) === "high");
    if (high.length >= 4) {
      const by = new Map<string, number>();
      high.forEach((a) => by.set(a.district, (by.get(a.district) ?? 0) + 1));
      const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
      const pct = Math.round(((top[0][1] + (top[1]?.[1] ?? 0)) / high.length) * 100);
      out.push({ text: t("ins_high", { a: top[0][0], b: top[1]?.[0] ?? "", p: pct, n: high.length }), go: { district: top[0][0], minRisk: 60 } });
    }
    if (zoneData.length) {
      out.push({ text: t("ins_zone", { p: k.restrictedPct, z: zoneData[0].name, n: zoneData[0].count }), go: { zone: zoneData[0].zone } });
    }
    if (byMonth.length) {
      const peak = [...byMonth].sort((a, b) => b.count - a.count)[0];
      const big = [...items].sort((a, b) => b.area_m2 - a.area_m2)[0];
      out.push({ text: t("ins_peak", { m: fmtMonth(peak.month, lang), n: peak.count, ha: fmtHa(big.area_m2 / 1e4), id: big.alert_id }), go: { q: big.alert_id } });
    }
    return out;
  }, [items, zoneData, byMonth, k.restrictedPct, t, lang]);

  const exportCsv = () => {
    const url = exportUrl({ ...EMPTY_FILTERS, ...scope });
    if (url) window.open(url, "_blank");
    else downloadText("sitesentinel_alerts.csv", toCsv(items));
  };

  if (all.isError) return <ErrorState error={all.error} onRetry={() => all.refetch()} className="flex-1" />;
  const ready = !!all.data;
  const chartH = "h-72";

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1440px] space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("nav_stats")}</h2>
            <p className="tnum text-xs text-fg2">
              {meta.data ? `${meta.data.region} · ${meta.data.period_t1} → ${meta.data.period_t2} · ` : ""}
              {t("stats_scope", { n: k.total, ha: fmtHa(k.area) })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label={t("district")} className="w-[150px]" value={scope.district} onChange={(e) => setScope({ ...scope, district: e.target.value })}>
              <option value="">{t("all_districts")}</option>
              {(meta.data?.districts ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Select aria-label={t("zone")} className="w-[170px]" value={scope.zone} onChange={(e) => setScope({ ...scope, zone: e.target.value })}>
              <option value="">{t("all_zones")}</option>
              <option value="any_restricted">{t("any_restricted")}</option>
              {ZONES.map((z) => <option key={z} value={z}>{t(`z_${z}` as I18nKey)}</option>)}
            </Select>
            <Select aria-label={t("status")} className="w-[150px]" value={scope.status} onChange={(e) => setScope({ ...scope, status: e.target.value })}>
              <option value="">{t("all_statuses")}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`st_${s}` as I18nKey)}</option>)}
            </Select>
            {scoped && <Button variant="ghost" size="md" onClick={() => setScope(ALL)}><X size={14} /> {t("reset")}</Button>}
            <Button onClick={exportCsv}><Download size={14} /> {t("export_csv")}</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard icon={<MapPinned size={15} />} label={t("k_total")} value={ready ? k.total : undefined} sub={t("k_total_sub")} spark={quarterlyCumulative(items)} />
          <KpiCard icon={<Ruler size={15} />} label={t("k_area")} value={ready ? k.area : undefined} decimals={1} unit={t("ha")} sub={t("k_area_sub")} tone="blue" />
          <KpiCard icon={<Layers size={15} />} label={t("k_restricted")} value={ready ? k.restricted : undefined} sub={t("k_restricted_sub", { p: k.restrictedPct })} tone="accent" spark={quarterlyCumulative(items, (a) => a.zones.length > 0)} />
          <KpiCard icon={<AlertTriangle size={15} />} label={t("k_high")} value={ready ? k.high : undefined} sub={t("k_high_sub")} tone="high" spark={quarterlyCumulative(items, (a) => riskLevel(a.risk_score) === "high")} />
          <KpiCard icon={<CheckCircle2 size={15} />} label={t("k_confirmed")} value={ready ? k.confirmed : undefined} sub={t("k_confirmed_sub")} tone="violet" />
          <KpiCard icon={<Clock size={15} />} label={t("k_pending")} value={ready ? k.pending : undefined} sub={t("k_pending_sub")} tone="mid" />
        </div>

        {ready && insights.length > 0 && (
          <section className="card relative overflow-hidden p-4 md:p-5" aria-label={t("ins_title")}>
            <span className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" aria-hidden />
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent"><Lightbulb size={14} /></span>
              <h3 className="text-sm font-semibold">{t("ins_title")}</h3>
              <span className="text-2xs text-fg3">{t("ins_sub")}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {insights.map((x, i) => (
                <button key={i} onClick={() => open(x.go)} className="group flex items-start gap-3 rounded-xl border bg-bg2/60 p-3 text-left transition hover:border-accent/40 hover:bg-accent/[.06]">
                  <span className="tnum mt-0.5 font-mono text-xs font-bold text-accent">0{i + 1}</span>
                  <span className="flex-1 text-[13px] leading-relaxed text-fg1">{x.text}</span>
                  <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-fg3 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                </button>
              ))}
            </div>
          </section>
        )}

        {ready && !items.length ? (
          <div className="card"><EmptyState title={t("empty_title")} body={t("empty_body")} action={<Button size="sm" onClick={() => setScope(ALL)}>{t("reset")}</Button>} /></div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title={t("by_district")} hint={t("by_district_hint")} action={<Hint text={t("drill_hint")} />}>
              <div className="h-80">
                {ready ? (
                  <ResponsiveContainer>
                    <BarChart data={byDistrict} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
                      <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="district" interval={0} tick={AXIS} width={104} axisLine={false} tickLine={false} />
                      <Tooltip {...TOOLTIP} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="restricted" name={t("in_zone")} stackId="a" fill={RISK_HEX.high} cursor="pointer" onClick={(e: { district?: string }) => e.district && open({ district: e.district, zone: "any_restricted" })} />
                      <Bar dataKey="other" name={t("other")} stackId="a" fill="#3B82F6" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(e: { district?: string }) => e.district && open({ district: e.district })} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Skeleton className="h-full" />}
              </div>
            </ChartCard>

            <ChartCard
              title={t("by_month")}
              hint={t("by_month_hint")}
              action={<Segmented size="xs" label={t("by_month")} value={metric} onChange={setMetric} options={[{ value: "count", label: t("metric_count") }, { value: "area", label: `${t("metric_area")}, ${t("ha")}` }]} />}
            >
              <div className="h-80">
                {ready ? (
                  <ResponsiveContainer>
                    <BarChart data={byMonth} margin={{ left: -16, right: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                      <XAxis dataKey="month" tick={{ ...AXIS, fontSize: 10 }} tickFormatter={(m: string) => fmtMonth(m, lang, true)} axisLine={false} tickLine={false} minTickGap={16} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={metric === "area"} />
                      <Tooltip {...TOOLTIP} labelFormatter={(m: string) => fmtMonth(m, lang)} />
                      <Bar dataKey={metric} name={metric === "count" ? t("count") : t("area_ha")} fill="#22D3EE" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Skeleton className="h-full" />}
              </div>
            </ChartCard>

            <ChartCard title={t("risk_dist")} hint={t("risk_dist_hint")} action={<Hint text={t("drill_hint")} />}>
              <div className={chartH}>
                {ready ? (
                  <ResponsiveContainer>
                    <BarChart data={riskBins} margin={{ left: -16, right: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                      <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...TOOLTIP} labelFormatter={(l: string) => `${t("score")}: ${l}`} />
                      <Bar dataKey="count" name={t("count")} radius={[4, 4, 0, 0]} cursor="pointer" onClick={(e: { lo?: number }) => e.lo != null && open({ minRisk: e.lo })}>
                        {riskBins.map((b) => <Cell key={b.lo} fill={RISK_HEX[riskLevel(b.lo)]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Skeleton className="h-full" />}
              </div>
            </ChartCard>

            <ChartCard title={t("by_zone")} hint={t("by_zone_hint")} action={<Hint text={t("drill_hint")} />}>
              <div className={chartH}>
                {ready ? (
                  zoneData.length ? (
                    <ResponsiveContainer>
                      <BarChart data={zoneData} layout="vertical" margin={{ left: 8, right: 28 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
                        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" interval={0} tick={AXIS} width={150} axisLine={false} tickLine={false} />
                        <Tooltip {...TOOLTIP} />
                        <Bar dataKey="count" name={t("count")} radius={[0, 4, 4, 0]} cursor="pointer" label={{ position: "right", fill: "rgb(148 163 184)", fontSize: 11 }} onClick={(e: { zone?: string }) => e.zone && open({ zone: e.zone })}>
                          {zoneData.map((z) => <Cell key={z.zone} fill={ZONE_HEX[z.zone]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState title={t("no_zone")} />
                ) : <Skeleton className="h-full" />}
              </div>
            </ChartCard>

            <ChartCard title={t("funnel")} hint={t("funnel_hint")} action={<Hint text={t("drill_hint")} />}>
              <div className="space-y-2 pt-1">
                {statusData.map((x) => {
                  const pct = items.length ? (x.v / items.length) * 100 : 0;
                  return (
                    <button key={x.key} onClick={() => open({ status: x.key as Status })} className="block w-full rounded-lg px-1.5 py-1 text-left transition hover:bg-bg3/60">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: x.fill }} />{x.name}</span>
                        <span className="tnum text-fg2"><b className="text-fg1">{x.v}</b> · {Math.round(pct)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-bg3">
                        <motion.div className="h-full rounded-full" style={{ background: x.fill }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ChartCard>

            <ChartCard title={t("heat_table")} hint={t("heat_hint")} action={<Hint text={t("drill_hint")} />}>
              <div className="grid grid-cols-[1fr_repeat(3,56px)] gap-1 text-2xs">
                <span />
                {(["high", "mid", "low"] as const).map((l) => <span key={l} className="text-center text-fg2">{t(`lvl_${l}`)}</span>)}
                {heat.rows.map(([dist, r]) => (
                  <div key={dist} className="contents">
                    <button onClick={() => open({ district: dist })} className="truncate text-left text-fg1 hover:text-accent">{dist}</button>
                    {(["high", "mid", "low"] as const).map((l) => {
                      const v = r[l];
                      const base = { high: "239 68 68", mid: "245 158 11", low: "234 179 8" }[l];
                      return (
                        <button
                          key={l}
                          disabled={!v}
                          onClick={() => open({ district: dist, minRisk: l === "high" ? 60 : l === "mid" ? 30 : 0 })}
                          className="tnum grid h-6 place-items-center rounded font-semibold transition enabled:hover:ring-1 enabled:hover:ring-fg2/40"
                          style={{ background: `rgb(${base} / ${v ? 0.12 + (v / heat.max) * 0.6 : 0.04})`, color: v ? "rgb(var(--fg-1))" : "rgb(var(--fg-3))" }}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                ))}
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
                              {isDemoUser(r.user) && <span className="rounded border border-risk-mid/40 bg-risk-mid/15 px-1 text-[9px] font-bold tracking-widest text-risk-mid">DEMO</span>}
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
              ) : ins.isLoading ? <Skeleton className="h-32" /> : <EmptyState icon={UsersRound} title={t("no_history")} body={t("no_activity_body")} hint={t("demo_act_where")} />}
            </ChartCard>
          </div>
        )}
      </div>
    </motion.div>
  );
}
