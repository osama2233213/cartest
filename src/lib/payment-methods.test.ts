import { describe, expect, it } from "vitest";
import { cardBrand, cardError, defaultMethods, methodLabel } from "./payment-methods";

describe("payment methods", () => {
  const now = new Date(2026, 9, 10);
  it("a verified bank starts as the default with a card beside it; nothing otherwise", () => {
    const m = defaultMethods(true);
    expect(m.filter((x) => x.isDefault)).toHaveLength(1);
    expect(m[0]!.kind).toBe("bank");
    expect(defaultMethods(false)).toEqual([]);
  });
  it("labels read the way the pay screen shows them", () => {
    expect(methodLabel(defaultMethods(true)[0]!)).toBe("Bank transfer · Chase checking ••4821");
    expect(methodLabel(defaultMethods(true)[1]!)).toBe("Card · Visa •••• 4242");
  });
  it("accepts a real test card and rejects typos and expired cards", () => {
    expect(cardError("4242 4242 4242 4242", "12/29", now)).toEqual({});
    expect(cardError("4242 4242 4242 4241", "12/29", now).number).toBeTruthy();
    expect(cardError("4242424242424242", "09/26", now).expiry).toMatch(/expired/);
    expect(cardError("4242424242424242", "13/29", now).expiry).toBeTruthy();
    expect(cardError("4242424242424242", "1229", now).expiry).toMatch(/MM\/YY/);
  });
  it("names the card brand", () => {
    expect(cardBrand("4242424242424242")).toBe("Visa");
    expect(cardBrand("5555555555554444")).toBe("Mastercard");
  });
});
