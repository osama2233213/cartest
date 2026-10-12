/** Static demo data for the admin console: extra people, review queue, partners, services, tickets, history. */

const DAY = 86_400_000;
export const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000).toISOString();
export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
export const userIdFor = (name: string) => `u-${slug(name)}`;

export type SeedUser = {
  name: string;
  role: "seller" | "buyer" | "admin";
  state: string;
  joinedDaysAgo: number;
  identity: "verified" | "in_review" | "not_started" | "rejected";
  payouts?: "verified" | "in_review" | "not_started";
  bank?: "verified" | "in_review" | "not_started" | "rejected";
  credit?: "verified" | "in_review" | "not_started";
  suspended?: { reason: string; daysAgo: number };
  adminRole?: "owner" | "admin" | "support";
  credit_band?: string;
  city?: string;
};

export const SEED_USERS: SeedUser[] = [
  { name: "James Torres", role: "seller", state: "TX", joinedDaysAgo: 160, identity: "verified", payouts: "verified", city: "Austin" },
  { name: "Priya Nair", role: "seller", state: "AZ", joinedDaysAgo: 140, identity: "verified", payouts: "verified", city: "Scottsdale" },
  { name: "Ken Wu", role: "seller", state: "AZ", joinedDaysAgo: 30, identity: "in_review", payouts: "not_started", city: "Mesa" },
  { name: "Lena Ross", role: "seller", state: "AZ", joinedDaysAgo: 75, identity: "verified", payouts: "verified", city: "Tempe" },
  { name: "Chloe Martin", role: "seller", state: "CA", joinedDaysAgo: 6, identity: "in_review", payouts: "not_started", city: "San Diego" },
  { name: "Aisha Khan", role: "buyer", state: "AZ", joinedDaysAgo: 50, identity: "verified", bank: "verified", credit: "verified", credit_band: "Good" },
  { name: "Leo Chen", role: "buyer", state: "AZ", joinedDaysAgo: 44, identity: "verified", bank: "verified", credit: "verified", credit_band: "Good" },
  { name: "Rosa Diaz", role: "buyer", state: "AZ", joinedDaysAgo: 41, identity: "verified", bank: "verified", credit: "verified", credit_band: "Very good" },
  { name: "Tom Bauer", role: "buyer", state: "AZ", joinedDaysAgo: 120, identity: "verified", bank: "verified", credit: "in_review", credit_band: "Fair" },
  { name: "Mia Lopez", role: "buyer", state: "AZ", joinedDaysAgo: 12, identity: "verified", bank: "in_review", credit: "not_started" },
  { name: "Sara Kim", role: "buyer", state: "AZ", joinedDaysAgo: 28, identity: "verified", bank: "in_review", credit: "verified", credit_band: "Good" },
  { name: "Ben Ade", role: "buyer", state: "AZ", joinedDaysAgo: 3, identity: "in_review", bank: "not_started", credit: "not_started" },
  { name: "Ivy Grant", role: "buyer", state: "AZ", joinedDaysAgo: 22, identity: "verified", bank: "verified", credit: "verified", credit_band: "Fair" },
  { name: "Omar Haddad", role: "buyer", state: "TX", joinedDaysAgo: 80, identity: "verified", bank: "rejected", credit: "not_started", suspended: { reason: "Suspected fraud", daysAgo: 9 } },
  { name: "Priya Shah", role: "admin", state: "AZ", joinedDaysAgo: 180, identity: "verified", adminRole: "admin" },
  { name: "Jo Bennett", role: "admin", state: "AZ", joinedDaysAgo: 90, identity: "verified", adminRole: "support" },
];

/* ------------------------------------------------------------ review queue */

export type QueueType = "identity" | "bank" | "title" | "vehicle_flag";
export type QueueItem = {
  id: string;
  type: QueueType;
  scope?: "credit" | undefined;
  userId?: string | undefined;
  vehicleId?: string | undefined;
  submittedAt: string;
  autoResult: "pass" | "review" | "fail";
  status: "in_review" | "verified" | "rejected";
  sla: string;
  notes?: string | undefined;
  decidedBy?: string | undefined;
  reason?: string | undefined;
};

