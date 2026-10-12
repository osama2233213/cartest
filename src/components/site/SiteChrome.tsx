import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  Check,
  FileCheck2,
  LogOut,
  Menu,
  Palette,
  ShieldCheck,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { AppLink, Alert, Avatar, ButtonLink, Popover, Sheet } from "@/components/kit";
import { DemoToolbar } from "@/components/site/DemoToolbar";
import { useAuth } from "@/lib/auth-store";
import { PORTAL } from "@/lib/portal";
import { auth } from "@/lib/session";
import { THEMES, setTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/demo-data";

/* ------------------------------------------------------------------ brand */

const maskStyle = (file: string): CSSProperties => ({
  WebkitMaskImage: `url(/brand/${file})`,
  maskImage: `url(/brand/${file})`,
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
});

const LOGO_SIZE = { sm: "h-6", md: "h-7 md:h-8", lg: "h-10" } as const;

export function Logo({
  to = "/",
  inverted,
  size = "md",
  className,
}: {
  to?: string;
  inverted?: boolean;
  size?: keyof typeof LOGO_SIZE;
  className?: string;
}) {
  return (
    <AppLink
      to={to}
      aria-label="OwnerFi home"
      className={cn("inline-flex shrink-0 items-center rounded-lg", className)}
    >
      <span aria-hidden className={cn("relative block aspect-[474/138]", LOGO_SIZE[size])}>
        <span className={cn("absolute inset-0", inverted ? "bg-white" : "bg-ink")} style={maskStyle("logo-base.png")} />
        <span className={cn("absolute inset-0", inverted ? "bg-sky" : "bg-primary")} style={maskStyle("logo-fi.png")} />
      </span>
    </AppLink>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/mark.png"
      alt=""
      width={40}
      height={40}
      draggable={false}
      className={cn("h-8 w-8 shrink-0 select-none rounded-full", className)}
    />
  );
}

/* ----------------------------------------------------------- shared bits */


export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-[60] rounded-xl bg-white px-4 py-2 font-semibold text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Skip to content
    </a>
  );
}

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <Alert tone="danger" className="rounded-none" title="You're offline.">
      Changes may not save until you're back online.
    </Alert>
  );
}

