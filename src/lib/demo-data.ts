import { dealTerms } from "./finance";

export type Role = "seller" | "buyer" | "admin";
export const PERSONAS: Record<Role, { name: string; email: string; city: string; label: string }> = {
  seller: { name: "Maria Alvarez", email: "seller@demo.com", city: "Phoenix, AZ", label: "Seller" },
  buyer: { name: "Daniel Park", email: "buyer@demo.com", city: "Tempe, AZ", label: "Buyer" },
  admin: { name: "Sam Rivera", email: "admin@demo.com", city: "OwnerFi HQ", label: "Admin" },
};

export const STAGES = [
  "inquiry", "test_drive", "application", "negotiation", "inspection",
  "contract", "down_payment", "closing", "active", "paid_off",
] as const;
export type Stage = (typeof STAGES)[number] | "declined" | "cancelled" | "defaulted";

export const STAGE_LABEL: Record<Stage, string> = {
  inquiry: "Inquiry", test_drive: "Test drive", application: "Application",
  negotiation: "Negotiation", inspection: "Inspection", contract: "Contract",
  down_payment: "Down payment", closing: "Closing", active: "Active", paid_off: "Paid off",
  declined: "Declined", cancelled: "Cancelled", defaulted: "Defaulted",
};

export type DemoDeal = {
  id: string; car: string; photo: string; seller: string; buyer: string;
  stage: Stage; priceCents: number; downPct: number; apr: number; term: number;
  feeWaived?: boolean; late?: boolean; updated: string;
  state?: string;
  minDownPct?: number;
  allowedTerms?: number[];
};

