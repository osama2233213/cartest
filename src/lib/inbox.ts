import { useSyncExternalStore } from "react";

/** Which conversations the user has opened, so the inbox can show unread counts. */
const KEY = "ownerfi-poc-inbox-read-v1";
type ReadMap = Record<string, number>; // `${userId}:${dealId}` -> messages seen

let cache: ReadMap = {};
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY: ReadMap = {};

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as ReadMap;
  } catch {
    cache = {};
  }
}

export function useReadMap(): ReadMap {
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

export function markSeen(userId: string, dealId: string, count: number) {
  load();
  const k = `${userId}:${dealId}`;
  if (cache[k] === count) return;
  cache = { ...cache, [k]: count };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export const QUICK_REPLIES = {
  seller: ["Yes, it’s still available", "Thursday after 5 works", "Happy to share service records", "Make an offer and we’ll talk"],
  buyer: ["Is it still available?", "Can I see service records?", "Any accidents?", "Can I book a test drive?"],
};
