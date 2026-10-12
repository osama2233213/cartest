/**
 * A buyer's payment methods: linked bank accounts and cards. Stored per person in this browser (a demo; no real
 * card or bank number is ever kept, only the last 4 digits). The bank they linked while verifying shows up as the default.
 */
import { useSyncExternalStore } from "react";

export type PayMethod = { id: string; kind: "bank" | "card"; /** "Chase checking" or "Visa" */ name: string; last4: string; isDefault: boolean };

const KEY = "ownerfi-poc-pay-methods-v1";
type Store = Record<string, PayMethod[]>;
let cache: Store = {};
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY: Store = {};

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    cache = {};
  }
}

function write(next: Store) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** Before anything is saved: someone with a verified bank has that bank and a card on file. */
export const defaultMethods = (bankVerified: boolean): PayMethod[] =>
  bankVerified
    ? [
        { id: "pm-bank-4821", kind: "bank", name: "Chase checking", last4: "4821", isDefault: true },
        { id: "pm-card-4242", kind: "card", name: "Visa", last4: "4242", isDefault: false },
      ]
    : [];

export const methodLabel = (m: PayMethod) => (m.kind === "bank" ? `Bank transfer · ${m.name} ••${m.last4}` : `Card · ${m.name} •••• ${m.last4}`);

/* ----------------------------------------------------------------- validation */

const luhn = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

export const cardBrand = (digits: string) => (digits.startsWith("4") ? "Visa" : /^5[1-5]/.test(digits) ? "Mastercard" : digits.startsWith("3") ? "Amex" : "Card");

/** Checks a card the buyer typed. Returns what's wrong, or "" when it's fine. */
export function cardError(number: string, expiry: string, now = new Date()): { number?: string; expiry?: string } {
  const digits = number.replace(/\D/g, "");
  const out: { number?: string; expiry?: string } = {};
  if (digits.length < 13 || digits.length > 19 || !luhn(digits)) out.number = "That card number doesn’t look right.";
  const m = /^(\d{2})\/(\d{2})$/.exec(expiry.trim());
  if (!m) out.expiry = "Enter the expiry as MM/YY.";
  else {
    const month = Number(m[1]);
    const year = 2000 + Number(m[2]);
    if (month < 1 || month > 12) out.expiry = "Enter a real month.";
    else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) out.expiry = "That card has expired.";
  }
  return out;
}

/* ------------------------------------------------------------------------ store */

const useStore = () =>
  useSyncExternalStore(
    (l) => {
      load();
      listeners.add(l);
      l();
      return () => listeners.delete(l);
    },
    () => cache,
    () => EMPTY,
  );

export function usePaymentMethods(userId: string | undefined, bankVerified: boolean) {
  const store = useStore();
  const methods = userId ? (store[userId] ?? defaultMethods(bankVerified)) : [];
  const current = () => (userId ? (cache[userId] ?? defaultMethods(bankVerified)) : []);
  const save = (next: PayMethod[]) => userId && write({ ...cache, [userId]: next });
  return {
    methods,
    default: methods.find((m) => m.isDefault) ?? methods[0],
    add(m: Omit<PayMethod, "id" | "isDefault">) {
      const list = current();
      save([...list, { ...m, id: `pm-${m.kind}-${m.last4}-${Date.now().toString(36)}`, isDefault: list.length === 0 }]);
    },
    makeDefault(id: string) {
      save(current().map((m) => ({ ...m, isDefault: m.id === id })));
    },
    /** Removes a method. If it was the default, the next one takes over. */
    remove(id: string) {
      const rest = current().filter((m) => m.id !== id);
      save(rest.some((m) => m.isDefault) || rest.length === 0 ? rest : rest.map((m, i) => ({ ...m, isDefault: i === 0 })));
    },
  };
}
