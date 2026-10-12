import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useState, useSyncExternalStore } from "react";
import { useToast } from "@/components/kit";
import { useCurrentUser } from "./session";

const KEY = "ownerfi-poc-saved-v1";
type Saved = Record<string, string[]>;

let cache: Saved = {};
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Saved;
  } catch {
    cache = {};
  }
}

function write(next: Saved) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const EMPTY: Saved = {};

function useSavedMap(): Saved {
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

export function useSavedIds(userId: string | undefined): string[] {
  const map = useSavedMap();
  return userId ? (map[userId] ?? []) : [];
}

/** Heart-button state for car cards. Only buyers (or signed-out visitors) can save. */
export function useSaved() {
  const user = useCurrentUser();
  const map = useSavedMap();
  const toast = useToast();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const mine = user ? (map[user.id] ?? []) : [];
  const canSave = !user || user.role === "buyer";
  const isSaved = (id: string) => optimistic[id] ?? mine.includes(id);

  const toggle = useCallback(
    (id: string) => {
      if (!user) {
        toast({ tone: "info", title: "Log in to save cars" });
        navigate({ to: "/auth/login", search: { next: href } as never });
        return;
      }
      const has = (cache[user.id] ?? []).includes(id);
      const list = has ? (cache[user.id] ?? []).filter((x) => x !== id) : [...(cache[user.id] ?? []), id];
      setOptimistic((o) => ({ ...o, [id]: !has }));
      write({ ...cache, [user.id]: list });
      setOptimistic((o) => {
        const { [id]: _drop, ...rest } = o;
        return rest;
      });
      toast({ tone: "success", title: has ? "Removed from saved" : "Saved" });
    },
    [user, toast, navigate, href],
  );

  return { canSave, isSaved, toggle };
}
