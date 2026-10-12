import { Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Archive,
  Bell,
  CalendarDays,
  Car,
  CreditCard,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  TrendingUp,
  User as UserIcon,
  Users,
} from "lucide-react";
import { NavList, Sidebar, TopBar, type NavItem } from "@/components/app/PortalShell";
import { Sheet } from "@/components/kit";
import { DemoToolbar } from "@/components/site/DemoToolbar";
import { OfflineBanner, SkipLink } from "@/components/site/SiteChrome";
import { useAdminStore } from "@/lib/admin-data";
import { auth, useCurrentUser, useSessionReady } from "@/lib/session";

type Group = { label: string; items: NavItem[] };

const GROUPS: Group[] = [
  { label: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Review",
    items: [
      { to: "/admin/verifications", label: "Verifications", icon: ShieldCheck },
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/vehicles", label: "Vehicles", icon: Car },
    ],
  },
  {
    label: "Deals",
    items: [
      { to: "/admin/deals", label: "Deals", icon: Handshake },
      { to: "/admin/test-drives", label: "Test drives", icon: CalendarDays },
      { to: "/admin/closed-deals", label: "Closed deals", icon: Archive },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/admin/revenue", label: "Revenue", icon: TrendingUp },
      { to: "/admin/payments", label: "Payments", icon: CreditCard },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/admin/advertising", label: "Advertising", icon: Megaphone },
      { to: "/admin/integrations", label: "Integrations", icon: Plug },
      { to: "/admin/support", label: "Support", icon: LifeBuoy },
      { to: "/admin/audit-log", label: "Audit log", icon: ScrollText },
      { to: "/admin/settings/fees", label: "Settings", icon: Settings },
    ],
  },
];

const YOU: NavItem[] = [
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/account/profile", label: "Account", icon: UserIcon },
];

function Groups({ onNavigate, badges }: { onNavigate?: () => void; badges: Record<string, number> }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      {GROUPS.map((g, i) => (
        <div key={g.label} className={i === 0 ? undefined : "mt-5"}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/35">{g.label}</p>
          <NavList
            label={g.label}
            dark
            {...(onNavigate ? { onNavigate } : {})}
            items={g.items.map((it) => ({ ...it, badge: badges[it.to] ?? 0 }))}
          />
        </div>
      ))}
      <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/35">You</p>
      <NavList label="Your account" dark items={YOU} {...(onNavigate ? { onNavigate } : {})} />
      <span hidden>{path}</span>
    </>
  );
}

export function AdminFrame({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const user = useCurrentUser();
  const s = useAdminStore();
  const badges = { "/admin/verifications": s.queue.filter((q) => q.status === "in_review").length };

  return (
    <div className="min-h-screen">
      <SkipLink />
      <Sidebar homeTo="/admin" portal="Admin" user={{ name: user?.name ?? "Admin", detail: "Admin · 2-step on", to: "/admin/account/profile" }}>
        <Groups badges={badges} />
      </Sidebar>
      <div className="lg:pl-64">
        <OfflineBanner />
        <TopBar
          role="admin"
          userId={user?.id ?? ""}
          placeholder="Search people by name, email or state"
          onMenu={() => setMenu(true)}
          onSearch={(q) => navigate({ to: "/admin/users", search: (q ? { q } : {}) as never })}
        />
        <main id="main" className="px-4 pb-16 pt-6 md:px-8 md:pt-8">
          {children}
        </main>
      </div>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Menu">
        <Groups badges={badges} onNavigate={() => setMenu(false)} />
        <button
          type="button"
          onClick={() => {
            setMenu(false);
            auth.logout();
            navigate({ to: "/" });
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-ink/5"
        >
          <LogOut aria-hidden className="h-5 w-5" />
          Log out
        </button>
      </Sheet>
      <DemoToolbar />
    </div>
  );
}

/** Route guard + shell for /admin/*. Wrong-role visitors land on /no-access. */
export function AdminLayout() {
  const ready = useSessionReady();
  const user = useCurrentUser();
  const href = useRouterState({ select: (st) => st.location.href });
  if (!ready) return <div aria-busy="true" className="min-h-screen bg-surface" />;
  if (!user) return <Navigate to="/auth/login" search={{ next: href }} replace />;
  if (user.role !== "admin") return <Navigate to="/no-access" replace />;
  return (
    <AdminFrame>
      <Outlet />
    </AdminFrame>
  );
}
