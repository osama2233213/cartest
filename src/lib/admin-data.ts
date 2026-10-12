/**
 * The admin console's data layer. Everything is derived from the same demo store the seller and buyer
 * portals use (deals, cars, drives, ads, payments) plus a small persisted store of admin decisions
 * (suspensions, review results, notes, refunds, settings, audit log).
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { addDays } from "date-fns/addDays";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { startOfMonth } from "date-fns/startOfMonth";
import { subMonths } from "date-fns/subMonths";
import { isSameMonth } from "date-fns/isSameMonth";
import { feeCentsIn, isBackfill, reconcileRevenue } from "./revenue";
import { termsFor, REVENUE, STAGES, type DemoDeal, type Stage } from "./demo-data";
import { useDemoStore, type DealDetailData } from "./demo-store";
import { useDrives, type Drive } from "./drives";
import { useAds, CHANNELS } from "./ads";
import { ledgerFor } from "./ledger";
import { pushNotice } from "./notifications";
import { getSessionState, useSession, type SessionUser } from "./session";
import { listPublicVehicles, type PublicVehicle } from "./vehicles.functions";
import { vehicleStatus, vehicleStats, type VehicleStatus } from "./seller-data";
import { shortCar } from "./format";
import {
  ago,
  HIST_CLOSED,
  PARTNER_MAPPING,
  SEED_AUDIT,
  SEED_DISPUTES,
  SEED_INTEGRATIONS,
  SEED_PARTNERS,
  SEED_POLICIES,
  SEED_QUEUE,
  SEED_STATE_RULES,
  SEED_TICKETS,
  SEED_USERS,
  slug,
  userIdFor,
  type FullStateRule,
  type IntegrationSeed,
  type PartnerSeed,
  type Policies,
  type QueueItem,
  type QueueType,
  type Ticket,
} from "./admin-seed";

export { PARTNER_MAPPING, CHANNELS };
export type { QueueItem, Ticket, Policies, FullStateRule };

/* ------------------------------------------------------------------ types */

export type Note = { id: string; text: string; by: string; at: string };
export type VState = "not_started" | "in_progress" | "in_review" | "verified" | "rejected";
export type AdminUser = {
  id: string;
  role: "seller" | "buyer" | "admin";
  name: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  createdAt: string;
  status: "active" | "suspended";
  suspendedReason?: string | undefined;
  suspendedAt?: string | undefined;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactor: boolean;
  verification: { identity: VState; payouts?: VState | undefined; bank?: VState | undefined; credit?: VState | undefined };
  feeWaived: boolean;
  adminNotes: Note[];
  adminRole?: "owner" | "admin" | "support" | undefined;
  lastActiveAt?: string | undefined;
  creditBand?: string | undefined;
  bankAccount?: { bank: string; last4: string; type: string } | undefined;
  deals: number;
  volume: number;
  paid: number;
  received: number;
  live: boolean;
};

export type CheckResult = "pass" | "fail" | "review" | "pending";
export type AdminVehicle = {
  id: string;
  aliases: string[];
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  body: string;
  mileage: number;
  exteriorColor: string;
  interiorColor: string;
  condition: string;
  city: string;
  state: string;
  zip: string;
  description: string;
  features: string[];
  photos: string[];
  sellerName: string;
  seller?: AdminUser | undefined;
  status: VehicleStatus | "blocked" | "verifying";
  asking: number; // cents
  minDownPct: number;
  apr: number;
  allowedTerms: number[];
  market: { low: number; high: number };
  checks: { lien: CheckResult; theft: CheckResult; brand: CheckResult; history: CheckResult };
  flagged: boolean;
  flagItem?: QueueItem | undefined;
  liveAds: number;
  listedAt: string;
  views: number;
  saves: number;
  titleFileName: string;
  inDeal: boolean;
};

export type DealRow = {
  deal: DemoDeal;
  id: string;
  vehicle?: AdminVehicle | undefined;
  buyer?: AdminUser | undefined;
  seller?: AdminUser | undefined;
  price: number;
  idleDays: number;
  stuck: boolean;
  paused?: { reason: string; note?: string | undefined; at: string } | undefined;
  late: boolean;
  escalatedAt?: string | undefined;
  escalationNote?: string | undefined;
  adminNotes: Note[];
  updatedAt: string;
};

export type AdminPayment = {
  id: string;
  dealId: string;
  kind: "down_payment" | "monthly" | "payoff";
  amount: number;
  fee: number;
  status: "paid" | "failed" | "refunded";
  method: "ach" | "card";
  buyerName: string;
  sellerName: string;
  car: string;
  paidAt?: string | undefined;
  dueAt: string;
  stripeRef: string;
  failureReason?: string | undefined;
  refundedAt?: string | undefined;
  refundReason?: string | undefined;
  refundedBy?: string | undefined;
};

export type Dispute = {
  id: string;
  paymentId: string;
  dealId: string;
  amount: number;
  reason: string;
  openedAt: string;
  dueBy: string;
  status: "needs_response" | "under_review" | "won" | "lost";
};

export type ClosedRow = {
  key: string;
  dealId?: string | undefined;
  closedAt: string;
  car: string;
  seller: string;
  buyer: string;
  price: number;
  downPayment: number;
  fee: number;
  outcome: "paid_off" | "defaulted" | "cancelled";
  durationMonths: number;
  photo?: string | undefined;
};

export type FeeRow = {
  id: string;
  at: string;
  dealId: string;
  live: boolean;
  sellerName: string;
  sellerId?: string | undefined;
  downPayment: number;
  fee: number;
  status: "collected" | "waived" | "refunded";
};

export type PartnerView = {
  id: string;
  name: string;
  account: string;
  requirements: string[];
  status: "connected" | "needs_attention" | "disabled";
  errorRate: number;
  lastSyncAt: string;
  apiKeyMasked: string;
  stats: { live: number; clicks: number; inquiries: number };
  failures: { id: string; vehicleId: string; carName: string; sellerName: string; error?: string }[];
  sync: { id: string; kind: "posted" | "failed" | "sync"; at: string; note: string; vehicleId?: string }[];
};

export type IntegrationView = {
  id: string;
  name: string;
  vendorExample: string;
  category: IntegrationSeed["category"];
  health: "healthy" | "degraded" | "down";
  lastEventAt: string;
  costThisMonth: number;
  usageThisMonth: number;
  unit: string;
  key: string;
  keyRotatedAt: string | null;
  where: string[];
  series: { day: number; uses: number }[];
  webhookEvents: { type: string; at: string; ok: boolean }[];
};

export type AuditArea = "verification" | "users" | "vehicles" | "deals" | "payments" | "advertising" | "integrations" | "settings" | "support";
export const AREA_LABEL: Record<AuditArea, string> = {
  verification: "Verifications",
  users: "Users",
  vehicles: "Vehicles",
  deals: "Deals",
  payments: "Payments",
  advertising: "Advertising",
  integrations: "Integrations",
  settings: "Settings",
  support: "Support",
};
export const AUDIT_AREAS = Object.keys(AREA_LABEL) as AuditArea[];
export type AuditEntry = { id: string; at: string; actor: string; system?: boolean | undefined; action: string; area: AuditArea; label: string; target: string; before?: string | undefined; after?: string | undefined };

/* ------------------------------------------------------------------ store */

type UserPatch = Partial<Pick<AdminUser, "status" | "suspendedReason" | "suspendedAt" | "feeWaived" | "twoFactor" | "adminRole">> & {
  verification?: Partial<AdminUser["verification"]>;
};
type VehiclePatch = { status?: AdminVehicle["status"]; flagged?: boolean; flagNote?: string };
type DealPatch = { paused?: DealRow["paused"] | null; escalatedAt?: string | undefined; escalationNote?: string | undefined; notes?: Note[] };

