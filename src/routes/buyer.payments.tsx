import { createFileRoute } from "@tanstack/react-router";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { format } from "date-fns/format";
import { useState } from "react";
import { CreditCard, FileText, Receipt } from "lucide-react";
import { Alert, Breakdown, Button, ButtonLink, Card, CardHeader, EmptyState, Modal, NativeSelect, PageHeader, Switch, useToast } from "@/components/kit";
import { PayModal } from "@/components/app/PayModal";
import { StatusChip } from "@/components/status";
import { useBuyerDeals } from "@/lib/buyer-data";
import { setAutopay, useAutopay } from "@/lib/autopay";
import { usePaymentMethods } from "@/lib/payment-methods";
import { useDemoStore } from "@/lib/demo-store";
import { moneyC, shortCar } from "@/lib/format";
import { scheduleFor, type ScheduleRow } from "@/lib/ledger";
import { notify } from "@/lib/notify";
import { demoFlags, useCurrentUser } from "@/lib/session";
import { demoNow } from "@/lib/demo-clock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer/payments")({
  validateSearch: (s: Record<string, unknown>): { deal?: string } => (typeof s["deal"] === "string" ? { deal: s["deal"] } : {}),
  head: () => ({ meta: [{ title: "Payments · OwnerFi" }] }),
  component: BuyerPayments,
});

const ord = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/** Pays the next installment, or fails once if "Next payment fails" is on in the demo toolbar. */
export function usePayNext(dealId: string) {
  const { payInstallment, failInstallment } = useDemoStore();
  return () => {
    if (demoFlags.get().payFails) {
      demoFlags.set({ payFails: false });
      failInstallment(dealId);
      throw new Error("Payment declined");
    }
    payInstallment(dealId);
  };
}

