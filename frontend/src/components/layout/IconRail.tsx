import { BarChart3, HelpCircle, Map as MapIcon, Settings, Target } from "lucide-react";
import { motion } from "motion/react";
import type { Tab } from "@/app/state";
import { Tip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";

export const NAV: { tab: Tab; icon: typeof MapIcon; key: "nav_dashboard" | "nav_stats" | "nav_accuracy" }[] = [
  { tab: "dashboard", icon: MapIcon, key: "nav_dashboard" },
  { tab: "stats", icon: BarChart3, key: "nav_stats" },
  { tab: "accuracy", icon: Target, key: "nav_accuracy" },
];

export function IconRail({ tab, onTab, onSettings, onHelp }: { tab: Tab; onTab: (t: Tab) => void; onSettings: () => void; onHelp: () => void }) {
  const { t } = useI18n();
  const item = "relative grid h-10 w-10 place-items-center rounded-xl text-fg2 transition-colors hover:bg-bg3 hover:text-fg1";
  return (
    <nav className="z-30 hidden w-16 shrink-0 flex-col items-center gap-1 border-r border-line/10 bg-bg1 py-3 md:flex" aria-label="Main">
      <div className="mb-3"><Logo size={34} /></div>
      {NAV.map(({ tab: k, icon: I, key }) => (
        <Tip key={k} label={t(key)} side="right">
          <button className={cn(item, tab === k && "text-accent")} onClick={() => onTab(k)} aria-label={t(key)} aria-current={tab === k ? "page" : undefined}>
            {tab === k && <motion.span layoutId="rail-active" className="absolute inset-0 rounded-xl bg-accent/12" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            {tab === k && <motion.span layoutId="rail-bar" className="absolute -left-3 top-2 h-6 w-[3px] rounded-r bg-accent shadow-[0_0_10px_rgb(var(--accent))]" />}
            <I size={19} className="relative" />
          </button>
        </Tip>
      ))}
      <div className="my-2 h-px w-8 bg-line/15" />
      <div className="mt-auto flex flex-col gap-1">
        <Tip label={t("nav_help")} side="right" kbd="?"><button className={item} onClick={onHelp} aria-label={t("nav_help")}><HelpCircle size={18} /></button></Tip>
        <Tip label={t("nav_settings")} side="right"><button className={item} onClick={onSettings} aria-label={t("nav_settings")}><Settings size={18} /></button></Tip>
      </div>
    </nav>
  );
}

export function MobileTabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const { t } = useI18n();
  return (
    <nav className="z-30 grid grid-cols-3 border-t border-line/10 bg-bg1 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
      {NAV.map(({ tab: k, icon: I, key }) => (
        <button key={k} onClick={() => onTab(k)} className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]", tab === k ? "text-accent" : "text-fg2")} aria-current={tab === k ? "page" : undefined}>
          <I size={19} />
          {t(key)}
        </button>
      ))}
    </nav>
  );
}
