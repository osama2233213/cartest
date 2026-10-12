import { describe, expect, it } from "vitest";
import { DEALS, termsFor } from "./demo-data";
import { scheduleFor } from "./ledger";
import { dealTerms } from "./finance";
import type { DealDetailData } from "./demo-store";

describe("what the buyer sees matches the amortization schedule", () => {
  const f150 = DEALS.find((d) => d.id === "d-1003")!;
  const t = termsFor(f150);

  it("every upcoming installment is the schedule's payment, with no OwnerFi fee on top", () => {
    const rows = scheduleFor(f150, { messages: [], installment: { paidCount: 2, totalCount: 48, nextDueDate: "Oct 5, 2026", dueAt: new Date(2026, 9, 5).toISOString(), monthlyAmount: t.monthly } } as unknown as DealDetailData);
    expect(rows).toHaveLength(48);
    rows.forEach((r, i) => expect(r.amount).toBe(t.schedule[i]!.payment));
    expect(rows.filter((r) => r.status === "paid")).toHaveLength(2);
  });

  it("the schedule pays the loan off to zero", () => {
    expect(t.schedule.at(-1)!.balance).toBe(0);
    expect(t.schedule.reduce((s, r) => s + r.principal, 0)).toBe(t.financed);
  });

  it("the seeded installments charge the same amount as the schedule", () => {
    expect(dealTerms({ priceCents: 2480000, downPct: 15, apr: 14, termMonths: 48 }).monthly).toBe(t.monthly);
  });
});
