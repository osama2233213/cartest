import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        // Fail fast if the backend is down or paused, instead of leaving the page waiting forever.
        return fetch(input, { ...init, headers: h, signal: init?.signal ?? AbortSignal.timeout(6000) });
      },
    },
  });
}

const PUBLIC_COLS =
  "id, seller_display_name, seller_verified, year, make, model, trim, body, mileage, exterior_color, interior_color, condition, description, city, state, price_cents, min_down_pct, apr, allowed_terms, market_low_cents, market_high_cents, photos, features, history_summary, status, created_at";

export type PublicVehicle = {
  id: string;
  seller_display_name: string;
  seller_verified: boolean;
  /** The signed-in seller who published this car in the demo. Cars from the database have none. */
  owner_id?: string | undefined;
  vin?: string | null | undefined;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  body: string | null;
  mileage: number;
  exterior_color: string | null;
  interior_color: string | null;
  condition: string | null;
  description: string | null;
  city: string;
  state: string;
  price_cents: number;
  min_down_pct: number;
  apr: number;
  allowed_terms: number[];
  market_low_cents: number | null;
  market_high_cents: number | null;
  photos: string[];
  features: string[];
  history_summary: { owners?: number; accidents?: number; title?: string };
  status: string;
  created_at: string;
};

export const listPublicVehicles = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("vehicles")
    .select(PUBLIC_COLS)
    .in("status", ["listed", "reserved"])
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return { vehicles: [] as PublicVehicle[], error: "Couldn't load cars right now." };
  }
  return { vehicles: (data ?? []) as unknown as PublicVehicle[], error: null };
});

export const getPublicVehicle = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await publicClient()
      .from("vehicles")
      .select(PUBLIC_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) console.error(error);
    return (row ?? null) as unknown as PublicVehicle | null;
  });
