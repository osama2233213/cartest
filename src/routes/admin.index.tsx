import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Car, CheckCircle2, ChevronRight, Handshake, Plug, ShieldCheck, TrendingUp, TriangleAlert, Users } from "lucide-react";
import { AppLink, Badge, Button, Card, CardHeader, EmptyState } from "@/components/kit";
import { AdminHeader, AdminPage, ChartCard } from "@/components/admin/kit";
import { ChartTip, RevenueChart, axis } from "@/components/admin/charts";
import { dashboardOf, useAdminModel } from "@/lib/admin-data";
import { STAGE_LABEL } from "@/lib/demo-data";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Overview · Admin · OwnerFi" }] }),
  component: Dashboard,
});

type Kpi = ReturnType<typeof dashboardOf>["kpis"][number];
const show = (k: Kpi) => (k.format === "money" ? money(k.value) : String(k.value));
const Wrap = ({ to, className, children }: { to?: string | undefined; className?: string; children: React.ReactNode }) =>
  to ? (
    <AppLink to={to} className={className}>
      {children}
    </AppLink>
  ) : (
    <div className={className}>{children}</div>
  );

function Kpis({ kpis }: { kpis: Kpi[] }) {
  const hero = kpis.find((k) => k.key === "revenue");
  const mid = kpis.filter((k) => ["gmv", "open", "closed"].includes(k.key));
  const rest = kpis.filter((k) => k.key !== "revenue" && !["gmv", "open", "closed"].includes(k.key));
  return (
    <section aria-label="Key numbers" className="space-y-4">
      <div className="overflow-hidden rounded-3xl bg-ink bg-brand-glow p-6 text-white md:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          {hero && (
            <div>
              <p className="eyebrow text-sky">{hero.label}</p>
              <p className="num mt-2 font-display text-[44px] font-bold leading-none tracking-tight md:text-[52px]">{show(hero)}</p>
              {hero.hint && <p className="mt-3 text-sm text-white/65">{hero.hint}</p>}
              <AppLink to="/admin/revenue" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
                Open revenue <ArrowRight aria-hidden className="h-4 w-4" />
              </AppLink>
            </div>
          )}
          <dl className="grid grid-cols-3 gap-x-6 lg:gap-x-10">
            {mid.map((k) => (
              <Wrap key={k.key} to={k.to} className="block rounded-lg border-l border-white/15 pl-4 hover:border-sky">
                <dt className="text-xs text-white/55">{k.label}</dt>
                <dd className="num mt-1 font-display text-2xl font-bold tracking-tight">{show(k)}</dd>
                {k.hint && <dd className="text-xs text-white/45">{k.hint}</dd>}
              </Wrap>
            ))}
          </dl>
        </div>
      </div>
      <Card padding="none" className="grid grid-cols-2 divide-ink/[0.08] lg:grid-cols-4 lg:divide-x">
        {rest.map((k) => (
          <Wrap key={k.key} to={k.to} className="block p-5 transition-colors first:rounded-l-2xl last:rounded-r-2xl hover:bg-surface">
            <p className="text-sm font-medium text-muted">{k.label}</p>
            <p className="num mt-1 font-display text-2xl font-bold tracking-tight">{show(k)}</p>
            {k.hint && <p className="mt-0.5 text-xs text-muted">{k.hint}</p>}
          </Wrap>
        ))}
      </Card>
    </section>
  );
}

