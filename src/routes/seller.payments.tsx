import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { isSameMonth } from "date-fns/isSameMonth";
import { useMemo, useState } from "react";
import { Banknote, CreditCard, FileText, Landmark } from "lucide-react";
import { Alert, AppLink, Badge, Button, ButtonLink, Card, EmptyState, PageHeader, Segmented, useToast } from "@/components/kit";
import { StatusChip } from "@/components/status";
import { termsFor } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
import { moneyC } from "@/lib/format";
import { ledgerFor, monthlyStatements, scheduleFor, type LedgerRow } from "@/lib/ledger";
import { useSellerDeals } from "@/lib/seller-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/payments")({
  validateSearch: (s: Record<string, unknown>): { tab?: "received" | "payouts" | "statements" } =>
    s["tab"] === "received" || s["tab"] === "payouts" || s["tab"] === "statements" ? { tab: s["tab"] } : {},
  head: () => ({ meta: [{ title: "Payments · OwnerFi" }] }),
  component: SellerPayments,
});

const TABS = [
  { id: "schedule", label: "Schedule" },
  { id: "received", label: "Received" },
  { id: "payouts", label: "Payouts" },
  { id: "statements", label: "Statements" },
] as const;

const kindLabel = (k: LedgerRow["kind"]) => (k === "down_payment" ? "Down payment" : k === "refund" ? "Refund" : "Monthly");