export const SEED_QUEUE: QueueItem[] = [
  { id: "q-1", type: "identity", userId: userIdFor("Ken Wu"), submittedAt: ago(0, 3), autoResult: "pass", status: "in_review", sla: "21h left" },
  { id: "q-2", type: "bank", userId: userIdFor("Mia Lopez"), submittedAt: ago(0, 1), autoResult: "review", status: "in_review", sla: "23h left", notes: "The account name is spelled differently." },
  { id: "q-3", type: "identity", userId: userIdFor("Ben Ade"), submittedAt: ago(0, 1), autoResult: "pass", status: "in_review", sla: "23h left" },
  { id: "q-4", type: "identity", userId: userIdFor("Chloe Martin"), submittedAt: ago(1, 20), autoResult: "fail", status: "in_review", sla: "2h overdue", notes: "The photo was too blurry to match the selfie." },
  { id: "q-5", type: "identity", scope: "credit", userId: userIdFor("Tom Bauer"), submittedAt: ago(0, 6), autoResult: "pass", status: "in_review", sla: "18h left" },
  { id: "q-6", type: "bank", userId: userIdFor("Sara Kim"), submittedAt: ago(0, 9), autoResult: "pass", status: "in_review", sla: "2 days left" },
  { id: "q-7", type: "title", vehicleId: "dv-d-1005", userId: userIdFor("Priya Nair"), submittedAt: ago(0, 5), autoResult: "review", status: "in_review", sla: "5h left", notes: "The title brand lookup returned a possible salvage record." },
  { id: "q-8", type: "title", vehicleId: "dv-d-1007", userId: userIdFor("Ken Wu"), submittedAt: ago(0, 2), autoResult: "pass", status: "in_review", sla: "1 day left" },
  { id: "q-9", type: "vehicle_flag", vehicleId: "dv-d-1008", userId: userIdFor("Ken Wu"), submittedAt: ago(1, 4), autoResult: "review", status: "in_review", sla: "3h left", notes: "The price is well below market for this mileage." },
  { id: "q-10", type: "identity", userId: userIdFor("Rosa Diaz"), submittedAt: ago(20), autoResult: "pass", status: "verified", sla: "done", decidedBy: "Priya Shah" },
  { id: "q-11", type: "bank", userId: userIdFor("Omar Haddad"), submittedAt: ago(11), autoResult: "fail", status: "rejected", sla: "done", decidedBy: "Sam Rivera", reason: "Details don’t match" },
  { id: "q-12", type: "title", vehicleId: "dv-d-1001", userId: "u-maria", submittedAt: ago(40), autoResult: "pass", status: "verified", sla: "done", decidedBy: "Priya Shah" },
];

/* ------------------------------------------------------------ ad partners */

export type PartnerSeed = {
  id: string;
  name: string;
  account: "API partner" | "Feed upload" | "Manual post" | "OwnerFi link";
  requirements: string[];
  status: "connected" | "needs_attention" | "disabled";
  errorRate: number;
  lastSyncMin: number;
  apiKeyMasked: string;
  base: { live: number; clicks: number; inquiries: number };
  failures: { vehicleId: string; carName: string; sellerName: string; error: string }[];
};