function Attention({ items }: { items: ReturnType<typeof dashboardOf>["attention"] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 8);
  return (
    <Card>
      <CardHeader title="Needs attention" description="Problems and waiting work, worst first." action={items.length > 0 ? <Badge tone="warning">{items.length}</Badge> : undefined} />
      {items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 aria-hidden className="h-6 w-6" />}
          title="All clear"
          description="Nothing needs you right now. We’ll show problems here as they happen."
          action={
            <AppLink to="/admin/verifications" className="font-medium text-primary hover:underline">
              Open the verification queue
            </AppLink>
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-ink/[0.06]">
            {shown.map((it) => (
              <li key={it.id}>
                <AppLink to={it.to} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", it.tone === "danger" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")}>
                    <TriangleAlert aria-hidden className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{it.title}</span>
                    <span className="block truncate text-sm text-muted">
                      {it.detail} · {formatDistanceToNow(new Date(it.at), { addSuffix: true })}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-muted" />
                </AppLink>
              </li>
            ))}
          </ul>
          {items.length > 8 && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all ${items.length}`}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

function QuickLinks({ counts }: { counts: { verifications: number; integrations: number } }) {
  const links = [
    { to: "/admin/verifications", label: "Review verifications", note: `${counts.verifications} waiting`, Icon: ShieldCheck },
    { to: "/admin/users", label: "Users", Icon: Users },
    { to: "/admin/vehicles", label: "Vehicles", Icon: Car },
    { to: "/admin/deals", label: "Deals", Icon: Handshake },
    { to: "/admin/revenue", label: "Revenue", Icon: TrendingUp },
    { to: "/admin/integrations", label: "Integrations", note: counts.integrations ? `${counts.integrations} need attention` : undefined, Icon: Plug },
  ];
  return (
    <Card>
      <CardHeader title="Quick links" />
      <ul className="space-y-1">
        {links.map(({ to, label, note, Icon }) => (
          <li key={to}>
            <AppLink to={to} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                <Icon aria-hidden className="h-[18px] w-[18px]" />
              </span>
              <span className="flex-1 font-semibold">{label}</span>
              {note && <span className="text-sm text-muted">{note}</span>}
              <ChevronRight aria-hidden className="h-5 w-5 text-muted" />
            </AppLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Funnel({ data, closedOut }: { data: { stage: string; count: number }[]; closedOut: number }) {
  const rows = data.map((d) => ({ ...d, label: STAGE_LABEL[d.stage as keyof typeof STAGE_LABEL] }));
  const top = rows.reduce((a, b) => (b.count > a.count ? b : a), rows[0]!);
  const any = top.count > 0;
  return (
    <ChartCard
      title="Deal funnel"
      takeaway={any ? `Most deals are waiting at ${top.label.toLowerCase()}. ${closedOut} ended early.` : "No deals yet."}
      table={{ caption: "Deals now in each stage", head: ["Stage", "Deals"], rows: rows.map((r) => [r.label, r.count]) }}
    >
      {any ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16 }}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={104} interval={0} {...axis} />
            <Tooltip cursor={{ className: "fill-ink/5" }} content={({ active, payload }) => <ChartTip active={active} label={payload?.[0]?.payload?.label} lines={payload?.[0] ? [`${payload[0].payload.count} deals`] : []} />} />
            <Bar dataKey="count" fill="currentColor" radius={[0, 6, 6, 0]} label={{ position: "right", className: "fill-ink text-xs" }}>
              {rows.map((r) => (
                <Cell key={r.stage} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="pt-24 text-center text-muted">No data yet</p>
      )}
    </ChartCard>
  );
}

function UsersChart({ data }: { data: { label: string; sellers: number; buyers: number }[] }) {
  const total = data.reduce((s, d) => s + d.sellers + d.buyers, 0);
  return (
    <ChartCard
      title="New users by week"
      className="lg:col-span-3"
      takeaway={total ? `${total} new sign-ups in 8 weeks.` : "No sign-ups in the last 8 weeks."}
      table={{ caption: "New sign-ups by week", head: ["Week of", "Sellers", "Buyers"], rows: data.map((d) => [d.label, d.sellers, d.buyers]) }}
    >
      {total === 0 ? (
        <p className="pt-24 text-center text-muted">No data yet</p>
      ) : (
        <div className="flex h-full flex-col">
          <ul className="mb-2 flex gap-4 text-sm text-ink">
            <li className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-primary" /> Sellers
            </li>
            <li className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-ink" /> Buyers
            </li>
          </ul>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} className="stroke-ink/10" />
                <XAxis dataKey="label" {...axis} />
                <YAxis allowDecimals={false} width={28} {...axis} />
                <Tooltip cursor={{ className: "fill-ink/5" }} content={({ active, payload }) => <ChartTip active={active} label={payload?.[0] ? `Week of ${payload[0].payload.label}` : undefined} lines={payload?.[0] ? [`${payload[0].payload.sellers} sellers`, `${payload[0].payload.buyers} buyers`] : []} />} />
                <Bar dataKey="sellers" stackId="u" fill="currentColor" />
                <Bar dataKey="buyers" stackId="u" className="fill-ink" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function Dashboard() {
  const m = useAdminModel();
  const d = dashboardOf(m);
  return (
    <AdminPage>
      <AdminHeader eyebrow="Admin" title="Overview" description="How OwnerFi is doing today." />
      <div className="space-y-6">
        <Kpis kpis={d.kpis} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <Attention items={d.attention} />
          </div>
          <div className="min-w-0">
            <QuickLinks counts={d.counts} />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <RevenueChart data={d.revenueByMonth} />
          <Funnel data={d.funnel} closedOut={d.closedOut} />
          <UsersChart data={d.usersByWeek} />
        </div>
      </div>
    </AdminPage>
  );
}
