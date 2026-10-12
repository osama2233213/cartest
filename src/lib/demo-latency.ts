/**
 * How long the demo pretends something takes (looking up a VIN, running the car checks, linking a bank, posting an ad).
 * These waits only exist so the screens feel real, so they are kept short. Add `?fast=1` to any address to skip them.
 */
export const DEMO_MS = {
  vinLookup: 250,
  checkRow: 250,
  writeDescription: 300,
  linkBank: 600,
  adQueued: 150,
  adLive: 700,
} as const;

/** The wait for one of the above, or 0 when the address has `?fast=1`. */
export function demoMs(ms: number): number {
  if (typeof window === "undefined") return ms;
  try {
    return new URLSearchParams(window.location.search).get("fast") === "1" ? 0 : ms;
  } catch {
    return ms;
  }
}
