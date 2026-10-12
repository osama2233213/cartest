import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/app/AppShell";
import { DealRoomBody } from "@/components/app/DealRoom";
import { DEALS, type DemoDeal } from "@/lib/demo-data";

function findLocalDeal(id: string): DemoDeal | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem("ownerfi_demo_store_v2");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.deals)) {
        const found = parsed.deals.find((x: DemoDeal) => x.id === id);
        if (found) return found;
      }
    }
  } catch {
    // ignore
  }
  return DEALS.find((x) => x.id === id);
}

export const Route = createFileRoute("/deals/$id")({
  validateSearch: z.object({ as: z.enum(["seller", "buyer", "admin"]).catch("buyer") }),
  // Deals are kept in this browser, so the server has nothing real to render for them.
  ssr: false,
  loader: ({ params }) => {
    const d = findLocalDeal(params.id);
    if (!d) {
      throw notFound();
    }
    return d;
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.car} · Deal · OwnerFi` : "Deal · OwnerFi" }] }),
  component: DealRoute,
  notFoundComponent: () => (
    <div className="p-16 text-center">
      <h2 className="text-xl font-bold text-ink">Deal not found</h2>
      <p className="mt-2 text-sm text-muted">This deal may have expired or was reset.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Go home
      </Link>
    </div>
  ),
  errorComponent: () => <p className="p-16 text-center">Couldn't load this deal.</p>,
});

function DealRoute() {
  const loaderData = Route.useLoaderData();
  const { as: asRole } = Route.useSearch();
  const { id } = Route.useParams();
  return (
    <AppShell role={asRole}>
      <DealRoomBody id={id} role={asRole} fallback={loaderData} />
    </AppShell>
  );
}
