import { describe, expect, it } from "vitest";
import { identityOutcome, loadOutcome, saveOutcome } from "./identity-check";

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
