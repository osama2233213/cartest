import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Building2, CheckCircle2, Clock, Loader2, Lock } from "lucide-react";
import { Alert, AppLink, Button, ButtonLink, Card, Checkbox, Modal, NativeSelect, TextInput, useToast } from "@/components/kit";
import { Stepper } from "@/components/kit-extra";
import { IdentityFlow } from "@/components/app/IdentityFlow";
import { PasswordField } from "@/components/auth/PasswordField";
import { VERIFY_STEPS, nextVerifyStep, stateOf, type VerifyStep } from "@/lib/buyer-data";
import { auth, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

import { CONSENT_TEXT, CONSENT_VERSION, DEFAULT_PROFILE, profileFor, recordConsent, saveProfile, sellerSummary, softPull } from "@/lib/risk-profile";
export const Route = createFileRoute("/buyer/verification/$step")({
  head: () => ({ meta: [{ title: "Get verified · OwnerFi" }] }),
  component: VerificationPage,
});

const LABEL: Record<VerifyStep, string> = { identity: "Identity", bank: "Bank", credit: "Credit" };
const WHY = [
  ["Identity", "Lets you book test drives."],
  ["Bank", "Shows sellers you can make the payments."],
  ["Credit", "Lets you make offers. It’s a soft check and won’t hurt your score."],
] as const;

function Done({ tone, title, children, action }: { tone: "success" | "warning"; title: string; children?: ReactNode; action: ReactNode }) {
  const Icon = tone === "success" ? CheckCircle2 : Clock;
  return (
    <div role="status" className="flex flex-col items-center py-8 text-center">
      <span className={cn("flex h-14 w-14 items-center justify-center rounded-full", tone === "success" ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
        <Icon aria-hidden className="h-7 w-7" />
      </span>
      <h2 className="mt-4 font-sans text-xl font-semibold tracking-normal">{title}</h2>
      {children && <p className="mt-1 text-muted">{children}</p>}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">{action}</div>
    </div>
  );
}

/* ----------------------------------------------------------------- identity */

/** IdentityFlow owns every state (upload, checking, manual review, rejected, verified), so its 3 s timer keeps running. */
function Identity() {
  return <IdentityFlow next={{ label: "Link your bank", to: "/buyer/verification/bank" }} backTo={{ label: "Continue to bank", to: "/buyer/verification/bank" }} />;
}

/* --------------------------------------------------------------------- bank */

const BANKS = ["Chase", "Bank of America", "Wells Fargo", "Citi", "Capital One", "US Bank"];
const ACCOUNTS = [
  { last4: "4821", type: "Checking" },
  { last4: "9034", type: "Savings" },
];

function Bank() {
  const user = useCurrentUser()!;
  const st = stateOf(user, "bank");
  const [phase, setPhase] = useState<"pick" | "login" | "connecting" | "accounts" | "linking" | "linked">(st === "verified" ? "linked" : "pick");
  const [q, setQ] = useState("");
  const [bank, setBank] = useState("");
  const [err, setErr] = useState("");
  const [account, setAccount] = useState(ACCOUNTS[0]!.last4);
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [tried, setTried] = useState(false);
  const [last4, setLast4] = useState("");
  const next = <ButtonLink to="/buyer/verification/credit">Next: credit consent</ButtonLink>;

  if (st === "in_review") {
    return (
      <Done tone="warning" title="We’re checking your account" action={next}>
        Usually under a day. You can keep going in the meantime.
      </Done>
    );
  }
  if (phase === "linked" && st === "verified") {
    return (
      <Done
        tone="success"
        title={`Bank linked — ${last4 ? `${bank} •••• ${last4}` : "Chase •••• 4821"}`}
        action={
          <>
            {next}
            <Button variant="secondary" onClick={() => setPhase("pick")}>
              Change account
            </Button>
          </>
        }
      />
    );
  }
  if (phase === "connecting" || phase === "linking") {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center py-12 text-center">
        <Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary" />
        <h2 className="mt-4 font-sans text-xl font-semibold tracking-normal">{phase === "connecting" ? "Connecting…" : "Linking your account…"}</h2>
      </div>
    );
  }

  const shown = BANKS.filter((b) => b.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Card className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Lock aria-hidden className="h-4 w-4" /> Secure connection by Plaid (demo)
      </p>
      {phase === "pick" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-sans text-xl font-semibold tracking-normal">Link your bank</h2>
            <p className="mt-1 text-muted">This shows sellers you can cover the payments. We can only see balances and account details.</p>
          </div>
          <TextInput label="Find your bank" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="grid grid-cols-2 gap-3">
            {[...shown, "Other bank"].map((b) => (
              <li key={b}>
                <button
                  type="button"
                  onClick={() => {
                    setBank(b);
                    setErr("");
                    setPhase("login");
                    auth.setVerification(user.id, { bank: "in_progress" });
                  }}
                  className="flex h-full min-h-16 w-full items-center gap-3 rounded-xl border border-ink/15 bg-white p-3 text-left font-medium hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Building2 aria-hidden className="h-5 w-5 shrink-0 text-muted" />
                  {b}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {phase === "login" && (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (!username.trim() || !pw) return;
            if (pw === "fail") {
              setErr("That username or password didn’t work.");
              return;
            }
            setErr("");
            setPhase("connecting");
            window.setTimeout(() => setPhase("accounts"), 1200);
          }}
        >
          <h2 className="font-sans text-xl font-semibold tracking-normal">Sign in to {bank}</h2>
          <p className="text-muted">OwnerFi never sees your bank password.</p>
          {err && <Alert tone="danger" title="Couldn’t sign in">{err}</Alert>}
          <TextInput label="Username" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} error={tried && !username.trim() ? "Enter your username." : undefined} />
          <PasswordField label="Password" autoComplete="current-password" value={pw} onChange={setPw} error={tried && !pw ? "Enter your password." : undefined} />
          <p className="text-xs text-muted">Demo: use any username and password. Password “fail” shows an error.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="secondary" onClick={() => setPhase("pick")}>
              Back
            </Button>
            <Button type="submit">Continue</Button>
          </div>
        </form>
      )}
      {phase === "accounts" && (
        <div className="space-y-4">
          <h2 className="font-sans text-xl font-semibold tracking-normal">Choose the account for your payments</h2>
          <p className="text-muted">We can see account details, never move money without your OK. Account: {bank}.</p>
          <NativeSelect label="Account" value={account} onChange={(e) => setAccount(e.target.value)} options={ACCOUNTS.map((a) => ({ value: a.last4, label: `${a.type} •••• ${a.last4}` }))} />
          <Button
            onClick={() => {
              setPhase("linking");
              window.setTimeout(() => {
                setLast4(account);
                auth.setVerification(user.id, { bank: "verified" });
                setPhase("linked");
              }, 1200);
            }}
          >
            Link this account
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------- credit */

const dobFormat = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
};
const over18 = (v: string) => {
  const [m, d, y] = v.split("/").map(Number);
  const born = new Date(y!, m! - 1, d);
  return Date.now() - born.getTime() >= 18 * 365.25 * 86_400_000;
};

function Credit() {
  const user = useCurrentUser()!;
  const st = stateOf(user, "credit");
  const [phase, setPhase] = useState<"form" | "processing" | "rejected">("form");
  const [dob, setDob] = useState("");
  const [ssn, setSsn] = useState("");
  const [consent, setConsent] = useState(false);
  const [tried, setTried] = useState(false);
  const [info, setInfo] = useState(false);
  const e = {
    dob: /^\d{2}\/\d{2}\/\d{4}$/.test(dob) ? (over18(dob) ? "" : "You must be 18 or older.") : "Enter a date like 04/22/1990.",
    ssn: /^\d{4}$/.test(ssn) ? "" : "Enter the last 4 digits.",
  };

  if (st === "verified") {
    return (
      <Done tone="success" title="Credit check done" action={<ButtonLink to="/buyer/verification/done">See what sellers see</ButtonLink>}>
        It was a soft check, so your score isn’t affected.
      </Done>
    );
  }
  if (st === "in_review") {
    return (
      <Done tone="warning" title="We’re taking a closer look" action={<ButtonLink to="/buyer/account/verification">Back to account</ButtonLink>}>
        Usually under a day. We’ll email you when it’s done.
      </Done>
    );
  }
  if (phase === "processing") {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center py-12 text-center">
        <Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary" />
        <h2 className="mt-4 font-sans text-xl font-semibold tracking-normal">Running a soft check…</h2>
        <p className="mt-1 text-muted">Please stay on this page.</p>
      </div>
    );
  }
  return (
    <Card>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          setTried(true);
          if (e.dob || e.ssn || !consent) return;
          // The consent is saved with the wording version the buyer agreed to, before anything is pulled.
          recordConsent(user.id);
          setPhase("processing");
          window.setTimeout(() => {
            saveProfile(user.id, softPull(ssn));
            if (ssn === "0000") {
              auth.setVerification(user.id, { credit: "rejected" });
              setPhase("rejected");
            } else if (ssn === "1111") auth.setVerification(user.id, { credit: "in_review" });
            else auth.setVerification(user.id, { credit: "verified" });
          }, 1800);
        }}
      >
        <h2 className="font-sans text-xl font-semibold tracking-normal">Agree to a soft credit check</h2>
        <Alert tone="info" title="Soft check – won’t affect your score">
          Sellers only see a short summary, never your SSN or birthday.
        </Alert>
        {(phase === "rejected" || st === "rejected") && (
          <Alert tone="danger" title="We couldn’t match those details">
            Check the date of birth and last 4, then try again.
          </Alert>
        )}
        <TextInput label="Full legal name" value={user.name} readOnly />
        <TextInput label="Date of birth" inputMode="numeric" autoComplete="off" placeholder="MM/DD/YYYY" value={dob} onChange={(ev) => setDob(dobFormat(ev.target.value))} error={tried ? e.dob || undefined : undefined} />
        <TextInput label="Last 4 of your SSN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={ssn} onChange={(ev) => setSsn(ev.target.value.replace(/\D/g, ""))} error={tried ? e.ssn || undefined : undefined} />
        <Checkbox checked={consent} onChange={(ev) => setConsent(ev.target.checked)} label={CONSENT_TEXT} />
        <p className="-mt-2 text-xs text-muted">Consent version {CONSENT_VERSION}. We keep a record of what you agreed to.</p>
        <button type="button" onClick={() => setInfo(true)} className="text-sm font-medium text-primary hover:underline">
          What’s shared?
        </button>
        {tried && !consent && (
          <p role="alert" className="text-sm text-danger">
            Please agree to continue.
          </p>
        )}
        <p className="text-xs text-muted">Demo: last 4 “0000” fails, “1111” goes to review.</p>
        <Button type="submit" className="w-full sm:w-auto">
          Run soft check
        </Button>
      </form>
      <Modal open={info} onClose={() => setInfo(false)} title="What’s shared with sellers" footer={<Button onClick={() => setInfo(false)}>Got it</Button>}>
        <p className="text-muted">When you make an offer, the seller sees a short summary:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Your credit range</li>
          <li>How much of your credit you use</li>
          <li>Recent credit inquiries</li>
          <li>Missed payments</li>
          <li>Estimated debt-to-income</li>
        </ul>
        <p className="mt-3 text-muted">They never see your Social Security number, birthday or account numbers.</p>
      </Modal>
    </Card>
  );
}

function Finished() {
  const user = useCurrentUser();
  const summary = sellerSummary(user ? profileFor(user.id) : DEFAULT_PROFILE, {
    identity: user?.verification.identity === "verified",
    bank: user?.verification.bank === "verified",
  });
  return (
    <div className="space-y-6">
      <div role="status" className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 aria-hidden className="h-7 w-7" />
        </span>
        <h2 className="mt-4 font-sans text-xl font-semibold tracking-normal">You’re verified</h2>
        <p className="mt-1 text-muted">Sellers can now accept your offers.</p>
      </div>
      <section aria-labelledby="sellers-see">
        <h3 id="sellers-see" className="mb-2 font-sans text-lg font-semibold tracking-normal">
          What sellers see
        </h3>
        <Card>
          <ul className="space-y-2 text-sm">
            {summary.rows.map((r) => (
              <li key={r.label} className="flex justify-between">
                <span className="text-muted">{r.label}</span>
                <span className="font-medium">{r.value}</span>
              </li>
            ))}
          </ul>
        </Card>
        <p className="mt-2 text-sm text-muted">This is the summary a seller sees when you make an offer. They never see your SSN, birthday or account numbers.</p>
      </section>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="/cars">Browse cars</ButtonLink>
        <ButtonLink variant="secondary" to="/buyer/account/verification">
          View my account
        </ButtonLink>
      </div>
    </div>
  );
}

function VerificationPage() {
  const { step } = Route.useParams();
  const user = useCurrentUser();
  const toast = useToast();
  const target = user ? nextVerifyStep(user) : "identity";
  const idx = VERIFY_STEPS.indexOf(step as VerifyStep);
  const blocked =
    !!user &&
    ((idx >= 0 && VERIFY_STEPS.slice(0, idx).some((s) => !["verified", "in_review"].includes(stateOf(user, s)))) || (step === "done" && target !== "done"));

  useEffect(() => {
    if (blocked) toast({ tone: "info", title: "Finish this step first." });
  }, [blocked, toast]);

  if (!user) return null;
  if (idx < 0 && step !== "done") return <Navigate to="/buyer/verification/$step" params={{ step: target === "done" ? "done" : target }} replace />;
  if (blocked) return <Navigate to="/buyer/verification/$step" params={{ step: target === "done" ? "done" : target }} replace />;

  const steps = VERIFY_STEPS.map((s) => {
    const v = stateOf(user, s);
    return {
      id: s,
      label: LABEL[s],
      ...(v === "in_review" ? { description: "Reviewing" } : {}),
      state: (s === step ? "current" : v === "verified" || v === "in_review" ? "done" : "upcoming") as "current" | "done" | "upcoming",
    };
  });

  return (
    <div className="mx-auto max-w-4xl">
      <AppLink to="/buyer/account/verification" className="mb-4 inline-block text-sm font-medium text-primary hover:underline">
        Back to account
      </AppLink>
      <h1 className="text-[28px] font-bold leading-9">Get verified</h1>
      <p className="mb-6 mt-1 text-muted">Three quick steps so sellers can trust you. It takes about 5 minutes.</p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,36rem)_1fr]">
        <div className="space-y-6">
          {step !== "done" && <Stepper steps={steps} />}
          {step === "identity" && <Identity />}
          {step === "bank" && <Bank />}
          {step === "credit" && <Credit />}
          {step === "done" && <Finished />}
        </div>
        <aside className="hidden lg:block">
          <Card className="sticky top-6">
            <h2 className="font-sans text-lg font-semibold tracking-normal">Why we ask</h2>
            <dl className="mt-3 space-y-3">
              {WHY.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-medium">{k}</dt>
                  <dd className="text-sm text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
