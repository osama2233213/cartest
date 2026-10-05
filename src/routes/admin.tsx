import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { DemoBar, StageChip, StatCard } from "@/components/app/AppShell";
import { Logo } from "@/components/site/SiteChrome";
import { DEALS, REVENUE, STAGES, STAGE_LABEL, VERIFICATION_QUEUE, termsFor } from "@/lib/demo-data";
import { fmtUsd } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin console (demo) — OwnerFi" },
      { name: "description", content: "Explore the OwnerFi admin console: verifications, deals and revenue." },
      { property: "og:title", content: "Admin console (demo) — OwnerFi" },
      { property: "og:description", content: "Explore the OwnerFi admin console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHome,
});

const NAV = ["Dashboard", "Verifications", "Users", "Vehicles", "Deals", "Test drives", "Payments", "Revenue", "Ad partners", "Integrations", "Settings", "Audit log", "Support"];

function AdminHome() {
  const fees = DEALS.filter((d) => !["inquiry", "test_drive", "application", "negotiation", "inspection", "contract", "declined"].includes(d.stage))
    .reduce((s, d) => s + termsFor(d).fee, 0);
  return (
    <div className="min-h-screen bg-surface">
      <DemoBar role="admin" />
      <div className="flex">
        <aside className="hidden min-h-[calc(100vh-36px)] w-60 shrink-0 bg-sidebar p-4 text-sidebar-foreground lg:block">
          <div className="mb-6 rounded-xl bg-background px-3 py-2"><Logo /></div>
          <nav className="space-y-1 text-sm">
            {NAV.map((n, i) => (
              <span key={n} className={cn("block rounded-full px-3 py-2", i === 0 ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground" : "opacity-80")}>{n}</span>
            ))}
          </nav>
        </aside>
        <main className="flex-1 space-y-6 p-6">
          <div>
            <h1 className="text-3xl font-bold text-ink">Good afternoon, Sam</h1>
            <p className="text-muted-foreground">5 items waiting for review · all integrations healthy</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard k="Live listings" v="9" />
            <StatCard k="Deals in flight" v={String(DEALS.length)} />
            <StatCard k="Fees collected (MTD)" v={fmtUsd(fees)} sub="10% of down payments" />
            <StatCard k="On-time payments" v="94%" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="card-surface p-5">
              <h2 className="font-semibold text-ink">Fee revenue, last 12 months</h2>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={REVENUE}>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip formatter={(v) => `$${v}`} />
                    <Bar dataKey="fees" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="card-surface p-5">
              <h2 className="font-semibold text-ink">Verification queue</h2>
              <ul className="mt-3 divide-y divide-border text-sm">
                {VERIFICATION_QUEUE.map((v) => (
                  <li key={v.who + v.kind} className="flex items-center justify-between py-2.5">
                    <div><p className="font-medium text-ink">{v.who}</p><p className="text-xs text-muted-foreground">{v.kind} · waiting {v.age}</p></div>
                    <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">Needs review</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <section className="card-surface overflow-x-auto p-5">
            <h2 className="font-semibold text-ink">Deals by stage</h2>
            <div className="mt-4 flex gap-3">
              {STAGES.map((s) => {
                const ds = DEALS.filter((d) => d.stage === s);
                return (
                  <div key={s} className="w-48 shrink-0 rounded-xl bg-surface p-2">
                    <p className="px-1 pb-2 text-xs font-semibold text-muted-foreground">{STAGE_LABEL[s]} · {ds.length}</p>
                    {ds.map((d) => (
                      <Link key={d.id} to="/deals/$id" params={{ id: d.id }} search={{ as: "admin" }} className="mb-2 block rounded-lg bg-background p-2 text-xs hover:shadow">
                        <p className="font-semibold text-ink">{d.car}</p>
                        <p className="text-muted-foreground">{d.seller} → {d.buyer}</p>
                        {d.late && <span className="mt-1 inline-block rounded-full bg-danger/10 px-2 py-0.5 font-semibold text-danger">Late</span>}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">{DEALS.filter((d) => d.stage === "declined").map((d) => <StageChip key={d.id} stage={d.stage} />)}</div>
          </section>
        </main>
      </div>
    </div>
  );
}
