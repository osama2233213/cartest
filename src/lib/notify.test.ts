import { beforeEach, describe, expect, it, vi } from "vitest";

async function setup() {
  vi.resetModules();
  localStorage.clear();
  const prefs = await import("./prefs");
  const notify = await import("./notify");
  const session = await import("./session");
  session.hydrateSession();
  return { ...prefs, ...notify, session };
}

describe("notification preferences are respected", () => {
  beforeEach(() => localStorage.clear());

  it("uses the defaults until the person changes them", async () => {
    const { channelsFor } = await setup();
    expect(channelsFor("u-daniel", "late_payment")).toEqual({ email: true, sms: true, push: true });
    expect(channelsFor("u-daniel", "message")).toEqual({ email: true, sms: false, push: true });
  });

  it("sends only on the channels that are on", async () => {
    const { setPref, notify, session, PREFS } = await setup();
    const def = PREFS.buyer.find((p) => p.key === "late_payment")!.defaults;
    setPref("u-daniel", "late_payment", "sms", false, def);
    setPref("u-daniel", "late_payment", "push", false, def);
    const before = session.getSessionState().mailbox.length;
    const sent = notify("u-daniel", "late_payment", { title: "Late payment notice", body: "Your payment is late.", href: "/buyer/payments", tag: "late" });
    expect(sent).toEqual(["email"]);
    expect(session.getSessionState().mailbox.length).toBe(before + 1);
    expect(session.getSessionState().mailbox[0]?.kind).toBe("email");
  });

  it("sends nothing when everything is off, except email for security alerts", async () => {
    const { setPref, notify, PREFS } = await setup();
    const msg = PREFS.buyer.find((p) => p.key === "message")!.defaults;
    for (const ch of ["email", "sms", "push"] as const) setPref("u-daniel", "message", ch, false, msg);
    expect(notify("u-daniel", "message", { title: "Hi", body: "x", href: "/buyer/inbox" })).toEqual([]);
    const sec = PREFS.buyer.find((p) => p.key === "security")!.defaults;
    for (const ch of ["email", "sms", "push"] as const) setPref("u-daniel", "security", ch, false, sec);
    expect(notify("u-daniel", "security", { title: "New sign-in", body: "x", href: "/buyer/account/security" })).toEqual(["email"]);
  });

  it("one person's choices don't change another's", async () => {
    const { setPref, channelsFor, PREFS } = await setup();
    const msg = PREFS.buyer.find((p) => p.key === "message")!.defaults;
    setPref("u-daniel", "message", "email", false, msg);
    expect(channelsFor("u-maria", "message").email).toBe(true);
  });
});
