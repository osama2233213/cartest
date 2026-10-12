import { createFileRoute } from "@tanstack/react-router";
import { AppLink, Button, ButtonLink, Card } from "@/components/kit";
import { AdminHeader, AdminPage, useAction } from "@/components/admin/kit";
import { StatusChip } from "@/components/status";
import { ago_, useAdminActions, useAdminModel, type IntegrationView } from "@/lib/admin-data";
import { moneyC } from "@/lib/format";

export const Route = createFileRoute("/admin/integrations/")({
  head: () => ({ meta: [{ title: "Integrations · Admin · OwnerFi" }] }),
  component: Integrations,
});

const usage = (i: IntegrationView) => `${i.usageThisMonth.toLocaleString("en-US")} ${i.unit}`;

function Integrations() {
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const a = useAction();
  const all = m.integrations;
  const count = (h: string) => all.filter((i) => i.health === h).length;
  const cost = all.reduce((s, i) => s + i.costThisMonth, 0);
  const groups = [...new Set(all.map((i) => i.category))].map((c) => [c, all.filter((i) => i.category === c)] as const);
  const stat = (n: string | number, l: string) => (
    <div>
      <p className="num text-2xl font-bold leading-8">{n}</p>
      <p className="text-sm text-muted">{l}</p>
    </div>
  );
  const testAll = () =>
    void a.run(
      "all",
      async () => {
        const res = await Promise.allSettled(all.map((i) => acts.integrations.test(i.id)));
        const bad = res.filter((r) => r.status === "rejected").length;
        if (bad) throw new Error(`${bad} ${bad === 1 ? "service" : "services"} didn’t answer.`);
      },
      "All services answered.",
    );
  return (
    <AdminPage>
      <AdminHeader title="Integrations" description="The outside services OwnerFi runs on." />
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-8">
          {stat(count("healthy"), "Healthy")}
          {stat(count("degraded"), "Slow")}
          {stat(count("down"), "Down")}
          {stat(moneyC(cost), "This month’s cost")}
        </div>
        <Button variant="secondary" loading={a.busy === "all"} onClick={testAll}>
          Test all
        </Button>
      </Card>
      {a.error && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {a.error}
        </p>
      )}
      <div className="space-y-8">
        {groups.map(([cat, items]) => (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="mb-3 text-lg font-semibold">
              {cat}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((i) => (
                <Card key={i.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <AppLink to={`/admin/integrations/${i.id}`} className="rounded font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        {i.name}
                      </AppLink>
                      <p className="truncate text-sm text-muted">{i.vendorExample}</p>
                    </div>
                    <StatusChip kind="integration" value={i.health} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-muted">Last event</dt>
                      <dd>{ago_(i.lastEventAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Cost this month</dt>
                      <dd className="num">{moneyC(i.costThisMonth)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted">Used this month</dt>
                      <dd>{usage(i)}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" size="sm" loading={a.busy === `t-${i.id}`} onClick={() => void a.run(`t-${i.id}`, () => acts.integrations.test(i.id), `${i.name} answered.`)}>
                      Test connection
                    </Button>
                    <ButtonLink variant="ghost" size="sm" to={`/admin/integrations/${i.id}`}>
                      Details
                    </ButtonLink>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminPage>
  );
}
