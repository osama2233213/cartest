/**
 * Keeps the parts of the demo that people share (cars, deals and their chat, notices, new accounts) in step across
 * browsers through the shared database. Each store describes its shareable docs; this engine pulls what others
 * changed, merges it in, and pushes what this browser changed. Last write wins per doc, except that chat messages
 * and notices are merged so two people typing at once lose nothing.
 */
import { pullShared, pushShared } from "./shared.functions";

export type LocalDoc = {
  id: string;
  /** Objects the doc is built from. Unchanged references mean an unchanged doc, so we skip re-hashing it. */
  refs: unknown[];
  data: () => unknown;
};
export type RemoteDoc = { id: string; data: unknown; rev: number };

export interface SyncSource {
  /** Every shareable doc as this browser has it now. */
  local(): LocalDoc[];
  /**
   * Merge docs that came from the database. `dirty` ids were changed here since we last synced them, so keep ours.
   * `fresh` ids are ones this browser has never synced: the database wins, but nothing typed here may be lost.
   */
  apply(docs: RemoteDoc[], dirty: Set<string>, fresh: Set<string>): void;
  /** Ids that every browser starts with (demo seed data), so an untouched one is never pushed. */
  isPristine?(id: string, hash: string): boolean;
}

const POLL_MS = 2500;

export function hashOf(data: unknown): string {
  return JSON.stringify(data) ?? "";
}

export function createSharedSync(sources: SyncSource[]) {
  const synced = new Map<string, string>();
  const cache = new Map<string, { refs: unknown[]; hash: string }>();
  let since = 0;
  let running = false;
  let again = false;
  let timer = 0;
  let stopped = false;

  const hashLocal = (d: LocalDoc) => {
    const c = cache.get(d.id);
    if (c && c.refs.length === d.refs.length && c.refs.every((r, i) => r === d.refs[i])) return c.hash;
    const hash = hashOf(d.data());
    cache.set(d.id, { refs: d.refs, hash });
    return hash;
  };

  const locals = () => sources.flatMap((s) => s.local().map((d) => ({ s, d })));

  async function cycle() {
    // 1. What did others change?
    const res = await pullShared({ data: { since } });
    if (!res.ok) return;
    const remote: RemoteDoc[] = res.docs.map((d) => ({ id: d.id, data: JSON.parse(d.json) as unknown, rev: d.rev }));
    if (remote.length) {
      const dirty = new Set<string>();
      const fresh = new Set<string>();
      for (const { s, d } of locals()) {
        const hash = hashLocal(d);
        const known = synced.get(d.id);
        if (known === undefined) {
          if (!s.isPristine?.(d.id, hash)) fresh.add(d.id);
        } else if (known !== hash) dirty.add(d.id);
      }
      for (const s of sources) s.apply(remote, dirty, fresh);
      for (const r of remote) {
        synced.set(r.id, hashOf(r.data));
        since = Math.max(since, r.rev);
      }
    }
    // 2. What did we change?
    const out: { id: string; data: unknown; hash: string }[] = [];
    for (const { s, d } of locals()) {
      const hash = hashLocal(d);
      if (synced.get(d.id) === hash) continue;
      // Never offer the untouched demo seed: every browser already has it.
      if (!synced.has(d.id) && s.isPristine?.(d.id, hash)) {
        synced.set(d.id, hash);
        continue;
      }
      out.push({ id: d.id, data: d.data(), hash });
    }
    for (let i = 0; i < out.length; i += 20) {
      const chunk = out.slice(i, i + 20);
      const r = await pushShared({ data: { docs: chunk.map(({ id, data }) => ({ id, json: JSON.stringify(data) })) } });
      if (!r.ok) return;
      for (const c of chunk) synced.set(c.id, c.hash);
    }
  }

  async function run() {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      await cycle();
    } catch (err) {
      console.warn("[shared-sync]", err);
    } finally {
      running = false;
      if (again) {
        again = false;
        void run();
      }
    }
  }

  const loop = () => {
    if (stopped) return;
    if (typeof document === "undefined" || document.visibilityState === "visible") void run();
    timer = window.setTimeout(loop, POLL_MS);
  };

  let poke = 0;
  return {
    start() {
      stopped = false;
      loop();
    },
    stop() {
      stopped = true;
      window.clearTimeout(timer);
      window.clearTimeout(poke);
    },
    /** Something changed locally: push soon instead of waiting for the next poll. */
    changed() {
      window.clearTimeout(poke);
      poke = window.setTimeout(() => void run(), 350);
    },
    now: run,
  };
}

/** Merge two lists of {id} items: everything in `remote` order, then local-only ones. */
export function unionById<T extends { id: string }>(remote: T[] = [], local: T[] = []): T[] {
  const seen = new Set(remote.map((m) => m.id));
  return [...remote, ...local.filter((m) => !seen.has(m.id))];
}
