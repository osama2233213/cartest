import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Link2Off } from "lucide-react";
import { Alert, AppLink, Button, ButtonLink, EmptyState, Skeleton } from "@/components/kit";
import { PasswordField } from "@/components/auth/PasswordField";
import { AuthError, auth, passwordRules } from "@/lib/session";

export const Route = createFileRoute("/auth/reset/$token")({
  head: () => ({ meta: [{ title: "Choose a new password · OwnerFi" }] }),
  component: ResetPage,
});

function ResetPage() {
  const { token } = Route.useParams();
  const [status, setStatus] = useState<"loading" | "valid" | "expired" | "invalid">("loading");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Reset links live in browser storage, so check after mount.
  useEffect(() => {
    setStatus(auth.checkResetToken(token));
  }, [token]);

  if (status === "loading") {
    return (
      <div className="space-y-3 p-5 md:p-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (status !== "valid") {
    return (
      <EmptyState
        headingLevel={1}
        icon={<Link2Off aria-hidden className="h-6 w-6" />}
        title={status === "expired" ? "This link has expired" : "This link doesn’t work"}
        description="Reset links only work once, for a short time. Ask for a new one and we’ll email it right away."
        action={<ButtonLink to="/auth/forgot">Request a new link</ButtonLink>}
      />
    );
  }

  if (done) {
    return (
      <EmptyState
        headingLevel={1}
        icon={<CheckCircle2 aria-hidden className="h-6 w-6" />}
        title="Password updated"
        description="You can log in with your new password now."
        action={<ButtonLink to="/auth/login">Log in</ButtonLink>}
      />
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordRules(pw).valid) return setError("Your password needs to meet every rule below.");
    if (pw !== confirm) return setError("Passwords don’t match.");
    setBusy(true);
    setError("");
    try {
      auth.resetPassword(token, pw);
      setDone(true);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-5 md:p-8">
      <div>
        <h1 className="text-[28px] font-bold leading-9">Choose a new password</h1>
        <p className="mt-1 text-muted">Pick something you don’t use anywhere else.</p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <PasswordField label="New password" autoComplete="new-password" showRules value={pw} onChange={setPw} />
      <PasswordField
        label="Confirm password"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        error={confirm && pw !== confirm ? "Passwords don’t match." : undefined}
      />
      <Button type="submit" fullWidth size="lg" loading={busy}>
        Update password
      </Button>
      <AppLink to="/auth/login" className="block text-center text-sm font-medium text-primary hover:underline">
        Back to log in
      </AppLink>
    </form>
  );
}
