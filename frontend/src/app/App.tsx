import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { apiReachable, type DataMode } from "./mode";
import { useAppState } from "./state";
import { useBreakpoint } from "./useMedia";
import { ApiBanner } from "@/components/layout/ApiBanner";
import { SettingsDialog, ShortcutsDialog } from "@/components/layout/Dialogs";
import { MobileTabBar } from "@/components/layout/IconRail";
import { TopBar } from "@/components/layout/TopBar";
import { AccuracyPage } from "@/pages/AccuracyPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { StatsPage } from "@/pages/StatsPage";

export function App({ mode, apiOnline: initialOnline }: { mode: DataMode; apiOnline: boolean }) {
  const { s, set, setFilters } = useAppState();
  const bp = useBreakpoint();
  const [settings, setSettings] = useState(false);
  const [help, setHelp] = useState(false);
  const [apiOnline, setApiOnline] = useState(initialOnline);
  const searchRef = useRef<HTMLInputElement>(null);

  // health polling in API mode (offline banner)
  useEffect(() => {
    if (mode !== "api") return;
    const id = setInterval(async () => setApiOnline(await apiReachable()), 15000);
    return () => clearInterval(id);
  }, [mode]);

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/") {
        e.preventDefault();
        if (s.tab !== "dashboard") set({ tab: "dashboard" });
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (e.key === "?") setHelp(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.tab, set]);

  const goDistrict = (d: string) => {
    setFilters({ district: d });
    set({ tab: "dashboard", alert: null });
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg0">
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          tab={s.tab}
          onTab={(tab) => set({ tab })}
          onSettings={() => setSettings(true)}
          onHelp={() => setHelp(true)}
          mode={mode}
          apiOnline={apiOnline}
          onAlert={(id) => set({ tab: "dashboard", alert: id })}
          onDistrict={goDistrict}
          searchRef={bp.xl ? searchRef : { current: null }}
        />
        {mode === "api" && !apiOnline && <ApiBanner onRetry={async () => setApiOnline(await apiReachable())} />}
        <main className="flex min-h-0 flex-1 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {s.tab === "dashboard" && <DashboardPage key="d" searchRef={searchRef} />}
            {s.tab === "stats" && <StatsPage key="s" onDistrict={goDistrict} />}
            {s.tab === "accuracy" && <AccuracyPage key="a" />}
          </AnimatePresence>
        </main>
        <MobileTabBar tab={s.tab} onTab={(tab) => set({ tab })} />
      </div>
      <SettingsDialog open={settings} onOpenChange={setSettings} mode={mode} apiOnline={apiOnline} />
      <ShortcutsDialog open={help} onOpenChange={setHelp} />
    </div>
  );
}