export const DEALS: DemoDeal[] = [
  { id: "d-1001", car: "2020 Honda Accord Sport", photo: "https://images.unsplash.com/photo-1606611013016-969c19ba27bb?w=800", seller: "Maria Alvarez", buyer: "Daniel Park", stage: "negotiation", priceCents: 2200000, downPct: 15, apr: 10, term: 48, state: "AZ", minDownPct: 15, allowedTerms: [36, 48, 60], updated: "2h ago" },
  { id: "d-1002", car: "2019 Tesla Model 3", photo: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800", seller: "Maria Alvarez", buyer: "Aisha Khan", stage: "inspection", priceCents: 2650000, downPct: 20, apr: 9.5, term: 36, state: "AZ", minDownPct: 20, allowedTerms: [24, 36, 48], updated: "1d ago" },
  { id: "d-1003", car: "2018 Ford F-150 XLT", photo: "https://images.unsplash.com/photo-1605893477799-b99e3b8b93fe?w=800", seller: "James Torres", buyer: "Daniel Park", stage: "active", priceCents: 2480000, downPct: 15, apr: 14, term: 48, state: "TX", minDownPct: 15, allowedTerms: [36, 48, 60], late: true, updated: "3d ago" },
  { id: "d-1004", car: "2019 Toyota Corolla LE", photo: "https://images.unsplash.com/photo-1623869675781-80aa31012a5a?w=800", seller: "James Torres", buyer: "Leo Chen", stage: "contract", priceCents: 1550000, downPct: 10, apr: 9.5, term: 36, state: "AZ", minDownPct: 10, allowedTerms: [24, 36, 48], updated: "5h ago" },
  { id: "d-1005", car: "2019 Mazda CX-3", photo: "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800", seller: "Priya Nair", buyer: "Rosa Diaz", stage: "down_payment", priceCents: 1690000, downPct: 15, apr: 10, term: 48, state: "AZ", minDownPct: 15, allowedTerms: [36, 48, 60], feeWaived: true, updated: "30m ago" },
  { id: "d-1006", car: "2016 BMW 328i", photo: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800", seller: "Priya Nair", buyer: "Tom Bauer", stage: "paid_off", priceCents: 1390000, downPct: 20, apr: 10, term: 24, state: "AZ", minDownPct: 20, allowedTerms: [24, 36], updated: "2w ago" },
  { id: "d-1007", car: "2018 Hyundai Sonata", photo: "https://images.unsplash.com/photo-1629897048514-3dd7414fe72a?w=800", seller: "Ken Wu", buyer: "Mia Lopez", stage: "application", priceCents: 1290000, downPct: 10, apr: 10, term: 36, state: "AZ", minDownPct: 10, allowedTerms: [24, 36, 48], updated: "1h ago" },
  { id: "d-1008", car: "2015 Jeep Grand Cherokee", photo: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800", seller: "Ken Wu", buyer: "Sara Kim", stage: "closing", priceCents: 1450000, downPct: 15, apr: 9, term: 36, state: "AZ", minDownPct: 15, allowedTerms: [36, 48], updated: "4h ago" },
  { id: "d-1009", car: "2019 Subaru Outback", photo: "https://images.unsplash.com/photo-1626072557464-90403d788e8e?w=800", seller: "Lena Ross", buyer: "Ben Ade", stage: "test_drive", priceCents: 2150000, downPct: 15, apr: 9, term: 48, state: "AZ", minDownPct: 15, allowedTerms: [36, 48, 60], updated: "20m ago" },
  { id: "d-1010", car: "2020 Chevrolet Malibu", photo: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800", seller: "Lena Ross", buyer: "Ivy Grant", stage: "declined", priceCents: 1750000, downPct: 10, apr: 10, term: 60, state: "AZ", minDownPct: 10, allowedTerms: [36, 48, 60], updated: "6d ago" },
];

export const termsFor = (d: DemoDeal) =>
  dealTerms({
    priceCents: d.priceCents,
    downPct: d.downPct,
    apr: d.apr,
    termMonths: d.term,
    ...(d.feeWaived !== undefined ? { feeWaived: d.feeWaived } : {}),
  });

type Who = "you" | "other" | "ownerfi" | "none";
const ACTOR: Record<Stage, "seller" | "buyer" | "ownerfi" | "none"> = {
  inquiry: "seller", test_drive: "seller", application: "seller", negotiation: "buyer",
  inspection: "buyer", contract: "seller", down_payment: "buyer", closing: "seller",
  active: "buyer", paid_off: "seller", declined: "none", cancelled: "none", defaulted: "ownerfi",
};
const ACTION: Record<Stage, string> = {
  inquiry: "Reply to the buyer's question", test_drive: "Confirm the test drive time",
  application: "Review the application", negotiation: "Respond to the counter-offer",
  inspection: "Review the inspection report", contract: "Sign the contract",
  down_payment: "Pay the down payment", closing: "Confirm title transfer at the DMV",
  active: "Make this month's payment", paid_off: "Release the lien",
  declined: "No action — deal closed", cancelled: "No action — deal closed", defaulted: "OwnerFi is reviewing the case",
};

export function getNextAction(d: DemoDeal, role: Role): { who: Who; text: string } {
  const a = ACTOR[d.stage];
  if (a === "none") return { who: "none", text: ACTION[d.stage] };
  if (a === "ownerfi") return { who: role === "admin" ? "you" : "ownerfi", text: ACTION[d.stage] };
  if (role === "admin") return { who: "other", text: `${a === "seller" ? d.seller : d.buyer}: ${ACTION[d.stage].toLowerCase()}` };
  return a === role ? { who: "you", text: ACTION[d.stage] } : { who: "other", text: `Waiting for the ${a} to ${ACTION[d.stage].toLowerCase()}` };
}

export const VERIFICATION_QUEUE = [
  { who: "Ken Wu", kind: "Identity", status: "in_review", age: "3h" },
  { who: "Mia Lopez", kind: "Bank account", status: "in_review", age: "1h" },
  { who: "2015 Jeep Grand Cherokee", kind: "Theft check", status: "review", age: "22h" },
  { who: "Ben Ade", kind: "Identity", status: "in_review", age: "40m" },
  { who: "2019 Mazda CX-3", kind: "Branded title", status: "review", age: "2d" },
];

export const REVENUE = ["Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct"].map((m, i) => ({
  month: m, fees: [820, 1140, 990, 1520, 1810, 1650, 2230, 2480, 2190, 2870, 3120, 3360][i]!,
}));