export const SEED_PARTNERS: PartnerSeed[] = [
  { id: "autotrader", name: "Autotrader", account: "API partner", requirements: ["VIN", "6+ photos", "Price"], status: "connected", errorRate: 0.01, lastSyncMin: 12, apiKeyMasked: "at_live_••••••••9f3a", base: { live: 14, clicks: 1380, inquiries: 52 }, failures: [] },
  { id: "cars", name: "Cars.com", account: "API partner", requirements: ["VIN", "5+ photos"], status: "connected", errorRate: 0.02, lastSyncMin: 25, apiKeyMasked: "cc_live_••••••••12bd", base: { live: 11, clicks: 902, inquiries: 33 }, failures: [] },
  { id: "cargurus", name: "CarGurus", account: "API partner", requirements: ["VIN", "Price", "Mileage"], status: "connected", errorRate: 0.0, lastSyncMin: 8, apiKeyMasked: "cg_live_••••••••77ce", base: { live: 9, clicks: 1104, inquiries: 41 }, failures: [] },
  { id: "edmunds", name: "Edmunds", account: "Feed upload", requirements: ["VIN", "Photos"], status: "connected", errorRate: 0.03, lastSyncMin: 55, apiKeyMasked: "ed_feed_••••••••41aa", base: { live: 6, clicks: 410, inquiries: 12 }, failures: [] },
  { id: "offerup", name: "OfferUp", account: "API partner", requirements: ["Photos", "Price"], status: "needs_attention", errorRate: 0.18, lastSyncMin: 340, apiKeyMasked: "ou_live_••••••••00ff", base: { live: 3, clicks: 120, inquiries: 4 }, failures: [{ vehicleId: "dv-d-1002", carName: "2019 Tesla Model 3", sellerName: "Maria Alvarez", error: "The partner rejected our key (401)." }, { vehicleId: "dv-d-1004", carName: "2019 Toyota Corolla LE", sellerName: "James Torres", error: "The partner rejected our key (401)." }] },
  { id: "fbmarketplace", name: "Facebook Marketplace", account: "Manual post", requirements: ["Photos", "Price", "Location"], status: "connected", errorRate: 0.04, lastSyncMin: 90, apiKeyMasked: "—", base: { live: 17, clicks: 2210, inquiries: 88 }, failures: [{ vehicleId: "dv-d-1009", carName: "2019 Subaru Outback", sellerName: "Lena Ross", error: "The listing was too long. Shorten the description." }] },
  { id: "craigslist", name: "Craigslist", account: "Manual post", requirements: ["Photos", "Contact"], status: "disabled", errorRate: 0.0, lastSyncMin: 4320, apiKeyMasked: "—", base: { live: 0, clicks: 0, inquiries: 0 }, failures: [] },
  { id: "ebay", name: "eBay Motors", account: "API partner", requirements: ["VIN", "Photos", "Price"], status: "connected", errorRate: 0.02, lastSyncMin: 33, apiKeyMasked: "eb_live_••••••••2d8e", base: { live: 4, clicks: 260, inquiries: 7 }, failures: [] },
  { id: "privateauto", name: "PrivateAuto", account: "API partner", requirements: ["VIN", "Photos"], status: "connected", errorRate: 0.01, lastSyncMin: 41, apiKeyMasked: "pa_live_••••••••a0c1", base: { live: 5, clicks: 310, inquiries: 11 }, failures: [] },
  { id: "direct", name: "OwnerFi link and QR", account: "OwnerFi link", requirements: [], status: "connected", errorRate: 0, lastSyncMin: 1, apiKeyMasked: "—", base: { live: 22, clicks: 640, inquiries: 29 }, failures: [] },
];

export const PARTNER_MAPPING: [string, string][] = [
  ["Year, make, model", "vehicle.title"],
  ["Asking price", "listing.price"],
  ["Mileage", "vehicle.odometer"],
  ["Photos (first 12)", "listing.images[]"],
  ["Description", "listing.description"],
  ["City and state", "listing.location"],
];

/* ------------------------------------------------------------ integrations */

export type IntegrationSeed = {
  id: string;
  name: string;
  vendorExample: string;
  category: "Payments" | "Identity and credit" | "Messaging" | "Vehicle data" | "Documents";
  health: "healthy" | "degraded" | "down";
  lastEventMin: number;
  cost: number; // cents this month
  usage: number;
  unit: string;
  key: string;
  rotatedDaysAgo: number | null;
  where: string[];
  fails: number;
};

