import { useSyncExternalStore } from "react";

export type Autopay = { enabled: boolean; day: number };
const KEY = "ownerfi-poc-autopay-v1";
let cache: Record<string, Autopay> = {};
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY: Record<string, Autopay> = {};

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Autopay>;
  } catch {
    cache = {};
  }
}

export function useAutopay(dealId: string): Autopay {
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
  return all[dealId] ?? { enabled: false, day: 5 };
}

/** Non-hook read, for the payment schedule. */
export function getAutopay(dealId: string): Autopay {
  load();
  return cache[dealId] ?? { enabled: false, day: 5 };
}

export function setAutopay(dealId: string, v: Autopay) {
  load();
  cache = { ...cache, [dealId]: v };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** Clears every autopay setting (used by "Reset demo data"). */
export function resetAutopay() {
  cache = {};
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
