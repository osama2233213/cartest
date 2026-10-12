import { useSyncExternalStore } from "react";

export type Notice = { id: string; userId: string; title: string; body: string; href: string; at: string; read: boolean };

const KEY = "ownerfi-poc-notifications-v1";
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

function seed(): Notice[] {
  return [
    { id: "n1", userId: "u-maria", title: "New offer on your Honda Accord", body: "Daniel sent an offer. Review it and say yes, counter or no.", href: "/seller/deals", at: ago(2), read: false },
    { id: "n2", userId: "u-maria", title: "Test drive requested", body: "A buyer asked to see your Tesla Model 3 on Saturday.", href: "/seller/test-drives", at: ago(5), read: false },
    { id: "n3", userId: "u-maria", title: "Payment received", body: "Your monthly payment landed in your bank account.", href: "/seller/payments", at: ago(30), read: true },
    { id: "n4", userId: "u-daniel", title: "Your test drive is confirmed", body: "Maria confirmed Saturday at 2:00 PM.", href: "/buyer/test-drives", at: ago(3), read: false },
    { id: "n5", userId: "u-daniel", title: "Payment due soon", body: "Your next payment is due in 3 days.", href: "/buyer/payments", at: ago(26), read: false },
    { id: "n6", userId: "u-sam", title: "5 items waiting for review", body: "Identity checks and one theft check need a look.", href: "/admin/verifications", at: ago(1), read: false },
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