type Store = {
  userPatch: Record<string, UserPatch>;
  userNotes: Record<string, Note[]>;
  queue: QueueItem[];
  vehiclePatch: Record<string, VehiclePatch>;
  dealPatch: Record<string, DealPatch>;
  refunds: Record<string, { at: string; reason: string; by: string }>;
  disputes: Dispute[];
  partners: Record<string, { status?: PartnerView["status"]; apiKeyMasked?: string; lastSyncAt?: string; errorRate?: number }>;
  partnerLog: Record<string, PartnerView["sync"]>;
  integrations: Record<string, { health?: IntegrationView["health"] | undefined; key?: string | undefined; keyRotatedAt?: string | undefined; replayed?: number[] | undefined }>;
  feeRate: number;
  /** What a buyer pays to book an inspection, in cents. */
  inspectionFeeCents: number;
  policies: Policies;
  stateRules: FullStateRule[];
  invites: { id: string; email: string; role: "owner" | "admin" | "support"; invitedAt: string }[];
  removedAdmins: string[];
  adminRoles: Record<string, "owner" | "admin" | "support">;
  tickets: Ticket[];
  audit: AuditEntry[];
};

const KEY = "ownerfi-poc-admin-v1";
const disputeSeed = (): Dispute[] =>
  SEED_DISPUTES.map((d) => ({ id: d.id, paymentId: d.paymentId, dealId: d.dealId, amount: d.amount, reason: d.reason, openedAt: ago(d.openedDaysAgo), dueBy: addDays(new Date(), d.dueInDays).toISOString(), status: d.status }));

function seed(): Store {
  return {
    userPatch: {},
    userNotes: {},
    queue: SEED_QUEUE.map((q) => ({ ...q })),
    vehiclePatch: {},
    dealPatch: {},
    refunds: {},
    disputes: disputeSeed(),
    partners: {},
    partnerLog: {},
    integrations: {},
    feeRate: 0.1,
    inspectionFeeCents: 9_900,
    policies: structuredClone(SEED_POLICIES),
    stateRules: structuredClone(SEED_STATE_RULES),
    invites: [],
    removedAdmins: [],
    adminRoles: {},
    tickets: structuredClone(SEED_TICKETS),
    audit: SEED_AUDIT.map((a) => ({ id: a.id, at: ago(a.daysAgo, a.hours), actor: a.actor, system: "system" in a ? a.system : undefined, action: a.action, area: a.area, label: a.label, target: a.target, before: a.before, after: a.after })),
  };
}

