import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { useState } from "react";
import { CreditCard, Download, FileText, Landmark, Laptop, Smartphone } from "lucide-react";
import {
  Alert,
  AppLink,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  NativeSelect,
  Switch,
  TextInput,
  useToast,
} from "@/components/kit";
import { PasswordField } from "@/components/auth/PasswordField";
import { StatusChip } from "@/components/status";
import { DEFAULT_STATE_RULES } from "@/lib/finance";
import { issueLink, type DocRef } from "@/lib/doc-links";
import { cardBrand, cardError, usePaymentMethods } from "@/lib/payment-methods";
import { liveSettings } from "@/lib/live-settings";
import { shortCar } from "@/lib/format";
import { PREFS, setPref, usePrefStore, type Channel } from "@/lib/prefs";
import { AuthError, DEMO_CODE, auth, passwordRules, useCurrentUser, useSession, type SessionUser, type VerifyState } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useDemoStore } from "@/lib/demo-store";
import { useSyncExternalStore } from "react";

type Role = "seller" | "buyer";

export const ACCOUNT_SECTIONS: Record<Role | "admin", { path: string; label: string }[]> = {
  admin: [
    { path: "profile", label: "Profile" },
    { path: "security", label: "Security" },
  ],
  seller: [
    { path: "profile", label: "Profile" },
    { path: "security", label: "Security" },
    { path: "notifications", label: "Notifications" },
    { path: "verification", label: "Verification" },
    { path: "documents", label: "Documents" },
    { path: "payouts", label: "Payouts" },
    { path: "account", label: "Close account" },
  ],
  buyer: [
    { path: "profile", label: "Profile" },
    { path: "security", label: "Security" },
    { path: "notifications", label: "Notifications" },
    { path: "verification", label: "Verification" },
    { path: "documents", label: "Documents" },
    { path: "payment-methods", label: "Payment methods" },
    { path: "account", label: "Close account" },
  ],
};

/* --------------------------------------------------------- notification prefs */

