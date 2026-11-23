import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeseriesPoint } from "@/api/types";
import { Skeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n";
import { fmtMonth } from "@/lib/format";

export function BuiltupChart({ data, start, loading }: { data: TimeseriesPoint[]; start: string | null; loading: boolean }) {
  const { lang } = useI18n();
  if (loading) return <Skeleton className="h-36 w-full" />;
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / .14)" vertical={false} />
          <ReferenceArea x1="2023-05" x2="2023-09" fill="#22D3EE" fillOpacity={0.07} />
          <ReferenceArea x1="2025-05" x2="2025-09" fill="#22D3EE" fillOpacity={0.07} />
          <ReferenceLine y={0.5} stroke="rgb(148 163 184 / .5)" strokeDasharray="2 3" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgb(148 163 184)" }} tickFormatter={(m: string) => (m.endsWith("-01") ? m.slice(0, 4) : "")} interval={0} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tick={{ fontSize: 10, fill: "rgb(148 163 184)" }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v: number) => [v == null ? "—" : v.toFixed(2), "built"]}
            labelFormatter={(m: string) => fmtMonth(m, lang)}
            contentStyle={{ fontSize: 12, borderRadius: 10, background: "rgb(var(--bg-1))", border: "1px solid rgb(var(--line) / .15)", color: "rgb(var(--fg-1))" }}
          />
          {start && <ReferenceLine x={start} stroke="#EF4444" strokeDasharray="4 3" />}
          <Line isAnimationActive={false} type="monotone" dataKey="built" stroke="#22D3EE" strokeWidth={2} dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
