import { DEMO_MS, demoMs } from "@/lib/demo-latency";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Lock } from "lucide-react";
import { AppLink, Button, ButtonLink, Card, TextInput, useToast } from "@/components/kit";
import { auth, useCurrentUser } from "@/lib/session";

export const Route = createFileRoute("/seller/onboarding/payouts")({
  head: () => ({ meta: [{ title: "Set up payouts · OwnerFi" }] }),
  component: Payouts,
});

type Step = "type" | "bank" | "review" | "connecting" | "done";

function Payouts() {
  const user = useCurrentUser();
  const toast = useToast();
  const [step, setStep] = useState<Step>("type");
  const [holder, setHolder] = useState(user?.name ?? "");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [err, setErr] = useState<{ routing?: string; account?: string; holder?: string }>({});
  const [last4, setLast4] = useState("");
  if (!user) return null;
  const id = user.verification.identity;
  if (id === "not_started" || id === "rejected" || id === "in_progress") {
    toast({ tone: "info", title: "Verify your identity first." });
    return <Navigate to="/seller/onboarding" replace />;
  }

  const validate = () => {
    const e: typeof err = {};
    if (holder.trim().length < 2) e.holder = "Enter the name on the account.";
    if (!/^\d{9}$/.test(routing)) e.routing = "A routing number has 9 digits.";
    if (!/^\d{4,17}$/.test(account)) e.account = "Enter the account number (4 to 17 digits).";
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const connect = () => {
    setStep("connecting");
    window.setTimeout(() => {
      setLast4(account.slice(-4));
      auth.setVerification(user.id, { payouts: "verified" });
      setStep("done");
    }, demoMs(DEMO_MS.linkBank));
  };

  return (
    <div className="mx-auto max-w-xl">
      <AppLink to="/seller/onboarding" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to checklist
      </AppLink>
      <h1 className="text-[28px] font-bold leading-9">Set up payouts</h1>
      <p className="mb-6 mt-1 text-muted">OwnerFi never holds your money — payments go straight to this account.</p>
      <Card className="p-5">
        <p className="mb-4 flex items-center gap-2 text-sm text-muted">
          <Lock aria-hidden className="h-4 w-4" /> Secure form · Powered by Stripe (demo)
        </p>
        {step === "type" && (
          <div className="space-y-5">
            <div role="radiogroup" aria-label="Account type" className="grid gap-2">
              <button type="button" role="radio" aria-checked className="rounded-xl border border-primary bg-primary/10 p-3 text-left">
                <span className="block font-semibold">Individual</span>
                <span className="block text-sm text-muted">You’re selling your own car.</span>
              </button>
              <button type="button" role="radio" aria-checked={false} disabled className="rounded-xl border border-ink/15 p-3 text-left opacity-50">
                <span className="block font-semibold">Company</span>
                <span className="block text-sm text-muted">Not available in the beta.</span>
              </button>
            </div>
            <Button onClick={() => setStep("bank")}>Continue</Button>
          </div>
        )}
        {step === "bank" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (validate()) setStep("review");
            }}
          >
            <TextInput label="Name on the account" value={holder} error={err.holder} onChange={(e) => setHolder(e.target.value)} />
            <TextInput label="Routing number" inputMode="numeric" maxLength={9} value={routing} error={err.routing} helper="Demo: any 9 digits work." onChange={(e) => setRouting(e.target.value.replace(/\D/g, ""))} />
            <TextInput label="Account number" inputMode="numeric" maxLength={17} value={account} error={err.account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))} />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setStep("type")}>
                Cancel
              </Button>
              <Button type="submit">Continue</Button>
            </div>
          </form>
        )}
        {step === "review" && (
          <div className="space-y-4">
            <dl className="divide-y divide-ink/10 rounded-xl bg-surface px-4">
              {[
                ["Account type", "Individual"],
                ["Name", holder],
                ["Routing number", routing],
                ["Account number", `•••• ${account.slice(-4)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setStep("bank")}>
                Edit
              </Button>
              <Button onClick={connect}>Connect account</Button>
            </div>
          </div>
        )}
        {step === "connecting" && (
          <div role="status" aria-live="polite" className="flex flex-col items-center py-10 text-center">
            <Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary" />
            <p className="mt-4 font-semibold">Connecting your account…</p>
          </div>
        )}
        {step === "done" && (
          <div role="status" className="flex flex-col items-center py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 aria-hidden className="h-7 w-7" />
            </span>
            <h2 className="mt-4 font-sans text-xl font-semibold tracking-normal">Payouts connected</h2>
            <p className="mt-1 text-muted">
              Account <span className="num">•••• {last4}</span> is ready to get paid.
            </p>
            <ButtonLink className="mt-6" to="/seller/onboarding">
              Back to checklist
            </ButtonLink>
          </div>
        )}
      </Card>
    </div>
  );
}
