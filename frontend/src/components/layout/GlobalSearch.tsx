import { MapPinned, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { EMPTY_FILTERS } from "@/api/types";
import { useAlerts, useMeta } from "@/api/hooks";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { RiskTile } from "@/components/ui/badges";
import { useI18n } from "@/i18n";
import * as P from "@radix-ui/react-popover";
import { cn } from "@/lib/cn";

export function GlobalSearch({ onAlert, onDistrict, inputRef }: { onAlert: (id: string) => void; onDistrict: (d: string) => void; inputRef: React.RefObject<HTMLInputElement> }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const all = useAlerts(EMPTY_FILTERS);
  const meta = useMeta();
  const wrap = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [] as { kind: "alert" | "district"; id: string; score?: number; sub?: string }[];
    const ds = (meta.data?.districts ?? []).filter((d) => d.toLowerCase().includes(s)).slice(0, 3).map((d) => ({ kind: "district" as const, id: d }));
    const as = (all.data?.items ?? []).filter((a) => a.alert_id.toLowerCase().includes(s) || a.district.toLowerCase().includes(s)).slice(0, 6)
      .map((a) => ({ kind: "alert" as const, id: a.alert_id, score: a.risk_score, sub: a.district }));
    return [...ds, ...as];
  }, [q, all.data, meta.data]);

  const choose = (r: (typeof results)[number]) => {
    if (r.kind === "alert") onAlert(r.id);
    else onDistrict(r.id);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <Popover open={open && q.trim().length > 0} onOpenChange={setOpen}>
      <P.Anchor asChild>
        <div ref={wrap} className="relative w-full min-w-[220px] max-w-[340px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setHi(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(results.length - 1, h + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
              if (e.key === "Enter" && results[hi]) choose(results[hi]);
              if (e.key === "Escape") { setQ(""); inputRef.current?.blur(); }
            }}
            placeholder={t("search_ph")}
            className="field h-9 w-full rounded-xl pl-9 pr-16"
            aria-label={t("search_ph")}
            role="combobox"
            aria-expanded={open && results.length > 0}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 gap-1"><span className="kbd">/</span><span className="kbd">⌘K</span></span>
        </div>
      </P.Anchor>
      <PopoverContent className="w-[340px] p-1" align="start">
        <div onMouseDown={(e) => e.preventDefault()}>
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-fg3">{t("no_results")}</div>
          ) : (
            results.map((r, i) => (
              <button key={`${r.kind}-${r.id}`} onClick={() => choose(r)} onMouseEnter={() => setHi(i)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left", i === hi && "bg-bg3")}>
                {r.kind === "alert" ? <RiskTile score={r.score!} className="w-9 scale-90" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/10 text-accent"><MapPinned size={15} /></span>}
                <span className="min-w-0">
                  <span className={cn("block truncate text-[13px]", r.kind === "alert" && "font-mono")}>{r.id}</span>
                  <span className="block text-2xs text-fg3">{r.kind === "alert" ? r.sub : t("district")}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
