import { describe, expect, it } from "vitest";
import { DEALS } from "./demo-data";
import { ledgerFor } from "./ledger";
import { applyWebhook, makeEvent, emptyPayment } from "./deal-rules";
import type { DealDetailData } from "./demo-store";

describe("ledger after a refund", () => {
  const deal = { ...DEALS[4]!, stage: "cancelled" as const };
  const paid = applyWebhook(emptyPayment(), makeEvent(deal.id, "payment_intent.succeeded", 1, 253_500, 25_350)).payment;
  const refunded = applyWebhook(paid, makeEvent(deal.id, "charge.refunded", 1, 253_500)).payment;
  const detail = { messages: [], payment: refunded } as unknown as DealDetailData;

  it("shows the payment and a refund that cancels it out, fee included", () => {
    const rows = ledgerFor(deal, detail);
    const down = rows.find((r) => r.kind === "down_payment")!;
    const refund = rows.find((r) => r.kind === "refund")!;
    expect(down.amount).toBe(253_500);
    expect(refund.amount).toBe(-253_500);
    expect(refund.fee).toBe(-down.fee);
    expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBe(0);
  });

  it("a deal that was never paid has no refund row", () => {
    const rows = ledgerFor({ ...deal }, { messages: [] } as unknown as DealDetailData);
    expect(rows.some((r) => r.kind === "refund")).toBe(false);
  });
});
