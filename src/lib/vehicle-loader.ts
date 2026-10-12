import { notFound } from "@tanstack/react-router";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { getPublicVehicle, type PublicVehicle } from "@/lib/vehicles.functions";

/** Cars added in the demo are saved in the browser, so only the browser can show them. */
export const isDemoCarId = (id: string) => id.startsWith("v-demo-");

function findLocalCustomVehicle(id: string): PublicVehicle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ownerfi_demo_store_v2");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.customVehicles)) {
      const found = parsed.customVehicles.find((v: PublicVehicle) => v.id === id);
      if (found) return found;
    }
  } catch {
    // ignore
  }
  return null;
}

export const carQuery = (id: string) =>
  queryOptions({
    queryKey: ["public-vehicle", id],
    queryFn: () => getPublicVehicle({ data: { id } }),
  });

/** Shared by the car page and the offer page: demo-created car, database car, or SSR stub. */
export async function loadVehicle({
  context,
  params,
}: {
  context: { queryClient: QueryClient };
  params: { id: string };
}): Promise<PublicVehicle> {
    // 1. First check if it's a locally created custom demo vehicle
    const local = findLocalCustomVehicle(params.id);
    if (local) return local;

    // 2. If it matches a UUID format, fetch from Supabase
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
    if (isUuid) {
      try {
        const v = await context.queryClient.ensureQueryData(carQuery(params.id));
        if (v) return v;
      } catch {
        // fall through to local check
      }
    }

    // 3. Fallback check for newly created car in current memory
    const fallback = findLocalCustomVehicle(params.id);
    if (fallback) return fallback;

    throw notFound();
}
