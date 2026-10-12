import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Plug, ScrollText } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, AppLink, Badge, Button, Card, CardHeader, EmptyState, Segmented } from "@/components/kit";
import { AdminPage, ConfirmModal, DetailSection, SummaryFacts, useAction } from "@/components/admin/kit";
import { ChartTip, axis } from "@/components/admin/charts";
import { StatusChip } from "@/components/status";
import { dateShort, dateTime, useAdminActions, useAdminModel, type IntegrationView } from "@/lib/admin-data";
import { moneyC } from "@/lib/format";

export const Route = createFileRoute("/admin/integrations/$id")({
  head: () => ({ meta: [{ title: "Service · Admin · OwnerFi" }] }),
  component: IntegrationDetail,
});

const Back = () => (
  <AppLink to="/admin/integrations" className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-muted hover:text-ink">
    <ArrowLeft aria-hidden className="h-4 w-4" /> Integrations
  </AppLink>
);
const use = (i: IntegrationView) => `${i.usageThisMonth.toLocaleString("en-US")} ${i.unit}`;
const fix = (id: string) => (id === "credit" ? "Soft credit checks are paused, so buyers can’t make offers." : id === "sms" ? "Some texts are arriving late." : "Some features may not work.");

function IntegrationDetail() {
  const { id } = Route.useParams();
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const a = useAction();
  const [rot, setRot] = useState(false);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<number | undefined>();
  const i = m.integrations.find((x) => x.id === id);

  if (!i) {
    return (
      <AdminPage>
        <div className="space-y-4">
          <Back />
          <EmptyState title="We can’t find that service" description="Go back to the list to find it." action={<AppLink to="/admin/integrations" className="font-semibold text-primary hover:underline">Integrations</AppLink>} />
        </div>
      </AdminPage>
    );
  }
  const replayed = m.s.integrations[i.id]?.replayed ?? [];
  const events = i.webhookEvents.map((e, index) => ({ ...e, index, ok: e.ok || replayed.includes(index) })).filter((e) => filter === "all" || !e.ok);
  const perUse = i.usageThisMonth ? i.costThisMonth / i.usageThisMonth : 0;

  return (
    <AdminPage>
      <div className="space-y-5">
        <div className="space-y-3">
          <Back />
          <Card padding="none">
            <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
              <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary">
                <Plug className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold md:text-[28px]">{i.name}</h1>
                  <StatusChip kind="integration" value={i.health} />
                </div>
                <p className="mt-1.5 text-sm text-muted">
                  {i.vendorExample} · {i.category}
                </p>
              </div>
              <div className="md:shrink-0 md:self-start">
                <Button variant="secondary" loading={a.busy === "test"} onClick={() => void a.run("test", () => acts.integrations.test(i.id), `${i.name} answered.`)}>
                  Test connection
                </Button>
              </div>
            </div>
            <div className="border-t border-ink/[0.08] bg-surface/60 px-5 py-4 md:px-6">
              <SummaryFacts facts={[{ label: "Used this month", value: use(i), strong: true }, { label: "Cost this month", value: moneyC(i.costThisMonth) }, { label: "Cost per use", value: i.usageThisMonth ? moneyC(perUse) : "—" }, { label: "Last event", value: dateTime(i.lastEventAt) }]} />
            </div>
          </Card>
          {a.error && !rot && <Alert tone="danger">{a.error}</Alert>}
          {i.health === "degraded" && <Alert tone="warning" title="Responses are slow">People may wait longer than usual. {fix(i.id)}</Alert>}
          {i.health === "down" && <Alert tone="danger" title="This service is down">{fix(i.id)} Rotate the credentials, then test the connection.</Alert>}
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            <DetailSection id="integration-usage" title="Last 30 days" description={`${use(i)} this month.`}>
              <div className="h-64 text-primary" aria-hidden>
                {i.usageThisMonth === 0 ? (
                  <p className="pt-24 text-center text-muted">No use yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={i.series} margin={{ left: 0, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} className="stroke-ink/10" />
                      <XAxis dataKey="day" interval={4} {...axis} />
                      <YAxis allowDecimals={false} width={32} {...axis} />
                      <Tooltip cursor={{ className: "fill-ink/5" }} content={({ active, payload }) => <ChartTip active={active} label={payload?.[0] ? `Day ${payload[0].payload.day}` : undefined} lines={payload?.[0] ? [`${payload[0].payload.uses} uses`] : []} />} />
                      <Bar dataKey="uses" fill="currentColor" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <table className="sr-only">
                <caption>Daily use</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Uses</th>
                  </tr>
                </thead>
                <tbody>
                  {i.series.map((s) => (
                    <tr key={s.day}>
                      <td>{s.day}</td>
                      <td>{s.uses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DetailSection>
            <DetailSection
              id="integration-webhooks"
              title="Webhook log"
              description="Events this service sent us."
              count={i.webhookEvents.length}
              action={<Segmented label="Show" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "failed", label: "Failed" }]} />}
            >
              {events.length === 0 ? (
                <EmptyState className="py-6" icon={<ScrollText aria-hidden className="h-6 w-6" />} title={filter === "failed" ? "No failed events" : "No events yet"} description={filter === "failed" ? "Every event went through." : undefined} />
              ) : (
                <ul className="divide-y divide-ink/10">
                  {events.map((e) => (
                    <li key={e.index} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="min-w-0 flex-1">
                          <span className="block break-all font-mono text-sm">{e.type}</span>
                          <span className="block text-sm text-muted">{dateTime(e.at)}</span>
                        </span>
                        <Badge tone={e.ok ? "success" : "danger"}>{e.ok ? "OK" : "Failed"}</Badge>
                        {!e.ok && (
                          <span className="flex gap-2">
                            <Button variant="ghost" size="sm" aria-expanded={open === e.index} onClick={() => setOpen(open === e.index ? undefined : e.index)}>
                              {open === e.index ? "Hide" : "Details"}
                            </Button>
                            <Button variant="secondary" size="sm" loading={a.busy === `r-${e.index}`} onClick={() => void a.run(`r-${e.index}`, () => acts.integrations.replay(i.id, e.index), "Event replayed.")}>
                              Replay
                            </Button>
                          </span>
                        )}
                      </div>
                      {open === e.index && !e.ok && <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-2 text-xs">{`{ "status": 500, "error": "upstream_timeout" }`}</pre>}
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>
          </div>
          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24" aria-label="Setup">
            <Card>
              <CardHeader title="Credentials" description="We only show the end of the key." />
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Key</dt>
                  <dd className="min-w-0 break-all text-right font-mono">{i.key}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Last rotated</dt>
                  <dd>{i.keyRotatedAt ? dateShort(i.keyRotatedAt) : "Never"}</dd>
                </div>
              </dl>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setRot(true)}>
                Rotate credentials
              </Button>
            </Card>
            <Card>
              <CardHeader title="Where it’s used" />
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {i.where.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Card>
          </aside>
        </div>
      </div>
      <ConfirmModal open={rot} title="Rotate credentials?" body="The old key stops working right away. Update the new one wherever it’s used." confirmLabel="Rotate" busy={a.busy === "rot"} error={a.error} onClose={() => { setRot(false); a.clearError(); }} onConfirm={() => void a.run("rot", () => acts.integrations.rotate(i.id), "Credentials rotated.").then((ok) => ok && setRot(false))} />
    </AdminPage>
  );
}
