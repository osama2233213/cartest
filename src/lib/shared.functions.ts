import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const docId = z.string().regex(/^(vehicle|vedit|deal|user|notif|drive):[\w.-]{1,80}$/);

// Docs travel as JSON strings: they are free-form, so the server-function types can't describe them.

/** Everything written since `since` (a rev from an earlier pull). */
export const pullShared = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ since: z.number().min(0) }).parse(d))
  .handler(async ({ data }) => {
    const { sharedStore } = await import("./shared-store.server");
    try {
      const store = await sharedStore();
      const docs = (await store.pull(data.since)).map((d) => ({ id: d.id, json: JSON.stringify(d.data), rev: d.rev }));
      return { ok: true as const, backend: store.name, docs };
    } catch (err) {
      console.error("[shared] pull failed", err);
      return { ok: false as const, backend: "", docs: [] };
    }
  });

/** Writes docs (last write wins per id). Returns false if the database is unreachable, so the client retries. */
export const pushShared = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ docs: z.array(z.object({ id: docId, json: z.string().max(8_000_000) })).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sharedStore } = await import("./shared-store.server");
    try {
      const store = await sharedStore();
      await store.push(data.docs.map((d) => ({ id: d.id, data: JSON.parse(d.json) as unknown })));
      return { ok: true as const };
    } catch (err) {
      console.error("[shared] push failed", err);
      return { ok: false as const };
    }
  });

/** Demo reset: wipes the shared database for everyone. */
export const resetShared = createServerFn({ method: "POST" }).handler(async () => {
  const { sharedStore } = await import("./shared-store.server");
  try {
    await (await sharedStore()).reset();
    return { ok: true as const };
  } catch (err) {
    console.error("[shared] reset failed", err);
    return { ok: false as const };
  }
});

/** One car or deal by id, for a link opened in a browser that hasn't synced yet. */
export const getSharedDoc = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ kind: z.enum(["vehicle", "deal"]), id: z.string().regex(/^[w.-]{1,80}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { sharedStore } = await import("./shared-store.server");
    try {
      const doc = await (await sharedStore()).get(`${data.kind}:${data.id}`);
      return { json: doc ? JSON.stringify(doc.data) : null };
    } catch (err) {
      console.error("[shared] get failed", err);
      return { json: null };
    }
  });
