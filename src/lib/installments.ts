/**
 * Monthly payment schedule rules: autopay on the due date, failed-payment retries, and the late timeline
 * (reminder, late notice, seller alert, default options). Pure functions, so time travel can replay them.
 * OwnerFi never recovers or picks up a car on its own; day 30 only opens options for the seller.
 */
import { addDays } from "date-fns/addDays";
import { addMonths } from "date-fns/addMonths";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { format } from "date-fns/format";

export type LateDays = { reminderDay: number; noticeDay: number; sellerAlertDay: number; defaultDay: number };
export const LATE_DAYS: LateDays = { reminderDay: 1, noticeDay: 5, sellerAlertDay: 15, defaultDay: 30 };
/** Autopay tries on the due date, then again on the next two days. */
export const AUTOPAY_TRIES = 3;

export type PayRecord = {
  n: number;
  status: "paid" | "failed";
  at: string;
  method: "autopay" | "manual";
  /** Same key = same payment. A repeat is ignored. */
  key: string;
  error?: string | undefined;
};

export type InstState = {
  paidCount: number;
  totalCount: number;
  nextDueDate: string;
  monthlyAmount: number;
  lastPaymentDate?: string | undefined;
  /** ISO date of the next installment. */
  dueAt?: string | undefined;
  history?: PayRecord[] | undefined;
  /** Late-timeline days already sent for the current due date. */
  fired?: number[] | undefined;
};

export type SchedEvent = {
  kind: "autopay_paid" | "autopay_failed" | "reminder" | "late_notice" | "seller_alert" | "default_options";
  /** Which installment this is about. */
  n: number;
  /** Days late when it fired. */
  day: number;
};

export const fmtDue = (d: Date) => format(d, "MMM d, yyyy");

/** The due date, from `dueAt` or an older "Nov 5, 2026" string. Null when there isn't one yet. */
export function dueDate(i: Pick<InstState, "dueAt" | "nextDueDate">): Date | null {
  const t = Date.parse(i.dueAt ?? i.nextDueDate);
  return Number.isNaN(t) ? null : new Date(t);
}

export const daysLate = (i: InstState, now: Date) => {
  const due = dueDate(i);
  return due && i.paidCount < i.totalCount ? Math.max(0, differenceInCalendarDays(now, due)) : 0;
};

/**
 * Records a payment attempt. A paid key already in the history changes nothing, so a failed payment that is
 * retried ends up as exactly one paid installment.
 */
export function recordPayment(i: InstState, p: { ok: boolean; method: PayRecord["method"]; key: string; now: Date; error?: string }): { inst: InstState; applied: boolean } {
  const history = i.history ?? [];
  if (history.some((h) => h.key === p.key && h.status === "paid")) return { inst: i, applied: false };
  if (i.paidCount >= i.totalCount) return { inst: i, applied: false };
  const n = i.paidCount + 1;
  if (!p.ok) {
    if (history.some((h) => h.key === p.key)) return { inst: i, applied: false };
    return { inst: { ...i, history: [...history, { n, status: "failed", at: p.now.toISOString(), method: p.method, key: p.key, error: p.error ?? "Payment declined" }] }, applied: true };
  }
  const due = dueDate(i) ?? p.now;
  const next = addMonths(due, 1);
  return {
    inst: {
      ...i,
      paidCount: n,
      lastPaymentDate: p.now.toISOString(),
      dueAt: next.toISOString(),
      nextDueDate: fmtDue(next),
      fired: [],
      history: [...history, { n, status: "paid", at: p.now.toISOString(), method: p.method, key: p.key }],
    },
    applied: true,
  };
}

/**
 * Moves a schedule forward to `now`: autopay charges on the due date (and retries), and each late-timeline
 * notice fires once. Safe to call again for the same `now`.
 */
export function advance(
  start: InstState,
  now: Date,
  opts: { autopay: boolean; shouldFail?: () => boolean; days?: LateDays },
): { inst: InstState; events: SchedEvent[] } {
  const days = opts.days ?? LATE_DAYS;
  let inst = start;
  const events: SchedEvent[] = [];
  for (let guard = 0; guard < 60; guard++) {
    const due = dueDate(inst);
    if (!due || inst.paidCount >= inst.totalCount || now < startOfDay(due)) break;
    const late = differenceInCalendarDays(now, due);
    const n = inst.paidCount + 1;

    let paid = false;
    if (opts.autopay) {
      for (let d = 0; d <= Math.min(late, AUTOPAY_TRIES - 1) && !paid; d++) {
        const key = `auto-${n}-d${d}`;
        if ((inst.history ?? []).some((h) => h.key === key)) continue; // already tried that day
        const fail = opts.shouldFail?.() ?? false;
        const at = addDays(due, d);
        const r = recordPayment(inst, { ok: !fail, method: "autopay", key, now: at, error: "Payment declined" });
        inst = r.inst;
        if (r.applied) events.push({ kind: fail ? "autopay_failed" : "autopay_paid", n, day: d });
        if (!fail) paid = true;
      }
    }
    if (paid) continue; // next month may be due too after a long jump

    const fired = new Set(inst.fired ?? []);
    const steps: [number, SchedEvent["kind"]][] = [
      [days.reminderDay, "reminder"],
      [days.noticeDay, "late_notice"],
      [days.sellerAlertDay, "seller_alert"],
      [days.defaultDay, "default_options"],
    ];
    for (const [day, kind] of steps) {
      if (late >= day && !fired.has(day)) {
        fired.add(day);
        events.push({ kind, n, day });
      }
    }
    inst = { ...inst, fired: [...fired] };
    break;
  }
  return { inst, events };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
