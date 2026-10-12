import { describe, expect, it } from "vitest";
import { feeCentsIn, reconcileRevenue, type FeeLike } from "./revenue";

const NOW = new Date(2026, 9, 12);
const row = (id: string, at: Date, fee: number, status: FeeLike["status"] = "collected"): FeeLike => ({ id, at: at.toISOString(), dealId: id, live: true, sellerName: "S", downPayment: fee * 10, fee, status });
const BASE = [820, 1140, 990, 1520, 1810, 1650, 2230, 2480, 2190, 2870, 3120, 3360];

describe("revenue reconciles to the fee ledger", () => {
  it("every month's total is exactly the sum of its ledger rows", () => {
    const real = [row("a", new Date(2026, 9, 3), 41_000), row("b", new Date(2026, 8, 20), 20_850), row("c", new Date(2026, 7, 2), 11_200)];
    const { fees, months } = reconcileRevenue(real, BASE, NOW);
    expect(months).toHaveLength(12);
    expect(months.at(-1)!.month).toBe("Oct");
    months.forEach((m, i) => {
      const [y, mo] = m.key.split("-").map(Number);
      const cents = feeCentsIn(fees, (d) => d.getFullYear() === y && d.getMonth() === mo! - 1);
      expect(cents).toBe(Math.round(BASE[i]! * 100));
      expect(m.fees).toBe(BASE[i]);
    });
  });

  it("never lets a busy month fall below the real fees", () => {
    const { fees, months } = reconcileRevenue([row("big", new Date(2026, 9, 1), 900_000)], BASE, NOW);
    expect(months.at(-1)!.fees).toBe(9000);
    expect(feeCentsIn(fees, (d) => d.getMonth() === 9)).toBe(900_000);
  });

  it("ignores waived and refunded fees", () => {
    const { fees } = reconcileRevenue([row("w", new Date(2026, 9, 2), 50_000, "waived"), row("r", new Date(2026, 9, 2), 50_000, "refunded")], BASE, NOW);
    expect(feeCentsIn(fees, (d) => d.getMonth() === 9)).toBe(336_000);
  });
});