function NotificationsSection({ user, role }: { user: SessionUser; role: Role }) {
  const store = usePrefStore();
  const [saved, setSaved] = useState("");
  const chans: { key: Channel; label: string }[] = [
    { key: "email", label: "Email" },
    { key: "sms", label: "Text" },
    { key: "push", label: "Push" },
  ];
  const set = (pref: string, ch: Channel, v: boolean, defaults: Record<Channel, boolean>) => {
    setPref(user.id, pref, ch, v, defaults);
    setSaved("Saved");
  };
  return (
    <Card className="p-5">
      <CardHeader title="How should we reach you?" description="Pick where each kind of update goes. Changes save as you go." />
      <p role="status" aria-live="polite" className="h-5 text-sm text-success">
        {saved}
      </p>
      <ul className="divide-y divide-ink/10">
        {PREFS[role === "seller" ? "seller" : "buyer"].map((p) => {
          const cur = store[user.id]?.[p.key] ?? p.defaults;
          return (
            <li key={p.key} className="py-4 md:grid md:grid-cols-[1fr_auto] md:items-center md:gap-6">
              <div>
                <p className="font-medium">{p.label}</p>
                <p className="text-sm text-muted">{p.hint}</p>
              </div>
              <div className="mt-3 flex flex-col gap-3 md:mt-0 md:flex-row md:gap-5">
                {chans.map((c) => {
                  const locked = p.locked && c.key === "email";
                  return (
                    <div key={c.key} className="flex flex-col items-stretch gap-1 text-sm">
                      <Switch
                        className="gap-3"
                        label={c.label}
                        checked={locked ? true : cur[c.key]}
                        disabled={!!locked}
                        onChange={(v) => set(p.key, c.key, v, p.defaults)}
                      />
                      {locked && <span className="text-muted">Always on, for your safety</span>}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* -------------------------------------------------------------------- profile */

const STATE_OPTIONS = DEFAULT_STATE_RULES.map((r) => ({ value: r.state, label: r.state === "other" ? "Another state" : r.state }));

function ProfileSection({ user }: { user: SessionUser }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone, state: user.state });
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const changed = JSON.stringify(form) !== JSON.stringify({ name: user.name, phone: user.phone, state: user.state });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const [confirm, setConfirm] = useState(false);

  const save = () => {
    try {
      auth.updateProfile(user.id, form);
      toast({ tone: "success", title: "Saved" });
      setConfirm(false);
    } catch (e) {
      setErrors({ name: e instanceof AuthError && e.message.includes("name") ? e.message : undefined, phone: e instanceof AuthError && e.message.includes("phone") ? e.message : undefined } as typeof errors);
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    if (form.name.trim().length < 2) err.name = "Enter your full name.";
    if (form.phone.replace(/\D/g, "").length < 10) err.phone = "Enter a 10-digit phone number.";
    setErrors(err);
    if (Object.keys(err).length) return;
    if (form.state !== user.state) setConfirm(true);
    else save();
  };
  // The rules the admin set (the built-in ones until they change anything).
  const rules = liveSettings().stateRules;
  const ruleOf = (s: string) => rules.find((r) => r.state === s) ?? rules.find((r) => r.state === "other") ?? DEFAULT_STATE_RULES[5]!;
  const cap = ruleOf(form.state);

  return (
    <form onSubmit={submit} noValidate>
      <Card className="space-y-5 p-5">
        <CardHeader title="Your details" description="This is what buyers and sellers see on your profile." />
        <div className="flex items-center gap-4">
          <Avatar name={form.name || user.name} size="lg" />
          <p className="text-sm text-muted">Your initials show until you add a photo.</p>
        </div>
        <TextInput label="Full name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
        <TextInput
          label="Email"
          value={user.email}
          readOnly
          helper={user.emailVerified ? "Verified. To change it, contact support." : "Not verified yet. Check the Verification tab."}
        />
        <TextInput label="Phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} helper="We’ll text you a code to confirm a new number." />
        <NativeSelect label="State" options={STATE_OPTIONS} value={form.state} onChange={(e) => set("state", e.target.value)} />
        <div className="sticky bottom-20 -mx-5 -mb-5 flex justify-end gap-2 rounded-b-2xl border-t border-ink/10 bg-white px-5 py-3 lg:static lg:bottom-auto">
          <Button type="button" variant="secondary" disabled={!changed} onClick={() => { setForm({ name: user.name, phone: user.phone, state: user.state }); setErrors({}); }}>
            Cancel
          </Button>
          <Button type="submit" disabled={!changed}>
            Save changes
          </Button>
        </div>
      </Card>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        size="sm"
        title="Change your state?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Keep {user.state}
            </Button>
            <Button onClick={save}>Change state</Button>
          </>
        }
      >
        <p className="text-muted">
          {user.role === "seller"
            ? `The most interest you can charge changes from ${ruleOf(user.state).max_apr}% to ${cap.max_apr}%, and you can sell ${cap.annual_sale_limit} cars a year. Listings you already posted keep their terms until you edit them.`
            : `The most interest a seller can charge changes from ${ruleOf(user.state).max_apr}% to ${cap.max_apr}%, and sellers in ${form.state === "other" ? "that state" : form.state} can sell ${cap.annual_sale_limit} cars a year. The cars and rates you see will change. Deals you already have keep their terms.`}
        </p>
      </Modal>
    </form>
  );
}

/* ------------------------------------------------------------------- security */

function SecuritySection({ user }: { user: SessionUser }) {
  const toast = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  // Real sign-in history: every login (and failed attempt) is recorded when it happens.
  const session = useSession();
  const history = session.logins.filter((l) => l.userId === user.id).slice(0, 8).map((l) => ({ ...l, at: new Date(l.at) }));
  const sessions = history.filter((l) => l.ok && !session.revokedLogins.includes(l.id)).slice(0, 3).map((h, i) => ({ ...h, current: i === 0 }));

  const change = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!passwordRules(next).valid) return setErr("Your new password needs to meet every rule below.");
    if (next !== confirm) return setErr("Passwords don’t match.");
    try {
      auth.changePassword(user.id, cur, next);
      setCur("");
      setNext("");
      setConfirm("");
      toast({ tone: "success", title: "Password changed" });
    } catch (x) {
      setErr(x instanceof AuthError ? x.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <CardHeader title="Change your password" />
        <form onSubmit={change} noValidate className="space-y-4">
          {err && <Alert tone="danger">{err}</Alert>}
          <PasswordField label="Current password" autoComplete="current-password" value={cur} onChange={setCur} />
          <PasswordField label="New password" autoComplete="new-password" showRules value={next} onChange={setNext} />
          <PasswordField label="Confirm new password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
          <Button type="submit">Update password</Button>
        </form>
      </Card>
      <Card className="p-5">
        <CardHeader title="2-step login" description="We text you a code when you log in." />
        <Switch
          label="Ask for a code when I log in"
          description={user.role === "admin" ? "Required for admin accounts." : undefined}
          checked={user.twoFactor}
          disabled={user.role === "admin"}
          onChange={(v) => {
            try {
              auth.setTwoFactor(user.id, v);
              toast({ tone: "success", title: v ? "2-step login is on" : "2-step login is off" });
            } catch (e) {
              toast({ tone: "danger", title: e instanceof Error ? e.message : "Couldn’t change that." });
            }
          }}
        />
      </Card>
      <Card className="p-5">
        <CardHeader
          title="Where you’re logged in"
          action={
            sessions.length > 1 ? (
              <Button variant="secondary" size="sm" onClick={() => auth.revokeLogins(sessions.filter((s) => !s.current).map((s) => s.id))}>
                Log out everywhere else
              </Button>
            ) : undefined
          }
        />
        <ul className="divide-y divide-ink/10">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0">
              {s.device.includes("iPhone") || s.device.includes("iPad") ? <Smartphone aria-hidden className="h-5 w-5 text-muted" /> : <Laptop aria-hidden className="h-5 w-5 text-muted" />}
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {s.device} {s.current && <Badge tone="success">This device</Badge>}
                </p>
                <p className="text-sm text-muted">
                  {s.place} · {format(s.at, "MMM d, h:mm a")}
                </p>
              </div>
              {!s.current && (
                <Button variant="ghost" size="sm" onClick={() => auth.revokeLogins([s.id])}>
                  Log out
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <CardHeader title="Recent logins" />
        <ul className="divide-y divide-ink/10">
          {history.map((h, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <span>
                <span className="block font-medium">{h.device}</span>
                <span className="block text-sm text-muted">
                  {h.place} · {format(h.at, "MMM d, h:mm a")}
                </span>
              </span>
              <Badge tone={h.ok ? "success" : "danger"}>{h.ok ? "Success" : "Blocked"}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------- verification & docs */

type HubItem = {
  key: "email" | "phone" | "identity" | "bank" | "credit" | "payouts";
  label: string;
  state: VerifyState;
  /** What a finished check lets the person do. */
  unlocks: string;
  /** Why it was rejected, shown with the retry button. */
  reason: string;
  /** Where the button goes. Email and phone open a code box instead. */
  to?: string;
};

function hubItems(user: SessionUser, role: Role): HubItem[] {
  const v = user.verification;
  const email: HubItem = { key: "email", label: "Email", state: user.emailVerified ? "verified" : "not_started", unlocks: "Account notices and password resets.", reason: "That code didn’t match." };
  const phone: HubItem = { key: "phone", label: "Phone", state: v.phone ?? "not_started", unlocks: "Text alerts for payments and test drives.", reason: "That code didn’t match. Ask for a new one." };
  if (role === "seller") {
    return [
      email,
      phone,
      { key: "identity", label: "Identity", state: v.identity, unlocks: "Lets you list cars.", reason: "The photo was too blurry or didn’t match. Upload clear photos.", to: "/seller/onboarding/identity" },
      { key: "payouts", label: "Payouts", state: v.payouts ?? "not_started", unlocks: "Lets you get paid.", reason: "We couldn’t link that account. Check the details.", to: "/seller/onboarding/payouts" },
    ];
  }
  return [
    email,
    phone,
    { key: "identity", label: "Identity", state: v.identity, unlocks: "Lets you book test drives.", reason: "The photo was too blurry or didn’t match. Upload clear photos.", to: "/buyer/verification/identity" },
    { key: "bank", label: "Bank account", state: v.bank ?? "not_started", unlocks: "Shows sellers you can make the payments.", reason: "We couldn’t sign in to that bank. Try again.", to: "/buyer/verification/bank" },
    { key: "credit", label: "Credit consent", state: v.credit ?? "not_started", unlocks: "Lets you make offers. It’s a soft check and won’t hurt your score.", reason: "We couldn’t match those details. Check the date of birth and last 4.", to: "/buyer/verification/credit" },
  ];
}

const CTA: Record<VerifyState, string> = { not_started: "Start", in_progress: "Continue", in_review: "See status", verified: "", rejected: "Try again" };

/** One-time code box for the email and phone cards. The demo code is 123456; anything else is rejected. */
function CodeModal({ item, userId, onClose }: { item: HubItem; userId: string; onClose: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (code !== DEMO_CODE) {
      if (item.key === "phone") auth.setVerification(userId, { phone: "rejected" });
      setErr("That code didn’t match. The demo code is 123456.");
      return;
    }
    if (item.key === "email") auth.verifyEmail(userId);
    else auth.setVerification(userId, { phone: "verified" });
    toast({ tone: "success", title: `${item.label} verified` });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Verify your ${item.label.toLowerCase()}`}
      description={`We sent a 6-digit code to your ${item.label.toLowerCase()}. Demo code: ${DEMO_CODE}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Verify</Button>
        </>
      }
    >
      <TextInput label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setErr(""); }} error={err || undefined} />
    </Modal>
  );
}

function VerificationSection({ user, role }: { user: SessionUser; role: Role }) {
  const [open, setOpen] = useState<HubItem | null>(null);
  const items = hubItems(user, role);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-sans text-lg font-semibold tracking-normal">What we’ve checked</h2>
        <p className="text-sm text-muted">Others see a badge, never your documents.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key}>
            <Card className="flex h-full flex-col gap-3 p-5" data-testid={`verify-${i.key}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-sans text-base font-semibold tracking-normal">{i.label}</h3>
                <StatusChip kind="verification" value={i.state} />
              </div>
              <p className="text-sm text-muted">{i.unlocks}</p>
              {i.state === "rejected" && (
                <Alert tone="danger" title="Couldn’t verify">
                  {i.reason}
                </Alert>
              )}
              {i.state === "in_review" && <p className="text-sm text-muted">A person is taking a look. Usually under a day.</p>}
              {i.state !== "verified" &&
                (i.to ? (
                  <ButtonLink to={i.to} variant={i.state === "rejected" ? "primary" : "secondary"} className="mt-auto self-start">
                    {CTA[i.state]}
                  </ButtonLink>
                ) : (
                  <Button variant={i.state === "rejected" ? "primary" : "secondary"} className="mt-auto self-start" onClick={() => setOpen(i)}>
                    {i.state === "not_started" ? "Send code" : CTA[i.state]}
                  </Button>
                ))}
            </Card>
          </li>
        ))}
      </ul>
      {open && <CodeModal item={open} userId={user.id} onClose={() => setOpen(null)} />}
    </div>
  );
}

function DocumentsSection({ user, role }: { user: SessionUser; role: Role }) {
  const toast = useToast();
  const { deals } = useDemoStore();
  const session = useSession();
  const idOf = (name: string) => session.users.find((u) => u.name === name)?.id ?? `u-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const docs: (DocRef & { group: string })[] = [];
  if (user.verification.identity === "verified") {
    docs.push(
      { group: "Identity", id: `id-front-${user.id}`, kind: "identity", owners: [user.id], title: "Driver’s licence (front)", detail: "Used to check who you are" },
      { group: "Identity", id: `id-back-${user.id}`, kind: "identity", owners: [user.id], title: "Driver’s licence (back)", detail: "Used to check who you are" },
    );
  }
  for (const d of deals.filter((x) => (role === "seller" ? x.seller : x.buyer) === user.name && ["contract", "down_payment", "closing", "active", "paid_off"].includes(x.stage))) {
    const owners = [idOf(d.seller), idOf(d.buyer)];
    docs.push(
      { group: "Contracts", id: `contract-${d.id}`, kind: "contract", owners, title: `Financing agreement — ${d.car}`, detail: "Signed by both of you" },
      { group: "Contracts", id: `bill-${d.id}`, kind: "bill_of_sale", owners, title: `Bill of sale — ${d.car}`, detail: "Signed by both of you" },
    );
  }
  if (docs.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<FileText aria-hidden className="h-6 w-6" />}
          title="Nothing here yet"
          description="Documents show up as you verify and sign."
          action={<ButtonLink to={`/${role}/account/verification`}>Go to verification</ButtonLink>}
        />
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      {["Identity", "Contracts"].map((g) => {
        const rows = docs.filter((d) => d.group === g);
        if (!rows.length) return null;
        return (
          <Card key={g} className="p-5">
            <h2 className="font-sans text-lg font-semibold tracking-normal">{g}</h2>
            <ul className="mt-2 divide-y divide-ink/10">
              {rows.map((r) => (
                <li key={r.title} className="flex items-center gap-3 py-3">
                  <FileText aria-hidden className="h-5 w-5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-sm text-muted">{r.detail}</p>
                  </div>
                  <Button variant="ghost" size="sm" aria-label={`Open ${r.title}`} leftIcon={<Download aria-hidden className="h-4 w-4" />} onClick={() => {
                    try {
                      // A private link that works for a few minutes, only for you.
                      const { token } = issueLink(r, user.id);
                      window.open(`/docs/${token}`, "_blank", "noopener");
                      toast({ tone: "info", title: "Opening your document", description: "The link works for 5 minutes and only for you." });
                    } catch (e) {
                      toast({ tone: "danger", title: e instanceof Error ? e.message : "Couldn’t open it." });
                    }
                  }}>
                    <span className="hidden sm:inline">Open</span>
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

const BANK_NAMES = ["Chase checking", "Bank of America checking", "Wells Fargo checking", "Citi checking", "Capital One checking", "US Bank checking"];

/** The buyer's payment methods: see them, add a bank or card, pick the default, remove one. */
function PaymentMethodsSection({ user }: { user: SessionUser }) {
  const toast = useToast();
  const { deals } = useDemoStore();
  const pm = usePaymentMethods(user.id, user.verification.bank === "verified");
  const [adding, setAdding] = useState<"card" | "bank" | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [card, setCard] = useState({ number: "", expiry: "", name: user.name });
  const [bank, setBank] = useState({ name: BANK_NAMES[0]!, last4: "" });
  const [tried, setTried] = useState(false);
  const hasLoan = deals.some((d) => d.buyer === user.name && d.stage === "active");
  const cardErr = cardError(card.number, card.expiry);
  const bankErr = /^\d{4}$/.test(bank.last4) ? "" : "Enter the last 4 digits of the account.";
  const close = () => {
    setAdding(null);
    setTried(false);
    setCard({ number: "", expiry: "", name: user.name });
    setBank({ name: BANK_NAMES[0]!, last4: "" });
  };
  const removeBlocked = (id: string) => (hasLoan && pm.methods.length === 1 && pm.methods[0]!.id === id ? "You have a loan in progress, so keep at least one way to pay. Add another method first." : "");

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <CardHeader title="Your payment methods" description="Monthly payments come out of your default method. OwnerFi charges buyers no fees." />
        {pm.methods.length === 0 ? (
          <EmptyState icon={<CreditCard aria-hidden className="h-6 w-6" />} title="No payment method yet" description="Add a bank or a card so you can pay for a car monthly." />
        ) : (
          <ul className="divide-y divide-ink/10">
            {pm.methods.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                {m.kind === "bank" ? <Landmark aria-hidden className="h-5 w-5 text-muted" /> : <CreditCard aria-hidden className="h-5 w-5 text-muted" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {m.name} <span className="num">{m.kind === "bank" ? "••" : "••••"} {m.last4}</span> {m.isDefault && <Badge tone="primary">Default</Badge>}
                  </p>
                  <p className="text-sm text-muted">{m.kind === "bank" ? "Bank account" : "Card"}</p>
                </div>
                {!m.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => { pm.makeDefault(m.id); toast({ tone: "success", title: `${m.name} is now your default` }); }}>
                    Make default
                  </Button>
                )}
                <Button variant="ghost" size="sm" aria-label={`Remove ${m.name} ${m.last4}`} onClick={() => setRemoving(m.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setAdding("bank")}>Add a bank account</Button>
          <Button variant="secondary" onClick={() => setAdding("card")}>Add a card</Button>
        </div>
      </Card>

      <Modal
        open={adding === "card"}
        onClose={close}
        size="sm"
        title="Add a card"
        description="Demo: use 4242 4242 4242 4242 with any future date. We only keep the last 4 digits."
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button
              onClick={() => {
                setTried(true);
                if (cardErr.number || cardErr.expiry) return;
                const digits = card.number.replace(/\D/g, "");
                pm.add({ kind: "card", name: cardBrand(digits), last4: digits.slice(-4) });
                toast({ tone: "success", title: "Card added" });
                close();
              }}
            >
              Add card
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput label="Card number" inputMode="numeric" autoComplete="off" placeholder="1234 5678 9012 3456" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, "").slice(0, 23) })} error={tried ? cardErr.number : undefined} />
          <TextInput label="Expiry" inputMode="numeric" autoComplete="off" placeholder="MM/YY" maxLength={5} value={card.expiry} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setCard({ ...card, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }); }} error={tried ? cardErr.expiry : undefined} />
        </div>
      </Modal>

      <Modal
        open={adding === "bank"}
        onClose={close}
        size="sm"
        title="Add a bank account"
        description="Demo: this links a pretend account. We only keep the last 4 digits."
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button
              onClick={() => {
                setTried(true);
                if (bankErr) return;
                pm.add({ kind: "bank", name: bank.name, last4: bank.last4 });
                toast({ tone: "success", title: "Bank account added" });
                close();
              }}
            >
              Add bank
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <NativeSelect label="Bank" value={bank.name} onChange={(e) => setBank({ ...bank, name: e.target.value })} options={BANK_NAMES.map((b) => ({ value: b, label: b }))} />
          <TextInput label="Last 4 digits of the account" inputMode="numeric" autoComplete="off" maxLength={4} value={bank.last4} onChange={(e) => setBank({ ...bank, last4: e.target.value.replace(/\D/g, "") })} error={tried ? bankErr || undefined : undefined} />
        </div>
      </Modal>

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        size="sm"
        title="Remove this payment method?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button variant="danger" disabled={!!removing && !!removeBlocked(removing)} onClick={() => { if (removing) pm.remove(removing); setRemoving(null); toast({ tone: "success", title: "Removed" }); }}>
              Remove
            </Button>
          </>
        }
      >
        {removing && removeBlocked(removing) ? <Alert tone="warning">{removeBlocked(removing)}</Alert> : <p className="text-muted">You can add it again any time. Payments already made aren’t affected.</p>}
      </Modal>
    </div>
  );
}

function MoneySection({ user, role }: { user: SessionUser; role: Role }) {
  const toast = useToast();
  const ok = role === "seller" ? user.verification.payouts === "verified" : user.verification.bank === "verified";
  if (!ok) {
    return (
      <Card>
        <EmptyState
          icon={<Landmark aria-hidden className="h-6 w-6" />}
          title={role === "seller" ? "No payout account yet" : "No payment method yet"}
          description={
            role === "seller"
              ? "Add a bank account so buyers’ payments land straight with you. OwnerFi never holds your money."
              : "Link your bank so you can pay for a car monthly."
          }
          action={<ButtonLink to={role === "seller" ? "/seller/onboarding/payouts" : "/buyer/verification"}>{role === "seller" ? "Set up payouts" : "Link your bank"}</ButtonLink>}
        />
      </Card>
    );
  }
  return (
    <Card className="space-y-4 p-5">
      <CardHeader
        title={role === "seller" ? "Payouts" : "Bank accounts"}
        description={role === "seller" ? "Payments go straight to your bank. OwnerFi never holds your money." : "Payments come out of the account you choose."}
        action={<Badge tone={role === "seller" ? "success" : "primary"}>{role === "seller" ? "Connected" : "Default"}</Badge>}
      />
      <p className="flex items-center gap-3 rounded-xl bg-surface p-4">
        <Landmark aria-hidden className="h-5 w-5 text-muted" />
        <span>
          Chase <span className="num font-medium">•••• 4821</span>
        </span>
      </p>
      {role === "seller" ? (
        <>
          <p className="text-sm text-muted">Payouts are automatic, every business day.</p>
          <p className="text-sm text-muted">OwnerFi’s 10% fee comes out of your down payment. Monthly payments are all yours.</p>
          <Button variant="secondary" onClick={() => toast({ tone: "info", title: "Demo: payout details can be updated here." })}>
            Update payout details
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted">Autopay is off.</p>
      )}
    </Card>
  );
}

function CloseSection({ user, role }: { user: SessionUser; role: Role }) {
  const { deals } = useDemoStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const blockers = deals.filter((d) => (role === "seller" ? d.seller : d.buyer) === user.name && !["declined", "cancelled", "paid_off"].includes(d.stage));
  const notes = blockers.filter((d) => ["active", "defaulted"].includes(d.stage));
  return (
    <Card className="border border-danger/30 p-5">
      <CardHeader title="Close your account" description="This takes your account offline. You can reopen it by logging in again." />
      {blockers.length > 0 && (
        <div className="mb-4 space-y-3" data-testid="close-blocked">
          <Alert tone="warning" title="You can’t close your account yet">
            You have {blockers.length} {blockers.length === 1 ? "deal" : "deals"} in progress
            {notes.length > 0 ? `, including ${notes.length} active ${notes.length === 1 ? "note" : "notes"}` : ""}. Finish or cancel {blockers.length === 1 ? "it" : "them"} first.{" "}
            {blockers.map((b, i) => (
              <span key={b.id}>
                {i > 0 && ", "}
                <AppLink to={`/deals/${b.id}?as=${role}`} className="font-medium text-primary underline">
                  Open {shortCar(b.car)}
                </AppLink>
              </span>
            ))}
          </Alert>
          {notes.length > 0 && (
            <div className="rounded-xl bg-surface p-4 text-sm">
              <p className="font-semibold">What happens to an active note</p>
              <p className="mt-1 text-muted">
                {role === "seller"
                  ? "An active note is a loan you made to a buyer. Closing your account wouldn’t end it. The buyer’s payments would still be due to you and you’d still hold the lien on the title, so we keep the account open until the note is paid off and you release the lien."
                  : "An active note is your loan with a seller. Closing your account wouldn’t cancel it or wipe what you owe. Payments would still be due and the seller would keep the lien on the title, so we keep the account open until the note is paid off."}
              </p>
              <p className="mt-2 text-muted">{role === "seller" ? "Deals that haven’t reached the loan stage can be cancelled from the deal." : "You can pay a note off early from Payments. Deals that haven’t reached the loan stage can be cancelled from the deal."}</p>
            </div>
          )}
        </div>
      )}
      <Button variant="danger" disabled={blockers.length > 0} onClick={() => setOpen(true)}>
        Close my account
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setTyped("");
        }}
        size="sm"
        title="Close your account?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button
              variant="danger"
              disabled={typed !== "CLOSE"}
              onClick={() => {
                auth.closeAccount(user.id);
                navigate({ to: "/" });
                toast({ tone: "success", title: "Your account is closed.", description: "Log in again any time to reopen it." });
              }}
            >
              Close my account
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1 pl-5 text-muted">
          {role === "seller" && <li>Your listed cars are taken down.</li>}
          <li>You’ll be signed out everywhere.</li>
          <li>You can log back in any time to reopen your account.</li>
        </ul>
        <TextInput className="mt-4" label="Type CLOSE to confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </Modal>
    </Card>
  );
}

/* ----------------------------------------------------------------------- page */

export function AccountPage({ role: viewRole, section }: { role: Role | "admin"; section: string }) {
  const role = (viewRole === "admin" ? "seller" : viewRole) as Role;
  const user = useCurrentUser();
  const nav = ACCOUNT_SECTIONS[viewRole];
  if (!user) return null;
  const attention = viewRole !== "admin" && (user.verification.identity !== "verified" || (role === "seller" ? user.verification.payouts !== "verified" : user.verification.bank !== "verified"));
  return (
    <div>
      <h1 className="text-[28px] font-bold leading-9">Account</h1>
      <div className="mt-4 lg:mt-6 lg:flex lg:gap-8">
        <nav
          aria-label="Account sections"
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-ink/10 px-4 lg:mx-0 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:px-0"
        >
          {nav.map((n) => {
            const on = n.path === section;
            return (
              <AppLink
                key={n.path}
                to={`/${viewRole}/account/${n.path}`}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium lg:rounded-xl lg:py-2.5",
                  on ? "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary lg:bg-primary/10 lg:after:hidden" : "text-muted hover:text-ink lg:hover:bg-ink/5",
                )}
              >
                {n.label}
                {n.path === "verification" && attention && <span className="h-2 w-2 rounded-full bg-warning" aria-label="Needs attention" />}
              </AppLink>
            );
          })}
        </nav>
        <div className="mt-6 min-w-0 flex-1 lg:mt-0 lg:max-w-2xl">
          {section === "profile" && <ProfileSection key={user.id} user={user} />}
          {section === "security" && <SecuritySection user={user} />}
          {section === "notifications" && <NotificationsSection user={user} role={role} />}
          {section === "verification" && <VerificationSection user={user} role={role} />}
          {section === "documents" && <DocumentsSection user={user} role={role} />}
          {section === "payouts" && <MoneySection user={user} role={role} />}
          {section === "payment-methods" && (role === "seller" ? <MoneySection user={user} role={role} /> : <PaymentMethodsSection user={user} />)}
          {section === "account" && <CloseSection user={user} role={role} />}
        </div>
      </div>
    </div>
  );
}
