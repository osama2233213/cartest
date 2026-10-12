/**
 * Client-side demo session: users, passwords, one-time codes, password-reset links and the
 * "demo inbox" that every email/SMS lands in. Persisted to localStorage. Nothing is really sent.
 *
 * Demo accounts (password Demo1234!, one-time code 123456):
 *   seller@demo.com (Maria), buyer@demo.com (Daniel), admin@demo.com (Sam, 2-step login)
 */
import { useSyncExternalStore } from "react";
import type { Role } from "./demo-data";
import { clearDue, dueDecisions } from "./identity-check";
import { hashOf, type SyncSource } from "./shared-sync";

export const DEMO_PASSWORD = "Demo1234!";
export const DEMO_CODE = "123456";
const KEY = "ownerfi-poc-session-v2";
const OTP_TRIES = 3;
const OTP_LOCK_MS = 30_000;
const OTP_TTL_MS = 10 * 60_000;
const RESET_TTL_MS = 60 * 60_000;

export type VerifyState = "not_started" | "in_progress" | "in_review" | "verified" | "rejected";

export type SessionUser = {
  id: string;
  /** The role this person is using right now. */
  role: Role;
  /** Every role the account holds. Missing means just `role`. */
  roles?: Role[] | undefined;
  /** Set when the person closed their account. Logging in again clears it. */
  closedAt?: string | undefined;
  name: string;
  email: string;
  phone: string;
  state: string;
  createdAt: string;
  status: "active" | "suspended";
  emailVerified: boolean;
  twoFactor: boolean;
  verification: { identity: VerifyState; payouts?: VerifyState; bank?: VerifyState; credit?: VerifyState; phone?: VerifyState };
};

export type Mail = {
  id: string;
  to: string;
  kind: "email" | "sms";
  subject?: string;
  body: string;
  tag: "otp" | "reset" | "test_drive" | "contract" | "receipt" | "late" | "other";
  at: string;
};

type Pending = {
  userId: string;
  email: string;
  phone: string;
  purpose: "signup" | "verify" | "2fa";
  sentAt: number;
  attempts: number;
  lockedUntil?: number;
};

/** One sign-in attempt on an account. Failed ones show as "Blocked". */
export type LoginEvent = { id: string; userId: string; at: string; device: string; place: string; ok: boolean };

type State = {
  users: SessionUser[];
  /** Sign-in history, newest first. */
  logins: LoginEvent[];
  /** Sign-ins the person ended from Security ("Log out" on another device). */
  revokedLogins: string[];
  passwords: Record<string, string>;
  pending: Pending | null;
  resetTokens: Record<string, { email: string; expiresAt: number }>;
  mailbox: Mail[];
  currentUserId: string | null;
  /** Demo toolbar switches that later flows (payments, requests, due dates) read. */
  demo: { payFails: boolean; reqFails: boolean; monthsAhead: number; daysAhead: number };
  /** False until the saved session has been read from storage (never true on the server). */
  ready: boolean;
};

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export const PERSONA_IDS: Record<Role, string> = {
  seller: "u-maria",
  buyer: "u-daniel",
  admin: "u-sam",
};

