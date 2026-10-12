import { useSyncExternalStore } from "react";

export const THEMES = [
  { id: "blue", name: "OwnerFi Blue", swatch: ["#175CD3", "#0B1B33"] },
  { id: "purple", name: "Original Purple", swatch: ["#4A09F5", "#1A1A1F"] },
  { id: "teal", name: "Teal", swatch: ["#08768A", "#0D2730"] },
  { id: "graphite", name: "Graphite", swatch: ["#18181B", "#D4D4D8"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const KEY = "ownerfi-theme";
const listeners = new Set<() => void>();
const valid = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

function read(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    return valid(v) ? v : "blue";
  } catch {
    return "blue";
  }
}

let current: ThemeId = "blue";

/** Runs before first paint (see the inline script in __root) and again on the client. */
export function initTheme() {
  if (typeof window === "undefined") return;
  current = read();
  document.documentElement.dataset["theme"] = current;
  listeners.forEach((l) => l());
}

export function setTheme(id: ThemeId) {
  current = id;
  document.documentElement.dataset["theme"] = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useTheme(): ThemeId {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => "blue",
  );
}

/** Inline script that applies the saved theme before React hydrates (avoids a colour flash). */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t&&["blue","purple","teal","graphite"].indexOf(t)>-1)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
