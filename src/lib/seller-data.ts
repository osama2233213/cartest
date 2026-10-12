import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { carTitle } from "@/components/site/cars";
import { getNextAction, termsFor, type DemoDeal } from "./demo-data";
import { useDemoStore } from "./demo-store";
import { listPublicVehicles, type PublicVehicle } from "./vehicles.functions";
import { useCurrentUser } from "./session";

export type VehicleStatus =
  | "draft"
  | "pending_review"
  | "listed"
  | "reserved"
  | "sold_active"
  | "paid_off"
  | "delisted";

/** Listings show "Maria A."; accounts are "Maria Alvarez". */
const sameSeller = (display: string, full: string) => {
  const [f = "", l = ""] = full.split(" ");
  return display === full || display === `${f} ${l.slice(0, 1)}.`;
};

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Demo engagement numbers, stable per car. */
export function vehicleStats(id: string) {
  const h = hash(id);
  return { views: 40 + (h % 220), saves: h % 9, questions: h % 4 };
}

export function dealForVehicle(v: PublicVehicle, deals: DemoDeal[]) {
  const title = carTitle(v);
  return deals.filter((d) => d.car.startsWith(title) && d.stage !== "declined" && d.stage !== "cancelled");
}

export function vehicleStatus(v: PublicVehicle, deals: DemoDeal[]): VehicleStatus {
  const ds = dealForVehicle(v, deals);
  if (ds.some((d) => d.stage === "paid_off")) return "paid_off";
  if (ds.some((d) => d.stage === "active" || d.stage === "defaulted")) return "sold_active";
  if (ds.length > 0) return "reserved";
  if (v.status === "reserved") return "reserved";
  if (v.status === "pending_review") return "pending_review";
  if (v.status === "delisted") return "delisted";
  return "listed";
}

/** The seller's cars: database cars under their name plus cars added in this demo. */
export function useSellerVehicles() {
  const user = useCurrentUser();
  const { customVehicles, deals, withEdits } = useDemoStore();
  const q = useQuery({
    queryKey: ["public-vehicles"],
    queryFn: async () => {
      // The server function reports failures as `{ error }`, so turn that into a real query error the page can show.
      const res = await listPublicVehicles();
      if (res.error) throw new Error(res.error);
      return res;
    },
    retry: 0,
    staleTime: 60_000,
  });
  const name = user?.name ?? "";
  const vehicles = useMemo(() => {
    const db = (q.data?.vehicles ?? []).filter((v) => sameSeller(v.seller_display_name, name));
    // Cars published in this demo belong to the seller who published them. Older ones carry only a name.
    const mine = customVehicles.filter((v) => !db.some((d) => d.id === v.id) && (v.owner_id ? v.owner_id === user?.id : sameSeller(v.seller_display_name, name)));
    return [...mine, ...db].map(withEdits).map((v) => ({ vehicle: v, status: vehicleStatus(v, deals), ...vehicleStats(v.id) }));
  }, [q.data, customVehicles, deals, name, withEdits]);
  return { vehicles, loading: q.isLoading, error: q.isError, reload: () => void q.refetch() };
}

export function useSellerDeals() {
  const user = useCurrentUser();
  const { deals } = useDemoStore();
  return useMemo(() => deals.filter((d) => d.seller === user?.name), [deals, user?.name]);
}

export function sellerKpis(deals: DemoDeal[], paidCounts: Record<string, number>) {
  const active = deals.filter((d) => d.stage === "active");
  let monthly = 0;
  let owed = 0;
  let interestYtd = 0;
  for (const d of active) {
    const t = termsFor(d);
    monthly += t.monthly;
    const paid = paidCounts[d.id] ?? 0;
    owed += t.schedule[paid - 1]?.balance ?? t.financed;
    interestYtd += t.schedule.slice(0, paid).reduce((s, r) => s + r.interest, 0);
  }
  return { monthlyIncome: monthly, outstanding: owed, interestYtd, activeNotes: active.length };
}

export function sellerActions(deals: DemoDeal[], detailOf?: Parameters<typeof getNextAction>[2] extends infer D ? (id: string) => D : never) {
  return deals
    .map((deal) => ({ deal, next: getNextAction(deal, "seller", detailOf?.(deal.id)) }))
    .filter((x) => x.next.who === "you");
}

export const CAR_PHOTO = (v: PublicVehicle) => v.photos[0];
