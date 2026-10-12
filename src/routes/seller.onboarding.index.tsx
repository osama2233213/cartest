import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Alert, AppLink, Badge, Button, ButtonLink, Card, Modal, buttonClasses, useToast } from "@/components/kit";
import { ProgressRing } from "@/components/kit-extra";
import { VerifyCode } from "@/components/auth/VerifyCode";
import { StatusChip } from "@/components/status";
import { auth, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/onboarding/")({
  head: () => ({ meta: [{ title: "Get verified to sell · OwnerFi" }] }),
  component: Onboarding,
});

function Item({
  n,
  title,
  why,
  status,
  done,
  isNext,
  note,
  rejected,
  cta,
}: {
  n: number;
  title: string;
  why: string;
  status?: string | undefined;
  done: boolean;
  isNext: boolean;
  note?: string | undefined;
  rejected?: string | undefined;
  cta?: { label: string; to?: string; disabled?: boolean; onClick?: () => void } | undefined;
}) {
  let action: ReactNode = null;
  if (cta && !done) {
    action =
      cta.to && !cta.disabled ? (
        <AppLink to={cta.to} className={buttonClasses(isNext ? "primary" : "secondary", "md", false, "mt-3 w-full sm:w-auto")}>
          {cta.label}
        </AppLink>
      ) : (
        <Button className="mt-3 w-full sm:w-auto" variant={isNext ? "primary" : "secondary"} disabled={!!cta.disabled} {...(cta.onClick ? { onClick: cta.onClick } : {})}>
          {cta.label}
        </Button>
      );
  }
  return (
    <Card className={cn("p-5", isNext && "ring-2 ring-primary")}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            done ? "bg-primary text-white" : "bg-ink/10 text-muted",
          )}
        >
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-sans text-lg font-semibold tracking-normal">{title}</h2>
            {status && <StatusChip kind="verification" value={status} />}
            {isNext && <Badge tone="primary">Next</Badge>}
          </div>
          <p className="mt-1 text-muted">{why}</p>
          {rejected && <Alert tone="danger" className="mt-3">{rejected}</Alert>}
          {status === "in_review" && <p className="mt-2 text-sm text-muted">We’re checking this. Usually under a day.</p>}
          {note && <p className="mt-2 text-sm text-muted">{note}</p>}
          {action}
        </div>
      </div>
    </Card>
  );
}

function Onboarding() {
  const user = useCurrentUser();
  const toast = useToast();
  const [verify, setVerify] = useState(false);
  const [sent, setSent] = useState(false);
  if (!user) return null;
  const id = user.verification.identity;
  const pay = user.verification.payouts ?? "not_started";
  const email = user.emailVerified;
  const idDone = id === "verified";
  const payDone = pay === "verified";
  const idStarted = id === "in_review" || id === "verified";
  const count = [email, idDone, payDone].filter(Boolean).length;
  const all = email && idDone && payDone;
  const next = !email ? "email" : !idDone && !idStarted ? "identity" : payDone ? "car" : "payouts";
  const nextLabel = { email: "Verify your email", identity: "Verify your identity", payouts: "Set up payouts", car: "Add your first car" }[next];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-4">
        <ProgressRing value={(count / 4) * 100} label={`${count} of 4 steps done`}>
          {count}/4
        </ProgressRing>
        <div>
          <h1 className="text-[28px] font-bold leading-9">Get ready to sell</h1>
          <p className="text-muted">{all ? "All set." : `${count} of 4 done. Next: ${nextLabel.toLowerCase()}.`}</p>
        </div>
      </div>
      {all && (
        <Alert tone="success" title="You’re ready to sell." action={<ButtonLink size="sm" to="/seller/vehicles/new">Add your car</ButtonLink>}>
          Add your car and pick your terms.
        </Alert>
      )}
      <Item
        n={1}
        title="Verify your email"
        why="So we can send you updates about your car and your money."
        done={email}
        isNext={next === "email"}
        cta={{
          label: "Verify email",
          onClick: () => {
            auth.startEmailVerify(user.id);
            setSent(true);
            setVerify(true);
          },
        }}
      />
      <Item
        n={2}
        title="Verify your identity"
        why="Buyers trust sellers who are real. We check your ID once."
        status={id}
        done={idDone}
        isNext={next === "identity"}
        rejected={id === "rejected" ? "We couldn’t read your ID. The photo was too blurry." : undefined}
        cta={id === "in_review" ? undefined : { label: id === "rejected" ? "Try again" : id === "in_progress" ? "Continue" : "Start", to: "/seller/onboarding/identity" }}
      />
      <Item
        n={3}
        title="Set up payouts"
        why="OwnerFi never holds your money — payments go straight to this account."
        status={pay}
        done={payDone}
        isNext={next === "payouts"}
        note={idStarted ? undefined : "Finish identity first."}
        cta={{ label: "Set up payouts", to: "/seller/onboarding/payouts", disabled: !idStarted }}
      />
      <Item
        n={4}
        title="Add your first car"
        why="Tell us about your car, pick your price and your terms."
        done={false}
        isNext={next === "car"}
        note={all ? undefined : "You can start now. You’ll need steps 2 and 3 done to publish."}
        cta={{ label: "Add your car", to: "/seller/vehicles/new" }}
      />
      <Modal
        open={verify && sent}
        onClose={() => {
          auth.cancelPending();
          setVerify(false);
          setSent(false);
        }}
        title="Verify your email"
        size="sm"
      >
        <VerifyCode
          mode="verify"
          onVerified={() => {
            setVerify(false);
            setSent(false);
            toast({ tone: "success", title: "Email verified" });
          }}
        />
      </Modal>
    </div>
  );
}
