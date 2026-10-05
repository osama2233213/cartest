import { describe, it, expect } from "vitest";
import * as f from "./finance";

describe("worked example $22,000", () => {
  const t = f.dealTerms({ priceCents: 2_200_000, downPct: 15, apr: 10, termMonths: 48 });
  it("down/fee/net/financed", () => {
    expect(t.down).toBe(330_000);
    expect(t.fee).toBe(33_000);
    expect(t.sellerNet).toBe(297_000);
    expect(t.financed).toBe(1_870_000);
  });
  it("monthly ≈ $474.2x", () => {
    expect(Math.abs(t.monthly - 47_428)).toBeLessThanOrEqual(5);
  });
  it("interest ≈ $4,064 and proceeds ≈ $25,734", () => {
    expect(Math.abs(t.interest - 406_400)).toBeLessThan(1_000);
    expect(Math.abs(t.sellerTotal - 2_573_400)).toBeLessThan(1_000);
    expect(Math.abs(t.buyerTotal - 2_606_400)).toBeLessThan(1_000);
  });
  it("schedule ends at zero", () => {
    expect(t.schedule.at(-1)!.balance).toBe(0);
    expect(t.schedule.reduce((s, r) => s + r.principal, 0)).toBe(t.financed);
  });
});

describe("edge cases", () => {
  it("zero interest", () => {
    const s = f.amortizationSchedule(100_000, 0, 3);
    expect(s.map((r) => r.payment)).toEqual([33_333, 33_333, 33_334]);
    expect(f.totalInterest(s)).toBe(0);
  });
  it("final installment absorbs rounding", () => {
    const s = f.amortizationSchedule(1_000_001, 7.77, 37);
    expect(s.at(-1)!.balance).toBe(0);
  });
  it("waived fee", () => {
    expect(f.platformFee(330_000, { waived: true })).toBe(0);
  });
  it("price vs down validation", () => {
    expect(() => f.amountFinanced(100, 200)).toThrow();
    expect(() => f.downPaymentAmount(100, 120)).toThrow();
  });
  it("early payoff", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const s = f.amortizationSchedule(1_870_000, 10, 48, start);
    const p = f.payoffAmount(s, new Date(s[11]!.due + "T00:00:00Z"));
    expect(p).toBe(s[11]!.balance);
    expect(f.payoffAmount(s, new Date("2031-01-01"))).toBe(0);
  });
  it("clampApr respects state cap", () => {
    expect(f.clampApr(15, "AZ")).toBe(10);
    expect(f.clampApr(15, "TX")).toBe(15);
    expect(f.clampApr(30, "WA")).toBe(12);
    expect(f.saleLimitForState("CA")).toBe(3);
  });
  it("market position", () => {
    expect(f.marketPosition(100, { low: 200, high: 300 })).toBe("below");
    expect(f.marketPosition(250, { low: 200, high: 300 })).toBe("fair");
  });
});
