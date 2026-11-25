import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api/client";
import { useAlerts, useDemoActivity } from "@/api/hooks";
import { EMPTY_FILTERS } from "@/api/types";
import { buildDemoActivity } from "@/lib/demoActivity";
import { Switch } from "@/components/ui/switch";
import { setPreferredMode, type DataMode } from "@/app/mode";
import { useTheme } from "@/app/theme";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { useI18n } from "@/i18n";

export function SettingsDialog({ open, onOpenChange, mode, apiOnline }: { open: boolean; onOpenChange: (o: boolean) => void; mode: DataMode; apiOnline: boolean }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const row = "flex items-center justify-between gap-3 py-2.5";
  const demoQ = useDemoActivity();
  const all = useAlerts(EMPTY_FILTERS);
  const [busy, setBusy] = useState(false);
  const demoOn = (demoQ.data?.rows ?? 0) > 0;
  const toggleDemo = async (v: boolean) => {
    setBusy(true);
    try {
      if (v) {
        const r = await api.demoSeed(buildDemoActivity(all.data?.items ?? []));
        toast.success(t("demo_act_on", { n: r.rows }));
      } else {
        const r = await api.demoClear();
        toast.success(t("demo_act_off", { n: r.removed }));
      }
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(t("save_failed", { e: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("nav_settings")}>
        <div className="divide-y divide-line/10">
          <div className={row}>
            <span className="text-sm">{t("theme")}</span>
            <Segmented label={t("theme")} value={theme} onChange={setTheme} options={[{ value: "dark", label: t("theme_dark") }, { value: "light", label: t("theme_light") }]} />
          </div>
          <div className={row}>
            <span className="text-sm">{t("language")}</span>
            <Segmented label={t("language")} value={lang} onChange={setLang} options={[{ value: "uz", label: "O'zbekcha" }, { value: "en", label: "English" }]} />
          </div>
          <div className={row}>
            <span className="text-sm">{t("data_source")}</span>
            <Segmented
              label={t("data_source")}
              value={mode}
              onChange={(m) => {
                if (m === "api" && !apiOnline) return toast.error(t("api_offline"));
                setPreferredMode(m === "demo" ? "demo" : null);
                location.reload();
              }}
              options={[{ value: "api", label: "FastAPI" }, { value: "demo", label: "Demo" }]}
            />
          </div>
          <div className={row}>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm">
                {t("demo_act")}
                <span className="rounded border border-risk-mid/40 bg-risk-mid/15 px-1 text-[9px] font-bold tracking-widest text-risk-mid">DEMO</span>
              </span>
              <span className="mt-0.5 block text-2xs leading-snug text-fg3">{t("demo_act_hint")}</span>
            </span>
            <Switch checked={demoOn} onChange={toggleDemo} label={t("demo_act")} disabled={busy || demoQ.isError || !all.data} />
          </div>
          <div className={row}>
            <span className="text-sm">{t("reset_demo")}</span>
            <Button
              size="sm"
              onClick={async () => {
                await api.reset();
                await qc.invalidateQueries();
                toast.success(t("reset_done"));
              }}
            >
              {t("reset")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const rows: [string[], string][] = [
    [["/"], t("sc_search")],
    [["↑", "↓"], t("sc_nav")],
    [["Enter", "Esc"], t("sc_open")],
    [["⌘", "K"], t("cmdk")],
    [["J", "K"], `${t("next")} / ${t("prev")}`],
    [["1", "2", "3"], t("sc_status")],
    [["C"], t("cmp_map")],
    [["M"], t("measure")],
    [["?"], t("sc_help")],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("shortcuts")}>
        <div className="space-y-2">
          {rows.map(([keys, label]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-fg2">{label}</span>
              <span className="flex gap-1">{keys.map((k) => <span key={k} className="kbd h-6 min-w-6 text-[11px]">{k}</span>)}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
