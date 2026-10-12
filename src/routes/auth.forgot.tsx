import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail } from "lucide-react";
import { Alert, AppLink, Button, TextInput, useCountdown, useToast } from "@/components/kit";
import { auth } from "@/lib/session";

export const Route = createFileRoute("/auth/forgot")({
  head: () => ({ meta: [{ title: "Forgot password · OwnerFi" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { remaining, restart } = useCountdown(30);
  const toast = useToast();

  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email, like name@mail.com.");
      return;
    }
    setError("");
    auth.requestReset(email);
    if (sent) toast({ tone: "success", title: "Link sent again" });
    setSent(true);
    restart();
  };

  if (sent) {
    return (
      <div className="space-y-5 p-5 md:p-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail aria-hidden className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-[28px] font-bold leading-9">Check your email</h1>
          <p className="mt-1 text-muted">
            If an account exists for <span className="font-medium text-ink">{email}</span>, we’ve sent a link to reset
            your password.
          </p>
        </div>
        <AppLink
          to={`/demo/inbox?to=${encodeURIComponent(email)}`}
          className="block text-sm font-medium text-primary hover:underline"
        >
          Open the email (demo)
        </AppLink>
        <Button variant="secondary" fullWidth disabled={remaining > 0} onClick={() => send()}>
          {remaining > 0 ? `Send again in ${remaining}s` : "Send again"}
        </Button>
        <AppLink to="/auth/login" className="block text-center text-sm font-medium text-primary hover:underline">
          Back to log in
        </AppLink>
      </div>
    );
  }

  return (
    <form onSubmit={send} noValidate className="space-y-4 p-5 md:p-8">
      <div>
        <h1 className="text-[28px] font-bold leading-9">Forgot your password?</h1>
        <p className="mt-1 text-muted">Enter your email and we’ll send you a link to choose a new one.</p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <TextInput
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" fullWidth size="lg">
        Send reset link
      </Button>
      <AppLink to="/auth/login" className="block text-center text-sm font-medium text-primary hover:underline">
        Back to log in
      </AppLink>
    </form>
  );
}
