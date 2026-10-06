import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { DEALS, type DemoDeal, type Stage, PERSONAS } from "./demo-data";
import type { PublicVehicle } from "./vehicles.functions";
import { dealTerms } from "./finance";

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
  status: "scheduled" | "confirmed" | "completed";
}

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
  buyerSigned: boolean;
  buyerSignedAt?: string | undefined;
  agreementNumber: string;
}

export interface DealPayment {
  downPaymentPaid: boolean;
  paidAt?: string | undefined;
  amountCents?: number | undefined;
  txId?: string | undefined;
}

export interface DealClosing {
  titleTransferred: boolean;
  lienholderRecorded: boolean;
  keysHandedOver: boolean;
  documentsExchanged: boolean;
  completed: boolean;
}

export interface DealInstallmentState {
  paidCount: number;
  totalCount: number;
  nextDueDate: string;
  monthlyAmount: number;
  lastPaymentDate?: string | undefined;
}

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
}

export interface DemoStoreState {
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
      payment: { downPaymentPaid: false },
      closing: { titleTransferred: false, lienholderRecorded: false, keysHandedOver: false, documentsExchanged: false, completed: false },
      installment: { paidCount: 0, totalCount: 48, nextDueDate: "Nov 5, 2026", monthlyAmount: 47425 },
    },
    "d-1003": {
      messages: [],
      testDrive: { slot: "Completed", location: "Austin, TX", status: "completed" },
      inspection: DEFAULT_INSPECTION,
      contract: { sellerSigned: true, sellerSignedAt: "Sep 1, 2026", buyerSigned: true, buyerSignedAt: "Sep 2, 2026", agreementNumber: "OF-TX-2026-4402" },
      payment: { downPaymentPaid: true, paidAt: "Sep 3, 2026", amountCents: 372000 },
      closing: { titleTransferred: true, lienholderRecorded: true, keysHandedOver: true, documentsExchanged: true, completed: true },
      installment: { paidCount: 2, totalCount: 48, nextDueDate: "Oct 5, 2026", monthlyAmount: 57400 },
    },
  };

  return {
    customVehicles: [],
    deals: [...DEALS],
    dealDetails: initialDetails,
  };
}

interface DemoStoreContextValue {
  deals: DemoDeal[];
  customVehicles: PublicVehicle[];
  allVehicles: (supabaseVehicles: PublicVehicle[]) => PublicVehicle[];
  getDeal: (id: string) => DemoDeal | undefined;
  getDealDetail: (id: string) => DealDetailData;
  addVehicle: (vehicle: Omit<PublicVehicle, "id" | "created_at" | "status" | "seller_display_name" | "seller_verified">) => PublicVehicle;
  createInquiry: (vehicle: PublicVehicle, message: string) => string;
  bookTestDrive: (vehicle: PublicVehicle, slot: string, location?: string | undefined) => string;
  makeOffer: (vehicle: PublicVehicle, terms: { priceCents: number; downPct: number; apr: number; term: number }) => string;
  sendMessage: (dealId: string, sender: "seller" | "buyer", text: string) => void;
  confirmTestDrive: (dealId: string) => void;
  completeTestDrive: (dealId: string) => void;
  approveOffer: (dealId: string) => void;
  declineDeal: (dealId: string, reason: string) => void;
  withdrawDeal: (dealId: string, reason?: string | undefined) => void;
  submitCounterOffer: (dealId: string, terms: { priceCents: number; downPct: number; apr: number; term: number }, by: "seller" | "buyer", note?: string | undefined) => void;
  acceptCounterOffer: (dealId: string) => void;
  acceptInspection: (dealId: string) => void;
  signContract: (dealId: string, role: "seller" | "buyer") => void;
  payDownPayment: (dealId: string) => void;
  confirmClosing: (dealId: string) => void;
  payInstallment: (dealId: string) => void;
  resetDemo: () => void;
}

