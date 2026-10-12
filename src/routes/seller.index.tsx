import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, ChevronRight, CheckCircle2, Eye, Heart, MessageSquare, Car as CarIcon } from "lucide-react";
import { AppLink, Card, CardHeader, ButtonLink, EmptyState, PageHeader, Skeleton } from "@/components/kit";
import { CarImage, carTitle } from "@/components/site/cars";
import { StatusChip, statusInfo } from "@/components/status";
import { Badge } from "@/components/kit";
import { STAGE_LABEL } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
import { saleLimitForState } from "@/lib/finance";
import { moneyC } from "@/lib/format";
import { sellerActions, sellerKpis, useSellerDeals, useSellerVehicles } from "@/lib/seller-data";
import { useCurrentUser } from "@/lib/session";

export const Route = createFileRoute("/seller/")({
  head: () => ({ meta: [{ title: "Seller home · OwnerFi" }] }),
  component: SellerHome,
});

const ROW = "-mx-3 flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface";

function Kpis({ monthly, owed, interest, notes }: { monthly: number; owed: number; interest: number; notes: number }) {
  const items = [
    { label: "Still owed to you", value: moneyC(owed) },
    { label: "Interest earned this year", value: moneyC(interest) },
    { label: "Cars being paid off", value: String(notes) },
  ];
  return (
    <section aria-label="Your numbers" className="overflow-hidden rounded-3xl bg-ink bg-brand-glow p-6 text-white md:p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-sky">Monthly income</p>
          <p className="num mt-2 font-display text-[40px] font-bold leading-none tracking-tight md:text-[52px]">
            {moneyC(monthly)}
          </p>
          <p className="mt-3 text-sm text-white/65">Paid straight to you each month, before any late payments.</p>
          <AppLink to="/seller/payments" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:underline">
            See payments <ArrowRight aria-hidden className="h-4 w-4" />
          </AppLink>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:gap-x-10">
          {items.map((i) => (
            <div key={i.label} className="border-l border-white/15 pl-4">
              <dt className="text-xs text-white/55">{i.label}</dt>
              <dd className="num mt-1 font-display text-xl font-bold tracking-tight md:text-2xl">{i.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function SellerHome() {
  const user = useCurrentUser();
  const { getDealDetail } = useDemoStore();
  const deals = useSellerDeals();
  const { vehicles, loading } = useSellerVehicles();
  if (!user) return null;

  const paidCounts = Object.fromEntries(deals.map((d) => [d.id, getDealDetail(d.id).installment?.paidCount ?? 0]));
  const k = sellerKpis(deals, paidCounts);
  const actions = sellerActions(deals).slice(0, 5);
  const limit = saleLimitForState(user.state);
  const used = deals.filter((d) => d.stage === "active" || d.stage === "paid_off").length;
  const remaining = Math.max(0, limit - used);

  const counts = vehicles.reduce<Record<string, number>>((m, v) => ({ ...m, [v.status]: (m[v.status] ?? 0) + 1 }), {});
  const drives = deals
    .map((d) => ({ d, td: getDealDetail(d.id).testDrive }))
    .filter((x) => x.td && x.td.status !== "completed");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Hi, ${user.name.split(" ")[0]}`} description="Here’s what’s happening with your cars." />
      {loading ? (
        <div aria-busy="true" className="space-y-6">
          <Skeleton className="h-56 rounded-3xl md:h-44" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="space-y-6">
          <Kpis monthly={k.monthlyIncome} owed={k.outstanding} interest={k.interestYtd} notes={k.activeNotes} />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="min-w-0 space-y-6 lg:col-span-2">
              <Card>
                <CardHeader
                  title="Needs you"
                  description="Things waiting on you right now."
                  action={
                    actions.length > 0 ? (
                      <span className="num rounded-full bg-primary px-2.5 py-0.5 text-sm font-semibold text-white">{actions.length}</span>
                    ) : undefined
                  }
                />
                {actions.length === 0 ? (
                  <EmptyState
                    icon={<CheckCircle2 aria-hidden className="h-6 w-6" />}
                    title="You’re all caught up"
                    description="Nothing needs you right now. We’ll tell you when a buyer replies."
                  />
                ) : (
                  <ul className="space-y-1">
                    {actions.map(({ deal, next }) => (
                      <li key={deal.id}>
                        <AppLink to={`/deals/${deal.id}?as=seller`} className={ROW}>
                          <CarImage src={deal.photo} alt="" className="h-12 w-12 shrink-0 !rounded-xl" aspect="square" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{next.text}</span>
                            <span className="block truncate text-sm text-muted">
                              {deal.car} · {deal.buyer.split(" ")[0]}
                            </span>
                          </span>
                          <span className="hidden sm:block">
                            <StatusChip kind="deal" value={deal.stage} />
                          </span>
                          <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-muted" />
                        </AppLink>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Your cars"
                  action={
                    vehicles.length > 0 ? (
                      <AppLink to="/seller/vehicles" className="text-sm font-semibold text-primary hover:underline">
                        See all
                      </AppLink>
                    ) : undefined
                  }
                />
                {vehicles.length === 0 ? (
                  <EmptyState
                    icon={<CarIcon aria-hidden className="h-6 w-6" />}
                    title="No cars yet"
                    description="Add a car and we’ll check it before it goes live."
                    action={<ButtonLink to="/seller/vehicles/new">Add a car</ButtonLink>}
                  />
                ) : (
                  <>
                    <ul aria-label="Cars by status" className="mb-4 flex flex-wrap gap-2">
                      {Object.entries(counts).map(([s, n]) => (
                        <li key={s}>
                          <Badge tone={statusInfo("vehicle", s).tone}>
                            {n} {statusInfo("vehicle", s).label.toLowerCase()}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {vehicles.slice(0, 4).map(({ vehicle: v, status, views, saves, questions }) => (
                        <li key={v.id}>
                          <AppLink
                            to={`/seller/vehicles/${v.id}`}
                            className="flex h-full gap-3 rounded-2xl border border-ink/[0.08] p-2.5 transition-colors hover:border-ink/20 hover:bg-surface"
                          >
                            <CarImage
                              src={v.photos[0]}
                              alt=""
                              make={v.make}
                              model={v.model}
                              className="h-[72px] w-24 shrink-0 !rounded-xl"
                            />
                            <span className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                              <span className="truncate font-semibold">{carTitle(v)}</span>
                              <span className="self-start">
                                <StatusChip kind="vehicle" value={status} />
                              </span>
                              <span className="num flex items-center gap-3 text-xs text-muted">
                                <span className="inline-flex items-center gap-1" title="Views">
                                  <Eye aria-hidden className="h-3.5 w-3.5" />
                                  {views}
                                </span>
                                <span className="inline-flex items-center gap-1" title="Saves">
                                  <Heart aria-hidden className="h-3.5 w-3.5" />
                                  {saves}
                                </span>
                                <span className="inline-flex items-center gap-1" title="Questions">
                                  <MessageSquare aria-hidden className="h-3.5 w-3.5" />
                                  {questions}
                                </span>
                              </span>
                            </span>
                          </AppLink>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            </div>

            <div className="min-w-0 space-y-6">
              <Card>
                <CardHeader title="Upcoming test drives" />
                {drives.length === 0 ? (
                  <p className="text-sm text-muted">
                    No test drives booked.{" "}
                    <AppLink to="/seller/test-drives/availability" className="font-semibold text-primary hover:underline">
                      Set your availability
                    </AppLink>
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {drives.slice(0, 3).map(({ d, td }) => (
                      <li key={d.id} className="flex gap-3">
                        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                          <CalendarCheck className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{td!.slot}</span>
                          <span className="block text-sm text-muted">
                            {d.buyer} · {d.car}
                          </span>
                          <span className="block truncate text-sm text-muted">{td!.location}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader title="Yearly sale limit" />
                <div
                  role="progressbar"
                  aria-label={`${used} of ${limit} sales used in the last 12 months`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round((used / limit) * 100)}
                  className="h-2 overflow-hidden rounded-full bg-ink/10"
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(used / limit) * 100}%` }} />
                </div>
                <p className="mt-2 text-sm">
                  {used} of {limit} sales used in the last 12 months.
                </p>
                <p className="mt-1 text-sm text-muted">
                  Arizona lets private sellers sell {limit} cars a year. You can sell {remaining} more.
                </p>
              </Card>

              <Card>
                <CardHeader title="Recent activity" />
                {deals.length === 0 ? (
                  <p className="text-sm text-muted">Nothing yet. Activity from your deals shows up here.</p>
                ) : (
                  <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-ink/10">
                    {deals.map((d) => (
                      <li key={d.id} className="relative pl-6">
                        <span
                          aria-hidden
                          className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-white bg-primary ring-1 ring-primary/30"
                        />
                        <AppLink to={`/deals/${d.id}?as=seller`} className="group block">
                          <span className="block text-sm font-medium group-hover:underline">
                            {d.buyer.split(" ")[0]}: {STAGE_LABEL[d.stage].toLowerCase()}
                          </span>
                          <span className="block text-xs text-muted">
                            {d.car} · {d.updated}
                          </span>
                        </AppLink>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

