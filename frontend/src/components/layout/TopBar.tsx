import { Command, FlaskConical, HelpCircle, Moon, Settings, Sun, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useDemoActivity, useMeta } from "@/api/hooks";
import type { DataMode } from "@/app/mode";
import type { Tab } from "@/app/state";
import { useTheme } from "@/app/theme";
import { useOnline } from "@/app/useMedia";
import { Tip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { GlobalSearch } from "./GlobalSearch";
import { NAV } from "./IconRail";
import { Logo } from "./Logo";

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tashkent" });
  return (
    <div className="hidden text-right leading-tight 2xl:block">
      <div className="tnum font-mono text-[13px] font-medium text-fg1">{hh}</div>
      <div className="hud-label">UTC+05</div>
    </div>
  );
}

export function TopBar({ tab, onTab, mode, apiOnline, onAlert, onDistrict, searchRef, onSettings, onHelp, onCommand }: {
  tab: Tab;
  onTab: (t: Tab) => void;
  mode: DataMode;
  apiOnline: boolean;
  onAlert: (id: string) => void;
  onDistrict: (d: string) => void;
  searchRef: React.RefObject<HTMLInputElement>;
  onSettings: () => void;
  onHelp: () => void;
  onCommand: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  const meta = useMeta();
  const { theme, toggle } = useTheme();
  const online = useOnline();
  const m = meta.data;
  const demoRows = useDemoActivity().data?.rows ?? 0;
  const status = !online ? "offline" : mode === "demo" ? "demo" : apiOnline ? "online" : "offline";
  const dot = { online: "bg-ok", demo: "bg-risk-mid", offline: "bg-risk-high" }[status];
  const label = { online: t("api_online"), demo: t("api_demo"), offline: online ? t("api_offline") : t("offline") }[status];
  const iconBtn = "grid h-9 w-9 place-items-center rounded-xl border bg-bg2/70 text-fg2 transition hover:border-accent/40 hover:text-fg1";

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-4 border-b border-accent/10 bg-bg1/80 px-3 backdrop-blur-xl md:px-5">
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

      <div className="flex min-w-0 items-center gap-3">
        <Logo size={36} />
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-2">
            <span className="text-glow bg-gradient-to-r from-accent to-accent2 bg-clip-text text-[19px] font-bold tracking-tight text-transparent">{t("app_name")}</span>
            {m?.is_mock && (
              <Tip label={t("demo_tip")}>
                <span className="shrink-0 rounded-md border border-rose-400/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-rose-400">{t("demo")}</span>
              </Tip>
            )}
          </div>
          <div className="hidden truncate text-[11px] text-fg2 sm:block">
            {t("app_sub")}{m && <> · {t("crumb", { region: m.region, t1: m.period_t1.slice(0, 4), t2: m.period_t2.slice(0, 4) })}</>}
          </div>
        </div>
      </div>

      <nav className="hidden items-center rounded-xl border bg-bg0/60 p-1 md:flex" aria-label="Main">
        {NAV.map(({ tab: k, icon: I, key }) => (
          <button
            key={k}
            onClick={() => onTab(k)}
            aria-current={tab === k ? "page" : undefined}
            className={cn("relative flex h-9 items-center gap-2 rounded-lg px-3 text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors", tab === k ? "text-accent" : "text-fg2 hover:text-fg1")}
          >
            {tab === k && (
              <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-accent/10 ring-1 ring-inset ring-accent/30" transition={{ type: "spring", stiffness: 500, damping: 40 }}>
                <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent))]" />
              </motion.span>
            )}
            <I size={15} className="relative" />
            <span className="relative hidden lg:inline">{t(key)}</span>
          </button>
        ))}
      </nav>

      <div className="hidden min-w-0 flex-1 justify-center min-[1700px]:flex">
        <GlobalSearch onAlert={onAlert} onDistrict={onDistrict} inputRef={searchRef} />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 min-[1700px]:ml-0">
        <Clock />
        {demoRows > 0 && (
          <Tip label={t("demo_act_tip", { n: demoRows })}>
            <button onClick={onSettings} className="flex h-9 items-center gap-1.5 rounded-xl border border-risk-mid/40 bg-risk-mid/10 px-2.5 text-[10px] font-bold tracking-widest text-risk-mid">
              <FlaskConical size={13} /> <span className="hidden 2xl:inline">{t("demo_act_badge")}</span>
            </button>
          </Tip>
        )}
        <Tip label={t("cmdk")} kbd="⌘K">
          <button onClick={onCommand} className={cn(iconBtn, "hidden lg:grid min-[1700px]:hidden")} aria-label={t("cmdk")}><Command size={15} /></button>
        </Tip>
        <Tip label={label}>
          <span className="hidden h-9 items-center gap-1.5 rounded-xl border bg-bg2/70 px-2.5 text-[11px] font-semibold tracking-wider text-fg2 sm:flex" role="status" aria-label={label}>
            {status === "offline" && !online ? <WifiOff size={12} className="text-risk-high" /> : (
              <span className="relative flex h-2 w-2">
                {status === "online" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />}
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", dot)} />
              </span>
            )}
            <span className="hidden sm:inline">{status === "online" ? "LIVE" : status === "demo" ? "LOCAL" : "OFFLINE"}</span>
          </span>
        </Tip>
        <div className="flex h-9 rounded-xl border bg-bg2/70 p-0.5 text-[11px] font-semibold" role="group" aria-label="Language">
          {(["uz", "en"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={cn("rounded-lg px-2 uppercase", lang === l ? "bg-accent/15 text-accent" : "text-fg3 hover:text-fg1")} aria-pressed={lang === l}>
              {l}
            </button>
          ))}
        </div>
        <Tip label={theme === "dark" ? t("theme_light") : t("theme_dark")}>
          <button onClick={toggle} className={iconBtn} aria-label={t("theme")}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </Tip>
        <Tip label={t("nav_help")} kbd="?"><button onClick={onHelp} className={cn(iconBtn, "hidden md:grid")} aria-label={t("nav_help")}><HelpCircle size={15} /></button></Tip>
        <Tip label={t("nav_settings")}><button onClick={onSettings} className={iconBtn} aria-label={t("nav_settings")}><Settings size={15} /></button></Tip>
        <div className="ml-1 hidden items-center gap-2 border-l border-line/10 pl-3 sm:flex">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 text-[11px] font-bold text-bg0 shadow-[0_0_16px_rgb(var(--accent)/.35)]">ID</div>
          <div className="hidden leading-tight 2xl:block">
            <div className="text-xs font-medium">inspector.demo</div>
            <div className="text-[10px] text-fg3">{t("user_role")}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