let store: Store = seed();
const SERVER: Store = seed();
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) store = { ...seed(), ...(JSON.parse(raw) as Partial<Store>) };
  } catch {
    /* ignore */
  }
}
function write(next: Store) {
  store = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
const patch = (fn: (s: Store) => Partial<Store>) => {
  load();
  write({ ...store, ...fn(store) });
};

export function useAdminStore(): Store {
  return useSyncExternalStore(
    (l) => {
      load();
      listeners.add(l);
      l();
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER,
  );
}

export function resetAdmin() {
  load();
  write(seed());
}
if (typeof window !== "undefined") window.addEventListener("ownerfi:reset", () => resetAdmin());

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const actorName = () => {
  const s = getSessionState();
  return s.users.find((u) => u.id === s.currentUserId)?.name ?? "Admin";
};

function logAudit(area: AuditArea, action: string, label: string, target: string, before?: string, after?: string, system = false) {
  patch((s) => ({ audit: [{ id: uid("a"), at: new Date().toISOString(), actor: system ? "System" : actorName(), system, action, area, label, target, before, after }, ...s.audit] }));
}

/* ----------------------------------------------------------------- people */

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const phoneFor = (name: string) => `(${["480", "602", "623", "512"][hash(name) % 4]}) 555-${String(1000 + (hash(name) % 9000)).slice(0, 4)}`;
const emailFor = (name: string) => `${slug(name).replace("-", ".")}@example.com`;
const BANKS = ["Chase", "Bank of America", "Wells Fargo", "Capital One"];

function buildUsers(session: SessionUser[], s: Store, deals: DemoDeal[]): AdminUser[] {
  const base: AdminUser[] = [];
  for (const u of session) {
    base.push({
      id: u.id,
      role: u.role,
      name: u.name,
      email: u.email,
      phone: u.phone,
      state: u.state,
      city: u.state === "AZ" ? "Phoenix" : "Austin",
      createdAt: u.createdAt,
      status: u.status,
      emailVerified: u.emailVerified,
      phoneVerified: true,
      twoFactor: u.twoFactor,
      verification: { ...u.verification },
      feeWaived: false,
      adminNotes: [],
      adminRole: u.role === "admin" ? "owner" : undefined,
      lastActiveAt: ago(0, 1),
      creditBand: u.role === "buyer" ? "Good" : undefined,
      deals: 0,
      volume: 0,
      paid: 0,
      received: 0,
      live: true,
    });
  }
  for (const x of SEED_USERS) {
    const id = userIdFor(x.name);
    if (base.some((b) => b.id === id || b.name === x.name)) continue;
    base.push({
      id,
      role: x.role,
      name: x.name,
      email: emailFor(x.name),
      phone: phoneFor(x.name),
      state: x.state,
      city: x.city ?? "Phoenix",
      createdAt: ago(x.joinedDaysAgo),
      status: x.suspended ? "suspended" : "active",
      suspendedReason: x.suspended?.reason,
      suspendedAt: x.suspended ? ago(x.suspended.daysAgo) : undefined,
      emailVerified: true,
      phoneVerified: true,
      twoFactor: x.role === "admin",
      verification: { identity: x.identity, payouts: x.payouts, bank: x.bank, credit: x.credit },
      feeWaived: false,
      adminNotes: [],
      adminRole: x.adminRole,
      lastActiveAt: x.role === "admin" ? ago(0, 3) : ago(x.joinedDaysAgo > 20 ? 1 : 0, 4),
      creditBand: x.credit_band,
      deals: 0,
      volume: 0,
      paid: 0,
      received: 0,
      live: false,
    });
  }
  // People who only appear on deals
  for (const d of deals) {
    for (const [name, role] of [[d.seller, "seller"], [d.buyer, "buyer"]] as const) {
      if (!base.some((b) => b.name === name)) {
        base.push({ id: userIdFor(name), role, name, email: emailFor(name), phone: phoneFor(name), state: d.state ?? "AZ", city: "Phoenix", createdAt: ago(60), status: "active", emailVerified: true, phoneVerified: true, twoFactor: false, verification: { identity: "verified", payouts: "verified", bank: "verified", credit: "verified" }, feeWaived: false, adminNotes: [], deals: 0, volume: 0, paid: 0, received: 0, live: false });
      }
    }
  }
  return base
    .filter((u) => !(u.role === "admin" && s.removedAdmins.includes(u.id)))
    .map((u) => {
      const p = s.userPatch[u.id] ?? {};
      const mine = deals.filter((d) => (u.role === "seller" ? d.seller === u.name : d.buyer === u.name));
      const closed = mine.filter((d) => ["closing", "active", "paid_off", "defaulted"].includes(d.stage));
      const volume = closed.reduce((sum, d) => sum + d.priceCents, 0);
      const adminRole = s.adminRoles[u.id] ?? p.adminRole ?? u.adminRole;
      const bankOk = u.role === "buyer" && (p.verification?.bank ?? u.verification.bank) === "verified";
      return {
        ...u,
        ...p,
        verification: { ...u.verification, ...p.verification },
        adminNotes: s.userNotes[u.id] ?? [],
        adminRole,
        bankAccount: bankOk ? { bank: BANKS[hash(u.name) % 4]!, last4: String(1000 + (hash(u.id) % 9000)), type: "Checking" } : undefined,
        deals: mine.length,
        volume,
        paid: u.role === "buyer" ? closed.reduce((sum, d) => sum + termsFor(d).down, 0) : 0,
        received: u.role === "seller" ? closed.reduce((sum, d) => sum + termsFor(d).sellerNet, 0) : 0,
      };
    });
}

export const userStatus = (u: AdminUser): { label: string; tone: "success" | "warning" | "danger" | "neutral" } => {
  if (u.status === "suspended") return { label: "Suspended", tone: "danger" };
  const v = Object.values(u.verification).filter(Boolean);
  if (v.every((x) => x === "verified")) return { label: "Verified", tone: "success" };
  if (v.some((x) => x === "rejected")) return { label: "Rejected", tone: "danger" };
  if (v.some((x) => x === "in_review")) return { label: "In review", tone: "warning" };
  return { label: "Not verified", tone: "neutral" };
};
export const firstName = (u: { name: string }) => u.name.split(" ")[0] ?? u.name;

/* ---------------------------------------------------------------- vehicles */

const sameSeller = (display: string, full: string) => {
  const [f = "", l = ""] = full.split(" ");
  return display === full || display === `${f} ${l.slice(0, 1)}.`;
};

const CHECK_SEED: Record<string, Partial<AdminVehicle["checks"]>> = {
  "dv-d-1005": { brand: "review" },
  "dv-d-1008": { history: "review" },
};

function fromDeal(d: DemoDeal): PublicVehicle {
  const parts = d.car.split(" ");
  return {
    id: `dv-${d.id}`,
    seller_display_name: d.seller,
    seller_verified: true,
    vin: null,
    year: Number(parts[0]) || 2019,
    make: parts[1] ?? "Car",
    model: parts[2] ?? "",
    trim: parts.slice(3).join(" ") || null,
    body: null,
    mileage: 38000 + (hash(d.id) % 60000),
    exterior_color: ["Silver", "Black", "White", "Blue", "Red"][hash(d.id) % 5]!,
    interior_color: "Black",
    condition: "Good",
    description: `${d.car}. Well kept, service records available.`,
    city: d.state === "TX" ? "Austin" : "Phoenix",
    state: d.state ?? "AZ",
    price_cents: d.priceCents,
    min_down_pct: d.minDownPct ?? 10,
    apr: d.apr,
    allowed_terms: d.allowedTerms ?? [36, 48],
    market_low_cents: Math.round(d.priceCents * 0.93),
    market_high_cents: Math.round(d.priceCents * 1.07),
    photos: [d.photo],
    features: ["Backup camera", "Bluetooth"],
    history_summary: { owners: 1, accidents: 0, title: "clean" },
    status: "listed",
    created_at: ago(20 + (hash(d.id) % 40)),
  };
}

function vinFor(id: string) {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  let h = hash(id);
  let out = "";
  for (let i = 0; i < 17; i++) {
    out += chars[h % chars.length];
    h = (h * 1103515245 + 12345) >>> 0;
  }
  return out;
}

function buildVehicles(pub: PublicVehicle[], custom: PublicVehicle[], deals: DemoDeal[], users: AdminUser[], s: Store, adsLive: (id: string) => number): AdminVehicle[] {
  const real = [...custom, ...pub.filter((v) => !custom.some((c) => c.id === v.id))];
  const synth = deals
    .filter((d) => !real.some((v) => d.car.startsWith(`${v.year} ${v.make} ${v.model}`)))
    .map(fromDeal);
  return [...real, ...synth].map((v) => {
    const vp = s.vehiclePatch[v.id] ?? {};
    const aliases = [v.id, ...deals.filter((d) => d.car.startsWith(`${v.year} ${v.make} ${v.model}`)).map((d) => `dv-${d.id}`)];
    const mine = (id: string | undefined) => !!id && aliases.includes(id);
    const flagItem = s.queue.find((q) => mine(q.vehicleId) && q.type === "vehicle_flag" && q.status === "in_review");
    const base = v.id.startsWith("dv-") ? (() => {
      const d = deals.find((x) => `dv-${x.id}` === v.id)!;
      return d.stage === "paid_off" ? "paid_off" : d.stage === "active" || d.stage === "defaulted" ? "sold_active" : ["declined", "cancelled"].includes(d.stage) ? "listed" : "reserved";
    })() : vehicleStatus(v, deals);
    const openTitle = s.queue.find((q) => mine(q.vehicleId) && q.type === "title" && q.status === "in_review");
    const status: AdminVehicle["status"] = vp.status ?? (openTitle && base === "listed" ? "pending_review" : base);
    const cs = aliases.reduce<Partial<AdminVehicle["checks"]>>((acc, a) => ({ ...acc, ...CHECK_SEED[a] }), {});
    const seller = users.find((u) => u.role === "seller" && sameSeller(v.seller_display_name, u.name));
    const st = vehicleStats(v.id);
    return {
      id: v.id,
      aliases,
      vin: v.vin ?? vinFor(v.id),
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim ?? "",
      body: v.body ?? "Sedan",
      mileage: v.mileage,
      exteriorColor: v.exterior_color ?? "Silver",
      interiorColor: v.interior_color ?? "Black",
      condition: v.condition ?? "Good",
      city: v.city,
      state: v.state,
      zip: ({ TX: "78701", FL: "33101", CA: "92101", NY: "10001" } as Record<string, string>)[v.state] ?? "85012",
      description: v.description ?? "",
      features: v.features ?? [],
      photos: v.photos.length ? v.photos : [],
      sellerName: seller?.name ?? v.seller_display_name,
      seller,
      status,
      asking: v.price_cents,
      minDownPct: v.min_down_pct,
      apr: v.apr,
      allowedTerms: v.allowed_terms,
      market: { low: v.market_low_cents ?? Math.round(v.price_cents * 0.93), high: v.market_high_cents ?? Math.round(v.price_cents * 1.07) },
      checks: { lien: "pass", theft: "pass", brand: cs.brand ?? "pass", history: cs.history ?? "pass", ...(status === "blocked" ? { lien: "fail" as const } : {}) },
      flagged: vp.flagged ?? !!flagItem,
      flagItem,
      liveAds: adsLive(v.id),
      listedAt: v.created_at,
      views: st.views,
      saves: st.saves,
      titleFileName: `${slug(v.make)}-${slug(v.model)}-title.pdf`,
      inDeal: deals.some((d) => d.car.startsWith(`${v.year} ${v.make} ${v.model}`) && !["declined", "cancelled"].includes(d.stage)),
    };
  });
}

export const hasVehicleId = (v: Pick<AdminVehicle, "id" | "aliases">, id: string | undefined) => !!id && (v.id === id || v.aliases.includes(id));

export const vehicleName = (v: Pick<AdminVehicle, "year" | "make" | "model">) => `${v.year} ${v.make} ${v.model}`;
export const vehicleGroup = (v: AdminVehicle) =>
  v.status === "listed" || v.status === "reserved" ? "listed" : v.status === "pending_review" || v.status === "verifying" ? "review" : v.status === "sold_active" || v.status === "paid_off" ? "sold" : v.status === "blocked" ? "blocked" : "not_listed";
export const checkSummary = (v: AdminVehicle): { label: string; tone: "success" | "warning" | "danger" } => {
  const all = Object.values(v.checks);
  if (all.includes("fail")) return { label: "Problem found", tone: "danger" };
  if (all.includes("review") || all.includes("pending")) return { label: "Needs a look", tone: "warning" };
  return { label: "All clear", tone: "success" };
};

/* ------------------------------------------------------------------- deals */

export function idleDaysOf(updated: string): number {
  if (/^just now$/i.test(updated)) return 0;
  const m = /^(\d+)\s*(m|h|d|w)/.exec(updated);
  if (!m) return 0;
  const n = Number(m[1]);
  return m[2] === "d" ? n : m[2] === "w" ? n * 7 : 0;
}
export const isClosedStage = (s: Stage) => ["paid_off", "declined", "cancelled", "defaulted"].includes(s);

function buildDealRows(deals: DemoDeal[], vehicles: AdminVehicle[], users: AdminUser[], s: Store): DealRow[] {
  return deals.map((d) => {
    const dp = s.dealPatch[d.id] ?? {};
    const idle = idleDaysOf(d.updated);
    const veh = vehicles.find((v) => d.car.startsWith(`${v.year} ${v.make} ${v.model}`));
    const paused = dp.paused === null ? undefined : dp.paused;
    return {
      deal: d,
      id: d.id,
      vehicle: veh,
      buyer: users.find((u) => u.name === d.buyer),
      seller: users.find((u) => u.name === d.seller),
      price: d.priceCents,
      idleDays: idle,
      stuck: idle >= 7 && !isClosedStage(d.stage),
      paused,
      late: !!d.late,
      escalatedAt: dp.escalatedAt,
      escalationNote: dp.escalationNote,
      adminNotes: dp.notes ?? [],
      updatedAt: new Date(Date.now() - Math.max(idle, 0) * 86_400_000).toISOString(),
    };
  });
}

/* ---------------------------------------------------------------- payments */

function buildPayments(deals: DemoDeal[], details: (id: string) => DealDetailData, s: Store): AdminPayment[] {
  const out: AdminPayment[] = [];
  for (const d of deals) {
    const det = details(d.id);
    for (const r of ledgerFor(d, det)) {
      // A cancelled deal's refund shows on its down payment row, not as a payment of its own.
      if (r.kind === "refund") continue;
      const autoRefund = r.kind === "down_payment" && det.payment?.status === "refunded";
      const rf = s.refunds[r.id] ?? (autoRefund ? { at: det.payment?.refundedAt ?? new Date().toISOString(), reason: "Deal cancelled", by: "OwnerFi" } : undefined);
      const t = r.id.replace(/-/g, "").slice(-8);
      out.push({
        id: r.id,
        dealId: d.id,
        kind: r.kind,
        amount: r.amount,
        fee: r.fee,
        status: rf ? "refunded" : "paid",
        method: hash(r.id) % 4 === 0 ? "card" : "ach",
        buyerName: d.buyer,
        sellerName: d.seller,
        car: shortCar(d.car),
        paidAt: r.at.toISOString(),
        dueAt: r.at.toISOString(),
        stripeRef: `pi_${t}${hash(r.id).toString(36)}`,
        refundedAt: rf?.at,
        refundReason: rf?.reason,
        refundedBy: rf?.by,
      });
    }
    if (d.late && d.stage === "active") {
      const t = termsFor(d);
      for (const [i, daysAgo] of [[1, 6], [2, 2]] as const) {
        out.push({ id: `${d.id}-f${i}`, dealId: d.id, kind: "monthly", amount: t.monthly, fee: 0, status: "failed", method: "ach", buyerName: d.buyer, sellerName: d.seller, car: shortCar(d.car), dueAt: ago(daysAgo), stripeRef: `pi_f${i}${hash(d.id).toString(36)}`, failureReason: "Insufficient funds" });
      }
    }
  }
  return out.sort((a, b) => (b.paidAt ?? b.dueAt).localeCompare(a.paidAt ?? a.dueAt));
}

/* ---------------------------------------------------------------- partners */

function buildPartners(s: Store, ads: ReturnType<typeof useAds>, vehicles: AdminVehicle[]): PartnerView[] {
  return SEED_PARTNERS.map((p: PartnerSeed) => {
    const o = s.partners[p.id] ?? {};
    const mine = ads.filter((a) => a.channelId === p.id);
    const live = mine.filter((a) => a.status === "live");
    const status = o.status ?? p.status;
    const failedAds = mine.filter((a) => a.status === "failed");
    const carName = (id: string) => {
      const v = vehicles.find((x) => x.id === id);
      return v ? vehicleName(v) : id;
    };
    const sellerName = (id: string) => vehicles.find((x) => x.id === id)?.sellerName ?? "Seller";
    return {
      id: p.id,
      name: p.name,
      account: p.account,
      requirements: p.requirements,
      status,
      errorRate: o.errorRate ?? p.errorRate,
      lastSyncAt: o.lastSyncAt ?? new Date(Date.now() - p.lastSyncMin * 60_000).toISOString(),
      apiKeyMasked: o.apiKeyMasked ?? p.apiKeyMasked,
      stats: {
        live: status === "disabled" ? 0 : p.base.live + live.length,
        clicks: p.base.clicks + mine.reduce((sum, a) => sum + a.clicks, 0),
        inquiries: p.base.inquiries + mine.reduce((sum, a) => sum + a.inquiries, 0),
      },
      failures: [
        ...failedAds.map((a) => ({ id: a.id, vehicleId: a.vehicleId, carName: carName(a.vehicleId), sellerName: sellerName(a.vehicleId), error: "The partner didn’t accept this ad." })),
        ...p.failures.map((f, i) => ({ id: `${p.id}-f${i}`, ...f })),
      ],
      sync: [
        ...(s.partnerLog[p.id] ?? []),
        ...mine.map((a) => ({ id: `${a.id}-p`, kind: (a.status === "failed" ? "failed" : "posted") as "failed" | "posted", at: a.postedAt, note: a.status === "failed" ? "Rejected by the partner." : "Ad is live.", vehicleId: a.vehicleId })),
        ...Array.from({ length: 6 }, (_, i) => ({ id: `${p.id}-s${i}`, kind: "sync" as const, at: new Date(Date.now() - (p.lastSyncMin + i * 60) * 60_000).toISOString(), note: status === "needs_attention" && i < 3 ? "Key was rejected. Nothing was synced." : `Synced ${Math.max(1, p.base.live - i)} listings.` })),
      ].sort((a, b) => b.at.localeCompare(a.at)),
    };
  });
}

function buildIntegrations(s: Store): IntegrationView[] {
  return SEED_INTEGRATIONS.map((i) => {
    const o = s.integrations[i.id] ?? {};
    const health = o.health ?? i.health;
    const h = hash(i.id);
    const series = Array.from({ length: 30 }, (_, d) => ({ day: d + 1, uses: Math.round((i.usage / 30) * (0.5 + ((h >> (d % 12)) % 10) / 9)) }));
    const types = ["payment_intent.succeeded", "charge.updated", "transfer.created", "customer.updated", "verification.completed", "message.delivered"];
    const events = Array.from({ length: 8 }, (_, k) => ({ type: i.id === "payments" ? types[k % 3]! : `${i.id}.${["event", "completed", "updated"][k % 3]}`, at: new Date(Date.now() - (i.lastEventMin + k * 95) * 60_000).toISOString(), ok: !(health !== "healthy" && k < 2) && !(i.fails > 0 && k === 4) }));
    return {
      id: i.id,
      name: i.name,
      vendorExample: i.vendorExample,
      category: i.category,
      health,
      lastEventAt: new Date(Date.now() - i.lastEventMin * 60_000).toISOString(),
      costThisMonth: i.cost,
      usageThisMonth: i.usage,
      unit: i.unit,
      key: o.key ?? i.key,
      keyRotatedAt: o.keyRotatedAt ?? (i.rotatedDaysAgo === null ? null : ago(i.rotatedDaysAgo)),
      where: i.where,
      series,
      webhookEvents: events,
    };
  });
}

/* ------------------------------------------------------------------- model */

export function useAdminModel() {
  const s = useAdminStore();
  const sess = useSession();
  const { deals, customVehicles, getDealDetail } = useDemoStore();
  const drives = useDrives();
  const ads = useAds();
  const q = useQuery({ queryKey: ["public-vehicles"], queryFn: () => listPublicVehicles() });
  const pub = q.data?.vehicles;

  return useMemo(() => {
    const users = buildUsers(sess.users, s, deals);
    const adsLive = (id: string) => ads.filter((a) => a.vehicleId === id && a.status === "live").length;
    const vehicles = buildVehicles(pub ?? [], customVehicles, deals, users, s, adsLive);
    const dealRows = buildDealRows(deals, vehicles, users, s);
    const payments = buildPayments(deals, getDealDetail, s);
    const partners = buildPartners(s, ads, vehicles);
    const integrations = buildIntegrations(s);

    const closed: ClosedRow[] = [
      ...deals
        .filter((d) => ["paid_off", "defaulted"].includes(d.stage) || (d.stage === "cancelled" && ledgerFor(d, getDealDetail(d.id)).length > 0))
        .map((d) => {
          const t = termsFor(d);
          return { key: d.id, dealId: d.id, closedAt: ago(Math.max(1, idleDaysOf(d.updated))), car: shortCar(d.car), seller: d.seller, buyer: d.buyer, price: d.priceCents, downPayment: t.down, fee: d.feeWaived ? 0 : t.fee, outcome: d.stage as ClosedRow["outcome"], durationMonths: d.stage === "paid_off" ? d.term : 0, photo: d.photo };
        }),
      ...HIST_CLOSED.map((h) => ({ key: h.id, closedAt: ago(h.closedDaysAgo), car: h.car, seller: h.seller, buyer: h.buyer, price: h.price, downPayment: h.down, fee: h.fee, outcome: h.outcome, durationMonths: h.months })),
    ];

    const liveFees: FeeRow[] = [
      ...payments
        .filter((p) => p.kind === "down_payment")
        .map((p) => {
          const d = deals.find((x) => x.id === p.dealId)!;
          const seller = users.find((u) => u.name === d.seller);
          const waived = !!d.feeWaived || !!seller?.feeWaived;
          return { id: p.id, at: p.paidAt ?? p.dueAt, dealId: p.dealId, live: true, sellerName: d.seller, sellerId: seller?.id, downPayment: p.amount, fee: waived ? 0 : p.fee, status: (p.status === "refunded" ? "refunded" : waived ? "waived" : "collected") as FeeRow["status"] };
        }),
      ...HIST_CLOSED.map((h) => ({ id: `fee-${h.id}`, at: ago(h.closedDaysAgo + h.months * 30), dealId: h.id, live: false, sellerName: h.seller, sellerId: userIdFor(h.seller), downPayment: h.down, fee: h.fee, status: "collected" as FeeRow["status"] })),
    ];

    const { fees, months: revenueMonths } = reconcileRevenue(liveFees, REVENUE.map((x) => x.fees));
    return { s, users, vehicles, dealRows, payments, closed, fees, revenueMonths, partners, integrations, drives, deals, details: getDealDetail };
  }, [s, sess.users, deals, customVehicles, pub, ads, drives, getDealDetail]);
}
export type AdminModel = ReturnType<typeof useAdminModel>;

/* --------------------------------------------------------------- dashboards */

export function dashboardOf(m: AdminModel) {
  const months = m.revenueMonths;
  const thisMonthFees = months[months.length - 1]!.fees;
  const open = m.dealRows.filter((r) => !isClosedStage(r.deal.stage));
  const waiting = m.s.queue.filter((q) => q.status === "in_review").length;
  const activeCars = m.vehicles.filter((v) => v.status === "listed" || v.status === "reserved").length;
  const gmv = m.dealRows.filter((r) => ["closing", "active", "paid_off"].includes(r.deal.stage)).reduce((sum, r) => sum + r.price, 0) / 100 + 58000;
  const kpis = [
    { key: "revenue", label: "Revenue this month", value: thisMonthFees, format: "money" as const, hint: "OwnerFi fees on down payments", to: "/admin/revenue" },
    { key: "gmv", label: "Cars financed", value: gmv, format: "money" as const, hint: "All time", to: "/admin/deals" },
    { key: "open", label: "Open deals", value: open.length, format: "number" as const, hint: `${open.filter((r) => r.stuck).length} stuck`, to: "/admin/deals" },
    { key: "closed", label: "Closed deals", value: m.closed.length, format: "number" as const, to: "/admin/closed-deals" },
    { key: "users", label: "People", value: m.users.filter((u) => u.role !== "admin").length, format: "number" as const, to: "/admin/users" },
    { key: "cars", label: "Cars for sale", value: activeCars, format: "number" as const, to: "/admin/vehicles" },
    { key: "queue", label: "Verifications waiting", value: waiting, format: "number" as const, to: "/admin/verifications" },
    { key: "late", label: "Late payments", value: m.dealRows.filter((r) => r.late).length, format: "number" as const, to: "/admin/payments?tab=failed" },
  ];
  type Att = { id: string; tone: "danger" | "warning"; title: string; detail: string; at: string; to: string };
  const attention: Att[] = [];
  for (const i of m.integrations) if (i.health !== "healthy") attention.push({ id: `i-${i.id}`, tone: i.health === "down" ? "danger" : "warning", title: `${i.name} is ${i.health === "down" ? "down" : "slow"}`, detail: i.vendorExample, at: i.lastEventAt, to: `/admin/integrations/${i.id}` });
  for (const d of m.s.disputes.filter((x) => x.status === "needs_response")) attention.push({ id: d.id, tone: "danger", title: "A payment dispute needs a reply", detail: `Deal ${d.dealId}`, at: d.openedAt, to: "/admin/payments?tab=disputes" });
  for (const r of m.dealRows.filter((x) => x.late)) attention.push({ id: `late-${r.id}`, tone: "danger", title: `${r.buyer?.name ?? r.deal.buyer} is behind on payments`, detail: shortCar(r.deal.car), at: r.updatedAt, to: `/admin/deals/${r.id}` });
  for (const q of m.s.queue.filter((x) => x.status === "in_review" && /overdue/.test(x.sla))) attention.push({ id: q.id, tone: "warning", title: "A verification is overdue", detail: queueSubject(q, m).name, at: q.submittedAt, to: `/admin/verifications?item=${q.id}` });
  for (const p of m.partners.filter((x) => x.status === "needs_attention")) attention.push({ id: `p-${p.id}`, tone: "warning", title: `${p.name} needs attention`, detail: "Key was rejected", at: p.lastSyncAt, to: `/admin/advertising/${p.id}` });
  for (const r of m.dealRows.filter((x) => x.stuck)) attention.push({ id: `stuck-${r.id}`, tone: "warning", title: `A deal has been quiet for ${r.idleDays} days`, detail: shortCar(r.deal.car), at: r.updatedAt, to: `/admin/deals/${r.id}` });
  attention.sort((a, b) => (a.tone === b.tone ? b.at.localeCompare(a.at) : a.tone === "danger" ? -1 : 1));
  const funnel = STAGES.filter((st) => st !== "paid_off").map((stage) => ({ stage, count: m.dealRows.filter((r) => r.deal.stage === stage).length }));
  const closedOut = m.dealRows.filter((r) => ["declined", "cancelled"].includes(r.deal.stage)).length;
  const usersByWeek = Array.from({ length: 8 }, (_, i) => {
    const start = Date.now() - (7 - i) * 7 * 86_400_000;
    const inWeek = m.users.filter((u) => u.role !== "admin" && new Date(u.createdAt).getTime() >= start && new Date(u.createdAt).getTime() < start + 7 * 86_400_000);
    return { label: format(new Date(start), "MMM d"), sellers: inWeek.filter((u) => u.role === "seller").length + (i % 3 === 0 ? 1 : 0), buyers: inWeek.filter((u) => u.role === "buyer").length + (i % 2) };
  });
  return { kpis, attention, funnel, closedOut, revenueByMonth: months, usersByWeek, counts: { verifications: waiting, integrations: m.integrations.filter((i) => i.health !== "healthy").length } };
}

export function queueSubject(q: QueueItem, m: AdminModel): { name: string; sub: string; user?: AdminUser | undefined; vehicle?: AdminVehicle | undefined } {
  const vehicle = q.vehicleId ? m.vehicles.find((v) => hasVehicleId(v, q.vehicleId)) : undefined;
  const user = q.userId ? m.users.find((u) => u.id === q.userId) : undefined;
  if (vehicle) return { name: vehicleName(vehicle), sub: `VIN …${vehicle.vin.slice(-6)} · ${vehicle.sellerName}`, user, vehicle };
  return { name: user?.name ?? "Unknown", sub: user ? `${user.role === "seller" ? "Seller" : "Buyer"} · ${user.email}` : "", user };
}

export const slaMinutes = (sla: string) => {
  const h = /^(\d+)h left/.exec(sla);
  if (h) return Number(h[1]) * 60;
  const d = /^(\d+) days? left/.exec(sla);
  if (d) return Number(d[1]) * 1440;
  return /overdue/.test(sla) ? -1 : Infinity;
};

export const ago_ = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });
export const dateShort = (iso: string) => format(new Date(iso), "MMM d, yyyy");
export const dateTime = (iso: string) => format(new Date(iso), "MMM d, yyyy 'at' h:mm a");

