import { DEMO_MS, demoMs } from "./demo-latency";
import { useSyncExternalStore } from "react";
import { demoFlags } from "./session";

export type Channel = { id: string; name: string; title: number; description: number; host: string };

/** Car sites a seller can post to, with the length limits each site allows. */
export const CHANNELS: Channel[] = [
  { id: "autotrader", name: "Autotrader", title: 60, description: 1000, host: "www.autotrader.com" },
  { id: "cars", name: "Cars.com", title: 60, description: 1000, host: "www.cars.com" },
  { id: "cargurus", name: "CarGurus", title: 70, description: 800, host: "www.cargurus.com" },
  { id: "edmunds", name: "Edmunds", title: 60, description: 600, host: "www.edmunds.com" },
  { id: "offerup", name: "OfferUp", title: 50, description: 500, host: "offerup.com" },
  { id: "fbmarketplace", name: "Facebook Marketplace", title: 100, description: 1500, host: "www.facebook.com/marketplace" },
  { id: "craigslist", name: "Craigslist", title: 70, description: 2000, host: "craigslist.org" },
  { id: "ebay", name: "eBay Motors", title: 80, description: 1000, host: "www.ebay.com/motors" },
  { id: "privateauto", name: "PrivateAuto", title: 60, description: 700, host: "privateauto.com" },
];

export type AdStatus = "queued" | "posting" | "live" | "failed" | "paused";
export type Ad = {
  id: string;
  vehicleId: string;
  channelId: string;
  status: AdStatus;
  postedAt: string;
  /** Where the ad lives once it is live. */
  url?: string | undefined;
  /** Why it failed, when it did. */
  error?: string | undefined;
  /** How many times posting has been tried. */
  attempts?: number | undefined;
  impressions: number;
  clicks: number;
  inquiries: number;
};

const KEY = "ownerfi-poc-ads-v1";
let cache: Ad[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY: Ad[] = [];

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Ad[];
  } catch {
    cache = [];
  }
}

function write(next: Ad[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useAds(vehicleId?: string): Ad[] {
  const all = useSyncExternalStore(
    (l) => {
      load();
      listeners.add(l);
      l();
      return () => listeners.delete(l);
    },
    () => cache,
    () => EMPTY,
  );
  return vehicleId ? all.filter((a) => a.vehicleId === vehicleId) : all;
}

const adUrl = (channelId: string, vehicleId: string) => {
  const host = CHANNELS.find((c) => c.id === channelId)?.host ?? "example.com";
  return `https://${host}/ownerfi-${vehicleId.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase()}`;
};

const patch = (ids: string[], f: (a: Ad) => Ad) => write(cache.map((a) => (ids.includes(a.id) ? f(a) : a)));

/** Takes ads from queued to posting to live. A site can refuse (the "Next request fails" demo switch), and the ad is then marked failed. */
function runPosting(ids: string[]) {
  window.setTimeout(() => patch(ids, (a) => ({ ...a, status: "posting", attempts: (a.attempts ?? 0) + 1 })), demoMs(DEMO_MS.adQueued));
  window.setTimeout(() => {
    let refused = demoFlags.get().reqFails;
    if (refused) demoFlags.set({ reqFails: false });
    write(
      cache.map((a) => {
        if (!ids.includes(a.id) || a.status !== "posting") return a;
        // The switch refuses the first ad of this batch only.
        const fail = refused;
        refused = false;
        return fail
          ? { ...a, status: "failed" as const, error: `${CHANNELS.find((c) => c.id === a.channelId)?.name ?? "The site"} didn’t accept the ad. Try again in a moment.` }
          : { ...a, status: "live" as const, error: undefined, url: adUrl(a.channelId, a.vehicleId), impressions: 20 + (a.id.length % 40), clicks: a.id.length % 6 };
      }),
    );
  }, demoMs(DEMO_MS.adLive));
}

/** Posts a car to the chosen sites. */
export function postAds(vehicleId: string, channelIds: string[]) {
  load();
  const fresh: Ad[] = channelIds
    .filter((c) => !cache.some((a) => a.vehicleId === vehicleId && a.channelId === c))
    .map((channelId) => ({
      id: `ad-${vehicleId}-${channelId}`,
      vehicleId,
      channelId,
      status: "queued" as const,
      postedAt: new Date().toISOString(),
      attempts: 0,
      impressions: 0,
      clicks: 0,
      inquiries: 0,
    }));
  write([...cache, ...fresh]);
  runPosting(fresh.map((a) => a.id));
}

/** Tries a failed ad again. */
export function retryAd(id: string) {
  load();
  const ad = cache.find((a) => a.id === id);
  if (!ad || ad.status !== "failed") return;
  patch([id], (a) => ({ ...a, status: "queued", error: undefined }));
  runPosting([id]);
}

export function setAdStatus(vehicleId: string, from: AdStatus, to: AdStatus) {
  load();
  write(cache.map((a) => (a.vehicleId === vehicleId && a.status === from ? { ...a, status: to } : a)));
}

export function removeAd(id: string) {
  load();
  write(cache.filter((a) => a.id !== id));
}

export function clipText(text: string, max: number) {
  return text.length <= max ? { text, shortened: false } : { text: `${text.slice(0, max - 1).trimEnd()}…`, shortened: true };
}
