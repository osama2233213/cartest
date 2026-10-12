/**
 * Pure rules for the deal flow (negotiation rounds, inspection, signatures, down-payment webhooks,
 * closing and cancellation). The demo store calls these, and they are unit tested on their own.
 */
import type { Stage } from "./demo-data";
import { DEFAULT_INSPECTION_FEE_CENTS, liveSettings } from "./live-settings";

export class RuleError extends Error {}

/* ------------------------------------------------------------- negotiation */

/** The default number of rounds. The live number is whatever the admin set; use `maxRounds()`. */
export const MAX_ROUNDS = 3;
export const maxRounds = () => liveSettings().maxCounterRounds;

export type OfferTerms = { priceCents: number; downPct: number; apr: number; term: number };
export type OfferVersion = {
  version: number;
  by: "buyer" | "seller";
  terms: OfferTerms;
  monthly: number;
  note?: string | undefined;
  status: "current" | "superseded" | "accepted" | "withdrawn" | "declined";
  at: string;
};

/** Offers made since the last reset (a renegotiation after inspection starts a fresh set of rounds). */
export const roundsUsed = (offers: OfferVersion[], base = 0) => offers.length - base;
export const currentOffer = (offers: OfferVersion[]) => [...offers].reverse().find((o) => o.status === "current");

export function canSubmitOffer(offers: OfferVersion[], base = 0, max = maxRounds()): { ok: true } | { ok: false; reason: string } {
  if (roundsUsed(offers, base) >= max) return { ok: false, reason: `That was round ${max}, the last one. You can accept, decline or withdraw.` };
  return { ok: true };
}

/** Adds a new version and marks the previous current one as superseded. Throws when round 4 is attempted. */
export function addOffer(offers: OfferVersion[], by: "buyer" | "seller", terms: OfferTerms, monthly: number, note?: string, base = 0, max = maxRounds()): OfferVersion[] {
  const can = canSubmitOffer(offers, base, max);
  if (!can.ok) throw new RuleError(can.reason);
  const last = currentOffer(offers);
  if (last && last.by === by) throw new RuleError("You already have an offer on the table. Wait for the other side to answer.");
  const next: OfferVersion = { version: offers.length + 1, by, terms, monthly, ...(note ? { note } : {}), status: "current", at: new Date().toISOString() };
  return [...offers.map((o) => (o.status === "current" ? { ...o, status: "superseded" as const } : o)), next];
}

/** Only the current version, made by the other side, can be accepted. */
export function acceptOfferVersion(offers: OfferVersion[], version: number, by: "buyer" | "seller"): OfferVersion[] {
  const cur = currentOffer(offers);
  if (!cur || cur.version !== version) throw new RuleError("That offer has been replaced. Review the latest one.");
  if (cur.by === by) throw new RuleError("You can’t accept your own offer.");
  return offers.map((o) => (o.version === version ? { ...o, status: "accepted" as const } : o));
}

/* -------------------------------------------------------------- inspection */