function seed(): State {
  return {
    users: [
      {
        id: "u-maria",
        role: "seller",
        name: "Maria Alvarez",
        email: "seller@demo.com",
        phone: "(602) 555-0142",
        state: "AZ",
        createdAt: ago(120),
        status: "active",
        emailVerified: true,
        twoFactor: false,
        verification: { identity: "verified", payouts: "verified", phone: "verified" },
      },
      {
        id: "u-daniel",
        role: "buyer",
        name: "Daniel Park",
        email: "buyer@demo.com",
        phone: "(480) 555-0177",
        state: "AZ",
        createdAt: ago(90),
        status: "active",
        emailVerified: true,
        twoFactor: false,
        verification: { identity: "verified", bank: "verified", credit: "verified", phone: "verified" },
      },
      {
        id: "u-dana",
        role: "buyer",
        roles: ["buyer", "seller"],
        name: "Dana Lee",
        email: "both@demo.com",
        phone: "(480) 555-0166",
        state: "AZ",
        createdAt: ago(60),
        status: "active",
        emailVerified: true,
        twoFactor: false,
        verification: { identity: "verified", bank: "verified", credit: "verified", payouts: "verified", phone: "verified" },
      },
      {
        id: "u-sam",
        role: "admin",
        name: "Sam Rivera",
        email: "admin@demo.com",
        phone: "(602) 555-0100",
        state: "AZ",
        createdAt: ago(200),
        status: "active",
        emailVerified: true,
        twoFactor: true,
        verification: { identity: "verified" },
      },
    ],
    // A little earlier history for the demo people, so Security isn't empty the first time you look.
    logins: ["u-maria", "u-daniel", "u-dana", "u-sam"].flatMap((userId) => [
      { id: `l-${userId}-1`, userId, at: new Date(Date.now() - 31 * 3_600_000).toISOString(), device: "Safari on iPhone", place: "Tempe, AZ", ok: true },
      { id: `l-${userId}-2`, userId, at: new Date(Date.now() - 62 * 3_600_000).toISOString(), device: "Chrome on Windows", place: "Austin, TX", ok: true },
      { id: `l-${userId}-3`, userId, at: new Date(Date.now() - 93 * 3_600_000).toISOString(), device: "Safari on iPad", place: "Miami, FL", ok: false },
    ]),
    revokedLogins: [],
    passwords: {},
    pending: null,
    resetTokens: {},
    mailbox: [],
    currentUserId: null,
    demo: { payFails: false, reqFails: false, monthsAhead: 0, daysAhead: 0 },
    ready: false,
  };
}

let state: State = seed();
let hydrated = false;
const listeners = new Set<() => void>();
const norm = (e: string) => e.trim().toLowerCase();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  persist();
  emit();
}

/**
 * Finishes ID checks whose time is up: approved, or rejected for a file name with "reject". It runs in the background,
 * so a seller who submits their ID and goes on to add a car still ends up verified. A "review" check waits for a person.
 */
export function resolveIdentityChecks() {
  for (const { userId, outcome } of dueDecisions()) {
    const u = state.users.find((x) => x.id === userId);
    clearDue(userId);
    if (u && u.verification.identity === "in_review") {
      set({ users: state.users.map((x) => (x.id === userId ? { ...x, verification: { ...x.verification, identity: outcome === "rejected" ? "rejected" : "verified" } } : x)) });
    }
  }
}

let identityTicker = 0;

/** Load the saved session after the first client render (keeps SSR and hydration identical). */
export function hydrateSession() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (parsed && Array.isArray(parsed.users)) {
        state = { ...seed(), ...parsed };
        // Sessions saved before phone checks existed: the demo people count as verified, everyone else starts fresh.
        const DEMO_IDS = new Set(["u-maria", "u-daniel", "u-sam"]);
        state = {
          ...state,
          users: state.users.map((u) =>
            u.verification.phone === undefined ? { ...u, verification: { ...u.verification, phone: DEMO_IDS.has(u.id) ? "verified" : "not_started" } } : u,
          ),
        };
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  state = { ...state, ready: true };
  emit();
  // Pick up any ID check that came due while the page was closed, then keep watching.
  resolveIdentityChecks();
  if (!identityTicker) identityTicker = window.setInterval(resolveIdentityChecks, 1000);
}

export function resetSession() {
  state = { ...seed(), ready: true };
  persist();
  emit();
  window.dispatchEvent(new Event("ownerfi:reset"));
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSession() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}
const SERVER_STATE = seed();

/** True once the saved login (if any) has been loaded. Gate redirects on this to avoid flashes. */
export function useSessionReady(): boolean {
  return useSession().ready;
}

export function useCurrentUser(): SessionUser | null {
  const s = useSession();
  return s.users.find((u) => u.id === s.currentUserId) ?? null;
}

export function getSessionState() {
  return state;
}

/* --------------------------------------------------- shared accounts */

/** Accounts people sign up with are shared, so a buyer who signed up in one browser can sign in from another. */
export const accountSync: SyncSource & { subscribe: (l: () => void) => () => void } = {
  subscribe,
  local() {
    const seedIds = new Set(seed().users.map((u) => u.id));
    return state.users
      .filter((u) => !seedIds.has(u.id))
      .map((u) => {
        const password = state.passwords[norm(u.email)];
        return { id: `user:${u.id}`, refs: [u, password], data: () => ({ user: u, password }) };
      });
  },
  apply(docs, dirty) {
    let users = state.users;
    let passwords = state.passwords;
    for (const r of docs) {
      if (!r.id.startsWith("user:") || dirty.has(r.id)) continue;
      const { user, password } = r.data as { user: SessionUser; password?: string };
      const i = users.findIndex((x) => x.id === user.id);
      if (i >= 0 && hashOf(users[i]) === hashOf(user) && passwords[norm(user.email)] === password) continue;
      users = i >= 0 ? users.map((x, j) => (j === i ? user : x)) : [...users, user];
      if (password) passwords = { ...passwords, [norm(user.email)]: password };
    }
    if (users !== state.users || passwords !== state.passwords) set({ users, passwords });
  },
};

