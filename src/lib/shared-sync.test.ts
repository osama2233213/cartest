import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory stand-in for the shared database, so two "browsers" can sync through it.
const db = new Map<string, { json: string; rev: number }>();
let rev = 0;
vi.mock("./shared.functions", () => ({
  pullShared: async ({ data }: { data: { since: number } }) => ({
    ok: true,
    backend: "test",
    docs: [...db.entries()].filter(([, v]) => v.rev > data.since).map(([id, v]) => ({ id, json: v.json, rev: v.rev })),
  }),
  pushShared: async ({ data }: { data: { docs: { id: string; json: string }[] } }) => {
    for (const d of data.docs) db.set(d.id, { json: d.json, rev: ++rev });
    return { ok: true };
  },
}));

import { createSharedSync, unionById, type SyncSource } from "./shared-sync";

type Chat = { id: string; text: string };
/** One browser: a list of cars and a deal chat, shared through the engine. */
function browser(seedChat: Chat[] = []) {
  const s = { cars: [] as { id: string }[], chat: seedChat };
  const source: SyncSource = {
    local: () => [
      ...s.cars.map((c) => ({ id: `vehicle:${c.id}`, refs: [c], data: () => c })),
      { id: "deal:d1", refs: [s.chat], data: () => ({ messages: s.chat }) },
    ],
    isPristine: (id, hash) => id === "deal:d1" && hash === JSON.stringify({ messages: seedChat }),
    apply: (docs, dirty, fresh) => {
      for (const r of docs) {
        if (r.id.startsWith("vehicle:") && !s.cars.some((c) => `vehicle:${c.id}` === r.id)) s.cars = [...s.cars, r.data as { id: string }];
        if (r.id === "deal:d1") {
          const remote = (r.data as { messages: Chat[] }).messages;
          s.chat = dirty.has(r.id) || fresh.has(r.id) ? unionById(remote, s.chat) : remote;
        }
      }
    },
  };
  return { s, sync: createSharedSync([source]) };
}

describe("shared sync", () => {
  beforeEach(() => {
    db.clear();
    rev = 0;
  });

  it("shows a seller's new car to a buyer in another browser", async () => {
    const seller = browser();
    const buyer = browser();
    await buyer.sync.now();
    seller.s.cars = [{ id: "v-demo-1" }];
    await seller.sync.now();
    await buyer.sync.now();
    expect(buyer.s.cars).toEqual([{ id: "v-demo-1" }]);
  });

  it("carries chat both ways", async () => {
    const a = browser();
    const b = browser();
    a.s.chat = [{ id: "m1", text: "Is it available?" }];
    await a.sync.now();
    await b.sync.now();
    expect(b.s.chat.map((m) => m.text)).toEqual(["Is it available?"]);
    b.s.chat = [...b.s.chat, { id: "m2", text: "Yes!" }];
    await b.sync.now();
    await a.sync.now();
    expect(a.s.chat.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("keeps both messages when two people write at once", async () => {
    const a = browser([{ id: "m0", text: "hi" }]);
    const b = browser([{ id: "m0", text: "hi" }]);
    a.s.chat = [...a.s.chat, { id: "ma", text: "from A" }];
    b.s.chat = [...b.s.chat, { id: "mb", text: "from B" }];
    await a.sync.now(); // A pushes first
    await b.sync.now(); // B pulls A's, merges its own, pushes
    await a.sync.now();
    expect(new Set(a.s.chat.map((m) => m.id))).toEqual(new Set(["m0", "ma", "mb"]));
    expect(new Set(b.s.chat.map((m) => m.id))).toEqual(new Set(["m0", "ma", "mb"]));
  });

  it("never pushes an untouched seed deal", async () => {
    const a = browser([{ id: "m0", text: "hi" }]);
    await a.sync.now();
    expect(db.has("deal:d1")).toBe(false);
  });
});
