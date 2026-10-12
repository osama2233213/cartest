import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoFlags } from "./session";

// The ads store keeps its list in module state, so load a fresh copy for each test.
async function fresh() {
  vi.resetModules();
  localStorage.clear();
  const ads = await import("./ads");
  const session = await import("./session");
  const read = () => JSON.parse(localStorage.getItem("ownerfi-poc-ads-v1") ?? "[]") as { id: string; channelId: string; status: string; url?: string; error?: string; attempts?: number }[];
  return { ...ads, session, read };
}

describe("advertising", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    demoFlags.set({ reqFails: false });
  });

  it("goes queued, posting, then live with a link", async () => {
    const { postAds, read } = await fresh();
    postAds("v-1", ["autotrader", "cars"]);
    expect(read().map((a) => a.status)).toEqual(["queued", "queued"]);
    vi.advanceTimersByTime(500);
    expect(read().map((a) => a.status)).toEqual(["posting", "posting"]);
    vi.advanceTimersByTime(1500);
    const done = read();
    expect(done.map((a) => a.status)).toEqual(["live", "live"]);
    expect(done[0]?.url).toMatch(/^https:\/\/www\.autotrader\.com\/ownerfi-/);
  });

  it("a refused ad is marked failed with a reason, and Try again makes it live", async () => {
    const { postAds, retryAd, read, session } = await fresh();
    session.demoFlags.set({ reqFails: true });
    postAds("v-2", ["autotrader", "cars"]);
    vi.advanceTimersByTime(2000);
    const [first, second] = read();
    expect(first?.status).toBe("failed");
    expect(first?.error).toMatch(/didn’t accept/);
    expect(second?.status).toBe("live");
    expect(session.demoFlags.get().reqFails).toBe(false);
    retryAd(first!.id);
    vi.advanceTimersByTime(2000);
    const again = read().find((a) => a.id === first!.id);
    expect(again?.status).toBe("live");
    expect(again?.attempts).toBe(2);
    expect(again?.url).toBeTruthy();
  });

  it("only failed ads can be retried", async () => {
    const { postAds, retryAd, read } = await fresh();
    postAds("v-3", ["offerup"]);
    vi.advanceTimersByTime(2000);
    retryAd("ad-v-3-offerup");
    vi.advanceTimersByTime(2000);
    expect(read()[0]?.attempts).toBe(1);
  });
});
