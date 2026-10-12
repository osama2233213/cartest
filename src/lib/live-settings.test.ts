import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, settingsFromStore } from "./live-settings";
import { platformFee, rateCapForState } from "./finance";
import { addOffer, canSubmitOffer, feeLabel, type OfferTerms, type OfferVersion } from "./deal-rules";

const T: OfferTerms = { priceCents: 2_000_000, downPct: 15, apr: 9, term: 48 };

describe("reading the admin's saved settings", () => {
  it("uses the defaults when nothing is saved", () => {
    expect(settingsFromStore(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(settingsFromStore({})).toEqual(DEFAULT_SETTINGS);
  });
  it("picks up what the admin changed and keeps defaults for the rest", () => {
    const s = settingsFromStore({
      feeRate: 0.08,
      inspectionFeeCents: 12_500,
      policies: { testDriveCancelHours: 48, maxCounterRounds: 5, late: { noticeDay: 7 } },
      stateRules: [{ state: "AZ", maxApr: 7, annualSaleLimit: 2 }],
    });
    expect(s.feeRate).toBe(0.08);
    expect(s.inspectionFeeCents).toBe(12_500);
    expect(s.testDriveCancelHours).toBe(48);
    expect(s.maxCounterRounds).toBe(5);
    expect(s.late).toMatchObject({ reminderDay: 1, noticeDay: 7, defaultDay: 30 });
    expect(s.stateRules).toEqual([{ state: "AZ", max_apr: 7, annual_sale_limit: 2 }]);
  });
  it("ignores nonsense and never allows fewer than one round", () => {
    const s = settingsFromStore({ feeRate: "ten", inspectionFeeCents: -5, policies: { maxCounterRounds: 0 } });
    expect(s.feeRate).toBe(DEFAULT_SETTINGS.feeRate);
    expect(s.inspectionFeeCents).toBe(DEFAULT_SETTINGS.inspectionFeeCents);
    expect(s.maxCounterRounds).toBeGreaterThanOrEqual(1);
  });
});

describe("the app follows the saved settings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const withAdmin = (store: object) => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: (k: string) => (k === "ownerfi-poc-admin-v1" ? JSON.stringify(store) : null) });
  };

  it("fee rate, state rate cap, rounds and inspection price", () => {
    expect(platformFee(330_000)).toBe(33_000); // default 10%
    expect(rateCapForState("AZ")).toBe(10);
    withAdmin({ feeRate: 0.05, inspectionFeeCents: 12_550, policies: { maxCounterRounds: 2 }, stateRules: [{ state: "AZ", maxApr: 6, annualSaleLimit: 5 }] });
    expect(platformFee(330_000)).toBe(16_500);
    expect(rateCapForState("AZ")).toBe(6);
    expect(feeLabel()).toBe("$125.50");
    let o: OfferVersion[] = [];
    o = addOffer(o, "buyer", T, 1);
    o = addOffer(o, "seller", T, 1);
    expect(canSubmitOffer(o).ok).toBe(false); // round 3 is blocked now that the admin allows 2
  });
});

describe("labels", () => {
  it("shows whole dollars without cents", () => {
    expect(feeLabel(9_900)).toBe("$99");
    expect(feeLabel(9_950)).toBe("$99.50");
  });
});
