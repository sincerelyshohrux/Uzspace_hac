import { ArrowRight, Brain, CheckCircle2, CircleDashed, Database, FlaskConical, Layers3, ListChecks, Satellite, Target, TrendingUp, Waypoints } from "lucide-react";
import { motion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMetrics } from "@/api/hooks";
import { AXIS, GRID, TOOLTIP } from "@/components/analytics/chartTheme";
import { ChartCard } from "@/components/analytics/ChartCard";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ErrorState, Skeleton } from "@/components/ui/states";
import type { Metrics } from "@/api/types";
import { useI18n, type I18nKey } from "@/i18n";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/cn";
import { pageVariants } from "@/lib/motion";

export function AccuracyPage() {
  const { t } = useI18n();
  const m = useMetrics();
  if (m.isError) return <ErrorState error={m.error} onRetry={() => m.refetch()} className="flex-1" />;
  if (!m.data)
    return (
      <div className="mx-auto grid w-full max-w-[1440px] gap-4 p-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
      </div>
    );
  const d = m.data;
  if (d.test_points === 0) return <PendingAccuracy m={d} />;
  const compare = [
    { name: t("precision"), b: d.baseline.precision, m: d.ml.precision },
    { name: t("recall"), b: d.baseline.recall, m: d.ml.recall },
    { name: t("f1"), b: d.baseline.f1, m: d.ml.f1 },
  ];
  const fpReduction = Math.round((1 - (1 - d.ml.precision) / (1 - d.baseline.precision)) * 100);
  const sel = d.pr_curve.find((p) => p.threshold === d.threshold);
  const { tp, fp, fn, tn } = d.confusion;
  const delta = (x: number, b?: number) => (b == null ? undefined : `${x - b >= 0 ? "▲ +" : "▼ "}${(x - b).toFixed(2)} ${t("vs_baseline")}`);
  const op = d.object_precision;

  const cm = (v: number, rowTotal: number, good: boolean, caption: string) => (
    <div className={cn("grid place-items-center rounded-xl border py-4", good ? "border-accent/30 bg-accent/10" : "border-line/10 bg-bg2")}>
      <div className={cn("tnum text-2xl font-semibold", good ? "text-accent" : "text-fg1")}>{v}</div>
      <div className="tnum text-2xs text-fg2">{Math.round((v / rowTotal) * 100)}%</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-fg3">{caption}</div>
    </div>
  );

  const steps = [
    [Satellite, t("pipe_1"), t("pipe_1d")],
    [Waypoints, t("pipe_2"), t("pipe_2d")],
    [Brain, t("pipe_3"), t("pipe_3d")],
    [Layers3, t("pipe_4"), t("pipe_4d")],
    [ListChecks, t("pipe_5"), t("pipe_5d")],
  ] as const;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1440px] space-y-4 p-4 md:p-6">
        <div>
          <h2 className="text-lg font-semibold">{t("nav_accuracy")}</h2>
          <p className="text-xs text-fg2">{t("test_set", { n: d.test_points })}{d.dataset ? ` · ${d.dataset.cv}` : ""}</p>
        </div>
        {d.is_mock && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 dark:text-rose-300">
            <FlaskConical size={16} className="shrink-0" /> <span className="text-fg1">{t("mock_metrics")}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard icon={<Target size={15} />} label={`${t("ml_model")} · ${t("precision")}`} value={d.ml.precision} decimals={2} sub={delta(d.ml.precision, d.baseline.precision)} />
          <KpiCard icon={<TrendingUp size={15} />} label={`${t("ml_model")} · ${t("recall")}`} value={d.ml.recall} decimals={2} sub={delta(d.ml.recall, d.baseline.recall)} tone="blue" />
          <KpiCard icon={<Target size={15} />} label={`${t("ml_model")} · F1`} value={d.ml.f1} decimals={2} sub={delta(d.ml.f1, d.baseline.f1)} tone="violet" />
          <KpiCard icon={<TrendingUp size={15} />} label="PR-AUC" value={d.ml.pr_auc} decimals={2} sub={`${t("threshold")}: ${d.threshold}`} tone="ok" />
        </div>

        <section className="card p-4">
          <h3 className="mb-3 text-sm font-semibold">{t("how_it_works")}</h3>
          <div className="grid gap-2 sm:grid-cols-5">
            {steps.map(([I, title, desc], i) => (
              <div key={title} className="relative flex items-center gap-2 sm:block">
                <div className="flex flex-1 items-center gap-3 rounded-xl border bg-bg2 p-3 sm:block">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent"><I size={17} /></div>
                  <div className="sm:mt-2">
                    <div className="text-[13px] font-semibold">{title}</div>
                    <div className="text-2xs text-fg2">{desc}</div>
                  </div>
                </div>
                {i < steps.length - 1 && <ArrowRight size={14} className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-fg3 sm:block" />}
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title={t("compare_title")} hint={t("compare_hint")} action={fpReduction > 0 && <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-ok/12 px-2 py-1 text-2xs font-semibold text-ok"><Target size={12} /> {t("fp_reduction", { x: fpReduction })}</span>}>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={compare} margin={{ left: -18, right: 4 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                  <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 1]} tick={AXIS} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP} formatter={(v: number) => v.toFixed(2)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar isAnimationActive={false} dataKey="b" name={t("baseline")} fill="#64748B" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fill: "rgb(148 163 184)", formatter: (v: number) => v.toFixed(2) }} />
                  <Bar isAnimationActive={false} dataKey="m" name={t("ml_model")} fill="#22D3EE" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fill: "rgb(148 163 184)", formatter: (v: number) => v.toFixed(2) }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title={t("pr_curve")} hint={sel ? `${t("threshold")} ${d.threshold}: P ${sel.precision.toFixed(2)} · R ${sel.recall.toFixed(2)}` : undefined}>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={[...d.pr_curve].sort((a, b) => a.recall - b.recall)} margin={{ left: -18, right: 12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="recall" type="number" domain={[0, 1]} tick={AXIS} axisLine={false} tickLine={false} label={{ value: t("recall"), fontSize: 11, fill: "rgb(148 163 184)", position: "insideBottom", offset: -6 }} />
                  <YAxis domain={[0, 1]} tick={AXIS} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP} labelFormatter={(r: number) => `${t("recall")} ${Number(r).toFixed(2)}`} formatter={(v: number, _n, p) => [`${v.toFixed(2)} (thr ${(p.payload as { threshold: number }).threshold})`, t("precision")]} />
                  <Line isAnimationActive={false} dataKey="precision" name={t("precision")} stroke="#22D3EE" strokeWidth={2.5} dot={{ r: 3, fill: "#22D3EE" }} />
                  {sel && <ReferenceDot x={sel.recall} y={sel.precision} r={7} fill="#EF4444" stroke="#fff" strokeWidth={2} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title={t("confusion")} hint={t("test_set", { n: d.test_points })}>
            <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-xs">
              <span />
              <span className="text-center font-medium text-fg2">{t("predicted")}: {t("change")}</span>
              <span className="text-center font-medium text-fg2">{t("predicted")}: {t("no_change")}</span>
              <span className="max-w-[88px] pr-1 text-right font-medium text-fg2">{t("actual")}: {t("change")}</span>
              {cm(tp, tp + fn, true, t("cm_tp"))}
              {cm(fn, tp + fn, false, t("cm_fn"))}
              <span className="max-w-[88px] pr-1 text-right font-medium text-fg2">{t("actual")}: {t("no_change")}</span>
              {cm(fp, fp + tn, false, t("cm_fp"))}
              {cm(tn, fp + tn, true, t("cm_tn"))}
            </div>
          </ChartCard>

          <ChartCard title={t("object_precision")}>
            <div className="flex items-end gap-3">
              <div className="tnum text-5xl font-semibold text-accent">{Math.round((op.correct / op.checked) * 100)}%</div>
              <div className="tnum pb-1.5 text-sm text-fg2">{op.correct} / {op.checked}</div>
            </div>
            <div className="mt-3 grid grid-cols-[repeat(25,minmax(0,1fr))] gap-1">
              {Array.from({ length: op.checked }).map((_, i) => (
                <motion.span key={i} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.008 }} className={cn("aspect-square rounded-[3px]", i < op.correct ? "bg-accent" : "bg-risk-high/50")} />
              ))}
            </div>
            <p className="mt-3 text-sm text-fg2">{t("object_precision_body", op)}</p>
          </ChartCard>

          {d.dataset && (
            <ChartCard title={t("dataset")}>
              <dl className="divide-y divide-line/10 text-[13px]">
                {[
                  [t("ds_source"), d.dataset.source],
                  [t("ds_period"), `T1 ${d.dataset.period_t1} · T2 ${d.dataset.period_t2}`],
                  [t("ds_split"), `${d.dataset.n_train} / ${d.dataset.n_test}`],
                  [t("ds_cv"), d.dataset.cv],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2">
                    <dt className="flex items-center gap-1.5 text-fg2"><Database size={12} />{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="section-title mb-1.5 mt-3">{t("ds_features")}</div>
              <div className="flex flex-wrap gap-1">
                {d.dataset.features.map((f) => <span key={f} className="rounded-md border bg-bg2 px-1.5 py-0.5 font-mono text-2xs">{f}</span>)}
              </div>
            </ChartCard>
          )}

          <ChartCard title={t("limitations")} className={d.dataset ? "" : "lg:col-span-2"}>
            <ul className="space-y-2 text-[13px] text-fg1">
              {d.limitations.map((l) => (
                <li key={l} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-risk-mid" />
                  {l}
                </li>
              ))}
            </ul>
          </ChartCard>
        </div>
      </div>
    </motion.div>
  );
}

/** Shown until the team has labelled the validation sample: method, status, no numbers. */
function PendingAccuracy({ m }: { m: Metrics }) {
  const { t } = useI18n();
  const limitations = m.limitations;
  const strata = m.sampling ?? [];
  const totalPx = strata.reduce((s, x) => s + x.pixels, 0);
  const totalPts = strata.reduce((s, x) => s + x.points, 0);
  const steps: [boolean, string, string][] = [
    [true, t("acc_s1"), t("acc_s1d")],
    [true, t("acc_s2"), t("acc_s2d")],
    [false, t("acc_s3"), t("acc_s3d")],
    [false, t("acc_s4"), t("acc_s4d")],
  ];
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1100px] space-y-4 p-4 md:p-6">
        <div>
          <h2 className="text-lg font-semibold">{t("nav_accuracy")}</h2>
          <p className="text-xs text-fg2">{t("acc_pending_sub")}</p>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-sm">
          <FlaskConical size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <span className="text-fg1">{t("acc_pending_body")}</span>
        </div>
        <section className="card p-4">
          <h3 className="mb-3 text-sm font-semibold">{t("acc_method")}</h3>
          <ol className="grid gap-2 md:grid-cols-2">
            {steps.map(([done, title, desc]) => (
              <li key={title} className="flex gap-3 rounded-xl border bg-bg2 p-3">
                {done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" /> : <CircleDashed size={18} className="mt-0.5 shrink-0 text-fg3" />}
                <div>
                  <div className="text-[13px] font-semibold">{title}</div>
                  <div className="text-2xs text-fg2">{desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>
        {strata.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <ChartCard title={t("acc_sample")} hint={t("acc_sample_hint")}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-2xs uppercase tracking-wide text-fg3">
                    <th className="pb-2 font-medium">{t("acc_stratum")}</th>
                    <th className="pb-2 text-right font-medium">{t("acc_px")}</th>
                    <th className="pb-2 pl-3 font-medium" />
                    <th className="pb-2 text-right font-medium">{t("acc_points")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/10">
                  {strata.map((x) => {
                    const share = x.pixels / totalPx;
                    return (
                      <tr key={x.stratum}>
                        <td className="py-2">{t(`acc_s_${x.stratum}` as I18nKey)}</td>
                        <td className="tnum py-2 text-right text-fg2">{fmtInt(x.pixels / 100)} {t("ha")}</td>
                        <td className="w-[30%] py-2 pl-3">
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg3"><span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(1, share * 100)}%` }} /></span>
                            <span className="tnum w-9 text-right text-2xs text-fg2">{(share * 100).toFixed(1)}%</span>
                          </span>
                        </td>
                        <td className="tnum py-2 text-right font-semibold">{x.points}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-semibold">
                    <td className="py-2">Σ</td>
                    <td className="tnum py-2 text-right">{fmtInt(totalPx / 100)} {t("ha")}</td>
                    <td />
                    <td className="tnum py-2 text-right">{totalPts}</td>
                  </tr>
                </tbody>
              </table>
            </ChartCard>
            <ChartCard title={t("acc_progress")}>
              <div className="flex items-baseline gap-1.5">
                <span className="tnum text-3xl font-semibold">{m.labelled?.usable ?? 0}</span>
                <span className="tnum text-sm text-fg2">/ {m.labelled?.total ?? totalPts}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg3">
                <div className="h-full rounded-full bg-accent" style={{ width: `${((m.labelled?.usable ?? 0) / Math.max(1, m.labelled?.total ?? totalPts)) * 100}%` }} />
              </div>
              <p className="mt-3 text-xs text-fg2">{t("acc_progress_body", { n: totalPts })}</p>
              <p className="mt-1.5 text-xs text-fg3">{t("acc_need")}</p>
            </ChartCard>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title={t("acc_compare_what")}>
            <ul className="space-y-2 text-[13px]">
              {(["acc_c1", "acc_c2", "acc_c3"] as const).map((k) => (
                <li key={k} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{t(k)}</li>
              ))}
            </ul>
          </ChartCard>
          <ChartCard title={t("limitations")}>
            <ul className="space-y-2 text-[13px] text-fg1">
              {limitations.map((l) => (
                <li key={l} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-risk-mid" />{l}</li>
              ))}
            </ul>
          </ChartCard>
        </div>
      </div>
    </motion.div>
  );
}
