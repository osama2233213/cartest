import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { dealTerms, fmtUsd } from "@/lib/finance";
import { cn } from "@/lib/utils";

export function PaymentCalculator({
  priceCents,
  apr,
  minDownPct,
  terms,
}: {
  priceCents: number;
  apr: number;
  minDownPct: number;
  terms: number[];
}) {
  const [downPct, setDownPct] = useState(Math.max(minDownPct, 15));
  const [term, setTerm] = useState(terms.includes(48) ? 48 : (terms[terms.length - 1] ?? 36));
  const t = useMemo(
    () => dealTerms({ priceCents, downPct, apr, termMonths: term }),
    [priceCents, downPct, apr, term],
  );

  return (
    <div className="card-surface p-5 space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Estimated monthly</p>
        <p className="money text-4xl font-bold text-ink">{fmtUsd(t.monthly, { cents: true })}</p>
        <p className="text-xs text-muted-foreground">
          {apr}% APR set by the seller · {term} months
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Down payment</span>
          <span className="money">
            {downPct}% · {fmtUsd(t.down)}
          </span>
        </div>
        <Slider
          value={[downPct]}
          min={minDownPct}
          max={50}
          step={1}
          onValueChange={(v) => setDownPct(v[0] ?? 0)}
          aria-label="Down payment percent"
        />
        <p className="text-xs text-muted-foreground">Seller minimum: {minDownPct}%</p>
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium">Term</span>
        <div className="flex flex-wrap gap-2">
          {terms.map((m) => (
            <button
              key={m}
              onClick={() => setTerm(m)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                m === term
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-surface",
              )}
            >
              {m} mo
            </button>
          ))}
        </div>
      </div>
      <dl className="space-y-1.5 border-t border-border pt-4 text-sm">
        <Row k="Car price" v={fmtUsd(priceCents)} />
        <Row k="Due at signing" v={fmtUsd(t.down)} />
        <Row k="Amount financed" v={fmtUsd(t.financed)} />
        <Row k="Total interest" v={fmtUsd(t.interest)} />
        <Row k="Total you'll pay" v={fmtUsd(t.buyerTotal)} strong />
        <Row k="OwnerFi fees for you" v="$0" />
      </dl>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("money", strong && "font-semibold text-ink")}>{v}</dd>
    </div>
  );
}