export const SEED_INTEGRATIONS: IntegrationSeed[] = [
  { id: "payments", name: "Payments", vendorExample: "Stripe Connect", category: "Payments", health: "healthy", lastEventMin: 4, cost: 61240, usage: 1284, unit: "payments", key: "sk_live_••••••••Qx7R", rotatedDaysAgo: 41, where: ["Down payments and monthly payments", "Seller payouts", "Refunds and disputes"], fails: 1 },
  { id: "bank-link", name: "Bank linking", vendorExample: "Plaid", category: "Payments", health: "healthy", lastEventMin: 36, cost: 8120, usage: 203, unit: "bank links", key: "plaid_••••••••8aB2", rotatedDaysAgo: 120, where: ["Buyer bank account step", "Seller payout set-up"], fails: 0 },
  { id: "identity", name: "ID checks", vendorExample: "Persona", category: "Identity and credit", health: "healthy", lastEventMin: 18, cost: 22400, usage: 140, unit: "checks", key: "persona_••••••••Lm4K", rotatedDaysAgo: 75, where: ["Seller identity", "Buyer identity"], fails: 0 },
  { id: "credit", name: "Soft credit check", vendorExample: "Experian", category: "Identity and credit", health: "down", lastEventMin: 410, cost: 15600, usage: 96, unit: "soft pulls", key: "exp_••••••••Wk3z", rotatedDaysAgo: 210, where: ["Buyer credit step (before offers)"], fails: 4 },
  { id: "sms", name: "Text messages", vendorExample: "Twilio", category: "Messaging", health: "degraded", lastEventMin: 9, cost: 4310, usage: 1940, unit: "texts", key: "twilio_••••••••9Ds1", rotatedDaysAgo: 18, where: ["One-time codes", "Test drive reminders", "Late payment texts"], fails: 6 },
  { id: "email", name: "Email", vendorExample: "SendGrid", category: "Messaging", health: "healthy", lastEventMin: 2, cost: 1900, usage: 6120, unit: "emails", key: "sg_••••••••Pq0v", rotatedDaysAgo: 95, where: ["Sign-in and reset emails", "Receipts", "Notifications"], fails: 2 },
  { id: "vehicle-history", name: "Vehicle history", vendorExample: "VinAudit", category: "Vehicle data", health: "healthy", lastEventMin: 52, cost: 18900, usage: 63, unit: "reports", key: "vin_••••••••c7Tt", rotatedDaysAgo: 140, where: ["Safety checks before listing", "History on the car page"], fails: 0 },
  { id: "title", name: "Title and lien lookup", vendorExample: "NMVTIS", category: "Vehicle data", health: "healthy", lastEventMin: 77, cost: 9400, usage: 63, unit: "lookups", key: "nmvtis_••••••••h2Yy", rotatedDaysAgo: 160, where: ["Lien and brand checks"], fails: 1 },
  { id: "esign", name: "E-signing", vendorExample: "Dropbox Sign", category: "Documents", health: "healthy", lastEventMin: 140, cost: 5200, usage: 38, unit: "agreements", key: "hs_••••••••m9Ne", rotatedDaysAgo: 60, where: ["Financing agreement", "Bill of sale"], fails: 0 },
];

/* --------------------------------------------------------------- support */

export type Ticket = {
  id: string;
  subject: string;
  userId: string;
  dealId?: string | undefined;
  status: "open" | "waiting" | "solved";
  priority: "low" | "normal" | "high" | "urgent";
  assigneeId: string | null;
  updatedAt: string;
  solvedAt?: string | undefined;
  messages: { id: string; from: "user" | "admin"; text: string; at: string }[];
};

