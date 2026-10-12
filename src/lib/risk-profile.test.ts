import { describe, expect, it } from "vitest";
import { CONSENT_TEXT, CONSENT_VERSION, DEFAULT_PROFILE, consentsFor, latestConsent, profileFor, recordConsent, saveProfile, sellerSummary, softPull } from "./risk-profile";

describe("consent record", () => {
  it("stores the version, wording and time, and never the SSN or birthday", () => {
    const rec = recordConsent("u-test");
    expect(rec.version).toBe(CONSENT_VERSION);
    expect(rec.text).toBe(CONSENT_TEXT);
    expect(Date.parse(rec.acceptedAt)).not.toBeNaN();
    // Only flags that the details were given. No field can hold a birthday or SSN value.
    expect(Object.keys(rec).sort()).toEqual(["acceptedAt", "ip", "provided", "text", "userAgent", "userId", "version"]);
    expect(rec.provided).toEqual({ dob: true, ssnLast4: true });
    expect(latestConsent("u-test")?.version).toBe(CONSENT_VERSION);
    expect(consentsFor("u-test")).toHaveLength(1);
    expect(consentsFor("someone-else")).toHaveLength(0);
  });
});

describe("soft pull and seller view", () => {
  it("gives the same result for the same last 4", () => {
    expect(softPull("1234")).toEqual(softPull("1234"));
  });
  it("saves the profile per person and falls back to the demo one", () => {
    saveProfile("u-a", softPull("4321"));
    expect(profileFor("u-a")).toEqual(softPull("4321"));
    expect(profileFor("u-b")).toEqual(DEFAULT_PROFILE);
  });
  it("shows sellers a summary with no raw credit, ID or SSN", () => {
    const p = softPull("9876");
    const s = sellerSummary(p);
    const text = JSON.stringify(s);
    expect(text).not.toContain(String(p.score));
    expect(text).not.toMatch(/ssn|birth|dob|\b\d{9}\b/i);
    expect(s.rows.map((r) => r.label)).toEqual(["Identity", "Bank account", "Credit range", "Credit used", "Recent inquiries", "Missed payments", "Estimated debt-to-income"]);
  });
  it("the default profile reads as the sample low-risk buyer", () => {
    const s = sellerSummary(DEFAULT_PROFILE);
    expect(s.level).toBe("low");
    expect(s.rows.find((r) => r.label === "Credit range")?.value).toBe("Good (700–739)");
  });
});
