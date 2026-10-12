import { describe, expect, it } from "vitest";
import { addDays } from "date-fns/addDays";
import { advance, daysLate, recordPayment, type InstState } from "./installments";

const due = new Date(2026, 10, 5);
const base = (): InstState => ({ paidCount: 2, totalCount: 48, nextDueDate: "Nov 5, 2026", dueAt: due.toISOString(), monthlyAmount: 47_425 });
const kinds = (r: { events: { kind: string }[] }) => r.events.map((e) => e.kind);

describe("autopay", () => {
  it("does nothing before the due date and charges on it", () => {
    expect(advance(base(), addDays(due, -1), { autopay: true }).inst.paidCount).toBe(2);
    const r = advance(base(), due, { autopay: true });
    expect(r.inst.paidCount).toBe(3);
    expect(kinds(r)).toEqual(["autopay_paid"]);
    expect(r.inst.nextDueDate).toBe("Dec 5, 2026");
  });
  it("is off: nothing is charged, the late timeline starts instead", () => {
    const r = advance(base(), addDays(due, 1), { autopay: false });
    expect(r.inst.paidCount).toBe(2);
    expect(kinds(r)).toEqual(["reminder"]);
  });
  it("a failed charge is retried the next day and recorded as one paid payment", () => {
    let fails = 1;
    const r = advance(base(), addDays(due, 1), { autopay: true, shouldFail: () => fails-- > 0 });
    expect(kinds(r)).toEqual(["autopay_failed", "autopay_paid"]);
    expect(r.inst.paidCount).toBe(3);
    expect(r.inst.history?.filter((h) => h.status === "paid")).toHaveLength(1);
    expect(r.inst.history?.filter((h) => h.status === "failed")).toHaveLength(1);
    // Running it again changes nothing.
    expect(advance(r.inst, addDays(due, 1), { autopay: true }).events).toEqual([]);
  });
  it("catches up each missed month after a long jump", () => {
    expect(advance(base(), addDays(due, 70), { autopay: true }).inst.paidCount).toBe(5);
  });
});

describe("late timeline", () => {
  it("fires day 1, 5, 15 and 30 once each, with time travel", () => {
    let inst = base();
    const seen: string[] = [];
    for (const d of [1, 4, 5, 14, 15, 29, 30, 31]) {
      const r = advance(inst, addDays(due, d), { autopay: false });
      inst = r.inst;
      seen.push(...r.events.map((e) => `${e.day}:${e.kind}`));
    }
    expect(seen).toEqual(["1:reminder", "5:late_notice", "15:seller_alert", "30:default_options"]);
  });
  it("a jump straight to day 30 sends every notice once", () => {
    expect(kinds(advance(base(), addDays(due, 30), { autopay: false }))).toEqual(["reminder", "late_notice", "seller_alert", "default_options"]);
  });
  it("paying clears the late state and the notices", () => {
    const late = advance(base(), addDays(due, 6), { autopay: false }).inst;
    expect(daysLate(late, addDays(due, 6))).toBe(6);
    const paid = recordPayment(late, { ok: true, method: "manual", key: "m-3", now: addDays(due, 6) });
    expect(paid.inst.paidCount).toBe(3);
    expect(paid.inst.fired).toEqual([]);
    expect(daysLate(paid.inst, addDays(due, 6))).toBe(0);
  });
  it("a repeat of the same payment is ignored", () => {
    const first = recordPayment(base(), { ok: true, method: "manual", key: "m-3", now: due });
    expect(recordPayment(first.inst, { ok: true, method: "manual", key: "m-3", now: due }).applied).toBe(false);
  });
});
