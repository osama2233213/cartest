import { format } from "date-fns/format";
import { setDate } from "date-fns/setDate";
import { subMonths } from "date-fns/subMonths";

export type FeeLike = { id: string; at: string; dealId: string; live: boolean; sellerName: string; sellerId?: string | undefined; downPayment: number; fee: number; status: "collected" | "waived" | "refunded" };

export type RevenueMonth = { key: string; month: string; fees: number };

const monthKey = (d: Date | string) => format(new Date(d), "yyyy-MM");

/**
 * Twelve months of OwnerFi fee revenue (whole dollars), built only from fee ledger rows.
 * `baseline` is the historic dollars-per-month shape for the demo (oldest first). Where the real rows for a
 * month add up to less, one "Earlier deals" row is added to the ledger for the gap, so every month's total
 * is exactly the sum of its ledger rows and the chart, KPIs and ledger table can never disagree.
 */
export function reconcileRevenue(fees: FeeLike[], baseline: readonly number[], now = new Date()) {
  const n = baseline.length;
  const backfill: FeeLike[] = [];
  const months: RevenueMonth[] = [];
  for (let i = 0; i < n; i++) {
    const d = subMonths(now, n - 1 - i);
    const key = monthKey(d);
    const real = fees.filter((f) => f.status === "collected" && monthKey(f.at) === key).reduce((s, f) => s + f.fee, 0);
    const gap = Math.round(baseline[i]! * 100) - real;
    if (gap > 0) {
      const at = i === n - 1 ? now : setDate(d, 15);
      backfill.push({ id: `fee-earlier-${key}`, at: at.toISOString(), dealId: `earlier-${key}`, live: false, sellerName: "Earlier deals", downPayment: Math.round(gap * 10), fee: gap, status: "collected" });
    }
    months.push({ key, month: format(d, "MMM"), fees: Math.round((real + Math.max(gap, 0)) / 100) });
  }
  return { fees: [...fees, ...backfill], months };
}

/** True for the per-month "Earlier deals" rows that stand in for deals older than the demo data. */
export const isBackfill = (f: Pick<FeeLike, "dealId">) => f.dealId.startsWith("earlier-");

/** Sum of collected fees (cents) in the given calendar month / year, straight from the ledger rows. */
export const feeCentsIn = (fees: FeeLike[], match: (d: Date) => boolean) =>
  fees.filter((f) => f.status === "collected" && match(new Date(f.at))).reduce((s, f) => s + f.fee, 0);
