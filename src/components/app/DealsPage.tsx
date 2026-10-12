import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Handshake } from "lucide-react";
import { AppLink, EmptyState, PageHeader } from "@/components/kit";
import { CarImage } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { CLOSED_STAGES, STAGES, getNextAction, type DemoDeal } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
import { moneyC, shortCar } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

type Role = "seller" | "buyer";
const CLOSED: readonly string[] = CLOSED_STAGES;

const step = (d: DemoDeal) => {
  const i = (STAGES as readonly string[]).indexOf(d.stage);
  return i >= 0 ? `Step ${i + 1} of ${STAGES.length}` : "";
};

function NextStep({ d, role }: { d: DemoDeal; role: Role }) {
  const { getDealDetail } = useDemoStore();
  const n = getNextAction(d, role, getDealDetail(d.id));
  if (n.who === "you") return <span className="font-semibold text-primary">{n.text}</span>;
  if (n.who === "none") return <span className="text-muted">{n.text}</span>;
  return <span className="text-muted">{n.text.replace("Waiting for the seller to", "Waiting on the seller to").replace("Waiting for the buyer to", "Waiting on the buyer to")}</span>;
}

function Progress({ d }: { d: DemoDeal }) {
  const i = (STAGES as readonly string[]).indexOf(d.stage);
  if (i < 0) return null;
  return (
    <span role="img" aria-label={`Step ${i + 1} of ${STAGES.length}`} className="mt-1.5 flex h-1.5 w-28 gap-0.5">
      {STAGES.map((s, k) => (
        <span key={s} className={cn("h-full flex-1 rounded-full", k <= i ? "bg-primary" : "bg-ink/10")} />
      ))}
    </span>
  );
}

export function DealsPage({ role }: { role: Role }) {
  const user = useCurrentUser();
  const { deals } = useDemoStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"active" | "closed">("active");
  const mine = deals.filter((d) => (role === "seller" ? d.seller : d.buyer) === user?.name);
  const active = mine.filter((d) => !CLOSED.includes(d.stage));
  const closed = mine.filter((d) => CLOSED.includes(d.stage));
  const rows = tab === "active" ? active : closed;
  const other = (d: DemoDeal) => (role === "seller" ? d.buyer : d.seller).split(" ")[0];
  const open = (d: DemoDeal) => navigate({ to: "/deals/$id", params: { id: d.id }, search: { as: role } as never });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Deals" description="Every offer and sale in one place. Open one to see what happens next." />
      <div role="tablist" className="scrollbar-none mb-4 flex gap-1 overflow-x-auto border-b border-ink/10">
        {(
          [
            ["active", "Active", active.length],
            ["closed", "Closed", closed.length],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold md:px-4",
              tab === id ? "border-primary text-ink" : "border-transparent text-muted hover:border-ink/20 hover:text-ink",
            )}
          >
            {label}
            <span className={cn("num rounded-full px-2 text-xs leading-5", tab === id ? "bg-primary text-white" : "bg-ink/[0.07] text-ink/70")}>{n}</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Handshake aria-hidden className="h-6 w-6" />}
          title={tab === "active" ? "No active deals" : "Nothing closed yet"}
          description={
            tab === "active"
              ? role === "seller"
                ? "When a buyer makes an offer, the deal shows up here."
                : "Find a car and make an offer to start a deal."
              : "Finished deals show up here."
          }
          action={role === "buyer" && tab === "active" ? <AppLink to="/cars" className="font-semibold text-primary hover:underline">Browse cars</AppLink> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-ink/[0.08] bg-white shadow-card">
          <table className="hidden w-full border-collapse text-left text-sm md:table">
            <thead className="border-b border-ink/10">
              <tr>
                {["Car", "Where it’s at", "Price", "Next step"].map((h, i) => (
                  <th key={h} scope="col" className={cn("px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted", i === 2 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} onClick={() => open(d)} className="cursor-pointer border-t border-ink/[0.06] first:border-t-0 hover:bg-surface">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CarImage src={d.photo} alt="" className="h-12 w-16 shrink-0 !rounded-xl" />
                      <div className="min-w-0">
                        <AppLink to={`/deals/${d.id}?as=${role}`} className="block truncate font-semibold hover:underline">
                          {shortCar(d.car)}
                        </AppLink>
                        <span className="block text-sm text-muted">
                          {role === "seller" ? "Buyer" : "Seller"}: {other(d)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip kind="deal" value={d.stage} />
                    <span className="num mt-1 block text-xs text-muted">{step(d)}</span>
                    <Progress d={d} />
                  </td>
                  <td className="num px-4 py-3 text-right">
                    <span className="font-medium">{moneyC(d.priceCents)}</span>
                    <span className="block text-xs text-muted">Updated {d.updated}</span>
                  </td>
                  <td className="px-4 py-3">
                    <NextStep d={d} role={role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-ink/10 md:hidden">
            {rows.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => open(d)} className="flex w-full items-center gap-3 p-4 text-left">
                  <CarImage src={d.photo} alt="" className="h-14 w-[72px] shrink-0 !rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{d.car}</span>
                    <span className="block text-sm text-muted">
                      {role === "seller" ? "Buyer" : "Seller"}: {other(d)} · {moneyC(d.priceCents)}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <StatusChip kind="deal" value={d.stage} />
                      <span className="num text-xs text-muted">{step(d)}</span>
                    </span>
                    <Progress d={d} />
                    <span className="mt-1 block text-sm">
                      <NextStep d={d} role={role} />
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