function SellerPayments() {
  const deals = useSellerDeals();
  const { getDealDetail } = useDemoStore();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const toast = useToast();
  const now = new Date();
  const active = tab ?? "schedule";
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const ledger = useMemo(
    () => deals.flatMap((d) => ledgerFor(d, getDealDetail(d.id))).sort((a, b) => b.at.getTime() - a.at.getTime()),
    [deals, getDealDetail],
  );
  const receivedThisMonth = ledger.filter((r) => isSameMonth(r.at, now)).reduce((s, r) => s + r.net, 0);
  const owed = deals
    .filter((d) => d.stage === "active")
    .reduce((s, d) => {
      const t = termsFor(d);
      const paid = getDealDetail(d.id).installment?.paidCount ?? 0;
      return s + (t.schedule[paid - 1]?.balance ?? t.financed);
    }, 0);
  const interest = deals.reduce(
    (s, d) => s + termsFor(d).schedule.slice(0, getDealDetail(d.id).installment?.paidCount ?? 0).reduce((a, r) => a + r.interest, 0),
    0,
  );
  const next = deals
    .filter((d) => d.stage === "active")
    .map((d) => ({ d, row: scheduleFor(d, getDealDetail(d.id)).find((r) => r.status !== "paid") }))
    .filter((x) => x.row)
    .sort((a, b) => a.row!.dueAt.getTime() - b.row!.dueAt.getTime())[0];

  const kpis = [
    { label: "Next payout", value: next ? moneyC(next.row!.amount) : "—", hint: next ? `Arrives ${format(next.row!.dueAt, "MMM d")}` : "Nothing on the way" },
    { label: "Still owed to you", value: moneyC(owed), hint: "Principal left on your notes" },
    { label: "Interest earned", value: moneyC(interest), hint: "So far" },
  ];

  const rows = ledger.filter((r) => filter === "all" || (filter === "down_payment" ? r.kind === "down_payment" : r.kind !== "down_payment"));
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const statements = monthlyStatements(ledger);

  return (
    <div className="space-y-5">
      <PageHeader title="Payments" description="What you’ve received, what’s coming, and where it goes." />
      <section aria-label="Your income" className="overflow-hidden rounded-3xl bg-ink bg-brand-glow p-6 text-white md:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-sky">Received this month</p>
            <p className="num mt-2 font-display text-[40px] font-bold leading-none tracking-tight md:text-[48px]">{moneyC(receivedThisMonth)}</p>
            <p className="mt-3 text-sm text-white/65">Monthly payments go straight to you. OwnerFi takes no cut of them.</p>
          </div>
          <dl className="grid grid-cols-3 gap-x-6 lg:gap-x-10">
            {kpis.map((k) => (
              <div key={k.label} className="border-l border-white/15 pl-4">
                <dt className="text-xs text-white/55">{k.label}</dt>
                <dd className="num mt-1 font-display text-xl font-bold tracking-tight md:text-2xl">{k.value}</dd>
                <dd className="text-xs text-white/45">{k.hint}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div role="tablist" className="scrollbar-none flex gap-1 overflow-x-auto border-b border-ink/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            onClick={() => navigate({ search: (t.id === "schedule" ? {} : { tab: t.id }) as never, replace: true })}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-semibold md:px-4",
              active === t.id ? "border-primary text-ink" : "border-transparent text-muted hover:border-ink/20 hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "schedule" &&
        (deals.filter((d) => d.stage === "active").length === 0 ? (
          <EmptyState
            icon={<CreditCard aria-hidden className="h-6 w-6" />}
            title="No payments yet"
            description="When a buyer pays, it shows up here."
            action={<ButtonLink to="/seller/deals">See your deals</ButtonLink>}
          />
        ) : (
          <div className="space-y-4">
            {deals
              .filter((d) => d.stage === "active")
              .map((d) => {
                const sched = scheduleFor(d, getDealDetail(d.id));
                const open = sched.filter((r) => r.status !== "paid");
                const shown = expanded[d.id] ? open : open.slice(0, 6);
                const paid = sched.length - open.length;
                const lateRow = sched.find((r) => r.status === "late");
                return (
                  <Card key={d.id} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-sans font-semibold tracking-normal">{d.car}</h3>
                        <p className="text-sm text-muted">
                          {d.buyer.split(" ")[0]} · {paid} of {sched.length} paid
                        </p>
                      </div>
                      <StatusChip kind="deal" value={d.stage} />
                    </div>
                    <ul className="divide-y divide-ink/10">
                      {shown.map((r) => (
                        <li key={r.id} className={cn("flex items-center gap-3 py-3", r.status === "late" && "rounded-xl bg-danger/10 px-3")}>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{format(r.dueAt, "MMM d, yyyy")}</p>
                            {r.status === "late" && <p className="text-sm">Late · day 2 · Grace until {format(new Date(Date.now() + 5 * 86_400_000), "MMM d")}</p>}
                          </div>
                          <span className="num font-medium">{moneyC(r.amount)}</span>
                          <StatusChip kind="payment" value={r.status} />
                        </li>
                      ))}
                    </ul>
                    {open.length > 6 && (
                      <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => ({ ...e, [d.id]: !e[d.id] }))}>
                        {expanded[d.id] ? "Show fewer" : `Show all ${open.length}`}
                      </Button>
                    )}
                    {lateRow && (
                      <Alert tone="danger" title={`${d.buyer.split(" ")[0]} is behind`} action={<ButtonLink size="sm" variant="secondary" to={`/seller/deals/${d.id}/default-options`}>See your options</ButtonLink>}>
                        You don’t have to do anything yet. We remind the buyer and show you your options.
                      </Alert>
                    )}
                  </Card>
                );
              })}
          </div>
        ))}

      {active === "received" && (
        <Card className="space-y-4">
          <Segmented
            label="Show"
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "down_payment", label: "Down payments" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
          {rows.length === 0 ? (
            <p className="p-6 text-center text-muted">Nothing here yet. When a buyer pays, it shows up here.</p>
          ) : (
            <>
              <div className="hidden overflow-auto rounded-2xl border border-ink/[0.08] md:block">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <caption className="sr-only">Payments you received</caption>
                  <thead className="border-b border-ink/10">
                    <tr>
                      {["Date", "Buyer", "Car", "What", "Paid", "OwnerFi fee", "You received", "Reference"].map((h, i) => (
                        <th key={h} className={cn("whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted", i >= 4 && i <= 6 && "text-right")}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice((page - 1) * 10, page * 10).map((r) => (
                      <tr key={r.id} className="border-t border-ink/[0.06] first:border-t-0 hover:bg-surface">
                        <td className="px-4 py-3">{format(r.at, "MMM d, yyyy")}</td>
                        <td className="px-4 py-3">{r.buyer}</td>
                        <td className="px-4 py-3">{r.car}</td>
                        <td className="px-4 py-3">{kindLabel(r.kind)}</td>
                        <td className="num px-4 py-3 text-right">{moneyC(r.amount)}</td>
                        <td className="num px-4 py-3 text-right">{r.kind === "down_payment" ? (r.fee ? `−${moneyC(r.fee)}` : "$0 · Beta — waived") : "—"}</td>
                        <td className="num px-4 py-3 text-right font-medium">{moneyC(r.net)}</td>
                        <td className="px-4 py-3 text-muted">{r.ref}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-ink/10 md:hidden">
                {rows.slice((page - 1) * 10, page * 10).map((r) => (
                  <li key={r.id} className="space-y-1 py-3">
                    <div className="flex justify-between gap-3">
                      <p className="font-medium">
                        {r.buyer} · {kindLabel(r.kind)}
                      </p>
                      <p className="num font-semibold">{moneyC(r.net)}</p>
                    </div>
                    <p className="text-sm text-muted">
                      {format(r.at, "MMM d, yyyy")} · {r.car}
                    </p>
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="num text-muted">
                    Page {page} of {pages}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      Previous
                    </Button>
                    <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          <p className="text-sm text-muted">OwnerFi takes no cut of monthly payments.</p>
        </Card>
      )}

      {active === "payouts" && (
        <div className="space-y-4">
          <Alert tone="warning" title="Set up payouts" action={<AppLink to="/seller/onboarding/payouts" className="inline-flex h-9 items-center rounded-xl border border-ink/15 bg-white px-3.5 text-sm font-semibold shadow-card hover:bg-surface">Set up payouts</AppLink>}>
            Add a bank account so payments can reach you.
          </Alert>
          <Card>
            {ledger.length === 0 ? (
              <EmptyState icon={<Landmark aria-hidden className="h-6 w-6" />} title="No payouts yet" description="Payouts show up after your first payment." />
            ) : (
              <ul className="divide-y divide-ink/10">
                {ledger.slice(0, 40).map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{moneyC(r.net)} to Chase ••4821</p>
                      <p className="text-sm text-muted">
                        {r.car} · {i === 0 && r.kind === "monthly" ? "Arrives" : "Arrived"} {format(r.at, "MMM d, yyyy")}
                      </p>
                    </div>
                    {i === 0 && next ? <Badge tone="warning">In transit</Badge> : <StatusChip kind="payment" value="paid" />}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-sm text-muted">OwnerFi never holds your money.</p>
          </Card>
        </div>
      )}

      {active === "statements" && (
        <Card>
          {statements.length === 0 ? (
            <EmptyState icon={<FileText aria-hidden className="h-6 w-6" />} title="No statements yet" description="A statement appears after the first month with payments." />
          ) : (
            <ul className="divide-y divide-ink/10">
              {statements.map((s) => (
                <li key={s.month} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.label}</p>
                    <p className="text-sm text-muted">
                      Received {moneyC(s.received)} · Interest {moneyC(s.interest)}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" leftIcon={<Banknote aria-hidden className="h-4 w-4" />} onClick={() => toast({ tone: "info", title: "Demo: this would download the statement." })}>
                    Download
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
