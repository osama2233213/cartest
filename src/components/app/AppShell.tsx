import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Eye, LogOut } from "lucide-react";
import { Logo } from "@/components/site/SiteChrome";
import { AdminFrame } from "@/components/admin/AdminShell";
import { PortalFrame } from "@/components/app/PortalShell";
import { PERSONAS, STAGE_LABEL, type Role, type Stage } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

import { RotateCcw } from "lucide-react";
import { useDemoStore } from "@/lib/demo-store";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

export function DemoBar({ role }: { role: Role }) {
  const { resetDemo } = useDemoStore();
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const handleReset = () => {
    resetDemo();
    toast.success("Demo state reset to initial seed data");
  };

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
    toast.success("Logged out");
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 bg-ink px-3 py-2 text-xs text-primary-foreground">
      <Eye className="size-3.5 opacity-70" />
      <span className="opacity-70">Demo mode — explore as:</span>
      {(["seller", "buyer", "admin"] as Role[]).map((r) => (
        <Link
          key={r}
          to={r === "seller" ? "/seller" : r === "buyer" ? "/buyer" : "/admin"}
          onClick={() => login(r)}
          className={cn(
            "rounded-full px-3 py-1 font-semibold transition-colors",
            r === role ? "bg-primary" : "bg-primary-foreground/10 hover:bg-primary-foreground/20",
          )}
        >
          {PERSONAS[r].name} · {PERSONAS[r].label}
        </Link>
      ))}
      <span className="mx-1 opacity-30">|</span>
      <button
        onClick={handleReset}
        title="Reset all demo deals and vehicles to initial state"
        className="flex items-center gap-1 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-medium text-primary-foreground/80 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors"
      >
        <RotateCcw className="size-3" />
        Reset demo
      </button>
      <button
        onClick={handleLogout}
        title="Log out and return to the landing page"
        className="flex items-center gap-1 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-medium text-primary-foreground/80 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors"
      >
        <LogOut className="size-3" />
        Log out
      </button>
    </div>
  );
}

export function AppShell({ role, children }: { role: Role; children: ReactNode; nav?: ReactNode }) {
  if (role === "admin") return <AdminFrame>{children}</AdminFrame>;
  return <PortalFrame role={role}>{children}</PortalFrame>;
}

export function StageChip({ stage }: { stage: Stage }) {
  const tone =
    stage === "declined" || stage === "cancelled" || stage === "defaulted"
      ? "bg-danger/10 text-danger"
      : stage === "active" || stage === "paid_off"
        ? "bg-success/10 text-success"
        : "bg-primary/10 text-primary";
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>{STAGE_LABEL[stage]}</span>;
}

export function StatCard({ k, v, sub, icon }: { k: string; v: string; sub?: string; icon?: ReactNode }) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{k}</p>
        {icon && <div>{icon}</div>}
      </div>
      <p className="money mt-1 text-2xl font-bold text-ink">{v}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
