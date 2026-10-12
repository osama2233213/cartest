/**
 * Soft credit consent records and the buyer risk profile.
 * Consent is stored with the wording version the buyer agreed to. The profile keeps the raw soft-pull result
 * for OwnerFi only; sellers get `sellerSummary`, which never contains a score, SSN, birthday or account number.
 */
import { getSessionState } from "./session";

export const CONSENT_VERSION = "soft-credit-2026-10-v1";
export const CONSENT_TEXT = "I agree OwnerFi may run a soft credit check and share a summary with sellers I apply to.";

export type ConsentRecord = {
  userId: string;
  version: string;
  /** What the buyer agreed to, word for word. */
  text: string;
  acceptedAt: string;
  userAgent: string;
  ip: string;
  /** Only that they gave these details. The values are never stored. */
  provided: { dob: true; ssnLast4: true };
};

export type RawProfile = { score: number; utilization: number; inquiries: number; missed: number; dti: number };
export type SellerRow = { label: string; value: string };

/** Pretends to pull credit. The same last 4 digits always give the same result. */
export function softPull(last4: string): RawProfile {
  const n = Number(last4.replace(/\D/g, "").slice(-4) || 0);
  return { score: 600 + (n % 220), utilization: 10 + (n % 50), inquiries: n % 4, missed: n % 5 === 0 ? 1 : 0, dti: 18 + (n % 25) };
}

/** Matches what the seller sees for a typical verified buyer in the demo. */
export const DEFAULT_PROFILE: RawProfile = { score: 720, utilization: 24, inquiries: 1, missed: 0, dti: 28 };

const range = (s: number) => (s >= 740 ? "Excellent (740+)" : s >= 700 ? "Good (700–739)" : s >= 660 ? "Fair (660–699)" : "Building (under 660)");

export function riskLevel(p: RawProfile): "low" | "medium" | "high" {
  if (p.score >= 700 && p.missed === 0 && p.dti < 36) return "low";
  if (p.score < 640 || p.missed > 1 || p.dti > 43) return "high";
  return "medium";
}

/** The only view of a buyer's credit a seller gets. */
export function sellerSummary(p: RawProfile, flags: { identity: boolean; bank: boolean } = { identity: true, bank: true }) {
  const rows: SellerRow[] = [
    { label: "Identity", value: flags.identity ? "Verified" : "Not yet" },
    { label: "Bank account", value: flags.bank ? "Verified" : "Not yet" },
    { label: "Credit range", value: range(p.score) },
    { label: "Credit used", value: `${p.utilization}%` },
    { label: "Recent inquiries", value: String(p.inquiries) },
    { label: "Missed payments", value: String(p.missed) },
    { label: "Estimated debt-to-income", value: `${p.dti}%` },
  ];
  const notes = [
    flags.identity ? "ID checked and matched" : "ID not checked yet",
    flags.bank ? "Bank account linked" : "No bank account linked",
    p.utilization < 30 ? "Uses under 30% of their available credit" : `Uses ${p.utilization}% of their available credit`,
    p.missed === 0 ? "No missed payments" : `${p.missed} missed ${p.missed === 1 ? "payment" : "payments"}`,
  ];
  return { rows, notes, level: riskLevel(p) };
}

/* ----------------------------------------------------------------- storage */

const CONSENT_KEY = "ownerfi-poc-consents-v1";
const PROFILE_KEY = "ownerfi-poc-risk-v1";

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export function recordConsent(userId: string): ConsentRecord {
  const rec: ConsentRecord = {
    userId,
    version: CONSENT_VERSION,
    text: CONSENT_TEXT,
    acceptedAt: new Date().toISOString(),
    userAgent: typeof navigator === "undefined" ? "unknown" : navigator.userAgent,
    ip: "203.0.113.24",
    provided: { dob: true, ssnLast4: true },
  };
  write(CONSENT_KEY, [...read<ConsentRecord[]>(CONSENT_KEY, []), rec]);
  return rec;
}

export const consentsFor = (userId: string) => read<ConsentRecord[]>(CONSENT_KEY, []).filter((c) => c.userId === userId);
export const latestConsent = (userId: string) => consentsFor(userId).at(-1);

export function saveProfile(userId: string, p: RawProfile) {
  write(PROFILE_KEY, { ...read<Record<string, RawProfile>>(PROFILE_KEY, {}), [userId]: p });
}
export const profileFor = (userId: string): RawProfile => read<Record<string, RawProfile>>(PROFILE_KEY, {})[userId] ?? DEFAULT_PROFILE;

/** The risk profile a seller sees for a buyer, found by name (deals only carry the name). */
export function sellerViewForBuyer(name: string) {
  const u = getSessionState().users.find((x) => x.name === name);
  const v = u?.verification;
  return sellerSummary(u ? profileFor(u.id) : DEFAULT_PROFILE, { identity: v ? v.identity === "verified" : true, bank: v ? v.bank === "verified" : true });
}
