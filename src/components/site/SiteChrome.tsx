import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-ink">
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground text-sm">
        OF
      </span>
      OwnerFi
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/cars" className="hover:text-ink" activeProps={{ className: "text-ink" }}>
            Browse cars
          </Link>
          <a href="/#how" className="hover:text-ink">How it works</a>
          <a href="/#fees" className="hover:text-ink">Fees</a>
          <a href="/#faq" className="hover:text-ink">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled title="Accounts arrive in the next build step">
            Log in
          </Button>
          <Button size="sm" asChild>
            <Link to="/cars">Find a car</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">Sell your car. Be the bank.</p>
        </div>
        <div className="md:col-span-2 flex gap-3 rounded-2xl border border-border bg-background p-5 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
          <p>
            OwnerFi is software only. We are not a lender, marketplace of record, escrow agent,
            payment processor, money transmitter, broker or dealer, and we never hold your money.
            All credit decisions are made by the seller.
          </p>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} OwnerFi
      </div>
    </footer>
  );
}
