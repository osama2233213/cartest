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

/** Deals that are over. Everything else is "in progress", on the Deals page and on Home. */
export const CLOSED_STAGES: readonly Stage[] = ["declined", "cancelled", "paid_off"];

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
  vehicleId?: string;
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

export type NextAction = {
  who: Who;
  text: string;
  /** Short button label for the person whose turn it is. */
  label: string;
  /** Where the button goes. */
  href: string;
  tone: "primary" | "neutral" | "warning" | "danger" | "success";
  /** Whose turn it is: the viewer, the other person, or the system (payments, admin). */
  waitingOn: "you" | "other" | "system";
};

type Detail = {
  testDrive?: { status: string } | undefined;
  counterOffer?: { proposedBy: "seller" | "buyer" } | undefined;
  offers?: { by: "buyer" | "seller"; status: string }[] | undefined;
  inspectionBooking?: { status: "requested" | "approved" } | undefined;
  contract?: { sellerSigned: boolean; buyerSigned: boolean } | undefined;
  payment?: { status?: string | undefined } | undefined;
  closing?: { sellerConfirmed?: boolean | undefined; buyerConfirmed?: boolean | undefined } | undefined;
  lien?: { releasedAt?: string | undefined } | undefined;
};

/**
 * What happens next on a deal, from the viewer's side. `detail` sharpens the answer inside a stage
 * (who made the last offer, who has signed). Without it the answer follows the stage alone.
 */
export function getNextAction(d: DemoDeal, role: Role, detail?: Detail): NextAction {
  const buyer = d.buyer.split(" ")[0] ?? "the buyer";
  const seller = d.seller.split(" ")[0] ?? "the seller";
  const room = role === "admin" ? `/deals/${d.id}?as=admin` : `/deals/${d.id}?as=${role}`;
  const mk = (who: Who, text: string, label: string, tone: NextAction["tone"], href = room): NextAction => ({
    who,
    text,
    label,
    href,
    tone,
    waitingOn: who === "you" ? "you" : who === "other" ? "other" : "system",
  });
  const you = (text: string, label = text, tone: NextAction["tone"] = "primary", href?: string) => mk("you", text, label, tone, href);
  const wait = (text: string, tone: NextAction["tone"] = "neutral") => mk("other", text, text, tone);
  if (role === "admin") {
    const a = ACTOR[d.stage];
    if (a === "none") return mk("none", ACTION[d.stage], "", "neutral");
    if (a === "ownerfi") return mk("you", ACTION[d.stage], ACTION[d.stage], "warning");
    return mk("other", `${a === "seller" ? d.seller : d.buyer}: ${ACTION[d.stage].toLowerCase()}`, "", "neutral");
  }
  const me = role;
  const other = me === "buyer" ? seller : buyer;
  const sellerTurn = (text: string) => (me === "seller" ? you(text) : wait(`Waiting for ${seller}: ${text.toLowerCase()}`));
  const buyerTurn = (text: string, tone: NextAction["tone"] = "primary", href?: string) => (me === "buyer" ? you(text, text, tone, href) : wait(`Waiting for ${buyer}: ${text.toLowerCase()}`));
  switch (d.stage) {
    case "inquiry":
      return sellerTurn("Reply to the question");
    case "test_drive":
      return sellerTurn(detail?.testDrive?.status === "confirmed" ? "Mark the test drive as done" : "Confirm the test drive time");
    case "application":
    case "negotiation": {
      const last = detail?.offers?.filter((o) => o.status === "current").pop()?.by ?? detail?.counterOffer?.proposedBy ?? "buyer";
      return last === "buyer" ? sellerTurn("Answer the offer") : buyerTurn("Answer the counter-offer");
    }
    case "inspection": {
      const b = detail?.inspectionBooking;
      if (!b) return buyerTurn("Book your inspection");
      if (b.status === "requested") return sellerTurn("Approve the inspection time");
      return buyerTurn("Read the report and decide");
    }
    case "contract": {
      const mine = me === "seller" ? detail?.contract?.sellerSigned : detail?.contract?.buyerSigned;
      return mine ? wait(`Waiting for ${other} to sign`) : you("Sign the contract");
    }
    case "down_payment":
      return buyerTurn(detail?.payment?.status === "failed" ? "Try the down payment again" : "Pay the down payment", detail?.payment?.status === "failed" ? "danger" : "primary");
    case "closing": {
      const mine = me === "seller" ? detail?.closing?.sellerConfirmed : detail?.closing?.buyerConfirmed;
      return mine ? wait(`Waiting for ${other} to confirm the title transfer`) : you("Confirm the title transfer");
    }
    case "active":
      return me === "buyer" ? you("Make this month’s payment", "Pay this month", d.late ? "danger" : "primary", "/buyer/payments") : mk("ownerfi", d.late ? "A payment is late" : "Payments are on schedule", d.late ? "See your options" : "See payments", d.late ? "warning" : "success", d.late ? `/seller/deals/${d.id}/default-options` : "/seller/payments");
    case "paid_off":
      if (detail?.lien?.releasedAt) return mk("none", "Lien released. The title is clear.", "", "success");
      return me === "seller" ? you("Release the lien", "Release the lien", "success") : mk("ownerfi", "Paid off. The seller releases the lien.", "", "success");
    case "defaulted":
      return mk("ownerfi", ACTION.defaulted, "", "danger");
    default:
      return mk("none", ACTION[d.stage], "", "neutral");
  }
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
