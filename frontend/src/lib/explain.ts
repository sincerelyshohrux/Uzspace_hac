import type { Alert } from "@/api/types";
import type { I18nKey } from "@/i18n";
import { fmtInt } from "./format";

type T = (k: I18nKey, v?: Record<string, string | number>) => string;

/** One plain-language sentence explaining why the alert was raised. */
export function explain(a: Alert, t: T): string {
  const zone = a.zones.length
    ? t("sentence_zone", { zone: a.zones.map((z) => t(`z_${z}` as I18nKey).toLowerCase()).join(" / ") })
    : t("sentence_nozone");
  return t("sentence", {
    type: t(`ct_${a.change_type}` as I18nKey),
    area: fmtInt(a.area_m2),
    zone,
    permit: t(`sentence_permit_${a.permit_match}` as I18nKey),
  });
}