const DemoStoreContext = createContext<DemoStoreContextValue | null>(null);

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoStoreState>(getInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Failed to persist demo store:", err);
    }
  }, [state]);

  const allVehicles = (supabaseVehicles: PublicVehicle[]) => {
    // Custom vehicles created in demo appear first
    const customIds = new Set(state.customVehicles.map((v) => v.id));
    const dedupedSupabase = supabaseVehicles.filter((v) => !customIds.has(v.id));
    return [...state.customVehicles, ...dedupedSupabase];
  };

  const getDeal = (id: string) => state.deals.find((d) => d.id === id);

  const getDealDetail = (id: string): DealDetailData => {
    return ensureDealDetail(state.dealDetails, id);
  };

  const addVehicle = (input: Omit<PublicVehicle, "id" | "created_at" | "status" | "seller_display_name" | "seller_verified">): PublicVehicle => {
    const newId = "v-demo-" + Date.now();
    const newVehicle: PublicVehicle = {
      ...input,
      id: newId,
      seller_display_name: PERSONAS.seller.name,
      seller_verified: true,
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
    const existing = state.deals.find(
      (d) => d.car.includes(vehicle.make) && d.car.includes(vehicle.model) && d.buyer === PERSONAS.buyer.name
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
      seller: vehicle.seller_display_name || PERSONAS.seller.name,
      buyer: PERSONAS.buyer.name,
      stage: "inquiry",
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
          senderName: PERSONAS.buyer.name,
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
    const existing = state.deals.find(
      (d) => d.car.includes(vehicle.make) && d.car.includes(vehicle.model) && d.buyer === PERSONAS.buyer.name
    );
    if (existing) {
      setState((prev) => {
        const cur = ensureDealDetail(prev.dealDetails, existing.id);
        const updatedDetail: DealDetailData = {
          ...cur,
          testDrive: { slot, location, status: "scheduled" },
          messages: [
            ...cur.messages,
            { id: "m-" + Date.now(), sender: "buyer", senderName: PERSONAS.buyer.name, text: `Test drive scheduled for ${slot} at ${location}.`, time: "Just now" },
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
      seller: vehicle.seller_display_name || PERSONAS.seller.name,
      buyer: PERSONAS.buyer.name,
      stage: "test_drive",
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
          senderName: PERSONAS.buyer.name,
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

    const existing = state.deals.find(
      (d) => d.car.includes(vehicle.make) && d.car.includes(vehicle.model) && d.buyer === PERSONAS.buyer.name
    );

    const dealId = existing ? existing.id : "d-" + Date.now().toString().slice(-4);
    const carTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}`.trim();

    const offerMessage: DealMessage = {
      id: "m-" + Date.now(),
      sender: "buyer",
      senderName: PERSONAS.buyer.name,
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
      seller: vehicle.seller_display_name || PERSONAS.seller.name,
      buyer: PERSONAS.buyer.name,
      stage: "application",
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
    const senderName = sender === "seller" ? PERSONAS.seller.name : PERSONAS.buyer.name;
    const msg: DealMessage = {
      id: "m-" + Date.now(),
      sender,
      senderName,
      text: text.trim(),
      time: "Just now",
    };

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

  const confirmTestDrive = (dealId: string) => {
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

  const approveOffer = (dealId: string) => {
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const updatedDetail: DealDetailData = {
        ...cur,
        inspection: cur.inspection || DEFAULT_INSPECTION,
        messages: [
          ...cur.messages,
          { id: "m-" + Date.now(), sender: "seller", senderName: PERSONAS.seller.name, text: "Offer approved! Next step: Mobile vehicle inspection.", time: "Just now" },
        ],
      };
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "inspection" as Stage, updated: "Just now" } : d)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const declineDeal = (dealId: string, reason: string) => {
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const updatedDetail: DealDetailData = {
        ...cur,
        messages: [
          ...cur.messages,
          {
            id: "m-" + Date.now(),
            sender: "seller",
            senderName: PERSONAS.seller.name,
            text: `Application declined by seller. Reason: ${reason}`,
            time: "Just now",
          },
        ],
      };
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "declined" as Stage, updated: "Just now" } : d)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const withdrawDeal = (dealId: string, reason?: string | undefined) => {
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const noteText = reason?.trim() ? ` Reason: ${reason.trim()}` : "";
      const updatedDetail: DealDetailData = {
        ...cur,
        messages: [
          ...cur.messages,
          {
            id: "m-" + Date.now(),
            sender: "buyer",
            senderName: PERSONAS.buyer.name,
            text: `Offer withdrawn by buyer.${noteText}`,
            time: "Just now",
          },
        ],
      };
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "cancelled" as Stage, updated: "Just now" } : d)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
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
    const calc = dealTerms({
      priceCents: terms.priceCents,
      downPct: terms.downPct,
      apr: terms.apr,
      termMonths: terms.term,
    });

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
        messages: [
          ...cur.messages,
          {
            id: "m-" + Date.now(),
            sender: by,
            senderName: by === "seller" ? PERSONAS.seller.name : PERSONAS.buyer.name,
            text: `Counter-offer sent: $${(terms.priceCents / 100).toLocaleString()}, ${terms.downPct}% down, ${terms.apr}% APR, ${terms.term} mo ($${(calc.monthly / 100).toFixed(2)}/mo)${note ? ` — "${note}"` : ""}`,
            time: "Just now",
          },
        ],
      };
      return {
        ...prev,
        deals: prev.deals.map((d) =>
          d.id === dealId
            ? {
                ...d,
                stage: "negotiation" as Stage,
                priceCents: terms.priceCents,
                downPct: terms.downPct,
                apr: terms.apr,
                term: terms.term,
                updated: "Just now",
              }
            : d
        ),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const acceptCounterOffer = (dealId: string) => {
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const updatedDetail: DealDetailData = {
        ...cur,
        inspection: cur.inspection || DEFAULT_INSPECTION,
        messages: [
          ...cur.messages,
          { id: "m-" + Date.now(), sender: "buyer", senderName: PERSONAS.buyer.name, text: "Counter-offer accepted! Moving to vehicle inspection.", time: "Just now" },
        ],
      };
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "inspection" as Stage, updated: "Just now" } : d)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const acceptInspection = (dealId: string) => {
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const updatedContract: DealContract = {
        sellerSigned: true,
        sellerSignedAt: "Oct 4, 2026",
        buyerSigned: false,
        agreementNumber: `OF-AZ-2026-${dealId.slice(-4)}`,
      };
      const updatedDetail: DealDetailData = {
        ...cur,
        contract: updatedContract,
        messages: [
          ...cur.messages,
          { id: "m-" + Date.now(), sender: "buyer", senderName: PERSONAS.buyer.name, text: "Inspection report reviewed and accepted. Ready to sign agreement.", time: "Just now" },
        ],
      };
      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: "contract" as Stage, updated: "Just now" } : d)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const signContract = (dealId: string, role: "seller" | "buyer") => {
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      const prevContract = cur.contract || {
        sellerSigned: true,
        sellerSignedAt: "Oct 4, 2026",
        buyerSigned: false,
        agreementNumber: `OF-${dealId}`,
      };

      const updatedContract: DealContract = {
        ...prevContract,
        sellerSigned: role === "seller" ? true : prevContract.sellerSigned,
        sellerSignedAt: role === "seller" ? new Date().toLocaleDateString() : prevContract.sellerSignedAt,
        buyerSigned: role === "buyer" ? true : prevContract.buyerSigned,
        buyerSignedAt: role === "buyer" ? new Date().toLocaleDateString() : prevContract.buyerSignedAt,
      };

      const bothSigned = updatedContract.sellerSigned && updatedContract.buyerSigned;
      const nextStage: Stage = bothSigned ? "down_payment" : "contract";

      const updatedDetail: DealDetailData = {
        ...cur,
        contract: updatedContract,
        messages: [
          ...cur.messages,
          {
            id: "m-" + Date.now(),
            sender: role,
            senderName: role === "seller" ? PERSONAS.seller.name : PERSONAS.buyer.name,
            text: `${role === "seller" ? "Seller" : "Buyer"} e-signed OwnerFi Financing Agreement #${updatedContract.agreementNumber}.`,
            time: "Just now",
          },
        ],
      };

      return {
        ...prev,
        deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stage: nextStage, updated: "Just now" } : d)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const payDownPayment = (dealId: string) => {
    setState((prev) => {
      const d = prev.deals.find((x) => x.id === dealId);
      const terms = d
        ? dealTerms({
            priceCents: d.priceCents,
            downPct: d.downPct,
            apr: d.apr,
            termMonths: d.term,
            ...(d.feeWaived !== undefined ? { feeWaived: d.feeWaived } : {}),
          })
        : null;
      const cur = ensureDealDetail(prev.dealDetails, dealId);

      const payment: DealPayment = {
        downPaymentPaid: true,
        paidAt: "Just now",
        amountCents: terms ? terms.down : 0,
        txId: "tx_mock_" + Date.now().toString().slice(-6),
      };

      const closing: DealClosing = {
        titleTransferred: true,
        lienholderRecorded: true,
        keysHandedOver: false,
        documentsExchanged: true,
        completed: false,
      };

      const updatedDetail: DealDetailData = {
        ...cur,
        payment,
        closing,
        messages: [
          ...cur.messages,
          {
            id: "m-" + Date.now(),
            sender: "buyer",
            senderName: PERSONAS.buyer.name,
            text: `Down payment of $${terms ? (terms.down / 100).toLocaleString() : ""} processed successfully. Moving to final closing and vehicle handoff!`,
            time: "Just now",
          },
        ],
      };

      return {
        ...prev,
        deals: prev.deals.map((x) => (x.id === dealId ? { ...x, stage: "closing" as Stage, updated: "Just now" } : x)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const confirmClosing = (dealId: string) => {
    setState((prev) => {
      const d = prev.deals.find((x) => x.id === dealId);
      const terms = d
        ? dealTerms({
            priceCents: d.priceCents,
            downPct: d.downPct,
            apr: d.apr,
            termMonths: d.term,
            ...(d.feeWaived !== undefined ? { feeWaived: d.feeWaived } : {}),
          })
        : null;
      const cur = ensureDealDetail(prev.dealDetails, dealId);

      const closing: DealClosing = {
        titleTransferred: true,
        lienholderRecorded: true,
        keysHandedOver: true,
        documentsExchanged: true,
        completed: true,
      };

      const installment: DealInstallmentState = {
        paidCount: 0,
        totalCount: d?.term || 48,
        nextDueDate: "Nov 5, 2026",
        monthlyAmount: terms?.monthly || 45000,
      };

      const updatedDetail: DealDetailData = {
        ...cur,
        closing,
        installment,
        messages: [
          ...cur.messages,
          {
            id: "m-" + Date.now(),
            sender: "seller",
            senderName: PERSONAS.seller.name,
            text: "Vehicle handoff confirmed! Title recorded with OwnerFi as lienholder. Deal is now ACTIVE.",
            time: "Just now",
          },
        ],
      };

      return {
        ...prev,
        deals: prev.deals.map((x) => (x.id === dealId ? { ...x, stage: "active" as Stage, updated: "Just now" } : x)),
        dealDetails: {
          ...prev.dealDetails,
          [dealId]: updatedDetail,
        },
      };
    });
  };

  const payInstallment = (dealId: string) => {
    setState((prev) => {
      const cur = ensureDealDetail(prev.dealDetails, dealId);
      if (!cur.installment) return prev;
      const nextPaid = cur.installment.paidCount + 1;
      const updatedInstallment: DealInstallmentState = {
        ...cur.installment,
        paidCount: nextPaid,
        lastPaymentDate: "Today",
        nextDueDate: "Dec 5, 2026",
      };
      const updatedDetail: DealDetailData = {
        ...cur,
        installment: updatedInstallment,
        messages: [
          ...cur.messages,
          {
            id: "m-" + Date.now(),
            sender: "buyer",
            senderName: PERSONAS.buyer.name,
            text: `Monthly installment #${nextPaid} of ${cur.installment.totalCount} ($${(cur.installment.monthlyAmount / 100).toFixed(2)}) paid on time!`,
            time: "Just now",
          },
        ],
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

  const resetDemo = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setState(getInitialState());
  };

  const value = useMemo(
    () => ({
      deals: state.deals,
      customVehicles: state.customVehicles,
      allVehicles,
      getDeal,
      getDealDetail,
      addVehicle,
      createInquiry,
      bookTestDrive,
      makeOffer,
      sendMessage,
      confirmTestDrive,
      completeTestDrive,
      approveOffer,
      declineDeal,
      withdrawDeal,
      submitCounterOffer,
      acceptCounterOffer,
      acceptInspection,
      signContract,
      payDownPayment,
      confirmClosing,
      payInstallment,
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
