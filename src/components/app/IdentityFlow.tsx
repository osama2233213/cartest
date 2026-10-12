import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, UploadCloud } from "lucide-react";
import { Alert, Button, ButtonLink, Card } from "@/components/kit";
import { StatusChip } from "@/components/status";
import { IDENTITY_APPROVE_MS, identityOutcome, loadOutcome, saveOutcome } from "@/lib/identity-check";
import { auth, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

function Slot({ label, file, onFile }: { label: string; file?: string | undefined; onFile: (n: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          file ? "border-success/40 bg-success/5" : "border-ink/20 bg-white hover:bg-ink/5",
        )}
      >
        {file ? <CheckCircle2 aria-hidden className="h-6 w-6 text-success" /> : <UploadCloud aria-hidden className="h-6 w-6 text-primary" />}
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-muted">{file ?? "JPG or PNG, up to 10 MB"}</span>
      </button>
      <input
        ref={ref}
        type="file"
        hidden
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f.name);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** ID check for sellers and buyers. The demo approves a few seconds after you submit. */
export function IdentityFlow({
  next,
  backTo,
}: {
  next: { label: string; to: string };
  backTo: { label: string; to: string };
}) {
  const user = useCurrentUser();
  const status = user?.verification.identity ?? "not_started";
  const [front, setFront] = useState<string>();
  const [back, setBack] = useState<string>();
  const [selfie, setSelfie] = useState<string>();
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (!user || status !== "in_review") return;
    const outcome = loadOutcome(user.id);
    if (outcome === "review") return; // stays in the manual queue until a person decides
    const t = window.setTimeout(
      () => auth.setVerification(user.id, { identity: outcome === "rejected" ? "rejected" : "verified" }),
      IDENTITY_APPROVE_MS,
    );
    return () => window.clearTimeout(t);
  }, [status, user]);

  if (!user) return null;

  if (status === "verified") {
    return (
      <Card className="flex flex-col items-center py-8 text-center" role="status">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 aria-hidden className="h-7 w-7" />
        </span>
        <h2 className="mt-4 font-sans text-xl font-semibold tracking-normal">Identity verified</h2>
        <p className="mt-1 text-muted">Thanks. You only do this once.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink to={next.to}>{next.label}</ButtonLink>
          <ButtonLink variant="secondary" to={backTo.to}>
            {backTo.label}
          </ButtonLink>
        </div>
      </Card>
    );
  }

  if (status === "in_review" && loadOutcome(user.id) === "review") {
    return (
      <Card className="flex flex-col items-center py-10 text-center" role="status" aria-live="polite">
        <Clock aria-hidden className="h-7 w-7 text-primary" />
        <h2 className="mt-4 font-sans text-xl font-semibold tracking-normal">A person is checking your ID</h2>
        <p className="mt-1 text-muted">Some IDs need a second look. It’s usually done within a day, and we’ll tell you as soon as it is.</p>
        <div className="mt-3">
          <StatusChip kind="verification" value="in_review" />
        </div>
        <ButtonLink className="mt-5" variant="secondary" to={backTo.to}>
          {backTo.label}
        </ButtonLink>
      </Card>
    );
  }

  if (status === "in_review") {
    return (
      <Card className="flex flex-col items-center py-10 text-center" role="status" aria-live="polite">
        <Loader2 aria-hidden className="h-7 w-7 animate-spin text-primary" />
        <h2 className="mt-4 font-sans text-xl font-semibold tracking-normal">We’re checking your ID</h2>
        <p className="mt-1 text-muted">This takes a few seconds in the demo. In real life it’s usually under a day.</p>
        <div className="mt-3">
          <StatusChip kind="verification" value="in_review" />
        </div>
      </Card>
    );
  }

  const ready = !!front && !!back && !!selfie && consent;
  return (
    <Card className="space-y-4 p-5">
      {status === "rejected" && <Alert tone="danger" title="We couldn’t verify your ID.">The photo was too blurry or didn’t match. Upload clear photos and try again.</Alert>}
      <p className="rounded-xl bg-surface px-3 py-2 text-xs text-muted">Demo: a file name with “reject” fails the check, “review” sends it to a person, anything else passes after a few seconds.</p>
      <Slot label="Front of your driver’s licence" file={front} onFile={setFront} />
      <Slot label="Back of your driver’s licence" file={back} onFile={setBack} />
      <Slot label="A selfie" file={selfie} onFile={setSelfie} />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-[rgb(var(--c-primary))]" />
        <span>I agree OwnerFi can check my ID with our verification partner. We don’t share it with buyers or sellers.</span>
      </label>
      <Button
        disabled={!ready}
        fullWidth
        onClick={() => {
          saveOutcome(user.id, identityOutcome([front, back, selfie]));
          auth.setVerification(user.id, { identity: "in_review" });
        }}
      >
        Submit for checking
      </Button>
    </Card>
  );
}