/* ------------------------------------------------------------ demo flags */

export const demoFlags = {
  set(patch: Partial<State["demo"]>) {
    set({ demo: { ...state.demo, ...patch } });
  },
  get: () => state.demo,
};

/* --------------------------------------------------------------- mailbox */

export function addMail(m: Omit<Mail, "id" | "at">) {
  const mail: Mail = {
    ...m,
    id: `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
  };
  set({ mailbox: [mail, ...state.mailbox] });
  return mail;
}

/* ------------------------------------------------------------------ auth */

export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const findUser = (email: string) => state.users.find((u) => norm(u.email) === norm(email));

/** "Chrome on Windows", from this browser. */
function deviceName() {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "device";
  return `${browser} on ${os}`;
}

/** Writes one sign-in attempt to the person's history. */
function recordLogin(userId: string, ok: boolean) {
  const ev: LoginEvent = { id: `l-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, userId, at: new Date().toISOString(), device: deviceName(), place: "Phoenix, AZ", ok };
  set({ logins: [ev, ...state.logins].slice(0, 200) });
}
const passwordFor = (u: SessionUser) => state.passwords[norm(u.email)] ?? DEMO_PASSWORD;

function sendCode(u: SessionUser, purpose: Pending["purpose"]) {
  set({
    pending: {
      userId: u.id,
      email: u.email,
      phone: u.phone,
      purpose,
      sentAt: Date.now(),
      attempts: 0,
    },
  });
  const sms = purpose === "2fa";
  addMail({
    to: sms ? u.phone : u.email,
    kind: sms ? "sms" : "email",
    ...(sms ? {} : { subject: "Your OwnerFi code" }),
    body: `Your OwnerFi code is ${DEMO_CODE}. It works for 10 minutes.`,
    tag: "otp",
  });
}

export type LoginResult =
  | { status: "ok"; role: Role }
  | { status: "needs_otp" }
  | { status: "needs_2fa" }
  | { status: "suspended" };

