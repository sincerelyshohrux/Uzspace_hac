import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { ZONES } from "@/api/types";
import { useI18n, type I18nKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { RISK_HEX, ZONE_HEX } from "@/lib/format";

export function Legend({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  return (
    <div className={cn("glass w-52 rounded-xl text-xs", className)} style={style}>
      <button className="flex w-full items-center justify-between px-3 py-2" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="section-title">{t("legend")}</span>
        <ChevronDown size={14} className={cn("text-fg2 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="space-y-2.5 px-3 pb-3">
          <div className="space-y-1">
            {(["high", "mid", "low"] as const).map((l) => (
              <div key={l} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full ring-2 ring-black/20" style={{ background: RISK_HEX[l] }} />
                <span className="flex-1">{t(`risk_${l}`)}</span>
                <span className="tnum text-fg3">{l === "high" ? "≥ 60" : l === "mid" ? "30–59" : "< 30"}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-line/10 pt-2">
            {ZONES.map((z) => (
              <div key={z} className="flex items-center gap-1.5 truncate">
                {z === "power_line" || z === "railway" ? (
                  <span className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: ZONE_HEX[z] }} />
                ) : z === "canal" || z === "river" ? (
                  <span className="h-0.5 w-3 rounded" style={{ background: ZONE_HEX[z] }} />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-sm border" style={{ background: `${ZONE_HEX[z]}44`, borderColor: ZONE_HEX[z] }} />
                )}
                <span className="truncate text-2xs text-fg2">{t(`z_${z}` as I18nKey)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
