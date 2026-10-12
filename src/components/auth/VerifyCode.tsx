import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Alert, Button, OtpInput, useCountdown, useToast } from "@/components/kit";
import { AuthError, DEMO_CODE, auth, maskEmail, maskPhone, useSession, type SessionUser } from "@/lib/session";
import type { Role } from "@/lib/demo-data";

type Verified = { role: Role; isNew: boolean };

export function VerifyCode({
  mode,
  onVerified,
  onChangeTarget,
}: {
  mode: "signup" | "verify" | "2fa";
  onVerified: (r: Verified) => void;
  onChangeTarget?: () => void;
}) {
  const { pending } = useSession();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { remaining, restart } = useCountdown(30);
  const lockLeft = pending?.lockedUntil ? Math.max(0, Math.ceil((pending.lockedUntil - now) / 1000)) : 0;

  useEffect(() => {
    if (!pending?.lockedUntil || pending.lockedUntil <= Date.now()) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [pending?.lockedUntil]);

  const target = pending ? (mode === "2fa" ? maskPhone(pending.phone) : maskEmail(pending.email)) : "";

  const submit = async (value: string) => {
    setBusy(true);
    setError("");
    try {
      const r = auth.verifyOtp(value);
      if (r.ok) {
        setDone(true);
        window.setTimeout(() => onVerified({ role: r.role, isNew: r.isNew }), 600);
        return;
      }
      setNow(Date.now());
      setCode("");
      if (r.reason === "expired") setExpired(true);
      else if (r.reason === "locked") setError("Too many tries.");
      else setError(`That code isn’t right. ${r.triesLeft} ${r.triesLeft === 1 ? "try" : "tries"} left.`);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = () => {
    try {
      auth.resendOtp();
      restart();
      setExpired(false);
      setError("");
      setCode("");
      toast({ tone: "success", title: "New code sent" });
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Couldn’t send a new code. Please try again.");
    }
  };

  if (done) {
    return (
      <div role="status" className="flex flex-col items-center py-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <Check aria-hidden className="h-7 w-7" />
        </span>
        <p className="mt-3 font-semibold">Verified</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold leading-9">{mode === "2fa" ? "Two-step check" : "Check your inbox"}</h1>
        <p className="mt-1 text-muted">
          {mode === "2fa" ? "We texted a 6-digit code to" : "We sent a 6-digit code to"}{" "}
          <span className="font-medium text-ink">{target}</span>.
        </p>
      </div>
      {expired ? (
        <Alert tone="warning" title="That code has expired">
          Codes only last 10 minutes. Send a new one to carry on.
        </Alert>
      ) : (
        <OtpInput value={code} onChange={setCode} onComplete={submit} error={!!error} disabled={busy || lockLeft > 0} />
      )}
      {lockLeft > 0 ? (
        <p role="alert" className="text-sm text-danger">
          Too many tries. Try again in {lockLeft}s.
        </p>
      ) : (
        error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )
      )}
      <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
        Demo code: <span className="num ml-1 font-semibold">{DEMO_CODE}</span>
        <a href="/demo/inbox" target="_blank" rel="noreferrer" className="ml-2 font-medium underline">
          Open the demo inbox
        </a>
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {expired ? (
          <Button onClick={resend}>Send a new code</Button>
        ) : (
          <Button variant="ghost" size="sm" disabled={remaining > 0} onClick={resend}>
            {remaining > 0 ? `Send a new code in ${remaining}s` : "Send a new code"}
          </Button>
        )}
        {onChangeTarget && (mode === "signup" || mode === "verify") && (
          <button type="button" onClick={onChangeTarget} className="font-medium text-primary hover:underline">
            Change email
          </button>
        )}
      </div>
    </div>
  );
}

export type { SessionUser };