export function ThemeMenu({ align = "right" }: { align?: "left" | "right" }) {
  const theme = useTheme();
  return (
    <Popover
      align={align}
      className="w-64 p-2"
      trigger={({ props, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          {...props}
          aria-label="Color theme"
          title="Color theme"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-ink/5 hover:text-ink"
        >
          <Palette aria-hidden className="h-5 w-5" />
        </button>
      )}
    >
      {({ close }) => (
        <div role="radiogroup" aria-label="Color theme">
          <p className="px-2.5 pb-2 pt-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Color theme
          </p>
          {THEMES.map((t) => {
            const on = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setTheme(t.id);
                  close();
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium hover:bg-ink/5",
                  on && "bg-primary-50 text-primary-700 hover:bg-primary-50",
                )}
              >
                <span aria-hidden className="flex -space-x-1.5">
                  {t.swatch.map((c) => (
                    <span key={c} className="h-5 w-5 rounded-full ring-2 ring-white" style={{ background: c }} />
                  ))}
                </span>
                <span className="flex-1">{t.name}</span>
                {on && <Check aria-hidden className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}

export function AccountMenu({ role }: { role: Role }) {
  const navigate = useNavigate();
  const info = PORTAL[role];
  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-ink/5";
  return (
    <Popover
      align="right"
      className="w-56 p-1.5"
      trigger={({ props, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          {...props}
          aria-label={`Account menu for ${info.full}`}
          className="rounded-full"
        >
          <Avatar name={info.full} size="sm" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <button
            type="button"
            className={item}
            onClick={() => {
              close();
              navigate({ to: info.home as never });
            }}
          >
            <UserIcon aria-hidden className="h-4 w-4" />
            Account
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              close();
              navigate({ to: info.home as never });
            }}
          >
            <Bell aria-hidden className="h-4 w-4" />
            Notifications
          </button>
          <button
            type="button"
            className={cn(item, "text-danger")}
            onClick={() => {
              close();
              auth.logout();
              navigate({ to: "/" });
            }}
          >
            <LogOut aria-hidden className="h-4 w-4" />
            Log out
          </button>
        </>
      )}
    </Popover>
  );
}

/* --------------------------------------------------------------- header */

const NAV = [
  { to: "/cars", label: "Browse cars" },
  { to: "/#how-it-works", label: "How it works" },
  { to: "/#calculator", label: "What you earn" },
  { to: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const role = user?.role ?? null;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const close = () => setOpen(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-ink/[0.08] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 md:h-[72px] md:px-6 lg:px-8">
          <Logo />
          <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
            {NAV.map((n) => {
              const active = !n.to.includes("#") && pathname.startsWith(n.to);
              return (
                <AppLink
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-ink/5 hover:text-ink",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  {n.label}
                </AppLink>
              );
            })}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <ThemeMenu />
            {role ? (
              <>
                <ButtonLink
                  to={PORTAL[role].home}
                  size="sm"
                  rightIcon={<ArrowRight aria-hidden className="h-4 w-4" />}
                >
                  My {PORTAL[role].label.toLowerCase()} portal
                </ButtonLink>
                <AccountMenu role={role} />
              </>
            ) : (
              <>
                <ButtonLink to="/auth/login" variant="ghost" size="sm">
                  Log in
                </ButtonLink>
                <ButtonLink to="/auth/signup" size="sm">
                  Get started
                </ButtonLink>
              </>
            )}
          </div>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="ml-auto rounded-xl p-2 hover:bg-ink/5 md:hidden"
          >
            <Menu aria-hidden className="h-6 w-6" />
          </button>
        </div>
      </header>
      <Sheet open={open} onClose={close} title="Menu">
        <nav aria-label="Menu" className="flex flex-col gap-1">
          {NAV.map((n) => (
            <AppLink
              key={n.to}
              to={n.to}
              onClick={close}
              className="rounded-xl px-3 py-3 text-[15px] font-semibold hover:bg-ink/5"
            >
              {n.label}
            </AppLink>
          ))}
          {role ? (
            <ButtonLink to={PORTAL[role].home} fullWidth className="mt-3" onClick={close}>
              My {PORTAL[role].label.toLowerCase()} portal
            </ButtonLink>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <ButtonLink to="/auth/signup" fullWidth onClick={close}>
                Get started
              </ButtonLink>
              <ButtonLink to="/auth/login" variant="secondary" fullWidth onClick={close}>
                Log in
              </ButtonLink>
            </div>
          )}
        </nav>
      </Sheet>
    </>
  );
}

/* --------------------------------------------------------------- footer */

const FOOTER = [
  {
    title: "Product",
    links: [
      ["Browse cars", "/cars"],
      ["How it works", "/#how-it-works"],
      ["Sell your car", "/auth/signup"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "#"],
      ["Careers", "#"],
      ["Contact", "#"],
    ],
  },
  {
    title: "Help",
    links: [
      ["FAQ", "/#faq"],
      ["Terms", "#"],
      ["Privacy", "#"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-6 lg:px-8">
        <div>
          <Logo inverted />
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/60">
            Sell your car on monthly payments to a verified buyer. You stay on the title until it’s paid off.
          </p>
        </div>
        {FOOTER.map((col) => (
          <div key={col.title}>
            <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.1em] text-white/40">
              {col.title}
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {col.links.map(([label, to]) => (
                <li key={label}>
                  <AppLink to={to} className="text-white/75 transition-colors hover:text-white">
                    {label}
                  </AppLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-white/50 md:px-6 lg:px-8">
          © 2026 OwnerFi · Demo build, no real money moves.
        </p>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------- page layout */

/** Public page frame: header, main, footer, demo toolbar. */
export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SkipLink />
      <OfflineBanner />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <DemoToolbar />
    </div>
  );
}

const ASIDE_POINTS = [
  { icon: ShieldCheck, text: "Every buyer and seller is verified" },
  { icon: FileCheck2, text: "Title and theft checks before a car is listed" },
  { icon: Wallet, text: "OwnerFi never holds your money" },
];

/** Split layout for /auth/* pages: form card on the left, brand panel on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <SkipLink />
      <div className="flex flex-1 flex-col">
        <OfflineBanner />
        <div className="px-4 py-5 md:px-10 md:py-7">
          <Logo />
        </div>
        <main
          id="main"
          className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-4 pb-10 md:px-0"
        >
          <div className="-mx-4 md:mx-0 md:rounded-3xl md:border md:border-ink/[0.08] md:bg-white md:shadow-raised">
            {children}
          </div>
        </main>
      </div>
      <aside className="relative overflow-hidden bg-ink bg-brand-glow px-6 py-10 text-white lg:flex lg:w-[44%] lg:items-center lg:px-14">
        <div className="relative mx-auto max-w-md">
          <p className="eyebrow text-sky">Seller financing, done safely</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight lg:text-[44px] lg:leading-[1.05]">
            Sell your car.
            <br />
            <span className="text-sky">Be the bank.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {ASIDE_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/85">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] ring-1 ring-white/10">
                  <Icon aria-hidden className="h-5 w-5 text-sky" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <DemoToolbar />
    </div>
  );
}

export { PORTAL };
