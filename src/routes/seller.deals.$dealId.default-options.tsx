import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Alert, Button, Card, EmptyState, Modal, PageHeader, useToast } from "@/components/kit";
import { uidOf, useDemoStore } from "@/lib/demo-store";
import { notify } from "@/lib/notify";
import { useCurrentUser } from "@/lib/session";

export const Route = createFileRoute("/seller/deals/$dealId/default-options")({
  head: () => ({ meta: [{ title: "Your options · OwnerFi" }] }),
  component: DefaultOptions,
});

function DefaultOptions() {
  const { dealId } = Route.useParams();
  const user = useCurrentUser();
  const toast = useToast();
  const { getDeal } = useDemoStore();
  const [grace, setGrace] = useState(false);
  const [days, setDays] = useState(7);
  const deal = getDeal(dealId);
  if (!deal || deal.seller !== user?.name) {
    return <EmptyState headingLevel={1} title="We can’t find that deal" description="It may have been removed, or it isn’t yours." />;
  }
  const defaulted = deal.stage === "defaulted";
  const buyer = deal.buyer.split(" ")[0] ?? "The buyer";
  const behind = 12;

  const options = [
    {
      title: "Give a payment plan",
      text: `Give ${buyer} more time to catch up. We tell them.`,
      label: "Offer more time",
      run: () => setGrace(true),
    },
    {
      title: "Send a final notice",
      text: `We email ${buyer} that the payment is overdue.`,
      label: "Send a final notice",
      run: () => {
        notify(uidOf(deal.buyer), "late_payment", { title: "Final notice: your payment is overdue", body: `${deal.seller.split(" ")[0]} asked us to remind you.`, href: "/buyer/payments", tag: "late" });
        toast({ tone: "success", title: "Notice sent." });
      },
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Your options" description={`${deal.car} · ${buyer}`} />
      {defaulted ? (
        <Alert tone="danger" title="The deal is marked as defaulted.">
          The car is still titled to you. These options are for reading only.
        </Alert>
      ) : (
        <Alert tone="danger" title={`${buyer} is ${behind} days behind.`}>
          Here’s what you can do. Nothing happens unless you choose it.
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {options.map((o) => (
          <Card key={o.title} className="space-y-3">
            <h2 className="font-sans font-semibold tracking-normal">{o.title}</h2>
            <p className="text-muted">{o.text}</p>
            <Button variant="secondary" disabled={defaulted} onClick={o.run}>
              {o.label}
            </Button>
          </Card>
        ))}
        <Card className="space-y-3">
          <h2 className="font-sans font-semibold tracking-normal">Talk to OwnerFi support</h2>
          <p className="text-muted">We look at the payment history with you and suggest the next step.</p>
          <Button disabled={defaulted} onClick={() => toast({ tone: "info", title: "Demo: support opens a ticket." })}>
            Talk to support
          </Button>
        </Card>
        <Card className="space-y-2">
          <h2 className="font-sans font-semibold tracking-normal">What the law allows in {user?.state ?? "your state"}</h2>
          <p className="text-muted">Rules are different in every state. This isn’t legal advice. OwnerFi support can point you to the right steps.</p>
        </Card>
      </div>
      <Modal
        open={grace}
        onClose={() => setGrace(false)}
        title="Give more time"
        description={`${buyer} gets extra days before anything else happens.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setGrace(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setGrace(false);
                toast({ tone: "success", title: `${buyer} has ${days} more days.` });
              }}
            >
              Give {days} more days
            </Button>
          </>
        }
      >
        <div role="radiogroup" aria-label="Extra days" className="flex gap-2">
          {[3, 7, 14].map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              onClick={() => setDays(d)}
              className={`h-10 rounded-full border px-4 text-sm font-semibold ${days === d ? "border-primary bg-primary text-white" : "border-ink/15"}`}
            >
              {d} days
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
