import { Navigate, createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { PartyPopper, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PayModal } from "@/components/app/PayModal";
import { Alert, AppLink, Breakdown, Button, Card, PageHeader } from "@/components/kit";
import { demoNow } from "@/lib/demo-clock";
import { useDemoStore } from "@/lib/demo-store";
import { moneyC, shortCar } from "@/lib/format";
import { payoffQuote } from "@/lib/payoff";
import { demoFlags, useCurrentUser } from "@/lib/session";

export const Route = createFileRoute("/buyer/deals/$dealId/payoff")({
  head: () => ({ meta: [{ title: "Pay off early · OwnerFi" }] }),
  component: Payoff,
});

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 7) * 0.12, color: ["#2563eb", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6"][i % 5]! }));

function Celebration() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden">
      <style>{"@keyframes of-fall{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(170px) rotate(540deg);opacity:0}}@media (prefers-reduced-motion:reduce){.of-confetti{animation:none!important;opacity:0}}"}</style>
      {CONFETTI.map((c, i) => (
        <span key={i} className="of-confetti absolute top-0 h-2.5 w-1.5 rounded-sm" style={{ left: `${c.left}%`, background: c.color, animation: `of-fall 2.4s ${c.delay}s ease-in both` }} />
      ))}
    </div>
  );
}

function Payoff() {
  const { dealId } = Route.useParams();
  const user = useCurrentUser();
  const { getDeal, getDealDetail, payOff } = useDemoStore();
  const [open, setOpen] = useState(false);
  const deal = getDeal(dealId);
  if (!deal || deal.buyer !== user?.name) return <Navigate to="/buyer/deals" replace />;
  const seller = deal.seller.split(" ")[0] ?? "the seller";
  const detail = getDealDetail(deal.id);
  const lien = detail.lien;

  if (deal.stage === "paid_off" || lien) {
    const released = !!lien?.releasedAt;
    return (
      <div className="relative space-y-5">
        {!released && <Celebration />}
        <PageHeader title={released ? "The title is yours, free and clear" : "You paid it all"} description={released ? `${seller} released the lien on ${shortCar(deal.car)}.` : `Now ${seller} releases the lien.`} />
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
              {released ? <ShieldCheck aria-hidden className="h-6 w-6" /> : <PartyPopper aria-hidden className="h-6 w-6" />}
            </span>
            <div>
              <p className="font-semibold">{released ? "Lien released" : "Waiting for the lien release"}</p>
              <p className="text-sm text-muted">
                {released
                  ? lien?.releasedAt
                    ? `Confirmed ${format(new Date(lien.releasedAt), "MMM d, yyyy")}.`
                    : ""
                  : `${seller} gets a notice to release the lien. We’ll tell you when the title is clear.`}
              </p>
            </div>
          </div>
          <ol className="space-y-2 text-sm">
            {[
              ["Final payment received", true],
              ["Lien release requested", !!lien || deal.stage === "paid_off"],
              ["Lien released, title is clear", released],
            ].map(([l, done]) => (
              <li key={String(l)} className="flex items-center gap-2">
                <span className={done ? "text-success" : "text-muted"}>{done ? "✓" : "○"}</span>
                <span className={done ? "font-medium" : "text-muted"}>{l}</span>
              </li>
            ))}
          </ol>
          {lien && <p className="num text-sm text-muted">Paid off: {moneyC(lien.paidOffCents)}</p>}
        </Card>
        <AppLink className="text-sm font-medium text-primary hover:underline" to={`/deals/${deal.id}?as=buyer`}>
          Back to the deal
        </AppLink>
      </div>
    );
  }
  if (deal.stage !== "active") return <Navigate to="/buyer/deals" replace />;

  const q = payoffQuote(deal, detail.installment, demoNow());

  return (
    <div className="space-y-5">
      <PageHeader title="Pay off early" description="Pay the balance today and the car is yours once the lien is released." />
      <Card className="space-y-4">
        <div>
          <p className="text-sm text-muted">Payoff amount today</p>
          <p className="num text-4xl font-bold">{moneyC(q.total)}</p>
          <p className="text-sm text-muted">Good for today only ({format(demoNow(), "MMM d")}). No prepayment penalty.</p>
        </div>
        <Breakdown
          rows={[
            { label: `Remaining principal (${q.remaining} payments left)`, value: moneyC(q.principal) },
            { label: `Interest for ${q.days} ${q.days === 1 ? "day" : "days"}`, hint: "Since your last due date.", value: moneyC(q.interest) },
          ]}
          total={{ label: "Total", value: moneyC(q.total) }}
        />
        {deal.late && <Alert tone="warning">A payment is late. The payoff covers it, so it’s all caught up.</Alert>}
        <div className="space-y-2">
          <Button size="lg" onClick={() => setOpen(true)}>
            Pay {moneyC(q.total)}
          </Button>
          <p className="text-sm text-muted">Goes straight to {seller}. No fees. Then they release the lien.</p>
        </div>
      </Card>
      <PayModal
        open={open}
        onClose={() => setOpen(false)}
        title="Pay off the balance"
        amount={q.total}
        sellerName={seller}
        extraRows={[
          { label: "Remaining principal", value: moneyC(q.principal) },
          { label: "Interest to date", value: moneyC(q.interest) },
        ]}
        doneText={`You paid it all. Now ${seller} releases the lien.`}
        run={() => {
          if (demoFlags.get().payFails) {
            demoFlags.set({ payFails: false });
            throw new Error("Payment declined");
          }
          payOff(deal.id, q.total);
        }}
      />
      <AppLink className="text-sm font-medium text-primary hover:underline" to="/buyer/payments">
        Back to payments
      </AppLink>
    </div>
  );
}
