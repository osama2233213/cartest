import { dealTerms, rateCapForState } from "./finance";
import type { PublicVehicle } from "./vehicles.functions";

/** Offer terms in whole dollars (the form works in dollars; finance.ts works in cents). */
export type OfferTerms = { price: number; downPayment: number; apr: number; termMonths: number };
export type OfferErrors = Partial<Record<"price" | "down" | "termMonths" | "apr", string>>;

export const defaultOffer = (v: PublicVehicle): OfferTerms => {
  const price = v.price_cents / 100;
  return {
    price,
    downPayment: Math.round((price * Number(v.min_down_pct)) / 100),
    apr: Number(v.apr),
    termMonths: v.allowed_terms.includes(48) ? 48 : (v.allowed_terms[v.allowed_terms.length - 1] ?? 48),
  };
};

export function validateOffer(t: OfferTerms, v: PublicVehicle): { ok: boolean; errors: OfferErrors } {
  const errors: OfferErrors = {};
  const minDown = Math.round((t.price * Number(v.min_down_pct)) / 100);
  const cap = rateCapForState(v.state);
  if (!(t.price > 0)) errors.price = "Enter a price.";
  if (t.price > 0 && t.downPayment < minDown) errors.down = `The seller asks for at least ${v.min_down_pct}% down.`;
  if (t.downPayment >= t.price && t.price > 0) errors.down = "The down payment has to be less than the price.";
  if (!v.allowed_terms.includes(t.termMonths)) errors.termMonths = "Pick one of the seller’s lengths.";
  if (t.apr > cap) errors.apr = `The highest rate allowed in ${v.state} is ${cap}%.`;
  else if (t.apr < Number(v.apr)) errors.apr = `The seller’s lowest rate is ${v.apr}%.`;
  return { ok: Object.keys(errors).length === 0, errors };
}

/** All numbers the offer screens show, in dollars. */
export function offerNumbers(t: OfferTerms) {
  const d = dealTerms({
    priceCents: Math.round(t.price * 100),
    downPct: (t.downPayment / t.price) * 100,
    apr: t.apr,
    termMonths: t.termMonths,
  });
  return {
    monthly: d.monthly / 100,
    interest: d.interest / 100,
    financed: d.financed / 100,
    fee: d.fee / 100,
    sellerNet: d.sellerNet / 100,
    sellerTotal: d.sellerTotal / 100,
    buyerTotal: d.buyerTotal / 100,
  };
}

/** Demo-only affordability meter. Treats the demo buyer as earning about $5,200 a month. */
const DEMO_MONTHLY_INCOME = 5_200;
const DEMO_EXISTING_DTI = 24;

export function budgetFit(monthly: number) {
  const dtiAfter = Math.round(DEMO_EXISTING_DTI + (monthly / DEMO_MONTHLY_INCOME) * 100);
  const band = dtiAfter < 36 ? "comfortable" : dtiAfter <= 45 ? "tight" : "stretch";
  return { dtiAfter, band } as const;
}
