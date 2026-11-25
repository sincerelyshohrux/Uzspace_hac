import { Check, ChevronLeft, ChevronRight, ClipboardCheck, Copy, ExternalLink, FileText, Gavel, Info, Link2, MapPin, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Alert, Status } from "@/api/types";
import { chipUrl, reportUrl } from "@/api/client";
import { useAlert, useAudit, useMeta, useTimeseries } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { ChangeIcon, StatusBadge, ZoneChip } from "@/components/ui/badges";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { Tip } from "@/components/ui/tooltip";
import { useI18n, type I18nKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { explain } from "@/lib/explain";
import { copyText, fmtArea, fmtMonth } from "@/lib/format";
import { openPrintableReport } from "@/lib/report";
import { AuditTimeline } from "./AuditTimeline";
import { BeforeAfter } from "./BeforeAfter";
import { BuiltupChart } from "./BuiltupChart";
import { FactorBars } from "./FactorBars";
import { InspectorActions } from "./InspectorActions";
import { NextStep, Provenance } from "./Provenance";
import { RiskGauge } from "./RiskGauge";

function Section({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-line/10 px-4 py-3.5", className)}>
      <h3 className="section-title mb-2.5 flex items-center gap-1">
        {title}
        {hint && (
          <Tip label={<span className="block max-w-[240px] font-normal normal-case tracking-normal">{hint}</span>}>
            <span className="cursor-help text-fg3"><Info size={12} /></span>
          </Tip>
        )}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <span className="text-fg2">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

type DetailTab = "overview" | "evidence" | "decide" | "history";
let lastTab: DetailTab = "overview"; // kept while moving between alerts with J/K

const PERMIT_CLS = {
  none: "border-risk-high/30 bg-risk-high/10 text-risk-high",
  partial: "border-risk-mid/30 bg-risk-mid/10 text-risk-mid",
  matched: "border-ok/30 bg-ok/10 text-ok",
  no_data: "border-line bg-bg2 text-fg2",
};

export function DetailPanel({ id, onClose, onPrev, onNext, position }: { id: string; onClose: () => void; onPrev?: () => void; onNext?: () => void; position?: string }) {
  const { t, lang } = useI18n();
  const meta = useMeta();
  const q = useAlert(id);
  const ts = useTimeseries(id);
  const audit = useAudit(id);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<Status | null>(null);
  const demo = !!meta.data?.is_mock;
  const [tab, setTabState] = useState<DetailTab>(lastTab);
  const setTab = (v: DetailTab) => {
    lastTab = v;
    setTabState(v);
  };

  // Keyboard: Esc close, 1/2/3 status, [ ] prev/next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "Escape") onClose();
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        lastTab = "decide";
        setTabState("decide");
        setTimeout(() => document.querySelector<HTMLButtonElement>(`[aria-keyshortcuts="${e.key}"]`)?.click(), 40);
      }
      if ((e.key === "]" || e.key === "j" || e.key === "J") && onNext) onNext();
      if ((e.key === "[" || e.key === "k" || e.key === "K") && onPrev) onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data)
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );

  const a: Alert = q.data;
  const before = chipUrl(a.chip_before);
  const after = chipUrl(a.chip_after);
  const coords = `${a.lat.toFixed(6)}, ${a.lon.toFixed(6)}`;
  const doCopy = async (text: string, msg: string) => {
    if (await copyText(text)) {
      toast.success(msg);
      return true;
    }
    return false;
  };
  const pdf = () => {
    const url = reportUrl(a.alert_id);
    if (url) window.open(url, "_blank");
    else openPrintableReport(a, audit.data ?? [], (k) => t(k as I18nKey), { before, after });
  };

  const tabs: { id: DetailTab; label: string; n?: number }[] = [
    { id: "overview", label: t("dt_overview") },
    { id: "evidence", label: t("dt_evidence") },
    { id: "decide", label: t("dt_decide") },
    { id: "history", label: t("history"), n: audit.data?.length },
  ];
  const takeReview = () => {
    setTab("decide");
    setTimeout(() => document.querySelector<HTMLButtonElement>('[aria-keyshortcuts="1"]')?.click(), 40);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-2 px-4 pb-2.5 pt-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-mono text-[15px] font-semibold">{a.alert_id}</h2>
            <Tip label={t("copy")}>
              <button onClick={() => doCopy(a.alert_id, t("copied"))} className="text-fg3 hover:text-fg1" aria-label={t("copy")}><Copy size={13} /></button>
            </Tip>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={a.status} />
            <span className="inline-flex items-center gap-1 rounded-md bg-risk-mid/12 px-1.5 py-0.5 text-2xs font-semibold text-risk-mid ring-1 ring-inset ring-risk-mid/25">{t("needs_check")}</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {position && <span className="tnum mr-1 hidden text-2xs text-fg3 sm:inline">{position}</span>}
          <Tip label={t("prev")} kbd="K"><Button variant="ghost" size="icon-sm" onClick={onPrev} disabled={!onPrev} aria-label={t("prev")}><ChevronLeft size={16} /></Button></Tip>
          <Tip label={t("next")} kbd="J"><Button variant="ghost" size="icon-sm" onClick={onNext} disabled={!onNext} aria-label={t("next")}><ChevronRight size={16} /></Button></Tip>
          <Tip label={t("close")} kbd="Esc"><Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("close")}><X size={16} /></Button></Tip>
        </div>
      </div>

      <div role="tablist" aria-label={t("dt_tabs")} className="flex gap-1 border-b border-line/10 px-3">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={cn("relative flex h-9 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors", tab === x.id ? "text-accent" : "text-fg2 hover:text-fg1")}
          >
            {x.label}
            {!!x.n && <span className="tnum rounded bg-bg3 px-1 text-[10px] text-fg2">{x.n}</span>}
            {tab === x.id && <motion.span layoutId={`dt-${id}`} className="absolute inset-x-1.5 -bottom-px h-[2px] rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" role="tabpanel">
        {tab === "overview" && (
          <>
            <div className="pt-3.5" />
        <div className="px-4 pb-3.5">
          <BeforeAfter a={a} before={before} after={after} demo={demo} />
          <div className="mt-2.5 grid grid-cols-3 divide-x divide-line/10 rounded-xl border bg-bg2/50 py-2">
            {[
              [t("rf_confidence"), `${Math.round(a.confidence * 100)}%`, "text-accent"],
              [t("started"), fmtMonth(a.start_month, lang, true), "text-fg1"],
              [t("area"), `${fmtArea(a.area_m2)}`, "text-fg1"],
            ].map(([l, v, c]) => (
              <div key={l} className="min-w-0 px-2.5">
                <div className="hud-label leading-snug [overflow-wrap:anywhere]" title={l}>{l}</div>
                <div className={cn("tnum mt-0.5 truncate text-[13px] font-semibold", c)}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-line/10 px-4 py-3.5">
          <RiskGauge score={a.risk_score} confidence={a.confidence} />
        </div>

        <Section title={t("why")}>
          <p className="mb-3 text-[13px] leading-relaxed text-fg1">{explain(a, t)}</p>
          <div className="mb-2.5 flex flex-wrap gap-1">
            {a.zones.length ? a.zones.map((z) => <ZoneChip key={z} zone={z} />) : <span className="text-xs text-fg3">{t("no_zone")}</span>}
          </div>
          <div className={cn("mb-3 rounded-lg border px-2.5 py-1.5 text-xs font-medium", PERMIT_CLS[a.permit_match])}>
            {t(`pm_${a.permit_match}`)} {demo && <span className="opacity-70">{t("demo_registry")}</span>}
          </div>
          <FactorBars a={a} />
        </Section>

          </>
        )}
        {tab === "evidence" && (
          <>
        <Section className="border-t-0" title={t("prov_title")} hint={t("prov_hint")}>
          <Provenance meta={meta.data} />
        </Section>

        <Section title={t("facts")}>
          <div className="divide-y divide-line/10">
            <Fact label={t("district")}>{a.district}</Fact>
            <Fact label={t("coords")}>
              <button
                className="inline-flex items-center gap-1 font-mono text-xs hover:text-accent"
                onClick={async () => {
                  if (await doCopy(coords, t("copied"))) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }
                }}
              >
                {coords}
                {copied ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
              </button>
            </Fact>
            <Fact label={t("area")}>
              <span className="tnum">{fmtArea(a.area_m2)}</span> <span className="text-2xs font-normal text-fg3">{t("approx")}</span>
            </Fact>
            <Fact label={t("change_type")}>
              <span className="inline-flex items-center gap-1"><ChangeIcon type={a.change_type} />{t(`ct_${a.change_type}`)}</span>
            </Fact>
            <Fact label={t("started")}>~ {fmtMonth(a.start_month, lang)}</Fact>
          </div>
        </Section>

        <Section title={t("builtup")} hint={t("builtup_hint")}>
          <BuiltupChart data={ts.data ?? []} start={a.start_month} loading={ts.isLoading} />
        </Section>

          </>
        )}
        {tab === "decide" && (
          <>
        <Section className="border-t-0" title={t("actions")}>
          <div className="mb-3"><NextStep a={a} /></div>
          <InspectorActions a={a} pending={pending} onPending={setPending} />
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Button size="sm" onClick={pdf}><FileText size={14} /> {t("report_pdf")}</Button>
            <Button size="sm" onClick={() => window.open(`https://www.google.com/maps?q=${a.lat},${a.lon}`, "_blank", "noopener")}>
              <ExternalLink size={14} /> {t("open_maps")}
            </Button>
            <Button size="sm" onClick={() => doCopy(coords, t("copied"))}><MapPin size={14} /> {t("coords")}</Button>
            <Button size="sm" onClick={() => doCopy(location.href, t("copied"))}><Link2 size={14} /> {t("copy_link")}</Button>
          </div>
        </Section>

          </>
        )}
        {tab === "history" && (
          <>
        <Section className="border-t-0" title={t("history")}>
          <AuditTimeline items={audit.data} loading={audit.isLoading} />
        </Section>

          </>
        )}
        <p className="border-t border-line/10 px-4 py-3 text-[11px] leading-relaxed text-fg3">{t("disclaimer")}</p>
      </div>

      {/* always-visible actions */}
      <div className="flex items-center gap-1.5 border-t border-line/10 bg-bg1/60 px-3 py-2.5 backdrop-blur">
        {a.status === "new" ? (
          <Button variant="primary" className="flex-1" onClick={takeReview}>
            <ClipboardCheck size={15} /> {t("a_review")} <span className="kbd ml-1 border-white/30 bg-white/15 text-white">1</span>
          </Button>
        ) : (
          <Button variant={tab === "decide" ? "default" : "primary"} className="flex-1" onClick={() => setTab("decide")}>
            <Gavel size={15} /> {t("dt_decide")} · <StatusBadge status={a.status} />
          </Button>
        )}
        <Tip label={t("report_pdf")}><Button size="icon" onClick={pdf} aria-label={t("report_pdf")}><FileText size={15} /></Button></Tip>
        <Tip label={t("open_maps")}>
          <Button size="icon" onClick={() => window.open(`https://www.google.com/maps?q=${a.lat},${a.lon}`, "_blank", "noopener")} aria-label={t("open_maps")}><ExternalLink size={15} /></Button>
        </Tip>
      </div>
    </div>
  );
}