function BuyerPayments() {
  const user = useCurrentUser();
  const toast = useToast();
  const deals = useBuyerDeals().filter((d) => d.stage === "active");
  const { getDealDetail } = useDemoStore();
  const { deal: dealParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const deal = deals.find((d) => d.id === dealParam) ?? deals.find((d) => d.late) ?? deals[0];
  const ap = useAutopay(deal?.id ?? "");
  const pay = usePayNext(deal?.id ?? "");
  const [payOpen, setPayOpen] = useState(false);
  const [apOpen, setApOpen] = useState(false);
  const [apOff, setApOff] = useState(false);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [receipt, setReceipt] = useState<ScheduleRow | null>(null);
  const pm = usePaymentMethods(user?.id, user?.verification.bank === "verified");
  if (!user) return null;

  if (!deal) {
    return (
      <>
        <PageHeader title="Payments" description="Your monthly payments, receipts and autopay." />
        <EmptyState
          icon={<CreditCard aria-hidden className="h-6 w-6" />}
          title="No payments yet"
          description="When you buy a car on payments, your schedule shows up here."
          action={<ButtonLink to="/cars">Browse cars</ButtonLink>}
        />
      </>
    );
  }

  const sched = scheduleFor(deal, getDealDetail(deal.id));
  const next = sched.find((r) => r.status !== "paid");
  const late = sched.find((r) => r.status === "late");
  const seller = deal.seller.split(" ")[0] ?? "the seller";
  const upcoming = sched.filter((r) => r.status !== "paid");
  const history = sched.filter((r) => r.status === "paid").reverse();
  const inst = getDealDetail(deal.id).installment;
  const failedTries = (inst?.history ?? []).filter((h) => h.status === "failed").slice().reverse();
  const sent = (inst?.fired ?? []).slice().sort((a, b) => a - b).map((d) => (d <= 1 ? "reminder" : d <= 5 ? "late notice" : d <= 15 ? "the seller was alerted" : "default options opened"));
  const bankOk = user.verification.bank === "verified";
  const bank = pm.default ? `${pm.default.name} ${pm.default.kind === "bank" ? "••" : "••••"}${pm.default.last4}` : "your default payment method";

  return (
    <div className="space-y-5">
      <PageHeader title="Payments" description="Your monthly payments, receipts and autopay." />
      {deals.length > 1 && (
        <NativeSelect
          label="Car"
          value={deal.id}
          onChange={(e) => navigate({ search: { deal: e.target.value } as never, replace: true })}
          options={deals.map((d) => ({ value: d.id, label: d.car }))}
        />
      )}
      {late && (
        <Alert
          tone="danger"
          title={`Your ${format(late.dueAt, "MMM")} payment of ${moneyC(late.amount)} is ${Math.max(1, differenceInCalendarDays(demoNow(), late.dueAt))} days late.`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setPayOpen(true)}>
                Pay now
              </Button>
              <ButtonLink size="sm" variant="secondary" to="/buyer/inbox">
                Contact {seller}
              </ButtonLink>
            </div>
          }
        >
          Pay now to catch up. It goes straight to the seller.
          {sent.length > 0 && <span className="mt-1 block text-sm">Sent so far: {sent.join(", ")}. OwnerFi never takes the car back by itself.</span>}
        </Alert>
      )}
      {next ? (
        <section aria-label="Next payment" className="overflow-hidden rounded-3xl bg-ink bg-brand-glow p-6 text-white md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <p className="eyebrow text-sky">Next payment</p>
              <p className="num font-display text-[40px] font-bold leading-none tracking-tight md:text-[48px]">
                {moneyC(next.amount)} <span className="font-sans text-base font-medium tracking-normal text-white/65">due {format(next.dueAt, "MMM d")}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 text-white/85">
                <span className="rounded-full bg-white">
                  <StatusChip kind="payment" value={next.status} />
                </span>
                <p>{late ? "This one is overdue." : ap.enabled ? `Autopay will take it on ${format(next.dueAt, "MMM d")}.` : "Pay it yourself, or turn on autopay."}</p>
              </div>
              <p className="text-sm text-white/55">Goes straight to {seller}. No fees.</p>
            </div>
            {!late && (
              <Button size="lg" variant="accent" onClick={() => setPayOpen(true)}>
                Pay now
              </Button>
            )}
          </div>
        </section>
      ) : (
        <Card>
          <p className="font-semibold">You’re all paid up.</p>
          <p className="text-muted">There are no payments left to make.</p>
        </Card>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="space-y-5">
          <Card className="space-y-3">
            {bankOk ? (
              <>
                <Switch
                  label="Autopay"
                  description={ap.enabled ? `${bank} · on the due date, the ${ord(next ? next.dueAt.getDate() : ap.day)} of each month` : "We pay it for you on the due date every month."}
                  checked={ap.enabled}
                  onChange={(v) => (v ? setApOpen(true) : setApOff(true))}
                />
              </>
            ) : (
              <>
                <h3 className="font-sans font-semibold tracking-normal">Autopay</h3>
                <p className="text-muted">Connect a bank account to use autopay.</p>
                <ButtonLink to="/buyer/verification" variant="secondary">
                  Verify your bank
                </ButtonLink>
              </>
            )}
          </Card>
          {next && (
            <Card>
              <CardHeader title="Pay it off early" description="Pay what’s left in one go and the title becomes fully yours." />
              <ButtonLink to={`/buyer/deals/${deal.id}/payoff`} variant="secondary" size="sm">
                See your payoff amount
              </ButtonLink>
            </Card>
          )}
        </div>
        <Card>
          <div role="tablist" className="mb-4 flex gap-1 border-b border-ink/10">
            {(
              [
                ["upcoming", "Upcoming", upcoming.length],
                ["history", "History", history.length],
              ] as const
            ).map(([id, label, n]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold", tab === id ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink")}
              >
                {label}
                <span className={cn("num rounded-full px-2 text-xs leading-5", tab === id ? "bg-primary text-white" : "bg-ink/[0.07] text-ink/70")}>{n}</span>
              </button>
            ))}
          </div>
          {tab === "history" && failedTries.length > 0 && (
            <ul className="mb-2 divide-y divide-ink/10 rounded-xl border border-danger/20 bg-danger/5 px-3">
              {failedTries.map((h) => (
                <li key={h.key + h.at} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{format(new Date(h.at), "MMM d, yyyy")}</p>
                    <p className="text-sm text-muted">
                      {h.method === "autopay" ? "Autopay" : "Manual"} try · {h.error ?? "Declined"} · you weren’t charged
                    </p>
                  </div>
                  <StatusChip kind="payment" value="failed" />
                </li>
              ))}
            </ul>
          )}
          {(tab === "upcoming" ? upcoming : history).length === 0 ? (
            <EmptyState icon={<Receipt aria-hidden className="h-6 w-6" />} title={tab === "upcoming" ? "Nothing coming up" : "No payments yet"} description="They show up here as they happen." />
          ) : (
            <ul className="divide-y divide-ink/10">
              {(tab === "upcoming" ? upcoming : history).slice(0, 12).map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{format(r.dueAt, "MMM d, yyyy")}</p>
                    <p className="text-sm text-muted">Monthly payment</p>
                  </div>
                  <span className="num font-medium">{moneyC(r.amount)}</span>
                  <StatusChip kind="payment" value={r.status} />
                  {r.status === "paid" && (
                    <Button size="sm" variant="ghost" aria-label={`Receipt for ${format(r.dueAt, "MMM d")}`} onClick={() => setReceipt(r)}>
                      <FileText aria-hidden className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {next && (
        <PayModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          title={`Pay ${shortCar(deal.car)}`}
          amount={next.amount}
          sellerName={seller}
          doneText={`${moneyC(next.amount)} is on its way to ${seller}.`}
          run={() => {
            pay();
            notify("u-maria", "payment_received", { title: "Payment received", body: `${user.name} paid ${moneyC(next.amount)}.`, href: "/seller/payments", tag: "receipt" });
          }}
        />
      )}
      <Modal
        open={apOpen}
        onClose={() => setApOpen(false)}
        title="Turn on autopay"
        description="We take each payment on its due date. If it fails we try again the next two days. You can stop any time."
        footer={
          <>
            <Button variant="secondary" onClick={() => setApOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setAutopay(deal.id, { enabled: true, day: next ? next.dueAt.getDate() : ap.day });
                setApOpen(false);
                toast({ tone: "success", title: "Autopay is on." });
              }}
            >
              Turn on autopay
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p>From {bank}.</p>
          {next && (
            <p className="rounded-xl bg-surface p-3 text-sm">
              Next payment: <strong>{moneyC(next.amount)}</strong> on <strong>{format(next.dueAt, "MMM d, yyyy")}</strong>.
            </p>
          )}
        </div>
      </Modal>
      <Modal
        open={apOff}
        onClose={() => setApOff(false)}
        size="sm"
        title="Turn off autopay?"
        description="You’ll need to pay each month yourself."
        footer={
          <>
            <Button variant="secondary" onClick={() => setApOff(false)}>
              Keep autopay
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setAutopay(deal.id, { enabled: false, day: ap.day });
                setApOff(false);
                toast({ tone: "success", title: "Autopay is off." });
              }}
            >
              Turn off
            </Button>
          </>
        }
      >
        <span />
      </Modal>
      <Modal open={!!receipt} onClose={() => setReceipt(null)} size="sm" title="Receipt" footer={<Button variant="secondary" onClick={() => toast({ tone: "info", title: "Demo: this would download the receipt." })}>Download receipt</Button>}>
        {receipt && (
          <Breakdown
            rows={[
              { label: "Payment", value: moneyC(receipt.amount) },
              { label: "Paid with", value: "Bank transfer" },
              { label: "Date", value: format(receipt.dueAt, "MMM d, yyyy") },
              { label: "Reference", value: `PAY-${deal.id.slice(-4).toUpperCase()}-${String(receipt.n).padStart(2, "0")}` },
              { label: "Fees", value: "None" },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
