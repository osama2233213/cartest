import { useSyncExternalStore } from "react";
import type { Role } from "./demo-data";

export type Channel = "email" | "sms" | "push";
export type Pref = { key: string; label: string; hint: string; defaults: Record<Channel, boolean>; locked?: boolean };
export type EventKey = "message" | "deal_stage" | "payment_received" | "late_payment" | "payment_due" | "test_drive" | "offer" | "payout" | "security";

const P = (email: boolean, sms: boolean, push: boolean) => ({ email, sms, push });
const COMMON: Pref[] = [
  { key: "message", label: "New message", hint: "Someone writes to you.", defaults: P(true, false, true) },
  { key: "deal_stage", label: "Deal stage changes", hint: "A deal moves to the next step.", defaults: P(true, false, true) },
  { key: "payment_received", label: "Payment received", hint: "A payment lands.", defaults: P(true, false, true) },
  { key: "late_payment", label: "Late payment", hint: "A payment is overdue.", defaults: P(true, true, true) },
];
const SECURITY: Pref = { key: "security", label: "Security alerts", hint: "New sign-ins and password changes.", defaults: P(true, true, false), locked: true };

export const PREFS: Record<Exclude<Role, "admin">, Pref[]> = {
  seller: [
    COMMON[0]!,
    { key: "test_drive", label: "Test drive requested", hint: "A buyer asks to see your car.", defaults: P(true, true, true) },
    { key: "offer", label: "New offer", hint: "A buyer sends an offer.", defaults: P(true, true, true) },
    COMMON[1]!,
    COMMON[2]!,
    { key: "payout", label: "Payout sent", hint: "Money is on its way to your bank.", defaults: P(true, false, true) },
    COMMON[3]!,
    SECURITY,
  ],
  buyer: [
    COMMON[0]!,
    { key: "test_drive", label: "Test drive confirmed", hint: "A seller confirms a time.", defaults: P(true, true, true) },
    { key: "offer", label: "Offer updates", hint: "A seller answers your offer.", defaults: P(true, true, true) },
    COMMON[1]!,
    { key: "payment_due", label: "Payment due soon", hint: "A reminder before a payment is due.", defaults: P(true, true, true) },
    COMMON[2]!,
    COMMON[3]!,
    SECURITY,
  ],
};

const PREF_KEY = "ownerfi-poc-prefs-v1";
type PrefStore = Record<string, Record<string, Record<Channel, boolean>>>;
let prefCache: PrefStore = {};
let prefLoaded = false;
const prefListeners = new Set<() => void>();
const EMPTY: PrefStore = {};

function loadPrefs() {
  if (prefLoaded || typeof window === "undefined") return;
  prefLoaded = true;
  try {
    prefCache = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") as PrefStore;
  } catch {
    prefCache = {};
  }
}

export const usePrefStore = () =>
  useSyncExternalStore(
    (l) => {
      loadPrefs();
      prefListeners.add(l);
      l();
      return () => prefListeners.delete(l);
    },
    () => prefCache,
    () => EMPTY,
  );

export function setPref(userId: string, pref: string, ch: Channel, v: boolean, defaults: Record<Channel, boolean>) {
  loadPrefs();
  const cur = prefCache[userId]?.[pref] ?? defaults;
  prefCache = { ...prefCache, [userId]: { ...prefCache[userId], [pref]: { ...cur, [ch]: v } } };
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefCache));
  } catch {
    /* ignore */
  }
  prefListeners.forEach((l) => l());
}

const DEFAULTS: Record<string, Record<Channel, boolean>> = Object.fromEntries([...PREFS.seller, ...PREFS.buyer].map((p) => [p.key, p.defaults]));

/** Which channels this person wants for an event. Security alerts always include email. */
export function channelsFor(userId: string, event: EventKey): Record<Channel, boolean> {
  loadPrefs();
  const base = DEFAULTS[event] ?? P(true, false, true);
  const mine = prefCache[userId]?.[event] ?? base;
  return event === "security" ? { ...mine, email: true } : mine;
}
