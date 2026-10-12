import { Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { isToday } from "date-fns/isToday";
import { isYesterday } from "date-fns/isYesterday";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Bell,
  BellRing,
  CalendarDays,
  Car,
  CheckCheck,
  CreditCard,
  Handshake,
  Heart,
  Home,
  Inbox,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  User as UserIcon,
  Mail,
} from "lucide-react";
import { useUnreadCount } from "@/components/app/Inbox";
import { Alert, AppLink, Avatar, Button, ButtonLink, Modal, Popover, Sheet, useToast } from "@/components/kit";
import { DemoToolbar } from "@/components/site/DemoToolbar";
import { Logo, OfflineBanner, SkipLink, ThemeMenu } from "@/components/site/SiteChrome";
import { useAuth } from "@/lib/auth-store";
import type { Role } from "@/lib/demo-data";
import { useNotices, type Notice } from "@/lib/notifications";
import { PORTAL } from "@/lib/portal";
import { VerifyCode } from "@/components/auth/VerifyCode";
import { auth, useCurrentUser, useSessionReady } from "@/lib/session";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------- nav items */

export type NavItem = { to: string; label: string; icon: typeof Home; mobileTab?: boolean; badge?: number };

export const SELLER_NAV: NavItem[] = [
  { to: "/seller", label: "Home", icon: Home, mobileTab: true },
  { to: "/seller/vehicles", label: "Vehicles", icon: Car, mobileTab: true },
  { to: "/seller/inbox", label: "Inbox", icon: Inbox, mobileTab: true },
  { to: "/seller/deals", label: "Deals", icon: Handshake, mobileTab: true },
  { to: "/seller/test-drives", label: "Test drives", icon: CalendarDays },
  { to: "/seller/payments", label: "Payments", icon: CreditCard },
];

export const BUYER_NAV: NavItem[] = [
  { to: "/buyer", label: "Home", icon: Home, mobileTab: true },
  { to: "/cars", label: "Browse", icon: Search, mobileTab: true },
  // CEO approved the build's sidebar (ADD-01): Saved is the 3rd item, then Inbox, Deals, Test drives, Payments.
  { to: "/buyer/saved", label: "Saved", icon: Heart },
  { to: "/buyer/inbox", label: "Inbox", icon: Inbox, mobileTab: true },
  { to: "/buyer/deals", label: "Deals", icon: Handshake, mobileTab: true },
  { to: "/buyer/test-drives", label: "Test drives", icon: CalendarDays },
  { to: "/buyer/payments", label: "Payments", icon: CreditCard },
];

const navFor = (role: "seller" | "buyer") => (role === "seller" ? SELLER_NAV : BUYER_NAV);

function useActive(to: string, end: boolean) {
  const path = useRouterState({ select: (st) => st.location.pathname });
  return end ? path === to : path === to || path.startsWith(`${to}/`);
}

