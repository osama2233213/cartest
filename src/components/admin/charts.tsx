import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/admin/kit";
import { money } from "@/lib/format";

export const axis = { axisLine: false, tickLine: false, tick: { fontSize: 12, fill: "currentColor", className: "fill-muted" } } as const;

export function ChartTip({ active, label, lines }: { active?: boolean | undefined; label?: string | number | undefined; lines: string[] }) {
  if (!active) return null;
  return (
    <div className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm shadow-raised">
      {label !== undefined && <p className="font-semibold">{label}</p>}
      {lines.map((l) => (
        <p key={l} className="num text-muted">
          {l}
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({ data, title = "Revenue by month", className }: { data: { month: string; fees: number }[]; title?: string; className?: string }) {
  const total = data.reduce((s, d) => s + d.fees, 0);
  const best = data.reduce((a, b) => (b.fees > a.fees ? b : a), data[0]!);
  return (
    <ChartCard
      title={title}
      className={className ?? "lg:col-span-2"}
      takeaway={`${money(total)} in fees over ${data.length} months. Best month: ${best.month}.`}
      table={{ caption: "Fees by month", head: ["Month", "Fees"], rows: data.map((d) => [d.month, money(d.fees)]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} className="stroke-ink/10" />
          <XAxis dataKey="month" {...axis} />
          <YAxis width={44} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} {...axis} />
          <Tooltip cursor={{ className: "fill-ink/5" }} content={({ active, payload }) => <ChartTip active={active} label={payload?.[0]?.payload?.month} lines={payload?.[0] ? [money(Number(payload[0].payload.fees))] : []} />} />
          <Bar dataKey="fees" fill="currentColor" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
