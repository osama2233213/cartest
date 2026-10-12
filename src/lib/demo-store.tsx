import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addMonths } from "date-fns/addMonths";
import { DEALS, termsFor, type DemoDeal, type Stage, PERSONAS } from "./demo-data";
import type { PublicVehicle } from "./vehicles.functions";
import { dealTerms, rateCapForState } from "./finance";
import {
  feeLabel,
  inspectionFeeCents,
  maxRounds,
  RuleError,
  acceptOfferVersion,
  addOffer,
  applyWebhook,
  buildEvidence,
  canActivateLoan,
  canCancel,
  canRenegotiate,
  currentOffer,
  emptyPayment,
  makeEvent,
  normalizePayment,
  refundAmount,
  type ClosingEvidence,
  type DownPayment,
  type InspectionBooking,
  type InspectionDecision,
  type OfferTerms,
  type OfferVersion,
  type SignatureEvidence,
} from "./deal-rules";
import { validateOffer } from "./offer";
import { shortCar } from "./format";
import { getAutopay } from "./autopay";
import { demoNow } from "./demo-clock";
import { liveSettings } from "./live-settings";
import { advance, daysLate, fmtDue, recordPayment, type InstState, type SchedEvent } from "./installments";
import { notify } from "./notify";
import { createSharedSync, hashOf, unionById, type SyncSource } from "./shared-sync";
import { resetShared } from "./shared.functions";
import { noticeSync } from "./notifications";
import { driveSync } from "./drives";
import type { EventKey } from "./prefs";
import { accountSync, demoFlags, getSessionState, useSession } from "./session";

export interface DealMessage {
  id: string;
  sender: "seller" | "buyer";
  senderName: string;
  text: string;
  time: string;
}

export interface DealTestDrive {
  slot: string;
  location: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled";
}

/** What a buyer can do to a test drive that is already booked. */
export type TestDriveChange = { kind: "cancelled"; reason: string } | { kind: "rescheduled"; slot: string };

export interface DealCounterOffer {
  proposedBy: "seller" | "buyer";
  priceCents: number;
  downPct: number;
  apr: number;
  term: number;
  monthly: number;
  note?: string | undefined;
}

export interface DealInspectionItem {
  name: string;
  status: "pass" | "good" | "wear";
  note: string;
}

export interface DealContract {
  sellerSigned: boolean;
  sellerSignedAt?: string | undefined;
  sellerSignature?: SignatureEvidence | undefined;
  buyerSigned: boolean;
  buyerSignedAt?: string | undefined;
  buyerSignature?: SignatureEvidence | undefined;
  agreementNumber: string;
}

export type DealPayment = DownPayment;

export interface DealClosing {
  titleTransferred: boolean;
  lienholderRecorded: boolean;
  keysHandedOver: boolean;
  documentsExchanged: boolean;
  completed: boolean;
  sellerConfirmed?: boolean | undefined;
  buyerConfirmed?: boolean | undefined;
  evidence?: ClosingEvidence[] | undefined;
}

export interface DealCancellation {
  by: "buyer" | "seller" | "admin";
  reason: string;
  at: string;
  refundCents: number;
  relisted: boolean;
}

export type DealInstallmentState = InstState;

export interface DealDetailData {
  messages: DealMessage[];
  testDrive?: DealTestDrive | undefined;
  counterOffer?: DealCounterOffer | undefined;
  inspection?: {
    passed: boolean;
    date: string;
    inspector: string;
    items: DealInspectionItem[];
  } | undefined;
  contract?: DealContract | undefined;
  payment?: DealPayment | undefined;
  closing?: DealClosing | undefined;
  installment?: DealInstallmentState | undefined;
  /** Every offer and counter, in order. Only the one marked "current" can be accepted. */
  offers?: OfferVersion[] | undefined;
  /** Offers before this index belong to an earlier negotiation (reset by a renegotiation). */
  roundBase?: number | undefined;
  inspectionBooking?: InspectionBooking | undefined;
  inspectionDecision?: InspectionDecision | undefined;
  renegotiations?: number | undefined;
  cancellation?: DealCancellation | undefined;
  /** Set when the loan is paid off. The seller then releases the lien. */
  lien?: { requestedAt: string; paidOffCents: number; releasedAt?: string | undefined } | undefined;
}

/** Offer history for a deal. Older saved deals only have the latest counter-offer, so rebuild a short history from it. */
export function offersOf(detail: DealDetailData): OfferVersion[] {
  if (detail.offers) return detail.offers;
  const c = detail.counterOffer;
  if (!c) return [];
  const terms: OfferTerms = { priceCents: c.priceCents, downPct: c.downPct, apr: c.apr, term: c.term };
  const at = new Date().toISOString();
  return c.proposedBy === "seller"
    ? [
        { version: 1, by: "buyer", terms, monthly: c.monthly, status: "superseded", at },
        { version: 2, by: "seller", terms, monthly: c.monthly, ...(c.note ? { note: c.note } : {}), status: "current", at },
      ]
    : [{ version: 1, by: "buyer", terms, monthly: c.monthly, ...(c.note ? { note: c.note } : {}), status: "current", at }];
}

/** Seller edits to a listing (pause, new terms). Applied on top of the database/custom car. */
export type VehicleEdit = Partial<
  Pick<PublicVehicle, "status" | "price_cents" | "min_down_pct" | "apr" | "allowed_terms">
>;

export interface DemoStoreState {
  vehicleEdits?: Record<string, VehicleEdit> | undefined;
  customVehicles: PublicVehicle[];
  deals: DemoDeal[];
  dealDetails: Record<string, DealDetailData>;
}

const STORAGE_KEY = "ownerfi_demo_store_v2";

export const DEFAULT_INSPECTION = {
  passed: true,
  date: "Today, 10:30 AM",
  inspector: "SafeDrive Mobile Inspection #AZ-4821",
  items: [
    { name: "Engine & Powertrain", status: "pass" as const, note: "Clean diagnostic scan, no fluid leaks, optimal compression" },
    { name: "Transmission & Drivetrain", status: "pass" as const, note: "Smooth gear transition, fluid level correct" },
    { name: "Braking System", status: "good" as const, note: "Pads 8mm front, 7mm rear (70%+ life remaining)" },
    { name: "Tires & Suspension", status: "wear" as const, note: "Tires 6/32 tread, minor cosmetic rim scuff" },
    { name: "Frame & Structure", status: "pass" as const, note: "No collision repairs, OEM panel gaps, clean unibody" },
    { name: "Electrical & OBD-II", status: "pass" as const, note: "Battery health 94%, all electronics & ADAS operational" },
  ],
};

function ensureDealDetail(details: Record<string, DealDetailData>, dealId: string): DealDetailData {
  const existing = details[dealId];
  if (existing) return existing;
  return {
    messages: [],
    inspection: DEFAULT_INSPECTION,
    contract: {
      sellerSigned: true,
      sellerSignedAt: "Oct 4, 2026",
      buyerSigned: false,
      agreementNumber: `OF-DEMO-${dealId.slice(-4)}`,
    },
    closing: {
      titleTransferred: false,
      lienholderRecorded: false,
      keysHandedOver: false,
      documentsExchanged: false,
      completed: false,
    },
  };
}

function getInitialState(): DemoStoreState {
  if (typeof window === "undefined") {
    return { customVehicles: [], deals: [...DEALS], dealDetails: {} };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.deals) && Array.isArray(parsed.customVehicles)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to load demo store from localStorage:", err);
  }

  return seedState();
}

/** The deals every browser starts with. */
function seedState(): DemoStoreState {
  // Pre-seed deals with rich stage-aware data
  const initialDetails: Record<string, DealDetailData> = {
    "d-1001": {
      messages: [
        { id: "m-1", sender: "buyer", senderName: "Daniel Park", text: "Hi Maria! Is the Accord Sport still available? Would love to inspect the service records.", time: "Yesterday" },
        { id: "m-2", sender: "seller", senderName: "Maria Alvarez", text: "Hi Daniel! Yes, it's garage kept with full synthetic oil records. Financing terms are ready.", time: "2h ago" },
      ],
      testDrive: { slot: "Sat, Oct 11 · 2:00 PM", location: "Camelback Rd, Phoenix, AZ", status: "completed" },
      counterOffer: {
        proposedBy: "seller",
        priceCents: 2200000,
        downPct: 15,
        apr: 10,
        term: 48,
        monthly: dealTerms({ priceCents: 2200000, downPct: 15, apr: 10, termMonths: 48 }).monthly,
        note: "Approved at 15% down with 10% APR. State usury cap compliant (AZ max is 10%).",
      },
      inspection: DEFAULT_INSPECTION,
      contract: { sellerSigned: true, sellerSignedAt: "Oct 4, 2026", buyerSigned: false, agreementNumber: "OF-AZ-2026-8819" },
      payment: emptyPayment(),
      closing: { titleTransferred: false, lienholderRecorded: false, keysHandedOver: false, documentsExchanged: false, completed: false, sellerConfirmed: false, buyerConfirmed: false, evidence: [] },
      installment: { paidCount: 0, totalCount: 48, nextDueDate: "Nov 5, 2026", dueAt: new Date(2026, 10, 5).toISOString(), monthlyAmount: dealTerms({ priceCents: 2200000, downPct: 15, apr: 10, termMonths: 48 }).monthly },
    },
    "d-1003": {
      messages: [],
      testDrive: { slot: "Completed", location: "Austin, TX", status: "completed" },
      inspection: DEFAULT_INSPECTION,
      contract: { sellerSigned: true, sellerSignedAt: "Sep 1, 2026", buyerSigned: true, buyerSignedAt: "Sep 2, 2026", agreementNumber: "OF-TX-2026-4402" },
      payment: { ...emptyPayment(), status: "paid", downPaymentPaid: true, attempts: 1, paidAt: "Sep 3, 2026", amountCents: 372000 },
      closing: { titleTransferred: true, lienholderRecorded: true, keysHandedOver: true, documentsExchanged: true, completed: true, sellerConfirmed: true, buyerConfirmed: true, evidence: [] },
      installment: { paidCount: 2, totalCount: 48, nextDueDate: "Oct 5, 2026", dueAt: new Date(2026, 9, 5).toISOString(), monthlyAmount: dealTerms({ priceCents: 2480000, downPct: 15, apr: 14, termMonths: 48 }).monthly, fired: [1] },
    },
  };

  return {
    customVehicles: [],
    deals: [...DEALS],
    dealDetails: initialDetails,
  };
}

