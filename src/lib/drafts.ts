import { useSyncExternalStore } from "react";
import { saleLimitForState } from "./finance";
import type { SessionUser } from "./session";

export const STEPS = ["vin", "title", "checks", "details", "photos", "terms", "review", "done"] as const;
export type Step = (typeof STEPS)[number];
export const STEP_LABEL: Record<Step, string> = {
  vin: "VIN",
  title: "Title",
  checks: "Checks",
  details: "Details",
  photos: "Photos",
  terms: "Terms",
  review: "Review",
  done: "Done",
};
export const isStep = (s: string | undefined): s is Step => !!s && (STEPS as readonly string[]).includes(s);
export const stepIndex = (s: Step) => STEPS.indexOf(s);

export const PHOTO_TAGS = ["front", "rear", "driver_side", "passenger_side", "interior", "odometer"] as const;
export type PhotoTag = (typeof PHOTO_TAGS)[number];
export const PHOTO_TAG_LABEL: Record<PhotoTag, string> = {
  front: "Front",
  rear: "Rear",
  driver_side: "Driver side",
  passenger_side: "Passenger side",
  interior: "Interior",
  odometer: "Odometer",
};

export type CheckState = "pending" | "pass" | "fail" | "review";
export type Decoded = {
  year: number;
  make: string;
  model: string;
  trim: string;
  body: string;
  engine: string;
  msrp: number;
  marketValue: { low: number; high: number };
};

export type Draft = {
  id: string;
  userId: string;
  vin: string;
  decoded: Decoded;
  reached: Step;
  updatedAt: string;
  titleFileName?: string | undefined;
  checks: Record<"lien" | "theft" | "brand" | "history", CheckState>;
  mileage: number;
  exteriorColor: string;
  interiorColor: string;
  condition: "excellent" | "good" | "fair";
  features: string[];
  description: string;
  city: string;
  zip: string;
  photos: string[];
  photoTags: Record<string, PhotoTag>;
  terms: { askingPrice: number; minDownPct: number; apr: number; allowedTerms: number[] };
  published?: { id: string; pendingReview: boolean } | undefined;
};

/* ------------------------------------------------------------------- VIN */

export const cleanVin = (v: string) => v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 17);
export const vinProblem = (v: string) =>
  /[IOQ]/.test(v)
    ? "VINs don’t use the letters I, O or Q."
    : v.length > 0 && v.length < 17
      ? `A VIN has 17 characters. You’ve typed ${v.length}.`
      : "";
export const vinOk = (v: string) => v.length === 17 && !/[IOQ]/.test(v);

export const DEMO_VINS = [
  { label: "Clean car", vin: "1HGCV1F34LA123456" },
  { label: "Has a loan (lien)", vin: "2T1BURHE0JC110000" },
  { label: "Stolen-vehicle flag", vin: "3FA6P0HD5KR209999" },
  { label: "Branded title", vin: "5YJ3E1EA7LF305555" },
];

const MODELS = [
  { make: "Toyota", model: "Camry", trim: "SE", body: "sedan", engine: "2.5L 4-cylinder", msrp: 27500 },
  { make: "Honda", model: "Accord", trim: "EX-L", body: "sedan", engine: "1.5L turbo", msrp: 29500 },
  { make: "Ford", model: "F-150", trim: "XLT", body: "truck", engine: "3.5L V6", msrp: 41000 },
  { make: "Mazda", model: "CX-5", trim: "Touring", body: "suv", engine: "2.5L 4-cylinder", msrp: 30000 },
  { make: "Subaru", model: "Outback", trim: "Premium", body: "suv", engine: "2.5L boxer", msrp: 31500 },
  { make: "Hyundai", model: "Elantra", trim: "SEL", body: "sedan", engine: "2.0L 4-cylinder", msrp: 22500 },
];
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789";

export function decodeVin(vin: string): Decoded {
  const h = [...vin].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);
  const m = MODELS[h % MODELS.length]!;
  const idx = YEAR_CODES.indexOf(vin[9] ?? "L");
  const year = Math.min(2025, Math.max(2012, 2010 + (idx < 0 ? 10 : idx)));
  const age = 2026 - year;
  const mid = Math.round((m.msrp * (0.82 - age * 0.055)) / 100) * 100;
  return {
    year,
    ...m,
    marketValue: { low: Math.round((mid * 0.93) / 100) * 100, high: Math.round((mid * 1.07) / 100) * 100 },
  };
}