export const auth = {
  signup(input: {
    role: "seller" | "buyer";
    name: string;
    email: string;
    phone: string;
    state: string;
    password: string;
  }) {
    const existing = findUser(input.email);
    const resumable = existing && !existing.emailVerified && state.passwords[norm(input.email)] !== undefined;
    if (existing && !resumable) {
      throw new AuthError("email_taken", "You already have an account with this email.");
    }
    const user: SessionUser = {
      id: existing?.id ?? `u-${Math.random().toString(36).slice(2, 9)}`,
      role: input.role,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      state: input.state,
      createdAt: new Date().toISOString(),
      status: "active",
      emailVerified: false,
      twoFactor: false,
      verification:
        input.role === "seller"
          ? { identity: "not_started", payouts: "not_started", phone: "not_started" }
          : { identity: "not_started", bank: "not_started", credit: "not_started", phone: "not_started" },
    };
    set({
      users: existing ? state.users.map((u) => (u.id === user.id ? user : u)) : [...state.users, user],
      passwords: { ...state.passwords, [norm(user.email)]: input.password },
    });
    sendCode(user, "signup");
  },

  login(email: string, password: string): LoginResult {
    const u = findUser(email);
    if (!u || passwordFor(u) !== password) {
      if (u) recordLogin(u.id, false);
      throw new AuthError("bad_credentials", "Incorrect email or password.");
    }
    if (u.status === "suspended") return { status: "suspended" };
    // Logging back in reopens an account that was closed.
    if (u.closedAt) set({ users: state.users.map((x) => (x.id === u.id ? { ...x, closedAt: undefined } : x)) });
    if (!u.emailVerified) {
      sendCode(u, "verify");
      return { status: "needs_otp" };
    }
    if (u.twoFactor || u.role === "admin") {
      sendCode(u, "2fa");
      return { status: "needs_2fa" };
    }
    recordLogin(u.id, true);
    set({ currentUserId: u.id });
    return { status: "ok", role: u.role };
  },

  verifyOtp(code: string):
    | { ok: true; role: Role; isNew: boolean }
    | { ok: false; reason: "locked"; lockedUntil: number }
    | { ok: false; reason: "expired" }
    | { ok: false; reason: "wrong"; triesLeft: number } {
    const p = state.pending;
    if (!p) throw new AuthError("no_pending", "Your code session ended. Please log in again.");
    if (p.lockedUntil && p.lockedUntil > Date.now()) {
      return { ok: false, reason: "locked", lockedUntil: p.lockedUntil };
    }
    const forceExpired =
      typeof window !== "undefined" && new URLSearchParams(window.location.search).get("expired") === "1";
    if (forceExpired || Date.now() - p.sentAt > OTP_TTL_MS) return { ok: false, reason: "expired" };
    if (code !== DEMO_CODE) {
      const attempts = p.attempts + 1;
      if (attempts >= OTP_TRIES) {
        const lockedUntil = Date.now() + OTP_LOCK_MS;
        set({ pending: { ...p, attempts: 0, lockedUntil } });
        return { ok: false, reason: "locked", lockedUntil };
      }
      set({ pending: { ...p, attempts } });
      return { ok: false, reason: "wrong", triesLeft: OTP_TRIES - attempts };
    }
    const user = state.users.find((u) => u.id === p.userId);
    if (!user) throw new AuthError("not_found", "We can’t find that account.");
    recordLogin(user.id, true);
    set({
      users: state.users.map((u) => (u.id === user.id ? { ...u, emailVerified: true } : u)),
      pending: null,
      currentUserId: user.id,
    });
    return { ok: true, role: user.role, isNew: p.purpose === "signup" };
  },

  resendOtp() {
    const p = state.pending;
    const u = p && state.users.find((x) => x.id === p.userId);
    if (!p || !u) throw new AuthError("no_pending", "Your code session ended. Please log in again.");
    sendCode(u, p.purpose);
  },

  continueUnverified(): Role {
    const p = state.pending;
    const u = p && state.users.find((x) => x.id === p.userId);
    if (!p || !u) throw new AuthError("no_pending", "Please log in again.");
    set({ pending: null, currentUserId: u.id });
    return u.role;
  },

  /** Updates one verification (identity, payouts, bank, credit) on a user. */
  setVerification(userId: string, patch: Partial<SessionUser["verification"]>) {
    set({
      users: state.users.map((u) => (u.id === userId ? { ...u, verification: { ...u.verification, ...patch } } : u)),
    });
  },

  /** Marks the email as confirmed (used by the verification hub when someone skipped the code at login). */
  verifyEmail(userId: string) {
    set({ users: state.users.map((u) => (u.id === userId ? { ...u, emailVerified: true } : u)) });
  },

  changePassword(userId: string, current: string, next: string) {
    const u = state.users.find((x) => x.id === userId);
    if (!u) throw new AuthError("not_found", "We can’t find that account.");
    if (passwordFor(u) !== current) throw new AuthError("bad_password", "That’s not your current password.");
    set({ passwords: { ...state.passwords, [norm(u.email)]: next } });
    addMail({
      to: u.email,
      kind: "email",
      subject: "Your OwnerFi password changed",
      body: "You just changed your password. If this wasn’t you, reset it right away.",
      tag: "other",
    });
  },

  setTwoFactor(userId: string, on: boolean) {
    const u = state.users.find((x) => x.id === userId);
    if (!u) throw new AuthError("not_found", "We can’t find that account.");
    if (u.role === "admin" && !on) throw new AuthError("required", "2-step login is required for admin accounts.");
    set({ users: state.users.map((x) => (x.id === userId ? { ...x, twoFactor: on } : x)) });
  },

  updateProfile(userId: string, patch: Partial<Pick<SessionUser, "name" | "phone" | "state">>) {
    const u = state.users.find((x) => x.id === userId);
    if (!u) throw new AuthError("not_found", "We can’t find that account.");
    if (patch.name !== undefined && patch.name.trim().length < 2) throw new AuthError("invalid", "Enter your full name.");
    if (patch.phone !== undefined && patch.phone.replace(/\D/g, "").length < 10) throw new AuthError("invalid", "Enter a 10-digit phone number.");
    set({ users: state.users.map((x) => (x.id === userId ? { ...x, ...patch } : x)) });
  },

  /** Sends a fresh email code to an already signed-in user (the "Verify email" banner). */
  startEmailVerify(userId: string) {
    const u = state.users.find((x) => x.id === userId);
    if (!u) throw new AuthError("not_found", "We can’t find that account.");
    sendCode(u, "verify");
  },

  cancelPending() {
    set({ pending: null });
  },

  requestReset(email: string) {
    const u = findUser(email);
    if (!u) return; // never reveal whether an account exists
    const token = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    set({ resetTokens: { ...state.resetTokens, [token]: { email: norm(u.email), expiresAt: Date.now() + RESET_TTL_MS } } });
    addMail({
      to: u.email,
      kind: "email",
      subject: "Reset your OwnerFi password",
      body: `Use this link to choose a new password: ${window.location.origin}/auth/reset/${token}`,
      tag: "reset",
    });
  },

  checkResetToken(token: string): "valid" | "expired" | "invalid" {
    if (token === "expired") return "expired";
    const t = state.resetTokens[token];
    if (!t) return "invalid";
    return t.expiresAt < Date.now() ? "expired" : "valid";
  },

  resetPassword(token: string, password: string) {
    const t = state.resetTokens[token];
    if (!t || t.expiresAt < Date.now()) throw new AuthError("bad_token", "This link has expired.");
    const rest = { ...state.resetTokens };
    delete rest[token];
    set({ passwords: { ...state.passwords, [t.email]: password }, resetTokens: rest });
  },

  logout() {
    set({ currentUserId: null, pending: null });
  },

  /** Closes the account: signs out and marks it closed. Logging in again reopens it. */
  closeAccount(userId: string) {
    set({ users: state.users.map((u) => (u.id === userId ? { ...u, closedAt: new Date().toISOString() } : u)), currentUserId: null, pending: null });
  },

  /** Ends the given sign-ins ("Log out" on another device). */
  revokeLogins(ids: string[]) {
    set({ revokedLogins: [...new Set([...state.revokedLogins, ...ids])] });
  },

  /** Demo toolbar: jump straight into a seeded persona (or sign out). */
  setPersona(role: Role | null) {
    set({ currentUserId: role ? PERSONA_IDS[role] : null, pending: null });
  },

  /** Switches a signed-in account that holds both roles between the seller and buyer side. No logout. */
  switchRole(role: Role) {
    const u = state.users.find((x) => x.id === state.currentUserId);
    if (!u || u.role === role || !(u.roles ?? [u.role]).includes(role)) return false;
    set({ users: state.users.map((x) => (x.id === u.id ? { ...x, role } : x)) });
    return true;
  },

  /** Admin "View as": sign in as that person, or the demo persona for their role if they have no login here. */
  impersonate(userId: string, role: Role) {
    set({ currentUserId: state.users.some((u) => u.id === userId) ? userId : PERSONA_IDS[role], pending: null });
  },
};

