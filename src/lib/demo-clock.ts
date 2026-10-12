import { demoFlags } from "./session";

/** The demo's "today". The toolbar's time travel moves it forward in days. */
export const demoNow = () => new Date(Date.now() + (demoFlags.get().daysAhead ?? 0) * 86_400_000);