export function checksForVin(vin: string): Draft["checks"] {
  return {
    lien: vin.endsWith("0000") ? "fail" : "pass",
    theft: vin.endsWith("9999") ? "fail" : "pass",
    brand: vin.endsWith("5555") ? "review" : "pass",
    history: vin.endsWith("5555") ? "review" : "pass",
  };
}

/* ---------------------------------------------------------------- store */

const KEY = "ownerfi-poc-drafts-v1";
let cache: Record<string, Draft> = {};
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY: Record<string, Draft> = {};

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Draft>;
  } catch {
    cache = {};
  }
}

function write(next: Record<string, Draft>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota or private mode: the draft still works in memory */
  }
  listeners.forEach((l) => l());
}

export function useDrafts(): Record<string, Draft> {
  return useSyncExternalStore(
    (l) => {
      load();
      listeners.add(l);
      l();
      return () => listeners.delete(l);
    },
    () => cache,
    () => EMPTY,
  );
}

const later = (a: Step, b: Step) => (stepIndex(a) >= stepIndex(b) ? a : b);

export function createDraft(userId: string, vin: string): Draft {
  load();
  const decoded = decodeVin(vin);
  const mid = Math.round((decoded.marketValue.low + decoded.marketValue.high) / 2 / 100) * 100;
  const d: Draft = {
    id: `draft-${Date.now().toString(36)}`,
    userId,
    vin,
    decoded,
    reached: "title",
    updatedAt: new Date().toISOString(),
    checks: { lien: "pending", theft: "pending", brand: "pending", history: "pending" },
    mileage: 0,
    exteriorColor: "",
    interiorColor: "",
    condition: "good",
    features: [],
    description: "",
    city: "",
    zip: "",
    photos: [],
    photoTags: {},
    terms: { askingPrice: mid, minDownPct: 15, apr: 10, allowedTerms: [36, 48, 60] },
  };
  write({ ...cache, [d.id]: d });
  return d;
}

export function patchDraft(id: string, patch: Partial<Draft>, reach?: Step) {
  load();
  const cur = cache[id];
  if (!cur) return;
  write({
    ...cache,
    [id]: { ...cur, ...patch, reached: reach ? later(cur.reached, reach) : cur.reached, updatedAt: new Date().toISOString() },
  });
}

/** Changing the VIN starts the car over (same draft id so the URL stays valid). */
export function restartVin(id: string, vin: string) {
  load();
  const cur = cache[id];
  if (!cur) return;
  write({
    ...cache,
    [id]: {
      ...cur,
      vin,
      decoded: decodeVin(vin),
      reached: "title",
      checks: { lien: "pending", theft: "pending", brand: "pending", history: "pending" },
      updatedAt: new Date().toISOString(),
    },
  });
}

export function deleteDraft(id: string) {
  load();
  const { [id]: _gone, ...rest } = cache;
  write(rest);
}

/* ---------------------------------------------------------------- gates */

/** Can this seller publish? (email, identity and payouts must all be verified.) */
export function publishGate(user: SessionUser) {
  const missing: ("email" | "identity" | "payouts")[] = [];
  if (!user.emailVerified) missing.push("email");
  if (user.verification.identity !== "verified") missing.push("identity");
  if (user.verification.payouts !== "verified") missing.push("payouts");
  const first = missing[0];
  const text = { email: "verify your email", identity: "verify your identity", payouts: "set up payouts" } as const;
  return {
    canPublish: missing.length === 0,
    missing,
    message: first ? `You need to ${text[first]} to publish.` : "",
    ctaTo: first === "email" ? "/seller" : first === "payouts" ? "/seller/onboarding/payouts" : "/seller/onboarding/identity",
  };
}

export function saleMeter(user: SessionUser, used: number) {
  const limit = saleLimitForState(user.state);
  return { used, limit, remaining: Math.max(0, limit - used) };
}