/* --------------------------------------------------------------- aggregates */

export function revenueSummary(m: AdminModel) {
  const r = m.revenueMonths;
  const now = new Date();
  const thisMonth = feeCentsIn(m.fees, (d) => isSameMonth(d, now));
  const lastMonth = feeCentsIn(m.fees, (d) => isSameMonth(d, subMonths(now, 1)));
  const ytd = feeCentsIn(m.fees, (d) => d.getFullYear() === now.getFullYear());
  const allTime = feeCentsIn(m.fees, () => true);
  const waived = m.fees.filter((f) => f.status === "waived");
  const byMonth = r.map((x) => ({ month: x.month, fees: x.fees }));
  const by = new Map<string, { fee: number; deals: number; name: string }>();
  for (const f of m.fees.filter((x) => x.status === "collected" && !isBackfill(x))) {
    const k = f.sellerId ?? f.sellerName;
    const cur = by.get(k) ?? { fee: 0, deals: 0, name: f.sellerName };
    by.set(k, { fee: cur.fee + f.fee, deals: cur.deals + 1, name: f.sellerName });
  }
  const top = [...by.entries()].map(([sellerId, v]) => ({ sellerId, seller: m.users.find((u) => u.id === sellerId), ...v })).sort((a, b) => b.fee - a.fee).slice(0, 5);
  const avg = Math.round((r.slice(-4, -1).reduce((sum, x) => sum + x.fees, 0) / 3) * 100);
  const projection = [1, 2, 3].map((i) => ({ month: format(addDays(startOfMonth(new Date()), 32 * i), "yyyy-MM"), label: format(addDays(startOfMonth(new Date()), 32 * i), "MMMM yyyy"), fee: avg }));
  const reconciliation = [3, 2, 1, 0].map((i) => ({ month: format(subMonths(new Date(), i), "yyyy-MM"), label: format(subMonths(new Date(), i), "MMMM yyyy"), ledger: feeCentsIn(m.fees, (d) => isSameMonth(d, subMonths(new Date(), i))), received: feeCentsIn(m.fees, (d) => isSameMonth(d, subMonths(new Date(), i))), status: i === 0 ? ("pending" as const) : ("matched" as const) }));
  return { totals: { thisMonth, lastMonth, ytd, allTime, deals: m.fees.filter((f) => !isBackfill(f)).length, waivedCount: waived.length + m.users.filter((u) => u.feeWaived).length, waivedForgone: waived.reduce((sum, f) => sum + Math.round(f.downPayment * m.s.feeRate), 0) }, byMonth, top, projection, reconciliation };
}

