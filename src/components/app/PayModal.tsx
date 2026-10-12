import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AppLink, Breakdown, Button, Modal } from "@/components/kit";
import { moneyC } from "@/lib/format";
import { methodLabel, usePaymentMethods } from "@/lib/payment-methods";
import { useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

/** Pay with one of the buyer's saved methods (their default unless they pick another). `run` does the work and throws if it fails. */
export function PayModal({
  open,
  onClose,
  title,
  amount,
  sellerName,
  run,
  doneText,
  extraRows = [],
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  amount: number; // cents
  sellerName: string;
  run: () => void | Promise<void>;
  doneText: string;
  extraRows?: { label: string; value: string }[];
}) {
  const user = useCurrentUser();
  const pm = usePaymentMethods(user?.id, user?.verification.bank === "verified");
  const [picked, setPicked] = useState("");
  const chosen = pm.methods.find((m) => m.id === picked) ?? pm.default;
  const [phase, setPhase] = useState<"idle" | "processing" | "done" | "failed">("idle");
  const close = () => {
    onClose();
    setPhase("idle");
  };
  const pay = async () => {
    setPhase("processing");
    try {
      await Promise.all([Promise.resolve(run()), new Promise((r) => setTimeout(r, 1500))]);
      setPhase("done");
    } catch {
      setPhase("failed");
    }
  };
  return (
    <Modal
      open={open}
      onClose={phase === "processing" ? () => undefined : close}
      title={title}
      footer={
        phase === "done" ? (
          <Button onClick={close}>Done</Button>
        ) : phase === "processing" ? undefined : (
          <>
            <Button variant="secondary" onClick={close}>
              Not now
            </Button>
            <Button disabled={!chosen} onClick={() => void pay()}>{phase === "failed" ? "Try again" : `Pay ${moneyC(amount)}`}</Button>
          </>
        )
      }
    >
      {phase === "processing" ? (
        <div role="status" aria-live="polite" className="flex flex-col items-center py-8 text-center">
          <Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 font-semibold">Processing your payment…</p>
        </div>
      ) : phase === "done" ? (
        <Alert tone="success" title="Payment received. Thank you.">
          {doneText}
        </Alert>
      ) : (
        <div className="space-y-4">
          {phase === "failed" && (
            <Alert tone="danger" title="The payment didn’t go through.">
              You weren’t charged.
            </Alert>
          )}
          <Breakdown
            rows={[
              ...extraRows,
              { label: "Payment", value: moneyC(amount) },
              { label: `Goes to ${sellerName}`, value: moneyC(amount) },
              { label: "OwnerFi fees", value: "$0" },
            ]}
          />
          {pm.methods.length === 0 ? (
            <Alert tone="warning" title="No payment method yet">
              Add a bank or card first.{" "}
              <AppLink to="/buyer/account/payment-methods" className="font-semibold text-primary underline">
                Add one
              </AppLink>
            </Alert>
          ) : (
            <div role="radiogroup" aria-label="Pay with" className="grid gap-2">
              {pm.methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen?.id === m.id}
                  onClick={() => setPicked(m.id)}
                  className={cn("rounded-xl border p-3 text-left font-medium", chosen?.id === m.id ? "border-primary bg-primary/10" : "border-ink/15 hover:border-ink/30")}
                >
                  {methodLabel(m)}
                  {m.isDefault && <span className="ml-2 text-xs font-normal text-muted">Default</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
