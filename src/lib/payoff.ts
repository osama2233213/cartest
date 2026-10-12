import { addMonths } from "date-fns/addMonths";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { termsFor, type DemoDeal } from "./demo-data";
import { dueDate, type InstState } from "./installments";

export type PayoffQuote = {
  /** Principal left on the schedule after the payments made. */
  principal: number;
  /** Interest earned since the last due date (simple daily interest). */
  interest: number;
  total: number;
  paidCount: number;
  remaining: number;
  /** Days of interest in the quote. */
  days: number;
};

/** What it costs to pay the loan off today, taken from the amortization schedule. All amounts in cents. */
export function payoffQuote(deal: DemoDeal, inst: Pick<InstState, "paidCount" | "dueAt" | "nextDueDate"> | undefined, now: Date): PayoffQuote {
  const t = termsFor(deal);
  const paidCount = inst?.paidCount ?? 0;
  const principal = paidCount > 0 ? (t.schedule[paidCount - 1]?.balance ?? 0) : t.financed;
  const due = inst ? dueDate(inst) : null;
  // Interest runs from the last due date (one month before the next one) up to today, never past the next due date.
  const since = due ? addMonths(due, -1) : now;
  const days = Math.max(0, Math.min(differenceInCalendarDays(now, since), due ? differenceInCalendarDays(due, since) : 0));
  const interest = Math.round((principal * deal.apr) / 100 / 365 * days);
  return { principal, interest, total: principal + interest, paidCount, remaining: t.schedule.length - paidCount, days };
}
