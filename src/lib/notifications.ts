import { useSyncExternalStore } from "react";
import { hashOf, type SyncSource } from "./shared-sync";

export type Notice = { id: string; userId: string; title: string; body: string; href: string; at: string; read: boolean };

const KEY = "ownerfi-poc-notifications-v1";
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

function seed(): Notice[] {
  return [
    { id: "n1", userId: "u-maria", title: "Daniel is reviewing your counter-offer", body: "You countered at $22,000 with 15% down. We’ll tell you when he answers.", href: "/deals/d-1001?as=seller", at: ago(2), read: false },
    { id: "n2", userId: "u-maria", title: "Your Tesla Model 3 deal is at inspection", body: "Aisha is on the inspection step. We’ll tell you if she needs anything from you.", href: "/deals/d-1002?as=seller", at: ago(5), read: false },
    { id: "n3", userId: "u-maria", title: "Test drive requested", body: "A buyer asked to see your Tesla Model 3 on Saturday.", href: "/seller/test-drives", at: ago(9), read: false },
    { id: "n4", userId: "u-maria", title: "Your ad is live on Facebook Marketplace", body: "Your Honda Accord Sport ad is up. Replies land in your inbox.", href: "/seller/vehicles", at: ago(20), read: true },
    { id: "n5", userId: "u-maria", title: "Payment received", body: "Your monthly payment landed in your bank account.", href: "/seller/payments", at: ago(30), read: true },
    { id: "n6", userId: "u-maria", title: "Your payout bank is verified", body: "You can now receive down payments and monthly payments.", href: "/seller/account/payouts", at: ago(96), read: true },
    { id: "n7", userId: "u-maria", title: "Welcome to OwnerFi", body: "Your first car is listed. Here’s what happens next.", href: "/seller", at: ago(480), read: true },
    { id: "n8", userId: "u-daniel", title: "Maria sent a counter-offer", body: "Review the new terms on the 2020 Honda Accord Sport and accept, counter or withdraw.", href: "/deals/d-1001?as=buyer", at: ago(2), read: false },
    { id: "n9", userId: "u-daniel", title: "Your test drive is confirmed", body: "Maria confirmed Friday at 11:00 AM for the Honda Accord.", href: "/buyer/test-drives", at: ago(3), read: false },
    { id: "n10", userId: "u-daniel", title: "Your F-150 payment is late", body: "Your October payment of $576.04 was due Oct 5. Pay now to catch up.", href: "/buyer/payments", at: ago(26), read: false },
    { id: "n11", userId: "u-daniel", title: "Reminder: payment due", body: "Your payment of $576.04 is due in 3 days.", href: "/buyer/payments", at: ago(120), read: true },
    { id: "n12", userId: "u-daniel", title: "A saved car dropped in price", body: "The 2019 Toyota Corolla LE is now $15,500.", href: "/buyer/saved", at: ago(150), read: true },
    { id: "n13", userId: "u-daniel", title: "You’re verified", body: "Identity, bank and credit checks are done. You can make offers.", href: "/buyer/verification", at: ago(700), read: true },
    { id: "n14", userId: "u-sam", title: "9 items waiting for review", body: "Identity checks, title documents and one flagged car need a look.", href: "/admin/verifications", at: ago(1), read: false },
    { id: "n15", userId: "u-sam", title: "A payment dispute needs a reply", body: "Deal d-1003 · reply by Oct 14.", href: "/admin/payments?tab=disputes", at: ago(4), read: false },
    { id: "n16", userId: "u-sam", title: "Soft credit check is slow", body: "Response times are above normal. Check the integration page.", href: "/admin/integrations", at: ago(7), read: false },
    { id: "n17", userId: "u-sam", title: "A deal has been quiet for 5 days", body: "The 2019 Tesla Model 3 deal hasn’t moved. You may want to nudge both sides.", href: "/admin/deals", at: ago(28), read: true },
    { id: "n18", userId: "u-sam", title: "Weekly summary is ready", body: "New people, deals closed and fees collected this week.", href: "/admin", at: ago(72), read: true },
  ];
}

let cache: Notice[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Notice[]) : seed();
  } catch {
    cache = seed();
  }
}

function write(next: Notice[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

const EMPTY: Notice[] = [];

function useAll(): Notice[] {
  return useSyncExternalStore(
    (l) => {
      load();
      listeners.add(l);
      l();
      return () => listeners.delete(l);
    },
    () => cache,
    () => EMPTY,
  );
}

export function useNotices(userId: string | undefined) {
  const all = useAll();
  const items = all.filter((n) => n.userId === userId).sort((a, b) => b.at.localeCompare(a.at));
  return {
    items,
    unread: items.filter((n) => !n.read).length,
    markRead: (id?: string) =>
      write(cache.map((n) => (n.userId === userId && (!id || n.id === id) ? { ...n, read: true } : n))),
    markUnread: (id: string) => write(cache.map((n) => (n.id === id ? { ...n, read: false } : n))),
  };
}

export function pushNotice(n: Omit<Notice, "id" | "at" | "read">) {
  load();
  write([{ ...n, id: `n-${Date.now().toString(36)}`, at: new Date().toISOString(), read: false }, ...cache]);
}

export function resetNotices() {
  write(seed());
}

/** Notices made while using the app are shared, so a seller's reply reaches the buyer's bell in another browser. */
const isSeedNotice = (id: string) => /^n[0-9]+$/.test(id);
export const noticeSync: SyncSource & { subscribe: (l: () => void) => () => void } = {
  subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  local() {
    load();
    return cache.filter((n) => !isSeedNotice(n.id)).map((n) => ({ id: `notif:${n.id}`, refs: [n], data: () => n }));
  },
  apply(docs, dirty) {
    load();
    let next = cache;
    for (const r of docs) {
      if (!r.id.startsWith("notif:") || dirty.has(r.id)) continue;
      const n = r.data as Notice;
      const i = next.findIndex((x) => x.id === n.id);
      if (i >= 0 && hashOf(next[i]) === hashOf(n)) continue;
      next = i >= 0 ? next.map((x, j) => (j === i ? n : x)) : [n, ...next];
    }
    if (next !== cache) write(next);
  },
};
