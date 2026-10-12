import { describe, expect, it } from "vitest";
import {
  RuleError,
  acceptOfferVersion,
  addOffer,
  applyWebhook,
  buildEvidence,
  canActivateLoan,
  canCancel,
  canRenegotiate,
  canSubmitOffer,
  emptyPayment,
  makeEvent,
  refundAmount,
  verifyWebhook,
  type OfferTerms,
  type OfferVersion,
} from "./deal-rules";

const T: OfferTerms = { priceCents: 2_000_000, downPct: 15, apr: 9, term: 48 };

describe("negotiation", () => {
  it("allows three rounds and blocks round 4", () => {
    let o: OfferVersion[] = [];
    o = addOffer(o, "buyer", T, 1);
    o = addOffer(o, "seller", T, 1);
    o = addOffer(o, "buyer", T, 1);
    expect(canSubmitOffer(o).ok).toBe(false);
    expect(() => addOffer(o, "seller", T, 1)).toThrow(RuleError);
  });
  it("only the current version can be accepted", () => {
    let o = addOffer([], "buyer", T, 1);
    o = addOffer(o, "seller", T, 1);
    expect(() => acceptOfferVersion(o, 1, "seller")).toThrow(RuleError);
    expect(() => acceptOfferVersion(o, 2, "seller")).toThrow(RuleError); // own offer
    expect(acceptOfferVersion(o, 2, "buyer").find((x) => x.version === 2)?.status).toBe("accepted");
  });
  it("a renegotiation starts a fresh set of rounds", () => {
    const o = [1, 2, 3].reduce((acc, i) => addOffer(acc, i % 2 ? "buyer" : "seller", T, 1), [] as OfferVersion[]);
    expect(canSubmitOffer(o, 3).ok).toBe(true);
    expect(canRenegotiate(0)).toBe(true);
    expect(canRenegotiate(1)).toBe(false);
  });
});

describe("down payment webhook", () => {
  const pay = (p = emptyPayment()) => applyWebhook(p, makeEvent("d-1", "payment_intent.succeeded", 1, 300_000, 30_000));
  it("rejects a bad signature", () => {
    const e = { ...makeEvent("d-1", "payment_intent.succeeded", 1, 300_000), amountCents: 1 };
    expect(verifyWebhook(e)).toBe(false);
    expect(() => applyWebhook(undefined, e)).toThrow(RuleError);
  });
  it("ignores a replayed event", () => {
    const first = pay();
    const again = applyWebhook(first.payment, makeEvent("d-1", "payment_intent.succeeded", 1, 300_000, 30_000));
    expect(first.payment.status).toBe("paid");
    expect(again.duplicate).toBe(true);
    expect(again.payment).toEqual(first.payment);
    expect(again.payment.events).toHaveLength(1);
  });
  it("fails then retries and ends paid once", () => {
    const failed = applyWebhook(undefined, makeEvent("d-1", "payment_intent.payment_failed", 1, 300_000, undefined, "Declined")).payment;
    expect(failed.status).toBe("failed");
    const paid = applyWebhook(failed, makeEvent("d-1", "payment_intent.succeeded", 2, 300_000, 30_000)).payment;
    expect(paid.status).toBe("paid");
    expect(refundAmount(paid)).toBe(300_000);
  });
  it("refunds the whole down payment", () => {
    const paid = pay().payment;
    const refunded = applyWebhook(paid, makeEvent("d-1", "charge.refunded", 1, 300_000)).payment;
    expect(refunded.status).toBe("refunded");
    expect(refunded.refundCents).toBe(300_000);
  });
});

describe("closing and cancel", () => {
  const base = { contractBothSigned: true, paymentPaid: true, sellerConfirmed: true, buyerConfirmed: true };
  it("needs both confirmations, the contract and the payment", () => {
    expect(canActivateLoan(base).ok).toBe(true);
    expect(canActivateLoan({ ...base, buyerConfirmed: false }).ok).toBe(false);
    expect(canActivateLoan({ ...base, sellerConfirmed: false }).ok).toBe(false);
    expect(canActivateLoan({ ...base, paymentPaid: false }).ok).toBe(false);
    expect(canActivateLoan({ ...base, contractBothSigned: false }).ok).toBe(false);
  });
  it("can cancel only before the loan is active", () => {
    expect(canCancel("closing")).toBe(true);
    expect(canCancel("active")).toBe(false);
  });
});

describe("signature evidence", () => {
  it("stores who, when, what and a document hash", () => {
    const e = buildEvidence({ mode: "type", name: "Daniel Park", agreementNumber: "OF-1", terms: T });
    expect(e.documentHash).toHaveLength(16);
    expect(e.signedAt).toMatch(/T/);
    expect(() => buildEvidence({ mode: "draw", name: "", agreementNumber: "OF-1", terms: T })).toThrow(RuleError);
  });
});
