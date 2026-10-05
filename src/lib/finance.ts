/**
 * OwnerFi finance library. Pure functions. All amounts are integer cents.
 * Rounding: half up. The final installment absorbs rounding drift.
 */

export type StateRule = { state: string; max_apr: number; annual_sale_limit: number };

export const DEFAULT_STATE_RULES: StateRule[] = [
  { state: "AZ", max_apr: 10, annual_sale_limit: 5 },
  { state: "TX", max_apr: 18, annual_sale_limit: 5 },
  { state: "FL", max_apr: 18, annual_sale_limit: 5 },
  { state: "CA", max_apr: 10, annual_sale_limit: 3 },
  { state: "NY", max_apr: 16, annual_sale_limit: 3 },
  { state: "other", max_apr: 12, annual_sale_limit: 5 },
];

const roundHalfUp = (n: number) => Math.sign(n) * Math.round(Math.abs(n) + 1e-9);

export function downPaymentAmount(priceCents: number, downPct: number): number {
  if (priceCents < 0) throw new Error("Price must be positive");
  if (downPct < 0 || downPct > 100) throw new Error("Down payment % must be between 0 and 100");
  return roundHalfUp((priceCents * downPct) / 100);
}

export function platformFee(
  downPaymentCents: number,
  opts: { rate?: number | undefined; waived?: boolean | undefined } = {},
): number {
  const rate = opts.rate ?? 0.1; const waived = opts.waived ?? false;
  if (waived) return 0;
  return roundHalfUp(downPaymentCents * rate);
}

export const sellerNetAtClosing = (downPaymentCents: number, feeCents: number) =>
  downPaymentCents - feeCents;

export function amountFinanced(priceCents: number, downPaymentCents: number): number {
  if (downPaymentCents > priceCents) throw new Error("Down payment cannot exceed price");
  return priceCents - downPaymentCents;
}

export function monthlyPayment(principalCents: number, aprPct: number, termMonths: number): number {
  if (termMonths <= 0) throw new Error("Term must be positive");
  if (principalCents <= 0) return 0;
  const r = aprPct / 100 / 12;
  if (r === 0) return roundHalfUp(principalCents / termMonths);
  return roundHalfUp((principalCents * r) / (1 - Math.pow(1 + r, -termMonths)));
}

export type Installment = {
  n: number;
  due: string; // ISO date
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

function addMonths(d: Date, m: number) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + m);
  return x;
}

export function amortizationSchedule(
  principalCents: number,
  aprPct: number,
  termMonths: number,
  startDate: Date = new Date(),
): Installment[] {
  const r = aprPct / 100 / 12;
  const pay = monthlyPayment(principalCents, aprPct, termMonths);
  const rows: Installment[] = [];
  let balance = principalCents;
  for (let n = 1; n <= termMonths; n++) {
    const interest = roundHalfUp(balance * r);
    let principal = pay - interest;
    let payment = pay;
    if (n === termMonths) {
      principal = balance;
      payment = principal + interest;
    }
    balance -= principal;
    rows.push({
      n,
      due: addMonths(startDate, n).toISOString().slice(0, 10),
      payment,
      interest,
      principal,
      balance,
    });
  }
  return rows;
}

export const totalInterest = (schedule: Installment[]) =>
  schedule.reduce((s, r) => s + r.interest, 0);

export const sellerTotalProceeds = (priceCents: number, interestCents: number, feeCents: number) =>
  priceCents + interestCents - feeCents;

export const buyerTotalCost = (downPaymentCents: number, schedule: Installment[]) =>
  downPaymentCents + schedule.reduce((s, r) => s + r.payment, 0);

function ruleFor(state: string, rules: StateRule[] = DEFAULT_STATE_RULES): StateRule {
  return (
    rules.find((r) => r.state === state) ??
    rules.find((r) => r.state === "other") ??
    DEFAULT_STATE_RULES[5]!
  );
}

export const rateCapForState = (state: string, rules?: StateRule[]) =>
  Number(ruleFor(state, rules).max_apr);
export const saleLimitForState = (state: string, rules?: StateRule[]) =>
  ruleFor(state, rules).annual_sale_limit;
export const clampApr = (apr: number, state: string, rules?: StateRule[]) =>
  Math.max(0, Math.min(apr, rateCapForState(state, rules)));

export function marketPosition(
  priceCents: number,
  range: { low: number; high: number },
): "below" | "fair" | "above" {
  if (priceCents < range.low) return "below";
  if (priceCents > range.high) return "above";
  return "fair";
}

/** Remaining principal after paid installments + interest accrued since last due date. No prepayment penalty. */
export function payoffAmount(schedule: Installment[], asOf: Date, aprPct?: number): number {
  const asOfIso = asOf.toISOString().slice(0, 10);
  const paid = schedule.filter((r) => r.due <= asOfIso);
  if (paid.length === schedule.length) return 0;
  const first = schedule[0]!;
  const startBalance = first.balance + first.principal;
  const balance = paid.length ? paid[paid.length - 1]!.balance : startBalance;
  if (!aprPct) return balance;
  const lastDue = paid.length
    ? new Date(paid[paid.length - 1]!.due)
    : addMonths(new Date(first.due), -1);
  const days = Math.max(0, (asOf.getTime() - lastDue.getTime()) / 86400000);
  return balance + roundHalfUp((balance * (aprPct / 100) * days) / 365);
}

/** One-shot summary used by every UI surface. */
export function dealTerms(input: {
  priceCents: number;
  downPct: number;
  apr: number;
  termMonths: number;
  feeRate?: number;
  feeWaived?: boolean;
}) {
  const down = downPaymentAmount(input.priceCents, input.downPct);
  const fee = platformFee(down, { rate: input.feeRate, waived: input.feeWaived });
  const financed = amountFinanced(input.priceCents, down);
  const schedule = amortizationSchedule(financed, input.apr, input.termMonths);
  const interest = totalInterest(schedule);
  return {
    down,
    fee,
    sellerNet: sellerNetAtClosing(down, fee),
    financed,
    monthly: monthlyPayment(financed, input.apr, input.termMonths),
    interest,
    sellerTotal: sellerTotalProceeds(input.priceCents, interest, fee),
    buyerTotal: buyerTotalCost(down, schedule),
    schedule,
  };
}

export const fmtUsd = (cents: number, opts: { cents?: boolean } = {}) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(cents / 100);
