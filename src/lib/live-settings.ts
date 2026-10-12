/**
 * The admin's settings as the rest of the app should see them. The admin screens save to one store
 * (`ownerfi-poc-admin-v1`); this reads it, so a change there takes effect on the next calculation or screen.
 * With no saved settings (first visit, server render, tests) it returns the defaults below.
 */
export type LiveStateRule = { state: string; max_apr: number; annual_sale_limit: number };
export type LiveLateDays = { reminderDay: number; noticeDay: number; sellerAlertDay: number; defaultDay: number };

export type LiveSettings = {
  /** OwnerFi's share of the down payment, 0.1 = 10%. */
  feeRate: number;
  /** What a buyer pays for the inspection, in cents. */
  inspectionFeeCents: number;
  /** Buyers can change a test drive for free until this many hours before. */
  testDriveCancelHours: number;
  /** How many offers and counters each side gets. */
  maxCounterRounds: number;
  late: LiveLateDays;
  stateRules: LiveStateRule[];
};

export const DEFAULT_INSPECTION_FEE_CENTS = 9_900;

export const DEFAULT_SETTINGS: LiveSettings = {
  feeRate: 0.1,
  inspectionFeeCents: DEFAULT_INSPECTION_FEE_CENTS,
  testDriveCancelHours: 24,
  maxCounterRounds: 3,
  late: { reminderDay: 1, noticeDay: 5, sellerAlertDay: 15, defaultDay: 30 },
  stateRules: [
    { state: "AZ", max_apr: 10, annual_sale_limit: 5 },
    { state: "TX", max_apr: 18, annual_sale_limit: 5 },
    { state: "FL", max_apr: 18, annual_sale_limit: 5 },
    { state: "CA", max_apr: 10, annual_sale_limit: 3 },
    { state: "NY", max_apr: 16, annual_sale_limit: 3 },
    { state: "other", max_apr: 12, annual_sale_limit: 5 },
  ],
};

export const ADMIN_STORE_KEY = "ownerfi-poc-admin-v1";

let cachedRaw: string | null | undefined;
let cached: LiveSettings = DEFAULT_SETTINGS;

const num = (v: unknown, fallback: number, min = 0) => (typeof v === "number" && Number.isFinite(v) && v >= min ? v : fallback);

/** Pulls the numbers out of a saved admin store, ignoring anything missing or malformed. */
export function settingsFromStore(raw: unknown): LiveSettings {
  const s = (raw ?? {}) as Record<string, any>;
  const p = (s["policies"] ?? {}) as Record<string, any>;
  const l = (p["late"] ?? {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const rules = Array.isArray(s["stateRules"])
    ? (s["stateRules"] as Record<string, unknown>[])
        .filter((r) => typeof r["state"] === "string")
        .map((r): LiveStateRule => ({
          state: String(r["state"]),
          max_apr: num(r["maxApr"], d.stateRules.find((x) => x.state === r["state"])?.max_apr ?? 12),
          annual_sale_limit: num(r["annualSaleLimit"], d.stateRules.find((x) => x.state === r["state"])?.annual_sale_limit ?? 5),
        }))
    : d.stateRules;
  return {
    feeRate: num(s["feeRate"], d.feeRate),
    inspectionFeeCents: num(s["inspectionFeeCents"], d.inspectionFeeCents),
    testDriveCancelHours: num(p["testDriveCancelHours"], d.testDriveCancelHours),
    maxCounterRounds: Math.max(1, Math.round(num(p["maxCounterRounds"], d.maxCounterRounds, 1))),
    late: {
      reminderDay: num(l["reminderDay"], d.late.reminderDay),
      noticeDay: num(l["noticeDay"], d.late.noticeDay),
      sellerAlertDay: num(l["sellerAlertDay"], d.late.sellerAlertDay),
      defaultDay: num(l["defaultDay"], d.late.defaultDay),
    },
    stateRules: rules.length ? rules : d.stateRules,
  };
}

export function liveSettings(): LiveSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(ADMIN_STORE_KEY);
  } catch {
    return DEFAULT_SETTINGS;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = raw ? settingsFromStore(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    cached = DEFAULT_SETTINGS;
  }
  return cached;
}
