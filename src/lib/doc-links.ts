/**
 * Private, signed, short-lived links to documents. A link only works for the person it was made for,
 * only until it expires, and only if that person is still an owner of the document.
 */
import { hashText } from "./deal-rules";

export const DOC_LINK_TTL_MS = 5 * 60_000;

export type DocRef = { id: string; title: string; kind: "identity" | "contract" | "bill_of_sale"; /** User ids who may open it. */ owners: string[]; detail?: string };
type LinkRecord = { token: string; doc: DocRef; userId: string; expiresAt: number };

const KEY = "ownerfi-poc-doc-links-v1";
const SECRET = "doc-link-secret-demo";

const read = (): LinkRecord[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as LinkRecord[];
  } catch {
    return [];
  }
};
const write = (v: LinkRecord[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

const sign = (docId: string, exp: number, userId: string) => hashText(`${docId}|${exp}|${userId}|${SECRET}`) + hashText(`${SECRET}|${userId}|${exp}|${docId}`, 0x9e3779b9);

/** Makes a link for one person. Anyone who isn't an owner of the document can't get one. */
export function issueLink(doc: DocRef, userId: string, now = Date.now(), ttl = DOC_LINK_TTL_MS): { token: string; expiresAt: number } {
  if (!doc.owners.includes(userId)) throw new Error("You can only open your own documents.");
  const expiresAt = now + ttl;
  const token = `${encodeURIComponent(doc.id)}.${expiresAt.toString(36)}.${sign(doc.id, expiresAt, userId)}`;
  // Old, expired links are dropped as new ones are made.
  write([...read().filter((r) => r.expiresAt > now), { token, doc, userId, expiresAt }]);
  return { token, expiresAt };
}

export type LinkResult = { ok: true; doc: DocRef; expiresAt: number } | { ok: false; reason: "invalid" | "expired" | "signed_out" | "not_owner" };

export function resolveLink(token: string, viewerId: string | null, now = Date.now()): LinkResult {
  const rec = read().find((r) => r.token === token);
  if (!rec) return { ok: false, reason: "invalid" };
  if (rec.token.split(".")[2] !== sign(rec.doc.id, rec.expiresAt, rec.userId)) return { ok: false, reason: "invalid" };
  if (rec.expiresAt <= now) return { ok: false, reason: "expired" };
  if (!viewerId) return { ok: false, reason: "signed_out" };
  if (viewerId !== rec.userId || !rec.doc.owners.includes(viewerId)) return { ok: false, reason: "not_owner" };
  return { ok: true, doc: rec.doc, expiresAt: rec.expiresAt };
}
