import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Search } from "lucide-react";
import { Alert, AppLink, Button, Checkbox, NativeSelect, TextInput } from "@/components/kit";
import { PasswordField } from "@/components/auth/PasswordField";
import { VerifyCode } from "@/components/auth/VerifyCode";
import { DEFAULT_STATE_RULES } from "@/lib/finance";
import { AuthError, afterLogin, auth, passwordRules, portalHome, useCurrentUser, useSessionReady } from "@/lib/session";
import type { Role } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth/signup")({
  validateSearch: (s: Record<string, unknown>): { role?: "seller" | "buyer" | undefined } =>
    s["role"] === "seller" || s["role"] === "buyer" ? { role: s["role"] } : {},
  head: () => ({ meta: [{ title: "Create your account · OwnerFi" }] }),
  component: SignupPage,
});

type RoleChoice = "seller" | "buyer";

const ROLES = [
  { value: "seller" as const, icon: KeyRound, title: "I want to sell my car", body: "List it, pick a buyer, get paid monthly." },
  { value: "buyer" as const, icon: Search, title: "I want to buy a car", body: "Find a car you can pay for monthly." },
];

function RolePicker({ value, onChange }: { value?: RoleChoice | undefined; onChange: (r: RoleChoice) => void }) {
  return (
    <div role="radiogroup" aria-label="What brings you to OwnerFi?" className="grid gap-3">
      {ROLES.map(({ value: v, icon: Icon, title, body }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors",
            value === v ? "border-primary bg-primary/10" : "border-ink/15 hover:border-ink/30",
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon aria-hidden className="h-6 w-6" />
          </span>
          <span>
            <span className="block font-semibold">{title}</span>
            <span className="block text-sm text-muted">{body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

type Values = { name: string; email: string; phone: string; state: string; password: string; terms: boolean };
type Errors = Partial<Record<keyof Values, string>>;

const EMPTY: Values = { name: "", email: "", phone: "", state: "AZ", password: "", terms: false };

function validate(v: Values): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = "Enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Enter a valid email, like name@mail.com.";
  if (v.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit phone number.";
  if (!passwordRules(v.password).valid) e.password = "Your password needs to meet every rule below.";
  if (!v.terms) e.terms = "Please accept the terms to continue.";
  return e;
}

function SignupForm({
  role,
  values,
  onChange,
  onBack,
  onSent,
}: {
  role: RoleChoice;
  values: Values;
  onChange: (v: Values) => void;
  onBack: () => void;
  onSent: () => void;
}) {
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const set = <K extends keyof Values>(k: K, v: Values[K]) => onChange({ ...values, [k]: v });
  const touch = (k: keyof Values) => setErrors((e) => ({ ...e, [k]: validate(values)[k] }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFormError("");
    try {
      auth.signup({ role, ...values });
      onSent();
    } catch (err) {
      if (err instanceof AuthError && err.code === "email_taken") {
        setErrors((x) => ({ ...x, email: "You already have an account with this email." }));
      } else {
        setFormError(err instanceof AuthError ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <h1 className="text-[28px] font-bold leading-9">Create your account</h1>
        <p className="mt-1 text-muted">
          {role === "seller" ? "Sell your car on monthly payments." : "Find a car you can pay for monthly."}{" "}
          <button type="button" onClick={onBack} className="font-medium text-primary hover:underline">
            Change
          </button>
        </p>
      </div>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <TextInput
        label="Full name"
        required
        autoComplete="name"
        value={values.name}
        error={errors.name}
        onChange={(e) => set("name", e.target.value)}
        onBlur={() => touch("name")}
      />
      <div>
        <TextInput
          label="Email"
          required
          type="email"
          inputMode="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(e) => set("email", e.target.value)}
          onBlur={() => touch("email")}
        />
        {errors.email?.startsWith("You already") && (
          <p className="mt-1 text-sm">
            <AppLink to="/auth/login" className="font-medium text-primary hover:underline">
              Log in
            </AppLink>
          </p>
        )}
      </div>
      <TextInput
        label="Phone"
        required
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={values.phone}
        error={errors.phone}
        onChange={(e) => set("phone", e.target.value)}
        onBlur={() => touch("phone")}
      />
      <NativeSelect
        label="State"
        value={values.state}
        onChange={(e) => set("state", e.target.value)}
        options={DEFAULT_STATE_RULES.map((r) => ({ value: r.state, label: r.state === "other" ? "Another state" : r.state }))}
      />
      <PasswordField
        label="Password"
        autoComplete="new-password"
        showRules
        value={values.password}
        error={errors.password}
        onChange={(v) => set("password", v)}
        onBlur={() => touch("password")}
      />
      <div>
        <Checkbox
          checked={values.terms}
          onChange={(e) => set("terms", e.target.checked)}
          label="I agree to the Terms and Privacy Policy"
        />
        {errors.terms && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {errors.terms}
          </p>
        )}
      </div>
      <Button type="submit" fullWidth size="lg" loading={busy}>
        Create account
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <AppLink to="/auth/login" className="font-medium text-primary hover:underline">
          Log in
        </AppLink>
      </p>
    </form>
  );
}

function SignupPage() {
  const { role: roleParam } = Route.useSearch();
  const navigate = useNavigate();
  const current = useCurrentUser();
  const [role, setRole] = useState<RoleChoice | undefined>(roleParam);
  const [step, setStep] = useState<"role" | "form" | "otp">(roleParam ? "form" : "role");
  const [values, setValues] = useState<Values>(EMPTY);
  const ready = useSessionReady();
  // Someone who just finished signing up is "current" too; only bounce people who were already in.
  const [alreadyIn, setAlreadyIn] = useState<Role | null | undefined>(undefined);
  useEffect(() => {
    if (ready) setAlreadyIn((prev) => (prev === undefined ? (current?.role ?? null) : prev));
  }, [ready, current]);

  if (alreadyIn === undefined) return <div className="p-5 md:p-8" aria-busy="true" />;
  if (alreadyIn) return <Navigate to={portalHome(alreadyIn) as never} replace />;

  return (
    <div className="p-5 md:p-8">
      {step === "role" && (
        <div className="space-y-5">
          <div>
            <h1 className="text-[28px] font-bold leading-9">Welcome to OwnerFi</h1>
            <p className="mt-1 text-muted">What brings you here?</p>
          </div>
          <RolePicker value={role} onChange={setRole} />
          <Button fullWidth size="lg" disabled={!role} onClick={() => setStep("form")}>
            Continue
          </Button>
          {!role && <p className="text-center text-sm text-muted">Pick one to continue. You can’t change it later.</p>}
        </div>
      )}
      {step === "form" && role && (
        <SignupForm role={role} values={values} onChange={setValues} onBack={() => setStep("role")} onSent={() => setStep("otp")} />
      )}
      {step === "otp" && (
        <VerifyCode
          mode="signup"
          onChangeTarget={() => {
            auth.cancelPending();
            setStep("form");
          }}
          onVerified={(r) => navigate({ to: afterLogin(r.role, { isNew: r.isNew }) as never, replace: true })}
        />
      )}
    </div>
  );
}