/** The default inspection price ($99). The live price is whatever the admin set; use `inspectionFeeCents()`. */
export const INSPECTION_FEE_CENTS = DEFAULT_INSPECTION_FEE_CENTS;
export const inspectionFeeCents = () => liveSettings().inspectionFeeCents;
/** "$99", or "$99.50" when the price isn't a whole number of dollars. */
export const feeLabel = (cents: number = inspectionFeeCents()) => (cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`);
export type InspectionBooking = {
  window: string;
  location: string;
  feeCents: number;
  status: "requested" | "approved";
  requestedAt: string;
};
export type InspectionDecision = "proceed" | "renegotiate" | "cancel";

export function canRenegotiate(renegotiations: number) {
  return renegotiations < 1;
}

/* --------------------------------------------------------------- signature */

export type SignatureEvidence = {
  mode: "draw" | "type";
  name: string;
  /** PNG data URL for a drawn signature. */
  image?: string | undefined;
  signedAt: string;
  ip: string;
  userAgent: string;
  documentHash: string;
  consented: true;
};

/** Tiny deterministic hash (FNV-1a, hex). Demo stand-in for SHA-256 of the document. */
export function hashText(text: string, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
export const documentHash = (agreementNumber: string, t: OfferTerms) => hashText(`${agreementNumber}|${t.priceCents}|${t.downPct}|${t.apr}|${t.term}`) + hashText(agreementNumber, 0x9e3779b9);

export function buildEvidence(input: { mode: "draw" | "type"; name: string; image?: string | undefined; agreementNumber: string; terms: OfferTerms; userAgent?: string }): SignatureEvidence {
  if (input.mode === "type" && !input.name.trim()) throw new RuleError("Type your full name to sign.");
  if (input.mode === "draw" && !input.image) throw new RuleError("Draw your signature to sign.");
  return {
    mode: input.mode,
    name: input.name.trim(),
    ...(input.image ? { image: input.image } : {}),
    signedAt: new Date().toISOString(),
    ip: "203.0.113.24",
    userAgent: input.userAgent ?? "unknown",
    documentHash: documentHash(input.agreementNumber, input.terms),
    consented: true,
  };
}

/* ---------------------------------------------------------- down payment */

export type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "refunded";
export type DownPayment = {
  status: PaymentStatus;
  /** Kept for older code that only knows "paid or not". */
  downPaymentPaid: boolean;
  attempts: number;
  amountCents?: number | undefined;
  feeCents?: number | undefined;
  paidAt?: string | undefined;
  txId?: string | undefined;
  lastError?: string | undefined;
  refundedAt?: string | undefined;
  refundCents?: number | undefined;
  /** Webhook event ids already applied. A replayed id is ignored. */
  events: string[];
};
export const emptyPayment = (): DownPayment => ({ status: "pending", downPaymentPaid: false, attempts: 0, events: [] });
/** Fills in fields that older saved data may lack. */
export const normalizePayment = (p?: Partial<DownPayment>): DownPayment => {
  const base = { ...emptyPayment(), ...p } as DownPayment;
  if (!p?.status) base.status = p?.downPaymentPaid ? "paid" : "pending";
  base.events = p?.events ?? [];
  base.attempts = p?.attempts ?? (p?.downPaymentPaid ? 1 : 0);
  return base;
};

export type WebhookEvent = {
  id: string;
  type: "payment_intent.processing" | "payment_intent.succeeded" | "payment_intent.payment_failed" | "charge.refunded";
  dealId: string;
  amountCents: number;
  feeCents?: number;
  error?: string;
  signature: string;
};

const WEBHOOK_SECRET = "whsec_demo_ownerfi";
const payload = (e: Omit<WebhookEvent, "signature">) => `${e.id}.${e.type}.${e.dealId}.${e.amountCents}.${e.feeCents ?? 0}`;
export const signWebhook = (e: Omit<WebhookEvent, "signature">, secret = WEBHOOK_SECRET) => hashText(payload(e) + secret) + hashText(secret + payload(e), 0x1234567);
export const verifyWebhook = (e: WebhookEvent, secret = WEBHOOK_SECRET) => {
  const { signature, ...rest } = e;
  return signature === signWebhook(rest, secret);
};

/** Applies a webhook. Bad signature throws; a duplicate id is ignored and changes nothing. */
export function applyWebhook(p: DownPayment | undefined, e: WebhookEvent): { payment: DownPayment; duplicate: boolean } {
  if (!verifyWebhook(e)) throw new RuleError("Webhook signature check failed.");
  const cur = normalizePayment(p);
  if (cur.events.includes(e.id)) return { payment: cur, duplicate: true };
  const events = [...cur.events, e.id];
  switch (e.type) {
    case "payment_intent.processing":
      if (cur.status === "paid" || cur.status === "refunded") return { payment: { ...cur, events }, duplicate: false };
      return { payment: { ...cur, status: "processing", events, lastError: undefined }, duplicate: false };
    case "payment_intent.succeeded":
      if (cur.status === "refunded") return { payment: { ...cur, events }, duplicate: false };
      return {
        payment: { ...cur, status: "paid", downPaymentPaid: true, amountCents: e.amountCents, feeCents: e.feeCents ?? 0, paidAt: new Date().toISOString(), txId: `pi_${e.id.slice(-8)}`, events, lastError: undefined },
        duplicate: false,
      };
    case "payment_intent.payment_failed":
      if (cur.status === "paid" || cur.status === "refunded") return { payment: { ...cur, events }, duplicate: false };
      return { payment: { ...cur, status: "failed", lastError: e.error ?? "Payment declined", events }, duplicate: false };
    case "charge.refunded":
      return { payment: { ...cur, status: "refunded", downPaymentPaid: false, refundedAt: new Date().toISOString(), refundCents: e.amountCents, events }, duplicate: false };
  }
}

export function makeEvent(dealId: string, type: WebhookEvent["type"], attempt: number, amountCents: number, feeCents?: number, error?: string): WebhookEvent {
  const base = { id: `evt_${dealId}_${attempt}_${type.split(".").pop()}`, type, dealId, amountCents, ...(feeCents !== undefined ? { feeCents } : {}), ...(error ? { error } : {}) };
  return { ...base, signature: signWebhook(base) };
}

/* ----------------------------------------------------------------- closing */

export type ClosingEvidence = { by: "buyer" | "seller"; name: string; at: string };

export function canActivateLoan(i: { contractBothSigned: boolean; paymentPaid: boolean; sellerConfirmed: boolean; buyerConfirmed: boolean }): { ok: true } | { ok: false; reason: string } {
  if (!i.contractBothSigned) return { ok: false, reason: "The contract has to be signed by both of you first." };
  if (!i.paymentPaid) return { ok: false, reason: "The down payment has to go through first." };
  if (!i.buyerConfirmed || !i.sellerConfirmed) return { ok: false, reason: "Both of you have to confirm the title transfer." };
  return { ok: true };
}

/* ------------------------------------------------------------ cancellation */

const PRE_TITLE: Stage[] = ["inquiry", "test_drive", "application", "negotiation", "inspection", "contract", "down_payment", "closing"];
export const canCancel = (stage: Stage) => PRE_TITLE.includes(stage);

/** The buyer gets the whole down payment back, including the OwnerFi fee (test mode). */
export const refundAmount = (p: DownPayment | undefined) => (p && p.status === "paid" ? (p.amountCents ?? 0) : 0);
