/**
 * The shared demo database behind every browser. Docs are small JSON blobs keyed by id ("vehicle:v-demo-1",
 * "deal:d-1", "notif:n-9"). Each write gets a rising `rev`, and clients ask for everything newer than the last rev
 * they saw.
 *
 * Backend: the Supabase `shared_docs` table (see supabase/migrations) when it exists. Otherwise a JSON file in
 * `.data/` (local dev), or plain memory where there is no disk. Chosen once per server process.
 */
import { createClient } from "@supabase/supabase-js";

export type Doc = { id: string; data: unknown; rev: number };

interface Backend {
  name: string;
  pull(since: number): Promise<Doc[]>;
  push(docs: { id: string; data: unknown }[]): Promise<Doc[]>;
  get(id: string): Promise<Doc | null>;
  reset(): Promise<void>;
}

let lastRev = 0;
const nextRev = () => (lastRev = Math.max(Date.now(), lastRev + 1));

function supabaseBackend(): Backend | null {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h, signal: init?.signal ?? AbortSignal.timeout(8000) });
      },
    },
  });
  return {
    name: "supabase",
    async pull(since) {
      const { data, error } = await sb.from("shared_docs").select("id, data, rev").gt("rev", since).order("rev").limit(1000);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id as string, data: r.data, rev: Number(r.rev) }));
    },
    async get(id) {
      const { data, error } = await sb.from("shared_docs").select("id, data, rev").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? { id: data.id as string, data: data.data, rev: Number(data.rev) } : null;
    },
    async push(docs) {
      const rows = docs.map((d) => ({ id: d.id, data: d.data as never, rev: nextRev() }));
      const { error } = await sb.from("shared_docs").upsert(rows);
      if (error) throw error;
      return rows.map((r) => ({ id: r.id, data: r.data, rev: r.rev }));
    },
    async reset() {
      const { error } = await sb.from("shared_docs").delete().neq("id", "");
      if (error) throw error;
    },
  };
}

async function probeSupabase(): Promise<Backend | null> {
  const b = supabaseBackend();
  if (!b) return null;
  try {
    await b.pull(Number.MAX_SAFE_INTEGER);
    return b;
  } catch {
    return null;
  }
}

async function localBackend(): Promise<Backend> {
  const docs = new Map<string, Doc>();
  let fs: typeof import("node:fs/promises") | null = null;
  let file = "";
  let dir = "";
  try {
    fs = await import("node:fs/promises");
    const path = await import("node:path");
    dir = path.join(process.cwd(), ".data");
    file = path.join(dir, "shared-docs.json");
    const rows = JSON.parse(await fs.readFile(file, "utf8")) as Doc[];
    for (const r of rows) {
      docs.set(r.id, r);
      lastRev = Math.max(lastRev, r.rev);
    }
  } catch {
    // no file yet, or no disk: start empty
  }
  const save = async () => {
    if (!fs || !file) return;
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file, JSON.stringify([...docs.values()]));
    } catch {
      // keep serving from memory
    }
  };
  return {
    name: file ? "file" : "memory",
    async pull(since) {
      return [...docs.values()].filter((d) => d.rev > since).sort((a, b) => a.rev - b.rev);
    },
    async get(id) {
      return docs.get(id) ?? null;
    },
    async push(list) {
      const out = list.map((d) => ({ id: d.id, data: d.data, rev: nextRev() }));
      for (const d of out) docs.set(d.id, d);
      await save();
      return out;
    },
    async reset() {
      docs.clear();
      await save();
    },
  };
}

let backendPromise: Promise<Backend> | undefined;
export function sharedStore(): Promise<Backend> {
  backendPromise ??= probeSupabase().then(async (b) => {
    const chosen = b ?? (await localBackend());
    console.info(`[shared-store] using ${chosen.name}`);
    return chosen;
  });
  return backendPromise;
}
