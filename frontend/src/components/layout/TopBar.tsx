import { Moon, Sun, WifiOff } from "lucide-react";
import { useMeta } from "@/api/hooks";
import type { DataMode } from "@/app/mode";
import { useTheme } from "@/app/theme";
import { useOnline } from "@/app/useMedia";
import { Tip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/format";
import { GlobalSearch } from "./GlobalSearch";
import { Logo } from "./Logo";

export function TopBar({ title, mode, apiOnline, onAlert, onDistrict, searchRef }: {
  title: string; mode: DataMode; apiOnline: boolean; onAlert: (id: string) => void; onDistrict: (d: string) => void; searchRef: React.RefObject<HTMLInputElement>;
}) {
  const { t, lang, setLang } = useI18n();
  const meta = useMeta();
  const { theme, toggle } = useTheme();
  const online = useOnline();
  const m = meta.data;
  const status = !online ? "offline" : mode === "demo" ? "demo" : apiOnline ? "online" : "offline";
  const dot = { online: "bg-ok", demo: "bg-risk-mid", offline: "bg-risk-high" }[status];
  const label = { online: t("api_online"), demo: t("api_demo"), offline: online ? t("api_offline") : t("offline") }[status];

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line/10 bg-bg1/85 px-3 backdrop-blur md:px-4">
      <div className="md:hidden"><Logo size={28} /></div>
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold leading-tight">{title}</h1>
        {m && <div className="truncate text-2xs text-fg2">{t("crumb", { region: m.region, t1: m.period_t1.slice(0, 4), t2: m.period_t2.slice(0, 4) })}</div>}
      </div>
      {m?.is_mock && (
        <Tip label={t("demo_tip")}>
          <span className="shrink-0 rounded-md border border-rose-400/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-rose-400">{t("demo")}</span>
        </Tip>
      )}
      <div className="mx-auto hidden flex-1 justify-center lg:flex">
        <GlobalSearch onAlert={onAlert} onDistrict={onDistrict} inputRef={searchRef} />
      </div>
      <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
        {m && (
          <div className="hidden text-right xl:block">
            <div className="text-[10px] uppercase tracking-wide text-fg3">{t("updated")}</div>
            <div className="tnum text-2xs text-fg2">{fmtDateTime(m.generated_at, lang)}</div>
          </div>
        )}
        <Tip label={label}>
          <span className="flex h-8 items-center gap-1.5 rounded-lg border bg-bg2 px-2 text-2xs text-fg2" role="status" aria-label={label}>
            {status === "offline" && !online ? <WifiOff size={12} className="text-risk-high" /> : (
              <span className="relative flex h-2 w-2">
                {status === "online" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />}
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", dot)} />
              </span>
            )}
            <span className="hidden sm:inline">{status === "online" ? "API" : status === "demo" ? "LOCAL" : "OFFLINE"}</span>
          </span>
        </Tip>
        <div className="flex h-8 rounded-lg border bg-bg2 p-0.5 text-2xs font-semibold" role="group" aria-label="Language">
          {(["uz", "en"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={cn("rounded-md px-2 uppercase", lang === l ? "bg-bg1 text-fg1 shadow-sm" : "text-fg3 hover:text-fg1")} aria-pressed={lang === l}>
              {l}
            </button>
          ))}
        </div>
        <Tip label={theme === "dark" ? t("theme_light") : t("theme_dark")}>
          <button onClick={toggle} className="grid h-8 w-8 place-items-center rounded-lg border bg-bg2 text-fg2 hover:text-fg1" aria-label={t("theme")}>
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </Tip>
        <div className="ml-1 hidden items-center gap-2 border-l border-line/10 pl-3 sm:flex">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 text-[11px] font-bold text-bg0">ID</div>
          <div className="hidden leading-tight xl:block">
            <div className="text-xs font-medium">inspector.demo</div>
            <div className="text-[10px] text-fg3">{t("user_role")}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