function Badge({ count, dark }: { count?: number | undefined; dark?: boolean | undefined }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} unread`}
      className={cn(
        "num ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold",
        dark ? "bg-cta text-cta-fg" : "bg-primary text-white",
      )}
    >
      {count}
    </span>
  );
}

export function NavList({
  items,
  label,
  dark,
  onNavigate,
}: {
  items: NavItem[];
  label: string;
  dark?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-0.5">
      {items.map((it) => (
        <NavLink key={it.to} item={it} dark={dark} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

function NavLink({ item, dark, onNavigate }: { item: NavItem; dark?: boolean | undefined; onNavigate?: (() => void) | undefined }) {
  const end = ["/seller", "/buyer", "/admin"].includes(item.to);
  const active = useActive(item.to, end);
  const Icon = item.icon;
  return (
    <AppLink
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 font-medium transition-colors",
        dark ? "h-9 text-[13.5px]" : "h-11 text-[15px]",
        dark
          ? active
            ? "bg-white/10 text-white"
            : "text-white/65 hover:bg-white/[0.06] hover:text-white"
          : active
            ? "bg-primary-50 text-primary-700"
            : "text-ink hover:bg-ink/5",
      )}
    >
      <Icon
        aria-hidden
        className={cn("h-[18px] w-[18px] shrink-0", dark ? (active ? "text-sky" : "text-white/50") : "text-current")}
      />
      {item.label}
      <Badge count={item.badge} dark={dark} />
    </AppLink>
  );
}

/* -------------------------------------------------------------- mobile bar */

function MobileTabs({ items, onMore }: { items: NavItem[]; onMore: () => void }) {
  const base = "group flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold";
  const pill = "flex h-8 w-14 items-center justify-center rounded-full transition-colors";
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink/[0.08] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {items.map((it) => {
        const end = ["/seller", "/buyer"].includes(it.to);
        return <MobileTab key={it.to} item={it} end={end} base={base} pill={pill} />;
      })}
      <button type="button" onClick={onMore} className={cn(base, "text-muted")}>
        <span className={pill}>
          <MoreHorizontal aria-hidden className="h-5 w-5" />
        </span>
        More
      </button>
    </nav>
  );
}

function MobileTab({ item, end, base, pill }: { item: NavItem; end: boolean; base: string; pill: string }) {
  const active = useActive(item.to, end);
  const Icon = item.icon;
  return (
    <AppLink to={item.to} className={cn(base, active ? "text-primary-700" : "text-muted")}>
      <span className={cn(pill, "relative", active && "bg-primary-50")}>
        <Icon aria-hidden className="h-5 w-5" />
        {!!item.badge && (
          <span className="absolute -top-1 right-1.5">
            <Badge count={item.badge} />
          </span>
        )}
      </span>
      {item.label}
    </AppLink>
  );
}

function MoreSheet({
  open,
  onClose,
  role,
  items,
}: {
  open: boolean;
  onClose: () => void;
  role: "seller" | "buyer";
  items: NavItem[];
}) {
  const navigate = useNavigate();
  const all: NavItem[] = [
    ...items,
    { to: `/${role}/notifications`, label: "Notifications", icon: Bell },
    { to: `/${role}/account/profile`, label: "Account", icon: UserIcon },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="More">
      <NavList label="More" items={all} onNavigate={onClose} />
      <button
        type="button"
        onClick={() => {
          onClose();
          auth.logout();
          navigate({ to: "/" });
        }}
        className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-ink/5"
      >
        <LogOut aria-hidden className="h-5 w-5" />
        Log out
      </button>
    </Sheet>
  );
}

/* ----------------------------------------------------------- notifications */

const iconFor = (href: string) =>
  href.includes("/deals") ? Handshake : href.includes("/inbox") ? Inbox : href.includes("/test-drives") ? CalendarDays : href.includes("/payments") ? CreditCard : href.includes("/vehicles") ? Car : href.includes("/verif") ? ShieldCheck : Bell;

export function groupByDay(items: Notice[]) {
  const groups = [
    { label: "Today", items: [] as Notice[] },
    { label: "Yesterday", items: [] as Notice[] },
    { label: "Earlier", items: [] as Notice[] },
  ];
  for (const n of items) {
    const d = new Date(n.at);
    groups[isToday(d) ? 0 : isYesterday(d) ? 1 : 2]!.items.push(n);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function NoticeRow({
  n,
  compact,
  onOpen,
  onToggle,
}: {
  n: Notice;
  compact?: boolean;
  onOpen: (n: Notice) => void;
  onToggle?: (n: Notice) => void;
}) {
  const Icon = iconFor(n.href);
  return (
    <li className="flex items-stretch">
      <button
        type="button"
        onClick={() => onOpen(n)}
        className="flex min-h-16 min-w-0 flex-1 items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon aria-hidden className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn("truncate", n.read ? "font-medium" : "font-bold")}>{n.title}</span>
            {!n.read && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
          </span>
          {!compact && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{n.body}</span>}
          <span className="mt-0.5 block text-xs text-muted">
            {formatDistanceToNow(new Date(n.at), { addSuffix: true })}
          </span>
        </span>
      </button>
      {onToggle && (
        <button
          type="button"
          onClick={() => onToggle(n)}
          aria-label={n.read ? "Mark as unread" : "Mark as read"}
          title={n.read ? "Mark as unread" : "Mark as read"}
          className="my-auto ml-1 rounded-lg p-2 text-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {n.read ? <Mail aria-hidden className="h-4 w-4" /> : <CheckCheck aria-hidden className="h-4 w-4" />}
        </button>
      )}
    </li>
  );
}

function NoticeMenu({ role, userId }: { role: Role; userId: string }) {
  const navigate = useNavigate();
  const { items, unread, markRead } = useNotices(userId);
  // Buyers and sellers: the bell goes straight to the notification center. Admins get the quick list.
  if (role !== "admin") {
    return (
      <AppLink
        to={`/${role}/notifications`}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Bell aria-hidden className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </AppLink>
    );
  }
  return (
    <Popover
      align="right"
      className="-mr-14 w-[calc(100vw-2rem)] max-w-96 p-2 sm:mr-0"
      trigger={({ props, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          {...props}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Bell aria-hidden className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-white ring-2 ring-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <div className="-m-2">
          <div className="flex items-center justify-between px-3 py-2">
            <h2 className="font-sans font-semibold tracking-normal">Notifications</h2>
            <button
              type="button"
              disabled={unread === 0}
              onClick={() => markRead()}
              className="text-sm font-medium text-primary disabled:text-muted"
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">You’re all caught up.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.slice(0, 5).map((n) => (
                <NoticeRow
                  key={n.id}
                  n={n}
                  compact
                  onOpen={(x) => {
                    markRead(x.id);
                    close();
                    navigate({ to: x.href as never });
                  }}
                />
              ))}
            </ul>
          )}
          <AppLink
            to={`/${role}/notifications`}
            onClick={close}
            className="block border-t border-ink/10 px-3 py-3 text-center text-sm font-medium text-primary hover:bg-surface"
          >
            See all notifications
          </AppLink>
        </div>
      )}
    </Popover>
  );
}

/* -------------------------------------------------------------- top bar etc */

function AccountDropdown({ role }: { role: Role }) {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const info = PORTAL[role];
  // Accounts that hold both roles can flip between the seller and buyer side without logging out.
  const otherRole: Role | undefined = (user?.roles ?? []).find((r) => r !== role && r !== "admin");
  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-ink/5";
  const go = (to: string, close: () => void) => () => {
    close();
    navigate({ to: to as never });
  };
  return (
    <Popover
      align="right"
      className="w-56 p-1.5"
      trigger={({ props, toggle }) => (
        <button type="button" onClick={toggle} {...props} aria-label={`Account menu for ${user?.name ?? info.full}`} className="rounded-full">
          <Avatar name={user?.name ?? info.full} size="sm" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          {otherRole && (
            <button
              type="button"
              className={item}
              onClick={() => {
                close();
                if (auth.switchRole(otherRole)) navigate({ to: PORTAL[otherRole].home as never });
              }}
            >
              <ArrowLeftRight aria-hidden className="h-4 w-4" /> Switch to {otherRole === "seller" ? "Seller" : "Buyer"}
            </button>
          )}
          <button type="button" className={item} onClick={go(`/${role}/account/profile`, close)}>
            <UserIcon aria-hidden className="h-4 w-4" /> Account
          </button>
          <button type="button" className={item} onClick={go(`/${role}/notifications`, close)}>
            <Bell aria-hidden className="h-4 w-4" /> Notifications
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
            <LogOut aria-hidden className="h-4 w-4" /> Log out
          </button>
        </>
      )}
    </Popover>
  );
}

export function TopBar({
  role,
  userId,
  placeholder,
  onSearch,
  onMenu,
}: {
  role: Role;
  userId: string;
  placeholder: string;
  onSearch?: (q: string) => void;
  onMenu?: () => void;
}) {
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink/[0.08] bg-white/90 px-4 backdrop-blur-md md:px-6 lg:px-8">
      {onMenu && (
        <button type="button" aria-label="Open menu" onClick={onMenu} className="rounded-xl p-2 text-ink hover:bg-ink/5 lg:hidden">
          <Menu aria-hidden className="h-5 w-5" />
        </button>
      )}
      <Logo to={`/${role}`} size="sm" className="lg:hidden" />
      {onSearch && (
        <form
          role="search"
          className="relative hidden w-full max-w-md md:block"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(q.trim());
          }}
        >
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            aria-label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-10 w-full rounded-xl border border-transparent bg-surface pl-9 pr-3 text-sm placeholder:text-muted/80 hover:border-ink/10 focus-visible:border-primary focus-visible:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          />
        </form>
      )}
      <div className="ml-auto flex items-center gap-1">
        <ThemeMenu />
        <NoticeMenu role={role} userId={userId} />
        <span className="ml-1">
          <AccountDropdown role={role} />
        </span>
      </div>
    </header>
  );
}

export function Sidebar({
  homeTo,
  portal,
  cta,
  children,
  user,
}: {
  homeTo: string;
  portal: string;
  cta?: ReactNode;
  children: ReactNode;
  user: { name: string; detail: string; to: string };
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-ink text-white lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <Logo to={homeTo} inverted size="sm" />
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/70">
          {portal}
        </span>
      </div>
      {cta && <div className="px-4 pb-2 pt-1">{cta}</div>}
      <div className="flex-1 overflow-y-auto px-3 pb-6 pt-3">{children}</div>
      <AppLink
        to={user.to}
        className="m-3 flex items-center gap-3 rounded-xl bg-white/[0.05] p-2.5 ring-1 ring-white/10 transition-colors hover:bg-white/10"
      >
        <Avatar name={user.name} size="sm" className="!bg-white/15 !text-white" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-white/55">{user.detail}</span>
        </span>
      </AppLink>
    </aside>
  );
}

function VerifyEmailModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const user = useCurrentUser();
  // Sends the code when the dialog opens.
  const [sent, setSent] = useState(false);
  const userId = user?.id;
  // In an effect, not during render: sending the code updates the session store, which can't happen mid-render.
  useEffect(() => {
    if (open && !sent && userId) {
      setSent(true);
      auth.startEmailVerify(userId);
    }
  }, [open, sent, userId]);
  return (
    <Modal
      open={open}
      onClose={() => {
        auth.cancelPending();
        setSent(false);
        onClose();
      }}
      title="Verify your email"
      size="sm"
    >
      <VerifyCode
        mode="verify"
        onVerified={() => {
          setSent(false);
          onClose();
          toast({ tone: "success", title: "Email verified" });
        }}
      />
    </Modal>
  );
}

/* ------------------------------------------------------------------ layout */

export function PortalFrame({ role, children }: { role: "seller" | "buyer"; children: ReactNode }) {
  const [more, setMore] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  // Other screens (like the inbox) can ask for the email check to open.
  useEffect(() => {
    const open = () => setVerifyOpen(true);
    window.addEventListener("ownerfi:verify-email", open);
    return () => window.removeEventListener("ownerfi:verify-email", open);
  }, []);
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { items: notices } = useNotices(user?.id);
  const verification = user?.verification;
  const verified = !!verification && Object.values(verification).every((v) => v === "verified");
  const unverifiedEmail = user && !user.emailVerified ? user : undefined;
  const nav = navFor(role);
  const unreadMsgs = useUnreadCount(role);
  const items = nav.map((n) => (n.to.endsWith("/inbox") ? { ...n, badge: unreadMsgs } : n));
  const you: NavItem[] = [
    { to: `/${role}/notifications`, label: "Notifications", icon: BellRing },
    { to: `/${role}/account/profile`, label: "Account", icon: UserIcon },
  ];
  void notices;
  const label = PORTAL[role].label;

  return (
    <div className="min-h-screen">
      <SkipLink />
      <Sidebar
        homeTo={`/${role}`}
        portal={label}
        cta={
          role === "seller" ? (
            <ButtonLink
              to="/seller/vehicles/new"
              variant="accent"
              fullWidth
              size="sm"
              leftIcon={<Plus aria-hidden className="h-4 w-4" />}
            >
              Add a car
            </ButtonLink>
          ) : undefined
        }
        user={{
          name: user?.name ?? label,
          detail: `${label} · ${verified ? "Verified" : "Not verified yet"}`,
          to: `/${role}/account/profile`,
        }}
      >
        <NavList label={`${role} navigation`} items={items} dark />
        <p className="mb-1.5 mt-6 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/35">You</p>
        <NavList label="Your account" items={you} dark />
      </Sidebar>
      <div className="lg:pl-64">
        <OfflineBanner />
        <TopBar
          role={role}
          userId={user?.id ?? ""}
          placeholder="Search cars by make, model or city"
          onSearch={(q) => navigate({ to: "/cars", search: (q ? { q } : {}) as never })}
        />
        <main id="main" className="mx-auto max-w-[1320px] px-4 pb-28 pt-6 md:px-8 md:pt-8 lg:pb-16">
          {unverifiedEmail && (
            <Alert
              tone="warning"
              className="mb-4"
              action={
                <Button variant="secondary" size="sm" className="self-center" onClick={() => setVerifyOpen(true)}>
                  Verify email
                </Button>
              }
            >
              Verify your email to message sellers.
            </Alert>
          )}
          {unverifiedEmail && <VerifyEmailModal open={verifyOpen} onClose={() => setVerifyOpen(false)} />}
          {!verified && !unverifiedEmail && (
            <Alert
              tone="warning"
              className="mb-4"
              action={
                <AppLink
                  to={role === "seller" ? "/seller/onboarding" : "/buyer/account/verification"}
                  className={cn(
                    "inline-flex h-9 select-none items-center justify-center self-center whitespace-nowrap rounded-xl border border-ink/15 bg-white px-3.5 text-sm font-semibold text-ink shadow-card hover:bg-surface",
                  )}
                >
                  Verify now
                </AppLink>
              }
            >
              Finish verification to unlock this part of OwnerFi.
            </Alert>
          )}
          {children}
        </main>
      </div>
      <MobileTabs items={items.filter((i) => i.mobileTab)} onMore={() => setMore(true)} />
      <MoreSheet open={more} onClose={() => setMore(false)} role={role} items={items.filter((i) => !i.mobileTab)} />
      <DemoToolbar />
    </div>
  );
}

/** Route guard + shell for /seller/* and /buyer/*. Wrong-role visitors land on /no-access. */
export function PortalLayout({ role }: { role: "seller" | "buyer" }) {
  const ready = useSessionReady();
  const user = useCurrentUser();
  const href = useRouterState({ select: (st) => st.location.href });
  const navigate = useNavigate();
  const signedOut = ready && !user;
  // One redirect to login. A <Navigate search={{ next }}> here fires again on every re-render (its props are a new
  // object each time), so the page loops and freezes.
  useEffect(() => {
    if (signedOut) navigate({ to: "/auth/login", search: { next: href }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedOut]);
  if (!ready || !user) return <div aria-busy="true" className="min-h-screen bg-surface" />;
  // An account that holds both roles can be on either side (the avatar menu switches between them).
  if (!(user.roles ?? [user.role]).includes(role)) return <Navigate to="/no-access" replace />;
  return (
    <PortalFrame role={role}>
      <Outlet />
    </PortalFrame>
  );
}
