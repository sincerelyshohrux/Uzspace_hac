import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
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
    [["[", "]"], `${t("prev")} / ${t("next")}`],
    [["1", "2", "3"], t("sc_status")],
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