export function driveStats(drives: Drive[]) {
  const done = drives.filter((d) => d.status === "completed").length;
  const lost = drives.filter((d) => d.status === "no_show" || d.status === "cancelled" || d.status === "declined").length;
  return { scheduled: drives.filter((d) => ["requested", "confirmed", "rescheduled"].includes(d.status)).length, completed: done, noShow: drives.filter((d) => d.status === "no_show").length, completionRate: done + lost > 0 ? done / (done + lost) : null };
}

export const daysLate = (iso: string) => Math.max(0, differenceInCalendarDays(new Date(), new Date(iso)));

/* ------------------------------------------------------------------ actions */

const notify = (userId: string | undefined, title: string, body: string, href: string) => {
  if (userId) pushNotice({ userId, title, body, href });
};

export function useAdminActions(m: AdminModel) {
  const { adminSetStage } = useDemoStore();
  const userById = (id: string) => m.users.find((u) => u.id === id);

  const setQueue = (id: string, p: Partial<QueueItem>) => patch((s) => ({ queue: s.queue.map((q) => (q.id === id ? { ...q, ...p } : q)) }));
  const setUser = (id: string, p: UserPatch) =>
    patch((s) => ({ userPatch: { ...s.userPatch, [id]: { ...s.userPatch[id], ...p, verification: { ...s.userPatch[id]?.verification, ...p.verification } } } }));
  const setVehicle = (id: string, p: VehiclePatch) => patch((s) => ({ vehiclePatch: { ...s.vehiclePatch, [id]: { ...s.vehiclePatch[id], ...p } } }));
  const setDeal = (id: string, p: DealPatch) => patch((s) => ({ dealPatch: { ...s.dealPatch, [id]: { ...s.dealPatch[id], ...p } } }));
  const fail = (): never => {
    throw new Error("Something went wrong. Please try again.");
  };

  const decide = (item: QueueItem, status: "verified" | "rejected", opts: { reason?: string | undefined; notes?: string | undefined } = {}) => {
    setQueue(item.id, { status, sla: "done", decidedBy: actorName(), reason: opts.reason, notes: opts.notes ?? item.notes });
    const key = item.type === "bank" ? "bank" : item.scope === "credit" ? "credit" : item.type === "identity" ? "identity" : undefined;
    if (item.userId && key) setUser(item.userId, { verification: { [key]: status } });
    const veh = m.vehicles.find((v) => hasVehicleId(v, item.vehicleId));
    if (item.type === "title" && veh) setVehicle(veh.id, { status: status === "verified" ? "listed" : "blocked" });
    const who = queueSubject(item, m);
    logAudit("verification", status === "verified" ? "verification.approve" : "verification.reject", status === "verified" ? "Approved a verification" : "Rejected a verification", who.name, "In review", status === "verified" ? "Verified" : "Rejected");
    notify(item.userId, status === "verified" ? "You’re verified" : "We couldn’t verify that", status === "verified" ? "That step is done." : opts.reason ?? "Please try again.", item.userId?.startsWith("u-maria") || userById(item.userId ?? "")?.role === "seller" ? "/seller/onboarding" : "/buyer/verification");
  };

  return {
    verification: {
      approve: async (item: QueueItem, notes?: string) => decide(item, "verified", { notes }),
      reject: async (item: QueueItem, reason: string, notes?: string) => decide(item, "rejected", { reason, notes }),
      askInfo: async (item: QueueItem, text: string) => {
        notify(item.userId, "We need a bit more", text, "/buyer/verification");
        logAudit("verification", "verification.ask", "Asked for more info", queueSubject(item, m).name);
      },
      bulk: async (ids: string[]) => {
        const items = m.s.queue.filter((q) => ids.includes(q.id) && q.status === "in_review");
        const ok = items.filter((q) => q.autoResult !== "fail");
        ok.forEach((q) => decide(q, "verified"));
        return { approved: ok.length, skipped: items.length - ok.length };
      },
    },
    users: {
      suspend: async (u: AdminUser, reason: string, note?: string) => {
        setUser(u.id, { status: "suspended", suspendedReason: reason, suspendedAt: new Date().toISOString() });
        if (note) patch((s) => ({ userNotes: { ...s.userNotes, [u.id]: [{ id: uid("n"), text: `Suspended: ${note}`, by: actorName(), at: new Date().toISOString() }, ...(s.userNotes[u.id] ?? [])] } }));
        logAudit("users", "user.suspend", "Suspended a user", u.name, "Active", "Suspended");
      },
      reinstate: async (u: AdminUser) => {
        setUser(u.id, { status: "active", suspendedReason: undefined, suspendedAt: undefined });
        logAudit("users", "user.reinstate", "Reinstated a user", u.name, "Suspended", "Active");
      },
      reset2fa: async (u: AdminUser) => {
        setUser(u.id, { twoFactor: false });
        logAudit("users", "user.reset2fa", "Reset two-step sign-in", u.name);
        notify(u.id, "Set up two-step sign-in again", "An admin reset it. You’ll be asked at your next sign-in.", `/${u.role}/account/security`);
      },
      setFeeWaiver: async (u: AdminUser, on: boolean) => {
        setUser(u.id, { feeWaived: on });
        logAudit("settings", "settings.waiver", on ? "Added a fee waiver" : "Ended a fee waiver", u.name, on ? "Fee charged" : "Waived", on ? "Waived" : "Fee charged");
      },
      addNote: async (u: AdminUser, text: string) => {
        if (text.trim().length < 3) fail();
        patch((s) => ({ userNotes: { ...s.userNotes, [u.id]: [{ id: uid("n"), text: text.trim(), by: actorName(), at: new Date().toISOString() }, ...(s.userNotes[u.id] ?? [])] } }));
        logAudit("users", "user.note", "Added a note", u.name);
      },
    },
    vehicles: {
      approve: async (v: AdminVehicle) => {
        setVehicle(v.id, { status: "listed", flagged: false });
        patch((s) => ({ queue: s.queue.map((q) => (hasVehicleId(v, q.vehicleId) && q.status === "in_review" ? { ...q, status: "verified" as const, sla: "done", decidedBy: actorName() } : q)) }));
        logAudit("vehicles", "vehicle.approve", "Approved a listing", vehicleName(v), "In review", "Listed");
        notify(v.seller?.id, "Your car is live", `${vehicleName(v)} is on the marketplace.`, "/seller/vehicles");
      },
      requestChanges: async (v: AdminVehicle, text: string) => {
        setVehicle(v.id, { status: "draft" });
        logAudit("vehicles", "vehicle.changes", "Asked for changes", vehicleName(v));
        notify(v.seller?.id, "Please update your listing", text, "/seller/vehicles");
      },
      takeDown: async (v: AdminVehicle, reason: string, note?: string) => {
        setVehicle(v.id, { status: "delisted" });
        logAudit("vehicles", "vehicle.takedown", "Took a car down", vehicleName(v), "Listed", "Not listed");
        notify(v.seller?.id, "A car was taken down", [reason, note].filter(Boolean).join(": "), "/seller/vehicles");
      },
      clearFlag: async (v: AdminVehicle, note?: string) => {
        patch((s) => ({ queue: s.queue.map((q) => (hasVehicleId(v, q.vehicleId) && q.type === "vehicle_flag" && q.status === "in_review" ? { ...q, status: "verified" as const, sla: "done", decidedBy: actorName(), notes: note || q.notes } : q)) }));
        setVehicle(v.id, { flagged: false, ...(v.status === "pending_review" ? { status: "listed" as const } : {}) });
        logAudit("vehicles", "vehicle.clearflag", "Cleared a flag", vehicleName(v));
      },
      confirmFlag: async (v: AdminVehicle, note?: string) => {
        patch((s) => ({ queue: s.queue.map((q) => (hasVehicleId(v, q.vehicleId) && q.type === "vehicle_flag" && q.status === "in_review" ? { ...q, status: "rejected" as const, sla: "done", decidedBy: actorName(), reason: note || "Flag confirmed" } : q)) }));
        setVehicle(v.id, { flagged: true, status: "delisted" });
        logAudit("vehicles", "vehicle.confirmflag", "Confirmed a flag", vehicleName(v), "Listed", "Not listed");
        notify(v.seller?.id, "A car was taken down", "It didn’t pass our review.", "/seller/vehicles");
      },
    },
    deals: {
      pause: async (r: DealRow, reason: string, note?: string) => {
        setDeal(r.id, { paused: { reason, note, at: new Date().toISOString() } });
        logAudit("deals", "deal.pause", "Paused a deal", `${r.id} · ${shortCar(r.deal.car)}`, undefined, reason);
        notify(r.buyer?.id, "Your deal is on hold", reason, `/buyer/deals/${r.id}`);
        notify(r.seller?.id, "Your deal is on hold", reason, `/seller/deals/${r.id}`);
      },
      resume: async (r: DealRow) => {
        setDeal(r.id, { paused: null });
        logAudit("deals", "deal.resume", "Resumed a deal", `${r.id} · ${shortCar(r.deal.car)}`);
      },
      cancel: async (r: DealRow, reason: string) => {
        adminSetStage(r.id, "cancelled", `Deal cancelled by OwnerFi: ${reason}`);
        logAudit("deals", "deal.cancel", "Cancelled a deal", `${r.id} · ${shortCar(r.deal.car)}`, r.deal.stage, "cancelled");
        notify(r.buyer?.id, "Your deal was cancelled", reason, `/buyer/deals/${r.id}`);
        notify(r.seller?.id, "Your deal was cancelled", reason, `/seller/deals/${r.id}`);
      },
      escalate: async (r: DealRow, note?: string) => {
        setDeal(r.id, { escalatedAt: new Date().toISOString(), escalationNote: note });
        logAudit("deals", "deal.escalate", "Escalated a deal", `${r.id} · ${shortCar(r.deal.car)}`);
      },
      markDefault: async (r: DealRow) => {
        adminSetStage(r.id, "defaulted", "This deal was marked as defaulted by OwnerFi.");
        logAudit("deals", "deal.default", "Marked a deal as defaulted", `${r.id} · ${shortCar(r.deal.car)}`, "active", "defaulted");
        notify(r.seller?.id, "Default options are open", "See your options for this deal.", `/seller/deals/${r.id}/default-options`);
      },
      addNote: async (r: DealRow, text: string) => {
        if (!text.trim()) return false;
        setDeal(r.id, { notes: [{ id: uid("n"), text: text.trim(), by: actorName(), at: new Date().toISOString() }, ...r.adminNotes] });
        logAudit("deals", "deal.note", "Added a deal note", r.id);
        return true;
      },
    },
    payments: {
      refund: async (p: AdminPayment, reason: string, note?: string) => {
        patch((s) => ({ refunds: { ...s.refunds, [p.id]: { at: new Date().toISOString(), reason: note ? `${reason}: ${note}` : reason, by: actorName() } } }));
        logAudit("payments", "payment.refund", "Refunded a payment", `${p.dealId} · ${p.stripeRef}`, "Paid", "Refunded");
        const d = m.deals.find((x) => x.id === p.dealId);
        notify(m.users.find((u) => u.name === d?.buyer)?.id, "A payment was refunded", reason, "/buyer/payments");
        notify(m.users.find((u) => u.name === d?.seller)?.id, "A payment was refunded", reason, "/seller/payments");
      },
      submitEvidence: async (id: string) => {
        patch((s) => ({ disputes: s.disputes.map((x) => (x.id === id ? { ...x, status: "under_review" as const } : x)) }));
        logAudit("payments", "dispute.evidence", "Sent dispute evidence", id);
      },
      acceptDispute: async (id: string) => {
        const dsp = m.s.disputes.find((x) => x.id === id);
        patch((s) => ({ disputes: s.disputes.map((x) => (x.id === id ? { ...x, status: "lost" as const } : x)) }));
        if (dsp) patch((s) => ({ refunds: { ...s.refunds, [dsp.paymentId]: { at: new Date().toISOString(), reason: "Dispute accepted", by: actorName() } } }));
        logAudit("payments", "dispute.accept", "Accepted a dispute", id);
      },
      simulate: async (id: string, outcome: "won" | "lost") => {
        patch((s) => ({ disputes: s.disputes.map((x) => (x.id === id ? { ...x, status: outcome } : x)) }));
        logAudit("payments", "dispute.decision", `Dispute ${outcome}`, id, undefined, undefined, true);
      },
    },
    partners: {
      test: async (id: string) => {
        const p = m.partners.find((x) => x.id === id);
        await new Promise((r) => setTimeout(r, 700));
        if (p?.status === "needs_attention") throw new Error(`${p.name} still rejects our key. Rotate the key first.`);
        patch((s) => ({ partners: { ...s.partners, [id]: { ...s.partners[id], lastSyncAt: new Date().toISOString() } } }));
      },
      disable: async (id: string, name: string) => {
        patch((s) => ({ partners: { ...s.partners, [id]: { ...s.partners[id], status: "disabled" as const } } }));
        logAudit("advertising", "partner.disable", "Turned off an ad partner", name, "Connected", "Disabled");
      },
      enable: async (id: string, name: string) => {
        patch((s) => ({ partners: { ...s.partners, [id]: { ...s.partners[id], status: "connected" as const, lastSyncAt: new Date().toISOString() } } }));
        logAudit("advertising", "partner.enable", "Turned on an ad partner", name, "Disabled", "Connected");
      },
      rotate: async (id: string) => {
        const key = `${id.slice(0, 2)}_live_••••••••${Math.random().toString(36).slice(2, 6)}`;
        patch((s) => ({ partners: { ...s.partners, [id]: { ...s.partners[id], apiKeyMasked: key, status: m.partners.find((x) => x.id === id)?.status === "needs_attention" ? ("connected" as const) : m.partners.find((x) => x.id === id)?.status ?? ("connected" as const), errorRate: 0.01 } } }));
        logAudit("advertising", "partner.rotate", "Rotated a partner key", m.partners.find((x) => x.id === id)?.name ?? id);
      },
    },
    integrations: {
      test: async (id: string) => {
        await new Promise((r) => setTimeout(r, 700));
        const i = m.integrations.find((x) => x.id === id);
        if (i?.health === "down") throw new Error(`${i.name} didn’t answer. Rotate the credentials, then try again.`);
      },
      rotate: async (id: string) => {
        const i = m.integrations.find((x) => x.id === id);
        patch((s) => ({ integrations: { ...s.integrations, [id]: { ...s.integrations[id], key: `${(i?.key ?? "key_").split("_")[0]}_••••••••${Math.random().toString(36).slice(2, 6)}`, keyRotatedAt: new Date().toISOString(), health: i?.health === "down" ? ("healthy" as const) : i?.health } } }));
        logAudit("integrations", "integration.rotate", "Rotated credentials", i?.name ?? id);
      },
      replay: async (id: string, index: number) => {
        patch((s) => ({ integrations: { ...s.integrations, [id]: { ...s.integrations[id], replayed: [...(s.integrations[id]?.replayed ?? []), index] } } }));
        logAudit("integrations", "integration.replay", "Replayed a webhook", m.integrations.find((x) => x.id === id)?.name ?? id);
      },
    },
    settings: {
      saveFees: async (rate: number) => {
        const before = `${Math.round(m.s.feeRate * 1000) / 10}%`;
        patch(() => ({ feeRate: rate }));
        logAudit("settings", "settings.fee", "Changed the OwnerFi fee", "Fees", before, `${Math.round(rate * 1000) / 10}%`);
      },
      saveInspectionFee: async (cents: number) => {
        if (!Number.isFinite(cents) || cents < 0 || cents > 100_000) throw new Error("Enter a price from $0 to $1,000.");
        const before = `$${((m.s.inspectionFeeCents ?? 9_900) / 100).toFixed(2)}`;
        patch(() => ({ inspectionFeeCents: Math.round(cents) }));
        logAudit("settings", "settings.inspection", "Changed the inspection price", "Fees", before, `$${(cents / 100).toFixed(2)}`);
      },
      savePolicies: async (p: Policies) => {
        patch(() => ({ policies: p }));
        logAudit("settings", "settings.policies", "Changed policies", "Policies");
      },
      saveStateRule: async (state: string, p: Omit<FullStateRule, "state">) => {
        patch((s) => ({ stateRules: s.stateRules.map((r) => (r.state === state ? { ...r, ...p } : r)) }));
        logAudit("settings", "settings.staterule", "Changed state rules", state);
      },
      invite: async (email: string, role: "owner" | "admin" | "support") => {
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error("Enter a valid email.");
        patch((s) => ({ invites: [...s.invites, { id: uid("inv"), email: email.trim(), role, invitedAt: new Date().toISOString() }] }));
        logAudit("settings", "team.invite", "Invited an admin", email.trim());
      },
      cancelInvite: async (id: string) => patch((s) => ({ invites: s.invites.filter((i) => i.id !== id) })),
      setRole: async (id: string, role: "owner" | "admin" | "support") => {
        patch((s) => ({ adminRoles: { ...s.adminRoles, [id]: role } }));
        logAudit("settings", "team.role", "Changed a role", userById(id)?.name ?? id, undefined, role);
      },
      removeAdmin: async (id: string) => {
        patch((s) => ({ removedAdmins: [...s.removedAdmins, id] }));
        logAudit("settings", "team.remove", "Removed an admin", userById(id)?.name ?? id);
      },
    },
    support: {
      reply: async (id: string, text: string) => {
        const t = m.s.tickets.find((x) => x.id === id);
        patch((s) => ({ tickets: s.tickets.map((x) => (x.id === id ? { ...x, status: "waiting" as const, updatedAt: new Date().toISOString(), messages: [...x.messages, { id: uid("tm"), from: "admin" as const, text: text.trim(), at: new Date().toISOString() }] } : x)) }));
        notify(t?.userId, "OwnerFi replied to your question", text.trim().slice(0, 90), "/demo/inbox");
        logAudit("support", "support.reply", "Replied to a ticket", t?.subject ?? id);
      },
      assign: async (id: string, assigneeId: string | null) => {
        patch((s) => ({ tickets: s.tickets.map((x) => (x.id === id ? { ...x, assigneeId, updatedAt: new Date().toISOString() } : x)) }));
        logAudit("support", "support.assign", "Assigned a ticket", m.s.tickets.find((x) => x.id === id)?.subject ?? id);
      },
      priority: async (id: string, priority: Ticket["priority"]) => {
        patch((s) => ({ tickets: s.tickets.map((x) => (x.id === id ? { ...x, priority } : x)) }));
      },
      solve: async (id: string) => {
        patch((s) => ({ tickets: s.tickets.map((x) => (x.id === id ? { ...x, status: "solved" as const, solvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : x)) }));
        logAudit("support", "support.solve", "Solved a ticket", m.s.tickets.find((x) => x.id === id)?.subject ?? id, "Open", "Solved");
      },
      reopen: async (id: string) => {
        patch((s) => ({ tickets: s.tickets.map((x) => (x.id === id ? { ...x, status: "open" as const, solvedAt: undefined } : x)) }));
      },
    },
  };
}
export type AdminActions = ReturnType<typeof useAdminActions>;

export const fileCsv = (name: string, rows: (string | number)[][]) => {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const text = rows.map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return rows.length - 1;
};

export const TICKET_ADMINS = (m: AdminModel) => m.users.filter((u) => u.role === "admin");
export type { QueueType };
