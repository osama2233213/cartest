import { describe, expect, it } from "vitest";
import { IDENTITY_APPROVE_MS, clearDue, dueDecisions, identityOutcome, loadOutcome, saveOutcome } from "./identity-check";

describe("an ID check finishes on its own, whatever page the person is on", () => {
  const t0 = 1_000_000;
  it("is not due before the wait is over, and is after", () => {
    saveOutcome("u-bg-1", "approved", t0);
    expect(dueDecisions(t0 + IDENTITY_APPROVE_MS - 1).some((d) => d.userId === "u-bg-1")).toBe(false);
    expect(dueDecisions(t0 + IDENTITY_APPROVE_MS)).toContainEqual({ userId: "u-bg-1", outcome: "approved" });
    clearDue("u-bg-1");
  });
  it("a rejected file name is decided as rejected", () => {
    saveOutcome("u-bg-2", "rejected", t0);
    expect(dueDecisions(t0 + IDENTITY_APPROVE_MS)).toContainEqual({ userId: "u-bg-2", outcome: "rejected" });
    clearDue("u-bg-2");
  });
  it("a check sent to a person is never decided by the clock", () => {
    saveOutcome("u-bg-3", "review", t0);
    expect(dueDecisions(t0 + 10 * IDENTITY_APPROVE_MS).some((d) => d.userId === "u-bg-3")).toBe(false);
    clearDue("u-bg-3");
  });
  it("a finished check is forgotten", () => {
    saveOutcome("u-bg-4", "approved", t0);
    clearDue("u-bg-4");
    expect(dueDecisions(t0 + IDENTITY_APPROVE_MS).some((d) => d.userId === "u-bg-4")).toBe(false);
  });
});

describe("identity check outcome", () => {
  it("rejects when a file name says reject", () => {
    expect(identityOutcome(["front-reject.jpg", "back.jpg", "me.jpg"])).toBe("rejected");
    expect(identityOutcome(["front.jpg", "back.jpg", "REJECT_selfie.png"])).toBe("rejected");
  });
  it("sends to manual review when a file name says review", () => {
    expect(identityOutcome(["front.jpg", "review-back.jpg", "me.jpg"])).toBe("review");
  });
  it("reject wins over review", () => {
    expect(identityOutcome(["review.jpg", "reject.jpg"])).toBe("rejected");
  });
  it("approves anything else", () => {
    expect(identityOutcome(["licence-front.jpg", "licence-back.jpg", "selfie.jpg"])).toBe("approved");
    expect(identityOutcome([undefined, "a.png"])).toBe("approved");
  });
  it("remembers the outcome for a person", () => {
    saveOutcome("u-1", "review");
    expect(loadOutcome("u-1")).toBe("review");
    expect(loadOutcome("u-unknown")).toBe("approved");
  });
});