export const SEED_TICKETS: Ticket[] = [
  { id: "t-1", subject: "My payment didn’t go through", userId: userIdFor("Aisha Khan"), dealId: "d-1002", status: "open", priority: "urgent", assigneeId: null, updatedAt: ago(0, 2), messages: [{ id: "tm-1", from: "user", text: "I tried to pay and it said declined, but my bank shows no problem. Can you check?", at: ago(0, 2) }] },
  { id: "t-2", subject: "Ad didn’t go up on OfferUp", userId: "u-maria", status: "open", priority: "high", assigneeId: "u-priya-shah", updatedAt: ago(0, 6), messages: [{ id: "tm-2", from: "user", text: "I posted my Model 3 yesterday and OfferUp shows nothing.", at: ago(0, 6) }] },
  { id: "t-3", subject: "How do I change my payout bank?", userId: userIdFor("Lena Ross"), status: "waiting", priority: "normal", assigneeId: "u-jo-bennett", updatedAt: ago(1), messages: [{ id: "tm-3", from: "user", text: "I changed banks. Where do I update it?", at: ago(2) }, { id: "tm-4", from: "admin", text: "Go to Account, then Payouts, and choose Update payout details. Tell us if it asks for anything unexpected.", at: ago(1) }] },
  { id: "t-4", subject: "Buyer stopped replying after the test drive", userId: userIdFor("Priya Nair"), dealId: "d-1005", status: "open", priority: "low", assigneeId: null, updatedAt: ago(2), messages: [{ id: "tm-5", from: "user", text: "Rosa hasn’t paid the down payment. Can you nudge her?", at: ago(2) }] },
  { id: "t-5", subject: "Can’t finish ID check", userId: userIdFor("Chloe Martin"), status: "open", priority: "high", assigneeId: null, updatedAt: ago(1, 4), messages: [{ id: "tm-6", from: "user", text: "It keeps saying my photo is blurry. I tried three times.", at: ago(1, 4) }] },
  { id: "t-6", subject: "Late fee question", userId: "u-daniel", dealId: "d-1003", status: "solved", priority: "normal", assigneeId: "u-jo-bennett", updatedAt: ago(3), solvedAt: ago(3), messages: [{ id: "tm-7", from: "user", text: "Is there a fee if I pay a few days late?", at: ago(4) }, { id: "tm-8", from: "admin", text: "OwnerFi doesn’t charge late fees. The seller may have terms in your agreement. Check section 6.", at: ago(3) }] },
];

/* ---------------------------------------------------------------- policies */

export type Policies = {
  testDriveCancelHours: number;
  maxCounterRounds: number;
  late: { reminderDay: number; noticeDay: number; sellerAlertDay: number; defaultDay: number };
};
export const SEED_POLICIES: Policies = {
  testDriveCancelHours: 24,
  maxCounterRounds: 3,
  late: { reminderDay: 1, noticeDay: 5, sellerAlertDay: 15, defaultDay: 30 },
};

export type FullStateRule = { state: string; maxApr: number; annualSaleLimit: number; disclosures: string[] };
export const SEED_STATE_RULES: FullStateRule[] = [
  { state: "AZ", maxApr: 10, annualSaleLimit: 5, disclosures: ["Retail installment disclosure", "Lien notice", "Odometer statement"] },
  { state: "TX", maxApr: 18, annualSaleLimit: 5, disclosures: ["Retail installment disclosure", "Lien notice", "Odometer statement", "Texas title notice"] },
  { state: "FL", maxApr: 18, annualSaleLimit: 5, disclosures: ["Retail installment disclosure", "Lien notice", "Odometer statement"] },
  { state: "CA", maxApr: 10, annualSaleLimit: 3, disclosures: ["Retail installment disclosure", "Lien notice", "Odometer statement", "California buyer’s guide"] },
  { state: "NY", maxApr: 16, annualSaleLimit: 3, disclosures: ["Retail installment disclosure", "Lien notice", "Odometer statement"] },
  { state: "other", maxApr: 12, annualSaleLimit: 5, disclosures: ["Retail installment disclosure", "Lien notice"] },
];

/* ----------------------------------------------------- history and disputes */

