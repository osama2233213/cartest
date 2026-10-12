import { describe, expect, it } from "vitest";
import { defaultCityForState, distanceMiles, locate, locateLabel } from "./geo";

describe("geo", () => {
  const phoenix = locateLabel("Phoenix, AZ")!;
  it("nearby cities are close, far cities are far", () => {
    expect(distanceMiles(phoenix, locate("Scottsdale", "AZ")!)).toBeLessThan(25);
    expect(distanceMiles(phoenix, locate("San Diego", "CA")!)).toBeGreaterThan(250);
    expect(distanceMiles(phoenix, locate("Austin", "TX")!)).toBeGreaterThan(800);
  });
  it("an unknown city falls back to the middle of its state", () => {
    expect(locate("Nowheresville", "AZ")).toEqual(locate(undefined, "AZ"));
    expect(locate("Nowheresville", "ZZ")).toBeNull();
  });
  it("a buyer starts at a city in their state", () => {
    expect(defaultCityForState("TX")).toMatch(/, TX$/);
    expect(defaultCityForState("ZZ")).toBe("Phoenix, AZ");
  });
});
