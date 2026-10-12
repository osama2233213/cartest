import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { ButtonLink, Card, EmptyState, PageHeader, Skeleton } from "@/components/kit";
import { CAR_GRID, CarCard, CarCardSkeleton, carEstimate } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { money } from "@/lib/format";
import { useSavedVehicles } from "@/lib/buyer-data";
import { useSaved } from "@/lib/saved";

export const Route = createFileRoute("/buyer/saved")({
  head: () => ({ meta: [{ title: "Saved cars · OwnerFi" }] }),
  component: SavedPage,
});

function SavedPage() {
  const { vehicles, loading } = useSavedVehicles();
  const saved = useSaved();
  const available = vehicles.filter((v) => v.status === "listed");
  const gone = vehicles.filter((v) => v.status !== "listed");
  const monthly = available.map((v) => Math.round(carEstimate(v).monthly));
  const lo = Math.min(...monthly);
  const hi = Math.max(...monthly);
  const grid = "flex min-w-0 [&>*]:min-w-0 [&>*]:flex-1";
  const card = (v: (typeof vehicles)[number]) => (
    <CarCard vehicle={v} saved={saved.isSaved(v.id)} onToggleSave={() => saved.toggle(v.id)} />
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Saved cars"
        description="Cars you like. We keep them here so you can come back."
        action={vehicles.length > 0 ? <ButtonLink to="/cars" variant="secondary">Browse cars</ButtonLink> : undefined}
      />
      {loading ? (
        <div aria-busy="true">
          <Skeleton className="mb-5 h-5 w-64" />
          <div className={CAR_GRID}>
            {Array.from({ length: 3 }, (_, i) => (
              <CarCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : vehicles.length === 0 ? (
        <Card className="py-6">
          <EmptyState
            icon={<Heart aria-hidden className="h-6 w-6" />}
            title="You haven’t saved any cars yet"
            description="Tap the heart on a car to keep it here."
            action={<ButtonLink to="/cars">Browse cars</ButtonLink>}
          />
        </Card>
      ) : (
        <>
          <p aria-live="polite" className="num mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
              <Heart aria-hidden className="h-4 w-4 fill-primary text-primary" />
              {vehicles.length} saved
            </span>
            {monthly.length > 0 && (
              <>
                <span aria-hidden className="h-1 w-1 rounded-full bg-muted/50" />
                <span>{monthly.length === 1 ? `About ${money(lo)}/mo` : `Monthly payments from ${money(lo)} to ${money(hi)}`}</span>
              </>
            )}
          </p>
          {available.length > 0 && (
            <ul className={CAR_GRID}>
              {available.map((v) => (
                <li key={v.id} className={grid}>
                  {card(v)}
                </li>
              ))}
            </ul>
          )}
          {gone.length > 0 && (
            <section aria-labelledby="gone" className={available.length > 0 ? "mt-10" : ""}>
              <h2 id="gone" className="text-xl font-bold leading-7">
                No longer available
              </h2>
              <p className="mb-4 mt-1 text-muted">These cars are sold or on hold. Remove them or find a similar car.</p>
              <ul className={CAR_GRID}>
                {gone.map((v) => (
                  <li key={v.id} className="relative flex min-w-0 flex-col">
                    <div className="flex flex-1 opacity-60 grayscale-[40%] [&>*]:min-w-0 [&>*]:flex-1">{card(v)}</div>
                    <span className="pointer-events-none absolute left-3 top-3">
                      <StatusChip kind="vehicle" value={v.status === "reserved" ? "reserved" : "delisted"} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