/* ------------------------------------------------------------- validation */

export function passwordRules(pw: string) {
  const rules = [
    { id: "len", label: "At least 8 characters", ok: pw.length >= 8 },
    { id: "case", label: "Upper and lower case letters", ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { id: "num", label: "A number", ok: /\d/.test(pw) },
    { id: "sym", label: "A symbol, like ! or #", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = rules.filter((r) => r.ok).length;
  return { score, rules, valid: score === 4 };
}

export const maskEmail = (e: string) => {
  const [a = "", b = ""] = e.split("@");
  return `${a.slice(0, 1)}***@${b}`;
};
export const maskPhone = (p: string) => `•••• ${p.replace(/\D/g, "").slice(-4)}`;

// Brand-new sellers start on the setup checklist.
export const portalHome = (role: Role, isNew = false) => (role === "seller" && isNew ? "/seller/onboarding" : `/${role}`);

/** Only follow same-app `next` links that make sense for this role. */
export function afterLogin(role: Role, opts: { next?: string | null | undefined; isNew?: boolean } = {}) {
  const n = opts.next;
  if (n && n.startsWith("/") && !n.startsWith("//") && (n.startsWith(`/${role}`) || n.startsWith("/cars"))) {
    return n;
  }
  return portalHome(role, opts.isNew);
}
