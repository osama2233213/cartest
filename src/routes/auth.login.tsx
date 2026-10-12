import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Alert, AppLink, Button, Checkbox, TextInput } from "@/components/kit";
import { PasswordField } from "@/components/auth/PasswordField";
import { AuthError, afterLogin, auth, useCurrentUser, useSessionReady } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string | undefined } =>
    typeof s["next"] === "string" ? { next: s["next"] } : {},
  head: () => ({ meta: [{ title: "Log in · OwnerFi" }] }),
  component: LoginPage,
});

const DEMO = [
  { name: "Maria Alvarez", role: "Seller", email: "seller@demo.com" },
  { name: "Daniel Park", role: "Buyer", email: "buyer@demo.com" },
  { name: "Dana Lee", role: "Buyer + Seller", email: "both@demo.com" },
  { name: "Sam Rivera", role: "Admin · 2-step", email: "admin@demo.com" },
];

function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
      >
        Demo accounts
        <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="space-y-1 px-2 pb-2">
          {DEMO.map((d) => (
            <li key={d.email}>
              <button
                type="button"
                onClick={() => onPick(d.email, "Demo1234!")}
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-ink/5"
              >
                <span>
                  <span className="block text-sm font-medium">{d.name}</span>
                  <span className="block text-sm text-muted">{d.email}</span>
                </span>
                <span className="text-sm text-muted">{d.role}</span>
              </button>
            </li>
          ))}
          <li className="px-2 pt-1 text-sm text-muted">Tap one to fill the form. Then press Log in.</li>
        </ul>
      )}
    </div>
  );
}

function LoginPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const current = useCurrentUser();
  const ready = useSessionReady();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (ready && current) return <Navigate to={afterLogin(current.role, { next }) as never} replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = auth.login(email, password);
      const search = next ? { next } : undefined;
      if (r.status === "ok") navigate({ to: afterLogin(r.role, { next }) as never, replace: true });
      else if (r.status === "needs_otp") navigate({ to: "/auth/verify", search: search as never });
      else if (r.status === "needs_2fa") navigate({ to: "/auth/2fa", search: search as never });
      else navigate({ to: "/auth/suspended", replace: true });
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-5 md:p-8">
      <div>
        <h1 className="text-[28px] font-bold leading-9">Log in</h1>
        <p className="mt-1 text-muted">Welcome back.</p>
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
      <PasswordField label="Password" autoComplete="current-password" value={password} onChange={setPassword} />
      <div className="flex items-center justify-between gap-3">
        <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} label="Remember me" />
        <AppLink to="/auth/forgot" className="text-sm font-medium text-primary hover:underline">
          Forgot password?
        </AppLink>
      </div>
      <Button type="submit" fullWidth size="lg" loading={busy}>
        Log in
      </Button>
      <DemoAccounts
        onPick={(e, p) => {
          setEmail(e);
          setPassword(p);
          setError("");
        }}
      />
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <AppLink to="/auth/signup" className="font-medium text-primary hover:underline">
          Create an account
        </AppLink>
      </p>
    </form>
  );
}
