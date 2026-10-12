import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { ArrowRight, CheckCircle2, ChevronRight, Clock, Handshake, Heart, Search } from "lucide-react";
import { AppLink, ButtonLink, Card, CardHeader, EmptyState, PageHeader } from "@/components/kit";
import { CarImage, carEstimate, carTitle } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { scheduleFor } from "@/lib/ledger";
import { useDemoStore } from "@/lib/demo-store";
import { money, moneyC } from "@/lib/format";
import { VERIFY_STEPS, buyerActions, dealProgress, isDone, stateOf, upcomingDrives, useBuyerDeals, useBuyerDrives, useSavedVehicles } from "@/lib/buyer-data";
import { CLOSED_STAGES } from "@/lib/demo-data";
import { useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer/")({
  head: () => ({ meta: [{ title: "Buyer home · OwnerFi" }] }),
  component: BuyerHome,
});

const ROW = "-mx-3 flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface";
const LABEL = { identity: "Identity", bank: "Bank", credit: "Credit check" } as const;

function BuyerHome() {
  const user = useCurrentUser();
  const { getDealDetail } = useDemoStore();
  const deals = useBuyerDeals();
  const drives = upcomingDrives(useBuyerDrives());
  const saved = useSavedVehicles();
  if (!user) return null;

  // Same definition as the Deals page's Active tab, so the numbers match.
  const active = deals.filter((d) => !CLOSED_STAGES.includes(d.stage));
  const actions = buyerActions(deals, getDealDetail);
  const payNext = deals
    .filter((d) => d.stage === "active")
    .map((d) => ({ d, row: scheduleFor(d, getDealDetail(d.id)).find((r) => r.status !== "paid") }))
    .filter((x) => x.row)
    .sort((a, b) => a.row!.dueAt.getTime() - b.row!.dueAt.getTime())[0];
  const verified = isDone(user);
  const done = VERIFY_STEPS.filter((s) => stateOf(user, s) === "verified").length;
  const late = payNext?.row?.status === "late";

  // Saved count follows the Saved page, which only lists cars that still exist.
  const savedCount = saved.loading ? saved.ids.length : saved.vehicles.length;
  const counts = [
    { label: "Deals in progress", value: active.length },
    { label: "Test drives coming up", value: drives.length },
    { label: "Saved cars", value: savedCount },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Here’s where your car search stands."
        action={
          <ButtonLink to="/cars" leftIcon={<Search aria-hidden className="h-4 w-4" />}>
            Find a car
          </ButtonLink>
        }
      />
      <div className="space-y-6">
        <section aria-label="Your summary" className="overflow-hidden rounded-3xl bg-ink bg-brand-glow p-6 text-white md:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              {payNext ? (
                <>
                  <p className="eyebrow flex items-center gap-2 text-sky">
                    Next payment
                    {late && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white">Late</span>}
                  </p>
                  <p className="num mt-2 font-display text-[40px] font-bold leading-none tracking-tight md:text-[52px]">{moneyC(payNext.row!.amount)}</p>
                  <p className="mt-3 text-sm text-white/65">
                    {late ? "Was due" : "Due"} {format(payNext.row!.dueAt, "EEEE, MMM d")} · {payNext.d.car} · paid straight to {payNext.d.seller.split(" ")[0]}.
                  </p>
                  <AppLink to={`/buyer/payments?deal=${payNext.d.id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:underline">
                    {late ? "Pay it now" : "See payments"} <ArrowRight aria-hidden className="h-4 w-4" />
                  </AppLink>
                </>
              ) : verified ? (
                <>
                  <p className="eyebrow text-sky">You’re verified</p>
                  <p className="num mt-2 font-display text-[34px] font-bold leading-none tracking-tight md:text-[44px]">Ready to make offers</p>
                  <p className="mt-3 text-sm text-white/65">Sellers see that OwnerFi checked you. Find a car and make an offer.</p>
                  <AppLink to="/cars" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:underline">
                    Browse cars <ArrowRight aria-hidden className="h-4 w-4" />
                  </AppLink>
                </>
              ) : (
                <>
                  <p className="eyebrow text-sky">Get verified</p>
                  <p className="num mt-2 font-display text-[40px] font-bold leading-none tracking-tight md:text-[52px]">
                    {done} of {VERIFY_STEPS.length} done
                  </p>
                  <p className="mt-3 text-sm text-white/65">Verify once to book test drives and make offers. It keeps everyone safe.</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {VERIFY_STEPS.map((s) => {
                      const st = stateOf(user, s);
                      return (
                        <li
                          key={s}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1",
                            st === "verified" ? "bg-white/10 text-white ring-white/15" : "text-white/65 ring-white/10",
                          )}
                        >
                          {st === "verified" ? <CheckCircle2 aria-hidden className="h-4 w-4 text-sky" /> : st === "in_review" ? <Clock aria-hidden className="h-4 w-4 text-sky" /> : <span aria-hidden className="h-3.5 w-3.5 rounded-full border border-white/40" />}
                          {LABEL[s]}
                        </li>
                      );
                    })}
                  </ul>
                  <ButtonLink to="/buyer/verification" variant="accent" className="mt-5">
                    Continue verification
                  </ButtonLink>
                </>
              )}
            </div>
            <dl className="grid shrink-0 grid-cols-3 gap-x-4 gap-y-5 lg:gap-x-8">
              {counts.map((c) => (
                <div key={c.label} className="border-l border-white/15 pl-4">
                  <dt className="text-xs text-white/55">{c.label}</dt>
                  <dd className="num mt-1 font-display text-xl font-bold tracking-tight md:text-2xl">{c.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <Card>
              <CardHeader
                title="Needs you"
                description="Things waiting on you right now."
                action={actions.length > 0 ? <span className="num rounded-full bg-primary px-2.5 py-0.5 text-sm font-semibold text-white">{actions.length}</span> : undefined}
              />
              {actions.length === 0 ? (
                <EmptyState icon={<CheckCircle2 aria-hidden className="h-6 w-6" />} title="You’re all caught up" description="Nothing needs you right now. We’ll tell you when a seller replies." />
              ) : (
                <ul className="space-y-1">
                  {actions.map(({ deal, next }) => (
                    <li key={deal.id}>
                      <AppLink to={`/deals/${deal.id}?as=buyer`} className={ROW}>
                        <CarImage src={deal.photo} alt="" className="h-12 w-12 shrink-0 !rounded-xl" aspect="square" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{next.text}</span>
                          <span className="block truncate text-sm text-muted">{deal.car}</span>
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
                title="Deals in progress"
                action={active.length > 0 ? <AppLink to="/buyer/deals" className="text-sm font-semibold text-primary hover:underline">{active.length > 4 ? `See all ${active.length}` : "See all"}</AppLink> : undefined}
              />
              {active.length === 0 ? (
                <EmptyState icon={<Handshake aria-hidden className="h-6 w-6" />} title="You have no deals yet" description="Find a car you like and ask the seller about it." action={<ButtonLink to="/cars">Find a car</ButtonLink>} />
              ) : (
                <ul className="space-y-1">
                  {active.slice(0, 4).map((d) => (
                    <li key={d.id}>
                      <AppLink to={`/deals/${d.id}?as=buyer`} className={ROW}>
                        <CarImage src={d.photo} alt="" className="h-12 w-16 shrink-0 !rounded-xl" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{d.car}</span>
                          <span className="block truncate text-sm text-muted">
                            Seller {d.seller.split(" ")[0]} · updated {d.updated}
                          </span>
                        </span>
                        <span className="hidden w-36 shrink-0 sm:block">
                          <StatusChip kind="deal" value={d.stage} />
                          <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-ink/10">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${dealProgress(d)}%` }} />
                          </span>
                        </span>
                        <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-muted" />
                      </AppLink>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader title="Upcoming test drives" action={<AppLink to="/buyer/test-drives" className="text-sm font-semibold text-primary hover:underline">See all</AppLink>} />
              {drives.length === 0 ? (
                <p className="text-sm text-muted">
                  No test drives booked. Book one from a car you like.{" "}
                  <AppLink to="/cars" className="font-semibold text-primary hover:underline">
                    Browse cars
                  </AppLink>
                </p>
              ) : (
                <ul className="space-y-4">
                  {drives.slice(0, 3).map((d) => {
                    const t = new Date(d.start);
                    return (
                      <li key={d.id} className="flex gap-3">
                        <span aria-hidden className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                          <span className="text-[10px] font-semibold uppercase leading-none">{format(t, "MMM")}</span>
                          <span className="num font-display text-lg font-bold leading-tight">{format(t, "d")}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{format(t, "EEEE")} at {format(t, "h:mm a")}</span>
                          <span className="block truncate text-sm text-muted">{d.car}</span>
                          {d.status === "requested" && <span className="block text-sm text-muted">Waiting for the seller</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Saved cars" action={savedCount > 0 ? <AppLink to="/buyer/saved" className="text-sm font-semibold text-primary hover:underline">See all</AppLink> : undefined} />
              {saved.vehicles.length === 0 ? (
                <EmptyState
                  className="py-4"
                  icon={<Heart aria-hidden className="h-6 w-6" />}
                  title="Cars you save show up here"
                  description="Tap the heart on a car to keep it for later."
                  action={<ButtonLink to="/cars" variant="secondary" size="sm">Browse cars</ButtonLink>}
                />
              ) : (
                <ul className="space-y-1">
                  {saved.vehicles.slice(0, 3).map((v) => (
                    <li key={v.id}>
                      <AppLink to={`/cars/${v.id}`} className={ROW}>
                        <CarImage src={v.photos[0]} alt="" make={v.make} model={v.model} className="h-12 w-16 shrink-0 !rounded-xl" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{carTitle(v)}</span>
                          <span className="num block text-sm text-muted">
                            ≈ {money(Math.round(carEstimate(v).monthly))}/mo · {moneyC(v.price_cents)}
                          </span>
                        </span>
                      </AppLink>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
