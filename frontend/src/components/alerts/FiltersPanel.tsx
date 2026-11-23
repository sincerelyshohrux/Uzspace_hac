import { CHANGE_TYPES, STATUSES, ZONES, type Filters } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useI18n, type I18nKey } from "@/i18n";

export function FiltersPanel({ filters, districts, onChange, onReset }: { filters: Filters; districts: string[]; onChange: (p: Partial<Filters>) => void; onReset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3">
      <label className="grid gap-1">
        <span className="section-title">{t("district")}</span>
        <Select value={filters.district} onChange={(e) => onChange({ district: e.target.value })}>
          <option value="">{t("all_districts")}</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
      </label>
      <label className="grid gap-1">
        <span className="section-title">{t("zone")}</span>
        <Select value={filters.zone} onChange={(e) => onChange({ zone: e.target.value })}>
          <option value="">{t("all_zones")}</option>
          <option value="any_restricted">{t("any_restricted")}</option>
          {ZONES.map((z) => <option key={z} value={z}>{t(`z_${z}` as I18nKey)}</option>)}
        </Select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className="section-title">{t("change_type")}</span>
          <Select value={filters.changeType} onChange={(e) => onChange({ changeType: e.target.value })}>
            <option value="">{t("all_types")}</option>
            {CHANGE_TYPES.map((c) => <option key={c} value={c}>{t(`ct_${c}` as I18nKey)}</option>)}
          </Select>
        </label>
        <label className="grid gap-1">
          <span className="section-title">{t("status")}</span>
          <Select value={filters.status} onChange={(e) => onChange({ status: e.target.value })}>
            <option value="">{t("all_statuses")}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`st_${s}` as I18nKey)}</option>)}
          </Select>
        </label>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <span className="section-title">{t("min_risk")}</span>
          <span className="tnum rounded bg-bg3 px-1.5 text-xs font-semibold">≥ {filters.minRisk}</span>
        </div>
        <Slider label={t("min_risk")} value={filters.minRisk} onChange={(v) => onChange({ minRisk: v })} step={5} />
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onReset}>{t("reset")}</Button>
      </div>
    </div>
  );
}
