import { Eye, FileQuestion, Map as MapIcon, Ruler, Satellite } from "lucide-react";
import type { ReactNode } from "react";
import type { Alert, Meta, Status } from "@/api/types";
import { useI18n, type I18nKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { WAYBACK } from "@/lib/wayback";

function Row({ icon, title, body, sub, tone = "fg" }: { icon: ReactNode; title: string; body: string; sub?: string; tone?: "fg" | "accent" | "muted" }) {
  return (
    <li className="flex gap-2.5 py-2">
      <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md", tone === "accent" ? "bg-accent/12 text-accent" : tone === "muted" ? "bg-bg3 text-fg3" : "bg-accent2/12 text-accent2")}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold">{title}</div>
        <div className="text-2xs leading-snug text-fg2">{body}</div>
        {sub && <div className="mt-0.5 whitespace-pre-line font-mono text-[10.5px] text-fg3">{sub}</div>}
      </div>
    </li>
  );
}

/** Where each piece of evidence comes from: detection source vs. visual check vs. missing data. */
export function Provenance({ meta }: { meta: Meta | undefined }) {
  const { t } = useI18n();
  if (meta?.is_mock) return <p className="rounded-lg border border-risk-mid/30 bg-risk-mid/10 px-2.5 py-1.5 text-xs text-risk-mid">{t("prov_demo")}</p>;
  const scenes = (s?: string[], period?: string) => (s?.length ? s.join(" · ") : period ?? "");
  return (
    <ul className="divide-y divide-line/10">
      <Row
        icon={<Satellite size={13} />}
        tone="accent"
        title={t("prov_model")}
        body={t("prov_model_d")}
        sub={meta ? `T1 ${scenes(meta.scenes_t1, meta.period_t1)}\nT2 ${scenes(meta.scenes_t2, meta.period_t2)}` : undefined}
      />
      <Row icon={<Eye size={13} />} title={t("prov_visual")} body={t("prov_visual_d", { t1: WAYBACK.t1.label, t2: WAYBACK.t2.label })} />
      <Row icon={<MapIcon size={13} />} title={t("prov_zones")} body={t("prov_zones_d")} />
      <Row icon={<Ruler size={13} />} tone="muted" title={t("prov_measure")} body={t("prov_measure_d")} />
      <Row icon={<FileQuestion size={13} />} tone="muted" title={t("prov_permit")} body={t("prov_permit_d")} />
    </ul>
  );
}

const NEXT: Record<Status, I18nKey> = { new: "next_new", in_review: "next_in_review", confirmed: "next_confirmed", false_positive: "next_false_positive" };

export function NextStep({ a }: { a: Alert }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-accent/25 bg-accent/[.07] px-3 py-2">
      <div className="text-2xs font-semibold uppercase tracking-wider text-accent">{t("next_title")}</div>
      <p className="mt-0.5 text-[12.5px] leading-snug text-fg1">{t(NEXT[a.status])}</p>
    </div>
  );
}
