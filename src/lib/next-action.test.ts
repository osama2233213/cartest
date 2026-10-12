import { describe, expect, it } from "vitest";
import { DEALS, getNextAction, type DemoDeal, type Stage } from "./demo-data";

const deal = (stage: Stage, extra: Partial<DemoDeal> = {}): DemoDeal => ({ ...DEALS[0]!, id: "d-t", buyer: "Daniel Park", seller: "Maria Alvarez", stage, ...extra });
const buyer = (stage: Stage, detail?: Parameters<typeof getNextAction>[2], extra?: Partial<DemoDeal>) => getNextAction(deal(stage, extra), "buyer", detail);

describe("getNextAction for the buyer", () => {
  it("always returns a label, a href, a tone and who is waiting", () => {
    for (const s of ["inquiry", "test_drive", "application", "negotiation", "inspection", "contract", "down_payment", "closing", "active", "paid_off", "declined", "cancelled", "defaulted"] as Stage[]) {
      const n = buyer(s);
      expect(n.href, s).toContain("/");
      expect(["primary", "neutral", "warning", "danger", "success"], s).toContain(n.tone);
      expect(["you", "other", "system"], s).toContain(n.waitingOn);
      expect(typeof n.label, s).toBe("string");
    }
  });

  it("inquiry and test drive wait on the seller", () => {
    expect(buyer("inquiry").waitingOn).toBe("other");
    expect(buyer("test_drive").waitingOn).toBe("other");
    expect(buyer("test_drive", { testDrive: { status: "confirmed" } }).waitingOn).toBe("other");
  });

  it("negotiation follows who made the current offer", () => {
    expect(buyer("negotiation", { offers: [{ by: "buyer", status: "current" }] }).waitingOn).toBe("other");
    const mine = buyer("negotiation", { offers: [{ by: "buyer", status: "superseded" }, { by: "seller", status: "current" }] });
    expect(mine.waitingOn).toBe("you");
    expect(mine.label).toMatch(/counter/i);
  });

  it("inspection moves from book, to wait for approval, to read and decide", () => {
    expect(buyer("inspection")).toMatchObject({ waitingOn: "you", label: "Book your inspection" });
    expect(buyer("inspection", { inspectionBooking: { status: "requested" } }).waitingOn).toBe("other");
    expect(buyer("inspection", { inspectionBooking: { status: "approved" } })).toMatchObject({ waitingOn: "you", label: "Read the report and decide" });
  });

  it("contract is yours until you sign, then it waits on the seller", () => {
    expect(buyer("contract", { contract: { sellerSigned: true, buyerSigned: false } })).toMatchObject({ waitingOn: "you", label: "Sign the contract" });
    expect(buyer("contract", { contract: { sellerSigned: false, buyerSigned: true } }).waitingOn).toBe("other");
  });

  it("down payment is yours, and a failed payment says try again in danger", () => {
    expect(buyer("down_payment")).toMatchObject({ waitingOn: "you", tone: "primary", label: "Pay the down payment" });
    expect(buyer("down_payment", { payment: { status: "failed" } })).toMatchObject({ waitingOn: "you", tone: "danger", label: "Try the down payment again" });
  });

  it("closing needs your confirmation, then waits on the seller", () => {
    expect(buyer("closing", { closing: { buyerConfirmed: false } })).toMatchObject({ waitingOn: "you", label: "Confirm the title transfer" });
    expect(buyer("closing", { closing: { buyerConfirmed: true, sellerConfirmed: false } }).waitingOn).toBe("other");
  });

  it("an active loan sends you to payments, in danger when late", () => {
    expect(buyer("active")).toMatchObject({ waitingOn: "you", href: "/buyer/payments", tone: "primary" });
    expect(buyer("active", undefined, { late: true })).toMatchObject({ waitingOn: "you", tone: "danger" });
  });

  it("paid off, closed and defaulted deals ask nothing of the buyer", () => {
    expect(buyer("paid_off").waitingOn).toBe("system");
    expect(buyer("paid_off", { lien: { releasedAt: "2026-10-01" } }).tone).toBe("success");
    for (const s of ["declined", "cancelled"] as Stage[]) expect(buyer(s).waitingOn).not.toBe("you");
    expect(buyer("defaulted").waitingOn).toBe("system");
  });
});