/* ------------------------------------------------------- payment schedule */

const slugOf = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Registered accounts first (so a new buyer's notices and mail reach them), then the demo people. */
/** Listings and deals show sellers as "Maria A."; the account is "Maria Alvarez". */
const shortName = (full: string) => {
  const [first = "", last = ""] = full.split(" ");
  return last ? `${first} ${last.slice(0, 1)}.` : first;
};
const accountByName = (name: string) =>
  getSessionState().users.find((u) => u.name === name || (u.role === "seller" && shortName(u.name) === name));
export const uidOf = (name: string) =>
  accountByName(name)?.id ?? (name === PERSONAS.buyer.name ? "u-daniel" : name === PERSONAS.seller.name ? "u-maria" : `u-${slugOf(name)}`);
const mailOf = (name: string) =>
  accountByName(name)?.email ?? (name === PERSONAS.buyer.name ? PERSONAS.buyer.email : name === PERSONAS.seller.name ? PERSONAS.seller.email : `${slugOf(name)}@demo.com`);
/** Listings show "Maria A."; a deal and the seller's own screens use the account's full name. Unknown names pass through. */
export const sellerFullName = (display: string) => accountByName(display)?.name ?? display;
/** How a listing names its seller: "First L." */
export const sellerDisplayName = (full: string) => shortName(full);
const sessionUser = () => {
  const s = getSessionState();
  return s.users.find((u) => u.id === s.currentUserId) ?? null;
};
/** The buyer acting now: the signed-in buyer, or the demo buyer when an admin or the demo toolbar is driving. */
const buyerName = () => {
  const u = sessionUser();
  return u?.role === "buyer" ? u.name : PERSONAS.buyer.name;
};
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function firstInstallment(term: number, monthly: number): InstState {
  const due = addMonths(demoNow(), 1);
  return { paidCount: 0, totalCount: term, nextDueDate: fmtDue(due), dueAt: due.toISOString(), monthlyAmount: monthly, history: [], fired: [] };
}

/**
 * Charges autopay on due dates and sends the late notices that are due (reminder, late notice, seller alert,
 * default options). Returns null when nothing changed. Side effects (notices, mail) come back as `effects`
 * so the caller can run them once, outside the state update.
 */
function runSchedule(prev: DemoStoreState, now: Date): { next: DemoStoreState; effects: () => void } | null {
  const fx: (() => void)[] = [];
  let changed = false;
  const dealDetails = { ...prev.dealDetails };
  const shouldFail = () => {
    if (!demoFlags.get().payFails) return false;
    demoFlags.set({ payFails: false });
    return true;
  };

  const deals = prev.deals.map((d) => {
    if (d.stage !== "active") return d;
    const cur = dealDetails[d.id];
    const saved = cur?.installment;
    if (!cur || !saved) return d;
    // The amount charged is always the amortization schedule's payment for the agreed terms, even in older saved data.
    const wantAmount = termsFor(d).monthly;
    const inst = saved.monthlyAmount === wantAmount ? saved : { ...saved, monthlyAmount: wantAmount };
    const ap = getAutopay(d.id);
    const { inst: nextInst, events } = advance(inst, now, { autopay: ap.enabled, shouldFail, days: liveSettings().late });
    const late = daysLate(nextInst, now) > 0;
    const same = JSON.stringify(nextInst) === JSON.stringify(saved);
    if (same && events.length === 0 && !!d.late === late) return d;
    changed = true;

    const car = shortCar(d.car);
    const amt = usd(inst.monthlyAmount);
    const due = inst.nextDueDate;
    const msgs: DealMessage[] = [];
    const say = (text: string) => msgs.push({ id: `m-${Date.now()}-${msgs.length}`, sender: "seller", senderName: "OwnerFi", text, time: "Just now" });
    const buyerId = uidOf(d.buyer);
    const sellerId = uidOf(d.seller);
    const toBuyer = (event: EventKey, title: string, body: string, tag: "receipt" | "late" | "other", href = "/buyer/payments") => {
      fx.push(() => notify(buyerId, event, { title, body, href, tag }));
    };
    const toSeller = (event: EventKey, title: string, body: string, href = "/seller/payments") => {
      fx.push(() => notify(sellerId, event, { title, body, href, tag: "late" }));
    };

    for (const e of events as SchedEvent[]) {
      switch (e.kind) {
        case "autopay_paid":
          say(`Autopay paid installment #${e.n} of ${inst.totalCount} (${amt})${e.day > 0 ? ` after a retry` : " on the due date"}.`);
          toBuyer("payment_received", "Autopay paid your monthly payment", `${amt} for ${car} was taken from your bank.`, "receipt");
          fx.push(() => notify(sellerId, "payment_received", { title: "Payment received", body: `${d.buyer} paid ${amt}.`, href: "/seller/payments", tag: "receipt" }));
          break;
        case "autopay_failed":
          say(`Autopay for installment #${e.n} didn’t go through. It will try again tomorrow.`);
          toBuyer("late_payment", "Autopay didn’t go through", `We couldn’t take ${amt} for ${car}. We’ll try again tomorrow, or you can pay now.`, "late");
          break;
        case "reminder":
          say(`Reminder sent: the ${amt} payment was due ${due}.`);
          toBuyer("payment_due", "Payment reminder", `Your ${amt} payment for ${car} was due ${due}. Pay now so it doesn’t get late.`, "late");
          break;
        case "late_notice":
          say(`Late notice sent: the ${amt} payment is ${e.day} days late.`);
          toBuyer("late_payment", "Late payment notice", `Your ${amt} payment for ${car} is ${e.day} days late. Please pay now, or contact ${d.seller.split(" ")[0]}.`, "late");
          break;
        case "seller_alert":
          say(`The seller was alerted: the payment is ${e.day} days late.`);
          toSeller("late_payment", `${d.buyer.split(" ")[0]} is ${e.day} days behind`, `The ${amt} payment for ${car} is ${e.day} days late. You can message ${d.buyer.split(" ")[0]} from the deal.`);
          break;
        case "default_options":
          say(`Day ${e.day}: default options are open to the seller. OwnerFi does not repossess or collect the car.`);
          toSeller("late_payment", "Default options are open", `${d.buyer.split(" ")[0]} is ${e.day} days behind on ${car}. You choose what happens next. OwnerFi never recovers or picks up a car on its own.`, `/seller/deals/${d.id}/default-options`);
          toBuyer("late_payment", `Your payment is ${e.day} days late`, `${d.seller.split(" ")[0]} can now choose next steps. Pay now to catch up.`, "late");
          break;
      }
    }
    const finished = nextInst.paidCount >= nextInst.totalCount;
    dealDetails[d.id] = { ...cur, installment: nextInst, messages: [...cur.messages, ...msgs] };
    return { ...d, late, ...(finished ? { stage: "paid_off" as Stage } : {}), updated: events.length ? "Just now" : d.updated };
  });

  if (!changed) return null;
  return { next: { ...prev, deals, dealDetails }, effects: () => fx.forEach((f) => f()) };
}

interface DemoStoreContextValue {
  deals: DemoDeal[];
  customVehicles: PublicVehicle[];
  allVehicles: (supabaseVehicles: PublicVehicle[]) => PublicVehicle[];
  /** Applies seller edits (pause, terms) to a car. */
  withEdits: (v: PublicVehicle) => PublicVehicle;
  updateVehicle: (id: string, patch: VehicleEdit) => void;
  getDeal: (id: string) => DemoDeal | undefined;
  getDealDetail: (id: string) => DealDetailData;
  addVehicle: (vehicle: Omit<PublicVehicle, "id" | "created_at" | "status" | "seller_display_name" | "seller_verified" | "owner_id">) => PublicVehicle;
  createInquiry: (vehicle: PublicVehicle, message: string) => string;
  bookTestDrive: (vehicle: PublicVehicle, slot: string, location?: string | undefined) => string;
  makeOffer: (vehicle: PublicVehicle, terms: { priceCents: number; downPct: number; apr: number; term: number }) => string;
  sendMessage: (dealId: string, sender: "seller" | "buyer", text: string) => void;
  /** Buyer cancels or moves a booked test drive: updates the deal, posts to the thread and tells the seller. */
  changeTestDrive: (dealId: string, change: TestDriveChange) => void;
  confirmTestDrive: (dealId: string) => void;
  completeTestDrive: (dealId: string) => void;
  approveOffer: (dealId: string) => void;
  declineDeal: (dealId: string, reason: string) => void;
  withdrawDeal: (dealId: string, reason?: string | undefined) => void;
  /** Admin override: moves a deal to a closed stage and tells both people why. */
  adminSetStage: (dealId: string, stage: Stage, text: string) => void;
  submitCounterOffer: (dealId: string, terms: { priceCents: number; downPct: number; apr: number; term: number }, by: "seller" | "buyer", note?: string | undefined) => void;
  /** Accepts the current offer. Pass the version you were looking at; a stale one is refused. */
  acceptCounterOffer: (dealId: string, version?: number) => void;
  /** Demo shortcut: the buyer goes ahead without the booking steps. */
  acceptInspection: (dealId: string) => void;
  bookInspection: (dealId: string, booking: { window: string; location: string }) => void;
  approveInspectionBooking: (dealId: string) => void;
  decideInspection: (dealId: string, decision: InspectionDecision, opts?: { terms?: OfferTerms; note?: string; reason?: string }) => void;
  signContract: (dealId: string, role: "seller" | "buyer", signature?: { mode: "draw" | "type"; name: string; image?: string }) => void;
  payDownPayment: (dealId: string) => void;
  /** Records a declined card as a signed webhook. The buyer can then retry. */
  failDownPayment: (dealId: string, error?: string) => void;
  /** Sends the last payment webhook again. It is ignored the second time. */
  replayPaymentWebhook: (dealId: string) => { duplicate: boolean };
  /** Without a role, confirms for both people (demo shortcut). With a role, that person needs to attach evidence. */
  confirmClosing: (dealId: string, role?: "seller" | "buyer", evidence?: string) => void;
  cancelDeal: (dealId: string, by: "buyer" | "seller" | "admin", reason?: string) => void;
  payInstallment: (dealId: string) => void;
  /** Records a declined monthly payment. The buyer can retry; the retry is recorded as one payment. */
  failInstallment: (dealId: string, error?: string) => void;
  /** Pays the whole balance in one go. The deal becomes paid_off and the seller is asked to release the lien. */
  payOff: (dealId: string, amountCents: number) => void;
  /** The seller confirms the lien is released and the title is clear. */
  releaseLien: (dealId: string) => void;
  resetDemo: () => void;
}

const DemoStoreContext = createContext<DemoStoreContextValue | null>(null);

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoStoreState>(getInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const { demo } = useSession();

  // Serialising the whole store (photos and signatures are data URLs) is costly, so write once the state settles
  // instead of on every change, and flush right away when the tab is hidden or closed.
  useEffect(() => {
    const persist = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
      } catch (err) {
        console.error("Failed to persist demo store:", err);
      }
    };
    const t = window.setTimeout(persist, 400);
    const flush = () => {
      window.clearTimeout(t);
      persist();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [state]);

  // Share cars, deals, chat, notices and new accounts with every other browser through the shared database.
  const syncRef = useRef<ReturnType<typeof createSharedSync> | null>(null);
  useEffect(() => {
    const seed = seedState();
    const seedHash = new Map<string, string>(
      seed.deals.map((d) => [`deal:${d.id}`, hashOf({ deal: d, detail: seed.dealDetails[d.id] })]),
    );
    const store: SyncSource = {
      local: () => {
        const s = stateRef.current;
        return [
          ...s.customVehicles.map((v) => ({ id: `vehicle:${v.id}`, refs: [v], data: () => v })),
          ...Object.entries(s.vehicleEdits ?? {}).map(([id, e]) => ({ id: `vedit:${id}`, refs: [e], data: () => e })),
          ...s.deals.map((d) => ({
            id: `deal:${d.id}`,
            refs: [d, s.dealDetails[d.id]],
            data: () => ({ deal: d, detail: s.dealDetails[d.id] }),
          })),
        ];
      },
      isPristine: (id, hash) => seedHash.get(id) === hash,
      apply: (docs, dirty, fresh) =>
        setState((prev) => {
          let next = prev;
          for (const r of docs) {
            const at = r.id.indexOf(":");
            const kind = r.id.slice(0, at);
            const key = r.id.slice(at + 1);
            if (kind === "vehicle") {
              if (dirty.has(r.id)) continue;
              const v = r.data as PublicVehicle;
              const cur = next.customVehicles.find((x) => x.id === key);
              if (cur && hashOf(cur) === hashOf(v)) continue;
              const list = cur ? next.customVehicles.map((x) => (x.id === key ? v : x)) : [...next.customVehicles, v];
              next = { ...next, customVehicles: list.sort((a, b) => b.created_at.localeCompare(a.created_at)) };
            } else if (kind === "vedit") {
              if (dirty.has(r.id)) continue;
              const e = r.data as VehicleEdit;
              if (hashOf(next.vehicleEdits?.[key]) === hashOf(e)) continue;
              next = { ...next, vehicleEdits: { ...next.vehicleEdits, [key]: e } };
            } else if (kind === "deal") {
              const { deal, detail } = r.data as { deal: DemoDeal; detail?: DealDetailData };
              const curDeal = next.deals.find((x) => x.id === key);
              const curDetail = next.dealDetails[key];
              if (hashOf({ deal: curDeal, detail: curDetail }) === hashOf({ deal, detail })) continue;
              if (dirty.has(r.id)) {
                // Both sides changed this deal: keep ours, but never lose a chat message.
                if (detail && curDetail) {
                  const messages = unionById(detail.messages, curDetail.messages);
                  next = { ...next, dealDetails: { ...next.dealDetails, [key]: { ...curDetail, messages } } };
                }
                continue;
              }
              // First contact with a deal that exists elsewhere: take theirs, plus any messages only we have.
              const merged = detail && curDetail && fresh.has(r.id) ? { ...detail, messages: unionById(detail.messages, curDetail.messages) } : detail;
              next = {
                ...next,
                deals: curDeal ? next.deals.map((x) => (x.id === key ? deal : x)) : [deal, ...next.deals],
                dealDetails: merged ? { ...next.dealDetails, [key]: merged } : next.dealDetails,
              };
            }
          }
          return next;
        }),
    };
    const sync = createSharedSync([store, accountSync, noticeSync, driveSync]);
    syncRef.current = sync;
    const un = [accountSync.subscribe(sync.changed), noticeSync.subscribe(sync.changed), driveSync.subscribe(sync.changed)];
    const onShow = () => document.visibilityState === "visible" && void sync.now();
    document.addEventListener("visibilitychange", onShow);
    sync.start();
    return () => {
      sync.stop();
      un.forEach((f) => f());
      document.removeEventListener("visibilitychange", onShow);
      syncRef.current = null;
    };
  }, []);
  useEffect(() => {
    syncRef.current?.changed();
  }, [state]);

  // Time travel and page load: charge autopay on due dates and send the late notices that are due.
  useEffect(() => {
    const prev = stateRef.current;
    const res = runSchedule(prev, demoNow());
    if (!res) return;
    stateRef.current = res.next; // so a second run (StrictMode) sees the new state and doesn't repeat anything
    setState(res.next);
    res.effects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.daysAhead]);

  const allVehicles = (supabaseVehicles: PublicVehicle[]) => {
    // Custom vehicles created in demo appear first
    const customIds = new Set(state.customVehicles.map((v) => v.id));
    const dedupedSupabase = supabaseVehicles.filter((v) => !customIds.has(v.id));
    return [...state.customVehicles, ...dedupedSupabase].map(withEdits);
  };

  const withEdits = (v: PublicVehicle): PublicVehicle => {
    const e = state.vehicleEdits?.[v.id];
    return e ? { ...v, ...e } : v;
  };

  const updateVehicle = (id: string, patch: VehicleEdit) => {
    setState((prev) => ({
      ...prev,
      vehicleEdits: { ...prev.vehicleEdits, [id]: { ...prev.vehicleEdits?.[id], ...patch } },
    }));
  };

  const getDeal = (id: string) => state.deals.find((d) => d.id === id);

  const getDealDetail = (id: string): DealDetailData => {
    return ensureDealDetail(state.dealDetails, id);
  };

  const addVehicle = (input: Omit<PublicVehicle, "id" | "created_at" | "status" | "seller_display_name" | "seller_verified" | "owner_id">): PublicVehicle => {
    const newId = "v-demo-" + Date.now();
    // The car belongs to whoever is signed in as a seller. With nobody signed in (demo shortcuts) it's the demo seller's.
    const owner = sessionUser();
    const seller = owner && owner.role === "seller" ? owner : null;
    const newVehicle: PublicVehicle = {
      ...input,
      id: newId,
      seller_display_name: seller ? shortName(seller.name) : PERSONAS.seller.name,
      seller_verified: seller ? seller.verification.identity === "verified" && seller.verification.payouts === "verified" : true,
      ...(seller ? { owner_id: seller.id } : {}),
      status: "listed",
      created_at: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      customVehicles: [newVehicle, ...prev.customVehicles],
    }));

    return newVehicle;
  };

  const createInquiry = (vehicle: PublicVehicle, message: string): string => {
    // Asking a seller needs a signed-in buyer with a verified email.
    const asker = sessionUser();
    if (!asker) throw new Error("Log in to message sellers.");
    if (asker.role === "buyer" && !asker.emailVerified) throw new Error("Verify your email to message sellers.");
    const existing = state.deals.find(
      (d) => d.car.includes(vehicle.make) && d.car.includes(vehicle.model) && d.buyer === buyerName()
    );
    if (existing) {
      if (message.trim()) {
        sendMessage(existing.id, "buyer", message);
      }
      return existing.id;
    }

    const dealId = "d-" + Date.now().toString().slice(-4);
    const carTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}`.trim();
    const primaryTerm = vehicle.allowed_terms[0] ?? 48;

    const newDeal: DemoDeal = {
      id: dealId,
      car: carTitle,
      photo: vehicle.photos[0] || "https://images.unsplash.com/photo-1606611013016-969c19ba27bb?w=800",
      seller: sellerFullName(vehicle.seller_display_name || PERSONAS.seller.name),
      buyer: buyerName(),
      stage: "inquiry",
      vehicleId: vehicle.id,
      priceCents: vehicle.price_cents,
      downPct: vehicle.min_down_pct,
      apr: vehicle.apr,
      term: primaryTerm,
      state: vehicle.state || "AZ",
      minDownPct: vehicle.min_down_pct || 15,
      allowedTerms: vehicle.allowed_terms || [36, 48, 60],
      updated: "Just now",
    };

    const details: DealDetailData = {
      messages: [
        {
          id: "m-" + Date.now(),
          sender: "buyer",
          senderName: buyerName(),
          text: message || "Hi, is this vehicle still available for seller financing?",
          time: "Just now",
        },
      ],
      inspection: DEFAULT_INSPECTION,
      contract: { sellerSigned: true, sellerSignedAt: "Today", buyerSigned: false, agreementNumber: `OF-${dealId}` },
      closing: { titleTransferred: false, lienholderRecorded: false, keysHandedOver: false, documentsExchanged: false, completed: false },
    };

    setState((prev) => ({
      ...prev,
      deals: [newDeal, ...prev.deals],
      dealDetails: { ...prev.dealDetails, [dealId]: details },
    }));

    return dealId;
  };

  const bookTestDrive = (vehicle: PublicVehicle, slot: string, location = "Phoenix / Tempe, AZ"): string => {
    // A test drive needs a signed-in buyer with a verified email and phone.
    const booker = sessionUser();
    if (!booker) throw new Error("Log in to book a test drive.");
    if (booker.role === "buyer" && !booker.emailVerified) throw new Error("Verify your email to book a test drive.");
    if (booker.role === "buyer" && booker.verification.phone !== "verified") throw new Error("Verify your phone to book a test drive.");
    const existing = state.deals.find(
      (d) => d.car.includes(vehicle.make) && d.car.includes(vehicle.model) && d.buyer === buyerName()
    );
    if (existing) {
      setState((prev) => {
        const cur = ensureDealDetail(prev.dealDetails, existing.id);
        const updatedDetail: DealDetailData = {
          ...cur,
          testDrive: { slot, location, status: "scheduled" },
          messages: [
            ...cur.messages,
            { id: "m-" + Date.now(), sender: "buyer", senderName: buyerName(), text: `Test drive scheduled for ${slot} at ${location}.`, time: "Just now" },
          ],
        };
        return {
          ...prev,
          deals: prev.deals.map((d) => (d.id === existing.id ? { ...d, stage: "test_drive" as Stage, updated: "Just now" } : d)),
          dealDetails: { ...prev.dealDetails, [existing.id]: updatedDetail },
        };
      });
      return existing.id;
    }

    const dealId = "d-" + Date.now().toString().slice(-4);
    const carTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}`.trim();
    const primaryTerm = vehicle.allowed_terms[0] ?? 48;

    const newDeal: DemoDeal = {
      id: dealId,
      car: carTitle,
      photo: vehicle.photos[0] || "https://images.unsplash.com/photo-1606611013016-969c19ba27bb?w=800",
      seller: sellerFullName(vehicle.seller_display_name || PERSONAS.seller.name),
      buyer: buyerName(),
      stage: "test_drive",
      vehicleId: vehicle.id,
      priceCents: vehicle.price_cents,
      downPct: vehicle.min_down_pct,
      apr: vehicle.apr,
      term: primaryTerm,
      state: vehicle.state || "AZ",
      minDownPct: vehicle.min_down_pct || 15,
      allowedTerms: vehicle.allowed_terms || [36, 48, 60],
      updated: "Just now",
    };

    const details: DealDetailData = {
      messages: [
        {
          id: "m-" + Date.now(),
          sender: "buyer",
          senderName: buyerName(),
          text: `I've booked a test drive for ${slot} at ${location}. Excited to see the car!`,
          time: "Just now",
        },
      ],
      testDrive: { slot, location, status: "scheduled" },
      inspection: DEFAULT_INSPECTION,
      contract: { sellerSigned: true, sellerSignedAt: "Today", buyerSigned: false, agreementNumber: `OF-${dealId}` },
      closing: { titleTransferred: false, lienholderRecorded: false, keysHandedOver: false, documentsExchanged: false, completed: false },
    };

    setState((prev) => ({
      ...prev,
      deals: [newDeal, ...prev.deals],
      dealDetails: { ...prev.dealDetails, [dealId]: details },
    }));

    return dealId;
  };

  const makeOffer = (
    vehicle: PublicVehicle,
    terms: { priceCents: number; downPct: number; apr: number; term: number }
  ): string => {
    const calc = dealTerms({
      priceCents: terms.priceCents,
      downPct: terms.downPct,
      apr: terms.apr,
      termMonths: terms.term,
    });

    const price = terms.priceCents / 100;
    const check = validateOffer({ price, downPayment: Math.round((price * terms.downPct) / 100), apr: terms.apr, termMonths: terms.term }, vehicle);
    if (!check.ok) throw new RuleError(Object.values(check.errors)[0] ?? "Those terms aren’t allowed.");
    const firstOffer = addOffer([], "buyer", terms, calc.monthly);

    const existing = state.deals.find(
      (d) => d.car.includes(vehicle.make) && d.car.includes(vehicle.model) && d.buyer === buyerName()
    );

    const dealId = existing ? existing.id : "d-" + Date.now().toString().slice(-4);
    const carTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}`.trim();

    const offerMessage: DealMessage = {
      id: "m-" + Date.now(),
      sender: "buyer",
      senderName: buyerName(),
      text: `Submitted financing offer: $${(terms.priceCents / 100).toLocaleString()} with ${terms.downPct}% down ($${(calc.down / 100).toLocaleString()}) at ${terms.apr}% APR for ${terms.term} months. Est. monthly: $${(calc.monthly / 100).toFixed(2)}/mo.`,
      time: "Just now",
    };

    const counterOffer: DealCounterOffer = {
      proposedBy: "buyer",
      priceCents: terms.priceCents,
      downPct: terms.downPct,
      apr: terms.apr,
      term: terms.term,
      monthly: calc.monthly,
    };

    if (existing) {
      setState((prev) => {
        const cur = ensureDealDetail(prev.dealDetails, existing.id);
        const updatedDetail: DealDetailData = {
          ...cur,
          messages: [...cur.messages, offerMessage],
          counterOffer,
          offers: firstOffer,
          roundBase: 0,
          installment: { paidCount: 0, totalCount: terms.term, nextDueDate: "30 days after closing", monthlyAmount: calc.monthly },
        };
        return {
          ...prev,
          deals: prev.deals.map((d) =>
            d.id === existing.id
              ? {
                  ...d,
                  stage: "application" as Stage,
                  priceCents: terms.priceCents,
                  downPct: terms.downPct,
                  apr: terms.apr,
                  term: terms.term,
                  state: d.state || vehicle.state || "AZ",
                  minDownPct: vehicle.min_down_pct || 15,
                  allowedTerms: vehicle.allowed_terms || [36, 48, 60],
                  updated: "Just now",
                }
              : d
          ),
          dealDetails: { ...prev.dealDetails, [existing.id]: updatedDetail },
        };
      });
      return existing.id;
    }

    const newDeal: DemoDeal = {
      id: dealId,
      car: carTitle,
      photo: vehicle.photos[0] || "https://images.unsplash.com/photo-1606611013016-969c19ba27bb?w=800",
      seller: sellerFullName(vehicle.seller_display_name || PERSONAS.seller.name),
      buyer: buyerName(),
      stage: "application",
      vehicleId: vehicle.id,
      priceCents: terms.priceCents,
      downPct: terms.downPct,
      apr: terms.apr,
      term: terms.term,
      state: vehicle.state || "AZ",
      minDownPct: vehicle.min_down_pct || 15,
      allowedTerms: vehicle.allowed_terms || [36, 48, 60],
      updated: "Just now",
    };

    const details: DealDetailData = {
      messages: [offerMessage],
      counterOffer,
      offers: firstOffer,
      roundBase: 0,
      inspection: DEFAULT_INSPECTION,
      contract: { sellerSigned: true, sellerSignedAt: "Pending acceptance", buyerSigned: false, agreementNumber: `OF-${dealId}` },
      closing: { titleTransferred: false, lienholderRecorded: false, keysHandedOver: false, documentsExchanged: false, completed: false },
      installment: { paidCount: 0, totalCount: terms.term, nextDueDate: "30 days after closing", monthlyAmount: calc.monthly },
    };

    setState((prev) => ({
      ...prev,
      deals: [newDeal, ...prev.deals],
      dealDetails: { ...prev.dealDetails, [dealId]: details },
    }));

    return dealId;
  };

  const sendMessage = (dealId: string, sender: "seller" | "buyer", text: string) => {
    if (!text.trim()) return;
    const thread = state.deals.find((x) => x.id === dealId);
    // A buyer's messages carry that deal's buyer, even when an admin is viewing as the buyer.
    const senderName = sender === "seller" ? PERSONAS.seller.name : (thread?.buyer ?? buyerName());
    const msg: DealMessage = {
      id: "m-" + Date.now(),
      sender,
      senderName,
      text: text.trim(),
      time: "Just now",
    };

    const dl = state.deals.find((x) => x.id === dealId);
    if (dl) {
      const to = sender === "seller" ? dl.buyer : dl.seller;
      notify(uidOf(to), "message", { title: `New message from ${senderName.split(" ")[0]}`, body: text.trim().slice(0, 140), href: `/${sender === "seller" ? "buyer" : "seller"}/inbox/${dealId}` });
    }
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const updatedDetail: DealDetailData = {
        ...cur,
        messages: [...cur.messages, msg],
      };
      return {
        ...prev,
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const changeTestDrive = (dealId: string, change: TestDriveChange) => {
    const dl = state.deals.find((x) => x.id === dealId);
    const buyer = dl?.buyer ?? buyerName();
    const car = dl ? shortCar(dl.car) : "the car";
    const text =
      change.kind === "cancelled"
        ? `I cancelled the test drive.${change.reason ? ` Reason: ${change.reason}.` : ""}`
        : `Can we move the test drive to ${change.slot}? Please confirm the new time.`;
    if (dl) {
      notify(uidOf(dl.seller), "test_drive", {
        title: change.kind === "cancelled" ? `${buyer.split(" ")[0]} cancelled the test drive` : `${buyer.split(" ")[0]} asked to move the test drive`,
        body: change.kind === "cancelled" ? `${car}: ${change.reason || "no reason given"}.` : `${car}: new time ${change.slot}. Confirm or suggest another.`,
        href: "/seller/test-drives",
      });
    }
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const td = cur.testDrive;
      const nextTd: DealTestDrive | undefined = td
        ? change.kind === "cancelled"
          ? { ...td, status: "cancelled" }
          : { ...td, slot: change.slot, status: "scheduled" }
        : undefined;
      const detail: DealDetailData = {
        ...cur,
        ...(nextTd ? { testDrive: nextTd } : {}),
        messages: [...cur.messages, { id: "m-" + Date.now(), sender: "buyer", senderName: buyer, text, time: "Just now" }],
      };
      return {
        ...prev,
        // With the drive cancelled the deal goes back to the inquiry, so the buyer can book another time.
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, ...(change.kind === "cancelled" && d.stage === "test_drive" ? { stage: "inquiry" as Stage } : {}), updated: "Just now" } : d)),
        dealDetails: { ...prev.dealDetails, [dealId]: detail },
      };
    });
  };

  /** Tells the buyer or the seller of a deal that something happened (bell, email or text, as they chose). Keep bodies free of private details. */
  const tell = (dealId: string, who: "buyer" | "seller", event: EventKey, title: string, body: string, href?: string) => {
    const d = state.deals.find((x) => x.id === dealId) ?? DEALS.find((x) => x.id === dealId);
    if (!d) return;
    notify(uidOf(who === "buyer" ? d.buyer : d.seller), event, { title, body, href: href ?? `/${who}/deals/${dealId}` });
  };
  const carOf = (dealId: string) => shortCar((state.deals.find((x) => x.id === dealId) ?? DEALS.find((x) => x.id === dealId))?.car ?? "the car");
  const firstName = (full: string | undefined) => (full ?? "").split(" ")[0] || "The seller";

  const confirmTestDrive = (dealId: string) => {
    tell(dealId, "buyer", "test_drive", "Your test drive is confirmed", `${firstName(dealOf(dealId).seller)} confirmed your time for the ${carOf(dealId)}.`, "/buyer/test-drives");
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const updatedTestDrive: DealTestDrive = {
        slot: cur.testDrive?.slot || "Tomorrow · 2:00 PM",
        location: cur.testDrive?.location || "Camelback Rd, Phoenix, AZ",
        status: "confirmed",
      };
      const updatedDetail: DealDetailData = {
        ...cur,
        testDrive: updatedTestDrive,
        messages: [
          ...cur.messages,
          { id: "m-" + Date.now(), sender: "seller", senderName: PERSONAS.seller.name, text: "Test drive time confirmed by seller! See you at the scheduled location.", time: "Just now" },
        ],
      };
      const exists = prev.deals.some((d) => d.id === dealId);
      const seedDeal = DEALS.find((d) => d.id === dealId);
      const updatedDeals = exists
        ? prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "test_drive" as Stage, updated: "Just now" } : d))
        : seedDeal
          ? [{ ...seedDeal, stage: "test_drive" as Stage, updated: "Just now" }, ...prev.deals]
          : prev.deals;
      return {
        ...prev,
        deals: updatedDeals,
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const completeTestDrive = (dealId: string) => {
    tell(dealId, "buyer", "deal_stage", "Test drive done", `Liked the ${carOf(dealId)}? You can make an offer now.`);
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const updatedTestDrive: DealTestDrive = cur.testDrive
        ? { ...cur.testDrive, status: "completed" }
        : { slot: "Completed", location: "Phoenix, AZ", status: "completed" };
      const updatedDetail: DealDetailData = {
        ...cur,
        testDrive: updatedTestDrive,
        messages: [
          ...cur.messages,
          { id: "m-" + Date.now(), sender: "seller", senderName: PERSONAS.seller.name, text: "Test drive completed! You can now review terms and submit your application.", time: "Just now" },
        ],
      };
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "application" as Stage, updated: "Just now" } : d)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const dealOf = (id: string) => {
    const d = state.deals.find((x) => x.id === id) ?? DEALS.find((x) => x.id === id);
    if (!d) throw new RuleError("We can’t find that deal.");
    return d;
  };

  /** Moves the deal to inspection once the current offer is accepted. */
  const acceptCurrent = (dealId: string, by: "buyer" | "seller" | undefined, version: number | undefined, text: string, sender: "buyer" | "seller") => {
    const cur = ensureDealDetail(state.dealDetails, dealId);
    const offers = offersOf(cur);
    const latest = currentOffer(offers);
    const acceptor = by ?? (latest?.by === "buyer" ? "seller" : "buyer");
    const next = latest ? acceptOfferVersion(offers, version ?? latest.version, acceptor) : offers;
    if (acceptor === "seller") tell(dealId, "buyer", "offer", "Your offer was accepted", `${firstName(dealOf(dealId).seller)} accepted your terms for the ${carOf(dealId)}. Next: book the inspection.`);
    else tell(dealId, "seller", "offer", "Your counter-offer was accepted", `${firstName(dealOf(dealId).buyer)} accepted your terms for the ${carOf(dealId)}.`);
    setState((prev) => {
      const c = ensureDealDetail(prev.dealDetails, dealId);
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "inspection" as Stage, updated: "Just now" } : d)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: {
            ...c,
            offers: next,
            inspection: c.inspection || DEFAULT_INSPECTION,
            messages: [...c.messages, { id: "m-" + Date.now(), sender, senderName: PERSONAS[sender].name, text, time: "Just now" }],
          },
        },
      };
    });
  };

  const approveOffer = (dealId: string) => acceptCurrent(dealId, "seller", undefined, "Offer approved! Next step: book the vehicle inspection.", "seller");

  const declineDeal = (dealId: string, reason: string) => {
    tell(dealId, "buyer", "offer", "Your offer was declined", `${firstName(dealOf(dealId).seller)} declined your offer on the ${carOf(dealId)}. You can look at other cars.`, "/cars");
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const updatedDetail: DealDetailData = {
        ...cur,
        offers: offersOf(cur).map((o) => (o.status === "current" ? { ...o, status: "declined" as const } : o)),
        messages: [
          ...cur.messages,
          { id: "m-" + Date.now(), sender: "seller", senderName: PERSONAS.seller.name, text: `Application declined by seller. Reason: ${reason}`, time: "Just now" },
        ],
      };
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "declined" as Stage, updated: "Just now" } : d)),
        dealDetails: { ...prev.dealDetails, [dealId]: updatedDetail },
      };
    });
  };

  /**
   * Cancels a deal before the title moves. Whoever cancels, the buyer gets the whole down payment back
   * (including OwnerFi's fee in test mode) and the car goes back on the market.
   */
  const cancelDeal = (dealId: string, by: "buyer" | "seller" | "admin", reason?: string) => {
    const deal = dealOf(dealId);
    const cur0 = ensureDealDetail(state.dealDetails, dealId);
    if (!canCancel(deal.stage) || cur0.closing?.completed) throw new RuleError("The title has already moved, so this deal can’t be cancelled here.");
    {
      const paid = refundAmount(cur0.payment ? normalizePayment(cur0.payment) : undefined);
      const car = carOf(dealId);
      // The other side hears about it. A buyer who gets a refund is told so, including who cancelled.
      if (by !== "buyer") tell(dealId, "buyer", "deal_stage", "Your deal was cancelled", `${by === "admin" ? "OwnerFi" : firstName(deal.seller)} cancelled the deal for the ${car}.${paid > 0 ? ` Your down payment of $${(paid / 100).toLocaleString()} is refunded in full.` : ""}`);
      else if (paid > 0) tell(dealId, "buyer", "payment_received", "Your down payment is refunded", `$${(paid / 100).toLocaleString()} is on its way back to you, fee included.`, "/buyer/payments");
      if (by !== "seller") tell(dealId, "seller", "deal_stage", "A deal was cancelled", `${by === "admin" ? "OwnerFi" : firstName(deal.buyer)} cancelled the deal for the ${car}. It is back on the market.`);
    }
    setState((prev) => {
      const d = prev.deals.find((x) => x.id === dealId) ?? deal;
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      let payment = cur.payment ? normalizePayment(cur.payment) : undefined;
      const refund = refundAmount(payment);
      if (payment && refund > 0) payment = applyWebhook(payment, makeEvent(dealId, "charge.refunded", payment.attempts, refund)).payment;
      const who = by === "buyer" ? buyerName() : by === "seller" ? PERSONAS.seller.name : "OwnerFi";
      const note = reason?.trim() ? ` Reason: ${reason.trim()}` : "";
      const text =
        by === "buyer" && refund === 0
          ? `Offer withdrawn by buyer.${note}`
          : `Deal cancelled by ${by === "admin" ? "OwnerFi" : by}.${note}${refund > 0 ? ` The down payment of $${(refund / 100).toLocaleString()} is refunded in full, including OwnerFi’s fee.` : ""} The car is back on the market.`;
      const detail: DealDetailData = {
        ...cur,
        ...(payment ? { payment } : {}),
        offers: offersOf(cur).map((o) => (o.status === "current" ? { ...o, status: "withdrawn" as const } : o)),
        cancellation: { by, reason: reason?.trim() ?? "", at: new Date().toISOString(), refundCents: refund, relisted: true },
        messages: [...cur.messages, { id: "m-" + Date.now(), sender: by === "seller" ? "seller" : "buyer", senderName: who, text, time: "Just now" }],
      };
      return {
        ...prev,
        deals: prev.deals.map((x) => (x.id === dealId ? { ...x, stage: "cancelled" as Stage, updated: "Just now" } : x)),
        dealDetails: { ...prev.dealDetails, [dealId]: detail },
        // The car is listed again.
        vehicleEdits: d.vehicleId ? { ...prev.vehicleEdits, [d.vehicleId]: { ...prev.vehicleEdits?.[d.vehicleId], status: "listed" } } : prev.vehicleEdits,
      };
    });
  };

  const withdrawDeal = (dealId: string, reason?: string | undefined) => cancelDeal(dealId, "buyer", reason);

  const adminSetStage = (dealId: string, stage: Stage, text: string) => {
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage, updated: "Just now" } : d)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: { ...cur, messages: [...cur.messages, { id: "m-" + Date.now(), sender: "seller" as const, senderName: "OwnerFi", text, time: "Just now" }] },
        },
      };
    });
  };

  const submitCounterOffer = (
    dealId: string,
    terms: { priceCents: number; downPct: number; apr: number; term: number },
    by: "seller" | "buyer",
    note?: string | undefined
  ) => {
    const deal = dealOf(dealId);
    const cap = rateCapForState(deal.state ?? "AZ");
    if (terms.apr > cap) throw new RuleError(`The highest rate allowed in ${deal.state ?? "AZ"} is ${cap}%.`);
    if (terms.downPct < (deal.minDownPct ?? 0)) throw new RuleError(`The down payment has to be at least ${deal.minDownPct}%.`);
    if (!(terms.priceCents > 0)) throw new RuleError("Enter a price.");
    const calc = dealTerms({ priceCents: terms.priceCents, downPct: terms.downPct, apr: terms.apr, termMonths: terms.term });
    const cur0 = ensureDealDetail(state.dealDetails, dealId);
    // Throws on round 4 or when it is not your turn.
    const offers = addOffer(offersOf(cur0), by, terms, calc.monthly, note, cur0.roundBase ?? 0, maxRounds());
    if (by === "seller") tell(dealId, "buyer", "offer", "New counter-offer", `${firstName(deal.seller)} sent new terms for the ${carOf(dealId)}: about $${(calc.monthly / 100).toFixed(0)}/month. Your move.`);
    else tell(dealId, "seller", "offer", "New offer to answer", `${firstName(deal.buyer)} sent new terms for the ${carOf(dealId)}.`);

    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const counterOffer: DealCounterOffer = {
        proposedBy: by,
        priceCents: terms.priceCents,
        downPct: terms.downPct,
        apr: terms.apr,
        term: terms.term,
        monthly: calc.monthly,
        ...(note !== undefined ? { note } : {}),
      };
      const updatedDetail: DealDetailData = {
        ...cur,
        counterOffer,
        offers,
        messages: [
          ...cur.messages,
          {
            id: "m-" + Date.now(),
            sender: by,
            senderName: by === "seller" ? PERSONAS.seller.name : buyerName(),
            text: `Counter-offer ${offers.length - (cur.roundBase ?? 0)} of ${maxRounds()}: $${(terms.priceCents / 100).toLocaleString()}, ${terms.downPct}% down, ${terms.apr}% APR, ${terms.term} mo ($${(calc.monthly / 100).toFixed(2)}/mo)${note ? ` — "${note}"` : ""}`,
            time: "Just now",
          },
        ],
      };
      return {
        ...prev,
        deals: prev.deals.map((d) =>
          d.id === dealId
            ? { ...d, stage: "negotiation" as Stage, priceCents: terms.priceCents, downPct: terms.downPct, apr: terms.apr, term: terms.term, updated: "Just now" }
            : d
        ),
        dealDetails: { ...prev.dealDetails, [dealId]: updatedDetail },
      };
    });
  };

  const acceptCounterOffer = (dealId: string, version?: number) =>
    acceptCurrent(dealId, undefined, version, "Terms accepted! Next step: book the vehicle inspection.", "buyer");

  const toContract = (cur: DealDetailData, dealId: string, text: string, decision?: InspectionDecision): DealDetailData => ({
    ...cur,
    ...(decision ? { inspectionDecision: decision } : {}),
    contract: { sellerSigned: false, buyerSigned: false, agreementNumber: cur.contract?.agreementNumber ?? `OF-AZ-2026-${dealId.slice(-4)}` },
    messages: [...cur.messages, { id: "m-" + Date.now(), sender: "buyer", senderName: buyerName(), text, time: "Just now" }],
  });

  const acceptInspection = (dealId: string) => {
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "contract" as Stage, updated: "Just now" } : d)),
        dealDetails: { ...prev.dealDetails, [dealId]: toContract(cur, dealId, "Inspection report reviewed. I want to go ahead. Ready to sign.", "proceed") },
      };
    });
  };

  const bookInspection = (dealId: string, booking: { window: string; location: string }) => {
    const deal = dealOf(dealId);
    if (deal.stage !== "inspection") throw new RuleError("Inspection isn’t open on this deal yet.");
    if (!booking.window || !booking.location.trim()) throw new RuleError("Pick a time window and where the car will be.");
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      return {
        ...prev,
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: {
            ...cur,
            inspectionBooking: { window: booking.window, location: booking.location.trim(), feeCents: inspectionFeeCents(), status: "requested", requestedAt: new Date().toISOString() },
            messages: [
              ...cur.messages,
              { id: "m-" + Date.now(), sender: "buyer", senderName: buyerName(), text: `Inspection requested for ${booking.window} at ${booking.location.trim()}. The inspection costs ${feeLabel()}, paid by me.`, time: "Just now" },
            ],
          },
        },
      };
    });
  };

  const approveInspectionBooking = (dealId: string) => {
    tell(dealId, "buyer", "deal_stage", "Inspection time approved", `${firstName(dealOf(dealId).seller)} approved your inspection time for the ${carOf(dealId)}. The report is ready to read.`);
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      if (!cur.inspectionBooking) return prev;
      return {
        ...prev,
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: {
            ...cur,
            inspectionBooking: { ...cur.inspectionBooking, status: "approved" },
            inspection: { ...(cur.inspection ?? DEFAULT_INSPECTION), date: cur.inspectionBooking.window },
            messages: [...cur.messages, { id: "m-" + Date.now(), sender: "seller", senderName: PERSONAS.seller.name, text: `Inspection time approved: ${cur.inspectionBooking.window}. The report is ready to read.`, time: "Just now" }],
          },
        },
      };
    });
  };

  const decideInspection = (dealId: string, decision: InspectionDecision, opts: { terms?: OfferTerms; note?: string; reason?: string } = {}) => {
    const deal = dealOf(dealId);
    const cur0 = ensureDealDetail(state.dealDetails, dealId);
    if (deal.stage !== "inspection") throw new RuleError("There’s no inspection to decide on.");
    if (cur0.inspectionBooking?.status !== "approved") throw new RuleError("The report isn’t ready yet.");
    if (decision === "proceed") {
      setState((prev) => {
        const cur = ensureDealDetail(prev.dealDetails, dealId);
        return {
          ...prev,
          deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "contract" as Stage, updated: "Just now" } : d)),
          dealDetails: { ...prev.dealDetails, [dealId]: toContract(cur, dealId, "I read the inspection report and want to go ahead.", "proceed") },
        };
      });
      return;
    }
    if (decision === "cancel") {
      cancelDeal(dealId, "buyer", opts.reason ?? "Walked away after the inspection");
      return;
    }
    // Renegotiate: once, back to negotiation with a fresh set of rounds.
    if (!canRenegotiate(cur0.renegotiations ?? 0)) throw new RuleError("You can only renegotiate once.");
    if (!opts.terms) throw new RuleError("Say what terms you want.");
    const t = opts.terms;
    const calc = dealTerms({ priceCents: t.priceCents, downPct: t.downPct, apr: t.apr, termMonths: t.term });
    const base = offersOf(cur0).length;
    const offers = addOffer(offersOf(cur0), "buyer", t, calc.monthly, opts.note, base);
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "negotiation" as Stage, priceCents: t.priceCents, downPct: t.downPct, apr: t.apr, term: t.term, updated: "Just now" } : d)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: {
            ...cur,
            offers,
            roundBase: base,
            renegotiations: (cur.renegotiations ?? 0) + 1,
            inspectionDecision: "renegotiate",
            counterOffer: { proposedBy: "buyer", priceCents: t.priceCents, downPct: t.downPct, apr: t.apr, term: t.term, monthly: calc.monthly, ...(opts.note ? { note: opts.note } : {}) },
            messages: [...cur.messages, { id: "m-" + Date.now(), sender: "buyer", senderName: buyerName(), text: `After the inspection I’d like new terms: $${(t.priceCents / 100).toLocaleString()}, ${t.downPct}% down, ${t.apr}% APR, ${t.term} mo ($${(calc.monthly / 100).toFixed(2)}/mo).${opts.note ? ` "${opts.note}"` : ""}`, time: "Just now" }],
          },
        },
      };
    });
  };

  const signContract = (dealId: string, role: "seller" | "buyer", signature?: { mode: "draw" | "type"; name: string; image?: string }) => {
    const deal = dealOf(dealId);
    if (deal.stage !== "contract") throw new RuleError("The contract isn’t open for signing.");
    const agreementNo = ensureDealDetail(state.dealDetails, dealId).contract?.agreementNumber ?? `OF-${dealId}`;
    const person = role === "seller" ? deal.seller : deal.buyer;
    {
      const c0 = ensureDealDetail(state.dealDetails, dealId).contract;
      const bothAfter = role === "seller" ? !!c0?.buyerSigned : !!c0?.sellerSigned;
      if (bothAfter) {
        tell(dealId, "buyer", "deal_stage", "Contract signed by both of you", `Next: pay the down payment for the ${carOf(dealId)}.`);
        tell(dealId, "seller", "deal_stage", "Contract signed by both of you", `${firstName(deal.buyer)} will pay the down payment next.`);
      } else if (role === "seller") tell(dealId, "buyer", "deal_stage", "Your contract is ready to sign", `${firstName(deal.seller)} signed. Read it and sign for the ${carOf(dealId)}.`);
      else tell(dealId, "seller", "deal_stage", "The buyer signed the contract", `${firstName(deal.buyer)} signed. It’s your turn to sign.`);
    }
    const evidence = buildEvidence({
      mode: signature?.mode ?? "type",
      name: signature?.name ?? person,
      image: signature?.image,
      agreementNumber: agreementNo,
      terms: { priceCents: deal.priceCents, downPct: deal.downPct, apr: deal.apr, term: deal.term },
      ...(typeof navigator !== "undefined" ? { userAgent: navigator.userAgent } : {}),
    });
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const prevContract = cur.contract ?? { sellerSigned: false, buyerSigned: false, agreementNumber: agreementNo };
      const now = new Date().toLocaleDateString();
      const updatedContract: DealContract = {
        ...prevContract,
        ...(role === "seller" ? { sellerSigned: true, sellerSignedAt: now, sellerSignature: evidence } : { buyerSigned: true, buyerSignedAt: now, buyerSignature: evidence }),
      };
      const bothSigned = updatedContract.sellerSigned && updatedContract.buyerSigned;
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: (bothSigned ? "down_payment" : "contract") as Stage, updated: "Just now" } : d)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: {
            ...cur,
            contract: updatedContract,
            ...(bothSigned && !cur.payment?.status ? { payment: emptyPayment() } : {}),
            messages: [
              ...cur.messages,
              { id: "m-" + Date.now(), sender: role, senderName: person, text: `${role === "seller" ? "Seller" : "Buyer"} e-signed OwnerFi Financing Agreement #${updatedContract.agreementNumber}.`, time: "Just now" },
            ],
          },
        },
      };
    });
  };

  const downTerms = (dealId: string) => {
    const d = dealOf(dealId);
    return dealTerms({ priceCents: d.priceCents, downPct: d.downPct, apr: d.apr, termMonths: d.term, ...(d.feeWaived !== undefined ? { feeWaived: d.feeWaived } : {}) });
  };

  const payDownPayment = (dealId: string) => {
    const deal = dealOf(dealId);
    const terms = downTerms(dealId);
    const cur0 = ensureDealDetail(state.dealDetails, dealId);
    const p0 = normalizePayment(cur0.payment);
    if (deal.stage !== "down_payment" || p0.status === "paid" || p0.status === "refunded") throw new RuleError("The down payment can’t be paid right now.");
    const attempt = p0.attempts + 1;
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      let payment = normalizePayment(cur.payment);
      // Stripe tells us twice: processing, then succeeded. Each is signed and applied once.
      payment = { ...applyWebhook(payment, makeEvent(dealId, "payment_intent.processing", attempt, terms.down)).payment, attempts: attempt };
      payment = applyWebhook(payment, makeEvent(dealId, "payment_intent.succeeded", attempt, terms.down, terms.fee)).payment;
      const closing: DealClosing = { titleTransferred: false, lienholderRecorded: false, keysHandedOver: false, documentsExchanged: false, completed: false, sellerConfirmed: false, buyerConfirmed: false, evidence: [] };
      return {
        ...prev,
        deals: prev.deals.map((x) => (x.id === dealId ? { ...x, stage: "closing" as Stage, updated: "Just now" } : x)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: {
            ...cur,
            payment,
            closing,
            messages: [
              ...cur.messages,
              { id: "m-" + Date.now(), sender: "buyer", senderName: buyerName(), text: `Down payment of $${(terms.down / 100).toLocaleString()} paid. Next: meet at the DMV and confirm the title transfer.`, time: "Just now" },
            ],
          },
        },
      };
    });
  };

  const failDownPayment = (dealId: string, error = "Payment declined") => {
    const terms = downTerms(dealId);
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const p = normalizePayment(cur.payment);
      if (p.status === "paid" || p.status === "refunded") return prev;
      const attempt = p.attempts + 1;
      const payment = { ...applyWebhook(p, makeEvent(dealId, "payment_intent.payment_failed", attempt, terms.down, undefined, error)).payment, attempts: attempt };
      return { ...prev, dealDetails: { ...prev.dealDetails, [dealId]: { ...cur, payment } } };
    });
  };

  const replayPaymentWebhook = (dealId: string) => {
    const cur = ensureDealDetail(state.dealDetails, dealId);
    const p = normalizePayment(cur.payment);
    const terms = downTerms(dealId);
    const res = applyWebhook(p, makeEvent(dealId, "payment_intent.succeeded", Math.max(1, p.attempts), terms.down, terms.fee));
    if (!res.duplicate) setState((prev) => ({ ...prev, dealDetails: { ...prev.dealDetails, [dealId]: { ...ensureDealDetail(prev.dealDetails, dealId), payment: res.payment } } }));
    return { duplicate: res.duplicate };
  };

  const confirmClosing = (dealId: string, role?: "seller" | "buyer", evidenceName?: string) => {
    const deal = dealOf(dealId);
    if (deal.stage !== "closing") throw new RuleError("The deal isn’t at closing.");
    if (role && !evidenceName?.trim()) throw new RuleError("Attach a photo or receipt as evidence first.");
    const cur0 = ensureDealDetail(state.dealDetails, dealId);
    // Deals that went through the payment flow carry a payment record; older ones are trusted by their stage.
    const tracked = cur0.payment?.status !== undefined;
    const prevClosing = cur0.closing ?? { titleTransferred: false, lienholderRecorded: false, keysHandedOver: false, documentsExchanged: false, completed: false };
    const sellerConfirmed = !role || role === "seller" ? true : !!prevClosing.sellerConfirmed;
    const buyerConfirmed = !role || role === "buyer" ? true : !!prevClosing.buyerConfirmed;
    const evidence: ClosingEvidence[] = [...(prevClosing.evidence ?? []), ...(role ? [{ by: role, name: evidenceName!.trim(), at: new Date().toISOString() }] : [])];
    const gate = canActivateLoan({
      contractBothSigned: !tracked || !!(cur0.contract?.sellerSigned && cur0.contract?.buyerSigned),
      paymentPaid: !tracked || cur0.payment?.status === "paid",
      sellerConfirmed,
      buyerConfirmed,
    });
    const activate = gate.ok;
    if (!gate.ok && sellerConfirmed && buyerConfirmed) throw new RuleError(gate.reason);
    if (activate) {
      tell(dealId, "buyer", "deal_stage", "Your loan is active", `The title for the ${carOf(dealId)} has moved. Your first payment is due in about a month.`, "/buyer/payments");
      tell(dealId, "seller", "deal_stage", "The loan is active", `Both of you confirmed the title transfer for the ${carOf(dealId)}.`);
    } else if (role === "seller") tell(dealId, "buyer", "deal_stage", "Confirm the title transfer", `${firstName(deal.seller)} confirmed. Add your evidence to finish.`);
    else if (role === "buyer") tell(dealId, "seller", "deal_stage", "The buyer confirmed the title transfer", `${firstName(deal.buyer)} confirmed. Add yours to finish.`);
    const terms = downTerms(dealId);
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const closing: DealClosing = {
        titleTransferred: activate,
        lienholderRecorded: activate,
        keysHandedOver: activate,
        documentsExchanged: activate,
        completed: activate,
        sellerConfirmed,
        buyerConfirmed,
        evidence,
      };
      const who = role ?? "seller";
      const text = activate
        ? "Both of you confirmed the title transfer. Title recorded with the seller as lienholder. The deal is now ACTIVE."
        : `${who === "seller" ? "Seller" : "Buyer"} confirmed the title transfer. Waiting for ${who === "seller" ? "the buyer" : "the seller"}.`;
      return {
        ...prev,
        deals: prev.deals.map((x) => (x.id === dealId ? { ...x, ...(activate ? { stage: "active" as Stage } : {}), updated: "Just now" } : x)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: {
            ...cur,
            closing,
            ...(activate ? { installment: firstInstallment(deal.term || 48, terms.monthly || 45000) } : {}),
            messages: [...cur.messages, { id: "m-" + Date.now(), sender: who, senderName: PERSONAS[who].name, text, time: "Just now" }],
          },
        },
      };
    });
  };

  const payInstallment = (dealId: string) => {
    const now = demoNow();
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      if (!cur.installment) return prev;
      // Same key for the same installment, so a retry after a failure (or a double tap) is recorded once.
      const r = recordPayment(cur.installment, { ok: true, method: "manual", key: `man-${cur.installment.paidCount + 1}`, now });
      if (!r.applied) return prev;
      const inst = r.inst;
      const nextPaid = inst.paidCount;
      const lateBy = daysLate(cur.installment, now);
      const updatedDetail: DealDetailData = {
        ...cur,
        installment: inst,
        messages: [
          ...cur.messages,
          {
            id: "m-" + Date.now(),
            sender: "buyer",
            senderName: buyerName(),
            text: `Monthly installment #${nextPaid} of ${inst.totalCount} ($${(inst.monthlyAmount / 100).toFixed(2)}) paid${lateBy > 0 ? ` ${lateBy} ${lateBy === 1 ? "day" : "days"} late` : " on time"}!`,
            time: "Just now",
          },
        ],
      };
      const finished = nextPaid >= inst.totalCount;
      return {
        ...prev,
        deals: prev.deals.map((d) =>
          d.id === dealId ? { ...d, late: false, ...(finished ? { stage: "paid_off" as Stage } : {}), updated: "Just now" } : d,
        ),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const payOff = (dealId: string, amountCents: number) => {
    const now = demoNow();
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const inst = cur.installment;
      const d = prev.deals.find((x) => x.id === dealId);
      if (!inst || !d || d.stage !== "active" || cur.lien) return prev; // already paid off: a repeat does nothing
      return {
        ...prev,
        deals: prev.deals.map((x) => (x.id === dealId ? { ...x, late: false, stage: "paid_off" as Stage, updated: "Just now" } : x)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: {
            ...cur,
            installment: {
              ...inst,
              paidCount: inst.totalCount,
              lastPaymentDate: now.toISOString(),
              fired: [],
              history: [...(inst.history ?? []), { n: inst.totalCount, status: "paid", at: now.toISOString(), method: "manual", key: "payoff" }],
            },
            lien: { requestedAt: now.toISOString(), paidOffCents: amountCents },
            messages: [
              ...cur.messages,
              { id: "m-" + Date.now(), sender: "buyer", senderName: buyerName(), text: `Paid off the loan: $${(amountCents / 100).toFixed(2)}. Please release the lien.`, time: "Just now" },
            ],
          },
        },
      };
    });
    const d = dealOf(dealId);
    notify(uidOf(d.seller), "deal_stage", { title: "Loan paid off", body: `${d.buyer} paid off ${shortCar(d.car)}. Release the lien so the title is clear.`, href: `/deals/${dealId}?as=seller` });
  };

  const releaseLien = (dealId: string) => {
    const now = demoNow();
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      if (!cur.lien || cur.lien.releasedAt) return prev;
      return {
        ...prev,
        deals: prev.deals.map((x) => (x.id === dealId ? { ...x, updated: "Just now" } : x)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: {
            ...cur,
            lien: { ...cur.lien, releasedAt: now.toISOString() },
            messages: [...cur.messages, { id: "m-" + Date.now(), sender: "seller", senderName: PERSONAS.seller.name, text: "Lien released. The title is now free and clear.", time: "Just now" }],
          },
        },
      };
    });
    const d = dealOf(dealId);
    notify(uidOf(d.buyer), "deal_stage", { title: "Your title is clear", body: `${d.seller.split(" ")[0]} released the lien on ${shortCar(d.car)}. It’s yours, free and clear.`, href: `/deals/${dealId}?as=buyer` });
  };

  const failInstallment = (dealId: string, error = "Payment declined") => {
    const now = demoNow();
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      if (!cur.installment) return prev;
      const r = recordPayment(cur.installment, { ok: false, method: "manual", key: `man-${cur.installment.paidCount + 1}`, now, error });
      if (!r.applied) return prev;
      return { ...prev, dealDetails: { ...prev.dealDetails, [dealId]: { ...cur, installment: r.inst } } };
    });
  };

  const resetDemo = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setState(getInitialState());
    void resetShared();
  };

  const value = useMemo(
    () => ({
      deals: state.deals,
      customVehicles: state.customVehicles,
      allVehicles,
      withEdits,
      updateVehicle,
      getDeal,
      getDealDetail,
      addVehicle,
      createInquiry,
      bookTestDrive,
      makeOffer,
      sendMessage,
      changeTestDrive,
      confirmTestDrive,
      completeTestDrive,
      approveOffer,
      declineDeal,
      withdrawDeal,
      adminSetStage,
      submitCounterOffer,
      acceptCounterOffer,
      acceptInspection,
      bookInspection,
      approveInspectionBooking,
      decideInspection,
      signContract,
      payDownPayment,
      failDownPayment,
      replayPaymentWebhook,
      confirmClosing,
      cancelDeal,
      payInstallment,
      failInstallment,
      payOff,
      releaseLien,
      resetDemo,
    }),
    [state]
  );

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore() {
  const ctx = useContext(DemoStoreContext);
  if (!ctx) {
    throw new Error("useDemoStore must be used within a DemoStoreProvider");
  }
  return ctx;
}
