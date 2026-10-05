import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { ShieldCheck, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

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

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const dest = user.role === "seller" ? "/seller" : user.role === "buyer" ? "/buyer" : "/admin";

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate({ to: "/" });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1.5 text-sm transition-colors hover:bg-surface"
      >
        <div className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {user.avatar}
        </div>
        <span className="hidden font-medium text-ink sm:inline">{user.name}</span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-in fade-in slide-in-from-top-2 rounded-xl border border-border bg-card p-1.5 shadow-xl">
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {user.label}
            </span>
          </div>
          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false);
                navigate({ to: dest });
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-surface"
            >
              <LayoutDashboard className="size-4 text-muted-foreground" />
              {user.label} Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/5"
            >
              <LogOut className="size-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  const { isLoggedIn } = useAuth();

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
          {isLoggedIn ? (
            <UserMenu />
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Log in</Link>
            </Button>
          )}
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
