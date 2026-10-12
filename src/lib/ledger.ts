import { addDays } from "date-fns/addDays";
import { addMonths } from "date-fns/addMonths";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { format } from "date-fns/format";
import { isSameMonth } from "date-fns/isSameMonth";
import { subMonths } from "date-fns/subMonths";
import { termsFor, type DemoDeal } from "./demo-data";
import { shortCar } from "./format";
import { demoNow } from "./demo-clock";
import { dueDate } from "./installments";
import type { DealDetailData } from "./demo-store";

export type LedgerRow = {
  id: string;
  dealId: string;
  at: Date;
  buyer: string;
  seller: string;
  car: string;
  kind: "down_payment" | "monthly" | "refund";
  amount: number; // cents paid by the buyer
  fee: number; // OwnerFi fee in cents (down payment only)
  net: number; // cents the seller receives
  ref: string;
};

export type ScheduleRow = { id: string; n: number; dueAt: Date; amount: number; status: "paid" | "scheduled" | "late" };

const AFTER_CLOSING = new Set(["active", "paid_off", "defaulted"]);

/** Money that has moved on a deal so far, built from the schedule and how many payments are made. */
export function ledgerFor(deal: DemoDeal, detail: DealDetailData, now = new Date()): LedgerRow[] {
  const t = termsFor(deal);
  const rows: LedgerRow[] = [];
  const paid = detail.installment?.paidCount ?? (deal.stage === "paid_off" ? t.schedule.length : 0);
  const base = {
    dealId: deal.id,
    buyer: deal.buyer,
    seller: deal.seller,
    car: shortCar(deal.car),
  };
  const pay = detail.payment;
  const refunded = pay?.status === "refunded";
  if (refunded) {
    const amount = pay?.amountCents ?? t.down;
    const fee = pay?.feeCents ?? t.fee;
    const paidAt = pay?.paidAt && !Number.isNaN(Date.parse(pay.paidAt)) ? new Date(pay.paidAt) : addDays(now, -3);
    rows.push({ ...base, id: `${deal.id}-down`, kind: "down_payment", at: paidAt, amount, fee, net: amount - fee, ref: `PAY-${deal.id.slice(-4).toUpperCase()}-DP` });
    // The buyer gets everything back, OwnerFi's fee included.
    rows.push({ ...base, id: `${deal.id}-refund`, kind: "refund", at: pay?.refundedAt ? new Date(pay.refundedAt) : now, amount: -(pay?.refundCents ?? amount), fee: -fee, net: -(pay?.refundCents ?? amount), ref: `REF-${deal.id.slice(-4).toUpperCase()}-DP` });
    return rows;
  }
  if (AFTER_CLOSING.has(deal.stage) || deal.stage === "closing") {
    rows.push({
      ...base,
      id: `${deal.id}-down`,
      kind: "down_payment",
      at: addMonths(addDays(now, -20), -paid),
      amount: t.down,
      fee: t.fee,
      net: t.sellerNet,
      ref: `PAY-${deal.id.slice(-4).toUpperCase()}-DP`,
    });
  }
  for (let n = 1; n <= paid; n++) {
    const row = t.schedule[n - 1];
    if (!row) break;
    rows.push({
      ...base,
      id: `${deal.id}-m${n}`,
      kind: "monthly",
      at: addMonths(addDays(now, -20), -(paid - n)),
      amount: row.payment,
      fee: 0,
      net: row.payment,
      ref: `PAY-${deal.id.slice(-4).toUpperCase()}-${String(n).padStart(2, "0")}`,
    });
  }
  return rows;
}

export function scheduleFor(deal: DemoDeal, detail: DealDetailData, now = demoNow()): ScheduleRow[] {
  const t = termsFor(deal);
  const paid = detail.installment?.paidCount ?? 0;
  // Deals with a real due date follow it (and the demo clock). Older ones keep the sample dates.
  const due = detail.installment ? dueDate(detail.installment) : null;
  return t.schedule.map((r, i) => {
    if (due) {
      const dueAt = addMonths(due, i - paid);
      const status: ScheduleRow["status"] = i < paid ? "paid" : i === paid && differenceInCalendarDays(now, dueAt) > 0 ? "late" : "scheduled";
      return { id: `${deal.id}-s${i + 1}`, n: i + 1, dueAt, amount: r.payment, status };
    }
    const dueAt = addMonths(addDays(now, 10), i - paid);
    const status: ScheduleRow["status"] = i < paid ? "paid" : deal.late && i === paid ? "late" : "scheduled";
    return { id: `${deal.id}-s${i + 1}`, n: i + 1, dueAt: status === "late" ? addDays(now, -2) : dueAt, amount: r.payment, status };
  });
}

export function monthlyStatements(rows: LedgerRow[], now = new Date()) {
  const out: { month: string; label: string; received: number; interest: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const m = subMonths(now, i);
    const inMonth = rows.filter((r) => isSameMonth(r.at, m));
    if (inMonth.length === 0) continue;
    out.push({
      month: format(m, "yyyy-MM"),
      label: format(m, "MMMM yyyy"),
      received: inMonth.reduce((s, r) => s + r.net, 0),
      interest: Math.round(inMonth.filter((r) => r.kind === "monthly").reduce((s, r) => s + r.net * 0.18, 0)),
    });
  }
  return out;
}
