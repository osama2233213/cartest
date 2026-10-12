import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { carTitle } from "@/components/site/cars";
import { getNextAction, termsFor, type DemoDeal } from "./demo-data";
import { useDrives, OPEN } from "./drives";
import { useDemoStore } from "./demo-store";
import { useSavedIds } from "./saved";
import { useCurrentUser, type SessionUser } from "./session";
import { listPublicVehicles, type PublicVehicle } from "./vehicles.functions";

export const VERIFY_STEPS = ["identity", "bank", "credit"] as const;
export type VerifyStep = (typeof VERIFY_STEPS)[number];

export const stateOf = (u: SessionUser, s: VerifyStep) => u.verification[s] ?? "not_started";
export const isDone = (u: SessionUser) => VERIFY_STEPS.every((s) => stateOf(u, s) === "verified");

/** First verification step still to do (in review counts as handled). */
export function nextVerifyStep(u: SessionUser): VerifyStep | "done" {
  for (const s of VERIFY_STEPS) {
    const v = stateOf(u, s);
    if (v !== "verified" && v !== "in_review") return s;
  }
  return VERIFY_STEPS.find((s) => stateOf(u, s) !== "verified") ?? "done";
}

export function useBuyerDeals() {
  const user = useCurrentUser();
  const { deals } = useDemoStore();
  return useMemo(() => deals.filter((d) => d.buyer === user?.name), [deals, user?.name]);
}

export function useBuyerDrives() {
  const user = useCurrentUser();
  const drives = useDrives();
  return useMemo(() => drives.filter((d) => d.buyerName === user?.name).sort((a, b) => a.start.localeCompare(b.start)), [drives, user?.name]);
}

export function useAllVehicles() {
  const { allVehicles } = useDemoStore();
  const q = useQuery({ queryKey: ["public-vehicles"], queryFn: () => listPublicVehicles() });
  const list = useMemo(() => allVehicles(q.data?.vehicles ?? []), [allVehicles, q.data]);
  return { vehicles: list, loading: q.isLoading, error: q.isError, reload: () => void q.refetch() };
}

export function useSavedVehicles() {
  const user = useCurrentUser();
  const ids = useSavedIds(user?.id);
  const all = useAllVehicles();
  const vehicles = useMemo(() => ids.map((id) => all.vehicles.find((v) => v.id === id)).filter((v): v is PublicVehicle => !!v), [ids, all.vehicles]);
  return { ids, vehicles, loading: all.loading, error: all.error, reload: all.reload };
}

export const dealProgress = (d: DemoDeal) => {
  const order = ["inquiry", "test_drive", "application", "negotiation", "inspection", "contract", "down_payment", "closing", "active", "paid_off"];
  const i = order.indexOf(d.stage);
  return i < 0 ? 0 : Math.round(((i + 1) / order.length) * 100);
};

/** Deals waiting on the buyer. Pass the deal details so the answer matches the Deal Room (who made the last offer, who signed). */
export function buyerActions(deals: DemoDeal[], detailOf?: Parameters<typeof getNextAction>[2] extends infer D ? (id: string) => D : never) {
  return deals
    .filter((d) => !["declined", "cancelled", "defaulted"].includes(d.stage))
    .map((deal) => ({ deal, next: getNextAction(deal, "buyer", detailOf?.(deal.id)) }))
    .filter((x) => x.next.who === "you");
}

export const upcomingDrives = (drives: ReturnType<typeof useBuyerDrives>) =>
  drives.filter((d) => OPEN.includes(d.status) && new Date(d.start) >= new Date(Date.now() - 3_600_000));

export { carTitle, termsFor };
