// Cmd/Ctrl+K: jump to an alert or district, switch page, toggle map modes, theme and language.
import * as D from "@radix-ui/react-dialog";
import { BarChart3, Box, Columns2, CornerDownLeft, Flame, Keyboard, Languages, Map as MapIcon, MapPinned, Moon, Search, Settings, Sun, Target, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAlerts, useMeta } from "@/api/hooks";
import { EMPTY_FILTERS } from "@/api/types";
import { useAppState } from "@/app/state";
import { useTheme } from "@/app/theme";
import { RiskTile } from "@/components/ui/badges";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";

interface Item {
  id: string;
  group: "actions" | "alerts" | "districts";
  label: string;
  sub?: string;
  icon?: LucideIcon;
  score?: number;
  keys?: string;
  run: () => void;
}

export function CommandPalette({ open, onOpenChange, onDistrict, onSettings, onHelp }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDistrict: (d: string) => void;
  onSettings: () => void;
  onHelp: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const { s, set } = useAppState();
  const all = useAlerts(EMPTY_FILTERS);
  const meta = useMeta();
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setHi(0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const top = [...(all.data?.items ?? [])].sort((a, b) => b.risk_score - a.risk_score)[0];
    const actions: Item[] = [
      { id: "go-d", group: "actions", label: t("nav_dashboard"), icon: MapIcon, run: () => set({ tab: "dashboard" }) },
      { id: "go-s", group: "actions", label: t("nav_stats"), icon: BarChart3, run: () => set({ tab: "stats" }) },
      { id: "go-a", group: "actions", label: t("nav_accuracy"), icon: Target, run: () => set({ tab: "accuracy" }) },
      ...(top ? [{ id: "top", group: "actions" as const, label: t("start_top"), sub: top.alert_id, icon: Flame, run: () => set({ tab: "dashboard", alert: top.alert_id }) }] : []),
      { id: "cmp", group: "actions", label: `${t("cmp_map")} · ${s.compare ? t("off") : t("on")}`, icon: Columns2, keys: "C", run: () => set({ tab: "dashboard", compare: !s.compare }) },
      { id: "3d", group: "actions", label: `3D · ${s.view3d ? t("off") : t("on")}`, icon: Box, run: () => set({ tab: "dashboard", view3d: !s.view3d }) },
      { id: "theme", group: "actions", label: theme === "dark" ? t("theme_light") : t("theme_dark"), icon: theme === "dark" ? Sun : Moon, run: toggle },
      { id: "lang", group: "actions", label: lang === "uz" ? "English" : "O'zbekcha", icon: Languages, run: () => setLang(lang === "uz" ? "en" : "uz") },
      { id: "help", group: "actions", label: t("shortcuts"), icon: Keyboard, keys: "?", run: onHelp },
      { id: "set", group: "actions", label: t("nav_settings"), icon: Settings, run: onSettings },
    ];
    const needle = q.trim().toLowerCase();
    const match = (x: string) => x.toLowerCase().includes(needle);
    if (!needle) return actions;
    const districts: Item[] = (meta.data?.districts ?? []).filter(match).slice(0, 4).map((d) => ({
      id: `d-${d}`, group: "districts", label: d, sub: t("district"), icon: MapPinned, run: () => onDistrict(d),
    }));
    const alerts: Item[] = (all.data?.items ?? [])
      .filter((a) => match(a.alert_id) || match(a.district))
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 7)
      .map((a) => ({ id: a.alert_id, group: "alerts", label: a.alert_id, sub: `${a.district} · ≈${fmtInt(a.area_m2)} m²`, score: a.risk_score, run: () => set({ tab: "dashboard", alert: a.alert_id }) }));
    return [...actions.filter((x) => match(x.label)), ...alerts, ...districts];
  }, [q, all.data, meta.data, s.compare, s.view3d, theme, lang, t, set, toggle, setLang, onDistrict, onHelp, onSettings]);

  useEffect(() => setHi(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  const run = (it: Item | undefined) => {
    if (!it) return;
    onOpenChange(false);
    setTimeout(it.run, 0);
  };

  const groups: Item["group"][] = ["actions", "alerts", "districts"];
  let n = -1;

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[2px]" />
        <D.Content
          className="fixed left-1/2 top-[12vh] z-[90] flex max-h-[70vh] w-[min(94vw,560px)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border bg-bg1 shadow-panel focus:outline-none"
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(items.length - 1, h + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
            if (e.key === "Enter") { e.preventDefault(); run(items[hi]); }
          }}
        >
          <D.Title className="sr-only">{t("cmdk")}</D.Title>
          <div className="flex items-center gap-2.5 border-b border-line/10 px-4">
            <Search size={16} className="shrink-0 text-fg3" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("cmdk_ph")}
              className="h-12 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg3"
              aria-label={t("cmdk_ph")}
              role="combobox"
              aria-expanded
              aria-controls="cmdk-list"
              aria-activedescendant={items[hi] ? `cmdk-${hi}` : undefined}
            />
            <span className="kbd">Esc</span>
          </div>
          <div ref={listRef} id="cmdk-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {items.length === 0 && <div className="px-3 py-8 text-center text-xs text-fg3">{t("no_results")}</div>}
            {groups.map((g) => {
              const rows = items.filter((x) => x.group === g);
              if (!rows.length) return null;
              return (
                <div key={g} className="mb-1">
                  <div className="hud-label px-2.5 pb-1 pt-2">{t(`cmdk_${g}`)}</div>
                  {rows.map((it) => {
                    n += 1;
                    const i = n;
                    const I = it.icon;
                    return (
                      <button
                        key={it.id}
                        id={`cmdk-${i}`}
                        data-i={i}
                        role="option"
                        aria-selected={i === hi}
                        onMouseMove={() => setHi(i)}
                        onClick={() => run(it)}
                        className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors", i === hi ? "bg-accent/10 text-fg1" : "text-fg1")}
                      >
                        {it.score != null ? (
                          <RiskTile score={it.score} className="w-9 scale-90" />
                        ) : (
                          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-bg2", i === hi ? "text-accent" : "text-fg2")}>{I && <I size={15} />}</span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-[13px]", it.group === "alerts" && "font-mono")}>{it.label}</span>
                          {it.sub && <span className="block truncate text-2xs text-fg3">{it.sub}</span>}
                        </span>
                        {it.keys && <span className="kbd">{it.keys}</span>}
                        {i === hi && <CornerDownLeft size={13} className="text-fg3" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 border-t border-line/10 px-4 py-2 text-2xs text-fg3">
            <span><span className="kbd">↑</span> <span className="kbd">↓</span> {t("cmdk_move")}</span>
            <span><span className="kbd">↵</span> {t("cmdk_run")}</span>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