export type HistClosed = {
  id: string;
  car: string;
  seller: string;
  buyer: string;
  price: number; // cents
  down: number;
  fee: number;
  outcome: "paid_off" | "defaulted" | "cancelled";
  closedDaysAgo: number;
  months: number;
};
export const HIST_CLOSED: HistClosed[] = [
  { id: "h-1", car: "2017 Honda Civic EX", seller: "Priya Nair", buyer: "Jon Ellis", price: 1390000, down: 208500, fee: 20850, outcome: "paid_off", closedDaysAgo: 34, months: 24 },
  { id: "h-2", car: "2016 Nissan Altima", seller: "James Torres", buyer: "Dee Park", price: 1120000, down: 112000, fee: 11200, outcome: "paid_off", closedDaysAgo: 71, months: 18 },
  { id: "h-3", car: "2014 Ford Focus SE", seller: "Ken Wu", buyer: "Cal Moore", price: 790000, down: 79000, fee: 7900, outcome: "defaulted", closedDaysAgo: 48, months: 6 },
  { id: "h-4", car: "2018 Kia Soul", seller: "Lena Ross", buyer: "Ana Ruiz", price: 1240000, down: 186000, fee: 18600, outcome: "cancelled", closedDaysAgo: 16, months: 0 },
  { id: "h-5", car: "2015 Toyota Camry LE", seller: "Priya Nair", buyer: "Sam Ortiz", price: 980000, down: 98000, fee: 9800, outcome: "paid_off", closedDaysAgo: 110, months: 24 },
];

export type DisputeSeed = { id: string; paymentId: string; dealId: string; amount: number; reason: string; openedDaysAgo: number; dueInDays: number; status: "needs_response" | "under_review" | "won" | "lost" };
export const SEED_DISPUTES: DisputeSeed[] = [
  { id: "dp-1", paymentId: "d-1003-m1", dealId: "d-1003", amount: 57400, reason: "The buyer says they didn’t authorise it", openedDaysAgo: 4, dueInDays: 2, status: "needs_response" },
  { id: "dp-2", paymentId: "d-1006-m10", dealId: "d-1006", amount: 61230, reason: "Duplicate charge", openedDaysAgo: 12, dueInDays: 9, status: "under_review" },
];

export const SEED_REVENUE_TOP_UP = 0;

export const SEED_AUDIT = [
  { id: "a-1", daysAgo: 0, hours: 5, actor: "Priya Shah", action: "verification.approve", area: "verification" as const, label: "Approved identity", target: "Rosa Diaz", before: "In review", after: "Verified" },
  { id: "a-2", daysAgo: 1, hours: 2, actor: "Sam Rivera", action: "user.suspend", area: "users" as const, label: "Suspended a user", target: "Omar Haddad", before: "Active", after: "Suspended" },
  { id: "a-3", daysAgo: 2, hours: 3, actor: "Sam Rivera", action: "settings.fee", area: "settings" as const, label: "Changed the OwnerFi fee", target: "Fees", before: "8%", after: "10%" },
  { id: "a-4", daysAgo: 3, hours: 1, actor: "Jo Bennett", action: "support.solve", area: "support" as const, label: "Solved a ticket", target: "Late fee question", before: "Open", after: "Solved" },
  { id: "a-5", daysAgo: 5, hours: 0, actor: "Priya Shah", action: "partner.disable", area: "advertising" as const, label: "Turned off an ad partner", target: "Craigslist", before: "Connected", after: "Disabled" },
  { id: "a-6", daysAgo: 6, hours: 6, actor: "System", action: "integration.down", area: "integrations" as const, label: "Service went down", target: "Soft credit check", before: "Healthy", after: "Down", system: true },
  { id: "a-7", daysAgo: 9, hours: 4, actor: "Sam Rivera", action: "vehicle.approve", area: "vehicles" as const, label: "Approved a listing", target: "2020 Honda Accord Sport", before: "In review", after: "Listed" },
];
