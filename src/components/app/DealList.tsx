import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CarPhoto } from "@/components/site/CarPhoto";
import { StageChip } from "./AppShell";
import { getNextAction, termsFor, type DemoDeal, type Role } from "@/lib/demo-data";
import { fmtUsd } from "@/lib/finance";
import { cn } from "@/lib/utils";

export function DealList({ deals, role }: { deals: DemoDeal[]; role: Role }) {
  return (
    <ul className="space-y-3">
      {deals.map((d) => {
        const n = getNextAction(d, role);
        return (
          <li key={d.id}>
            <Link to="/deals/$id" params={{ id: d.id }} search={{ as: role }} className="card-surface flex items-center gap-4 p-3 transition-shadow hover:shadow-md">
              <CarPhoto src={d.photo} alt={d.car} className="size-16 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{d.car}</p>
                  <StageChip stage={d.stage} />
                </div>
                <p className={cn("mt-0.5 truncate text-sm", n.who === "you" ? "font-medium text-primary" : "text-muted-foreground")}>
                  {n.who === "you" ? "Your turn: " : ""}{n.text}
                </p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="money font-semibold">{fmtUsd(termsFor(d).monthly)}/mo</p>
                <p className="text-xs text-muted-foreground">{d.updated}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
