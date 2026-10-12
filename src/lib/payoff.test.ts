import { describe, expect, it } from "vitest";
import { DEALS, termsFor } from "./demo-data";
import { payoffQuote } from "./payoff";

const deal = DEALS.find((d) => d.id === "d-1003")!;

describe("payoff quote", () => {
  it("starts from the financed amount before any payment", () => {
    const q = payoffQuote(deal, undefined, new Date(2026, 9, 9));
    expect(q.principal).toBe(termsFor(deal).financed);
    expect(q.interest).toBe(0);
    expect(q.total).toBe(q.principal);
    expect(q.remaining).toBe(deal.term);
  });
  it("uses the schedule balance after the payments made", () => {
    const t = termsFor(deal);
    const q = payoffQuote(deal, { paidCount: 5, dueAt: new Date(2026, 10, 5).toISOString(), nextDueDate: "Nov 5, 2026" }, new Date(2026, 9, 5));
    expect(q.principal).toBe(t.schedule[4]!.balance);
    expect(q.remaining).toBe(deal.term - 5);
  });
  it("adds daily interest since the last due date and no more than one month", () => {
    const inst = { paidCount: 5, dueAt: new Date(2026, 10, 5).toISOString(), nextDueDate: "Nov 5, 2026" };
    const mid = payoffQuote(deal, inst, new Date(2026, 9, 20));
    expect(mid.days).toBe(15);
    expect(mid.interest).toBe(Math.round((mid.principal * deal.apr) / 100 / 365 * 15));
    const late = payoffQuote(deal, inst, new Date(2027, 0, 1));
    expect(late.days).toBeLessThanOrEqual(31);
  });
});
