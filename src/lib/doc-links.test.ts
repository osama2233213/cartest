import { beforeEach, describe, expect, it } from "vitest";
import { DOC_LINK_TTL_MS, issueLink, resolveLink, type DocRef } from "./doc-links";

const doc: DocRef = { id: "contract-d-1", title: "Financing agreement", kind: "contract", owners: ["u-daniel", "u-maria"] };
const T0 = 1_800_000_000_000;

describe("signed document links", () => {
  beforeEach(() => localStorage.clear());

  it("opens for the person it was made for", () => {
    const { token } = issueLink(doc, "u-daniel", T0);
    const r = resolveLink(token, "u-daniel", T0 + 1000);
    expect(r.ok).toBe(true);
  });
  it("expires", () => {
    const { token } = issueLink(doc, "u-daniel", T0);
    expect(resolveLink(token, "u-daniel", T0 + DOC_LINK_TTL_MS - 1).ok).toBe(true);
    const late = resolveLink(token, "u-daniel", T0 + DOC_LINK_TTL_MS);
    expect(late).toEqual({ ok: false, reason: "expired" });
  });
  it("is private: someone else with the link sees nothing", () => {
    const { token } = issueLink(doc, "u-daniel", T0);
    expect(resolveLink(token, "u-maria", T0 + 1000)).toEqual({ ok: false, reason: "not_owner" });
    expect(resolveLink(token, "u-eve", T0 + 1000)).toEqual({ ok: false, reason: "not_owner" });
    expect(resolveLink(token, null, T0 + 1000)).toEqual({ ok: false, reason: "signed_out" });
  });
  it("won't make a link for a non-owner", () => {
    expect(() => issueLink(doc, "u-eve", T0)).toThrow();
  });
  it("rejects a tampered or made-up token", () => {
    const { token } = issueLink(doc, "u-daniel", T0);
    const parts = token.split(".");
    expect(resolveLink(`${parts[0]}.${(T0 * 2).toString(36)}.${parts[2]}`, "u-daniel", T0).ok).toBe(false);
    expect(resolveLink("nope.abc.def", "u-daniel", T0)).toEqual({ ok: false, reason: "invalid" });
  });
  it("each link is its own: a new one doesn't revive an old one", () => {
    const a = issueLink(doc, "u-daniel", T0);
    const b = issueLink(doc, "u-daniel", T0 + DOC_LINK_TTL_MS + 5);
    expect(resolveLink(a.token, "u-daniel", T0 + DOC_LINK_TTL_MS + 6).ok).toBe(false);
    expect(resolveLink(b.token, "u-daniel", T0 + DOC_LINK_TTL_MS + 6).ok).toBe(true);
  });
});
