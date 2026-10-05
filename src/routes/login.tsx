import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Car, ShieldCheck, User, Briefcase, LogIn, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { PERSONAS, type Role } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/SiteChrome";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — OwnerFi" },
      { name: "description", content: "Choose a demo persona to explore the OwnerFi platform as a seller, buyer, or admin." },
    ],
  }),
  component: LoginPage,
});

const ROLE_CARDS: {
  role: Role;
  icon: typeof Car;
  gradient: string;
  glow: string;
  desc: string;
  features: string[];
}[] = [
  {
    role: "seller",
    icon: Car,
    gradient: "from-violet-600 to-indigo-600",
    glow: "shadow-violet-500/25",
    desc: "List your car, set financing terms, and earn interest on monthly payments.",
    features: ["List vehicles", "Set price & APR", "Manage deals", "Collect payments"],
  },
  {
    role: "buyer",
    icon: User,
    gradient: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/25",
    desc: "Browse cars by monthly payment, apply for seller financing, and pay over time.",
    features: ["Browse listings", "Make offers", "Schedule test drives", "Pay monthly"],
  },
  {
    role: "admin",
    icon: Briefcase,
    gradient: "from-amber-500 to-orange-600",
    glow: "shadow-amber-500/25",
    desc: "Review verifications, monitor deals across all users, and track platform revenue.",
    features: ["Verification queue", "All deals overview", "Revenue analytics", "User management"],
  },
];

function LoginPage() {
  const { login, isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Role | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = (role: Role) => {
    setSelected(role);
    setIsLoggingIn(true);

    // Brief delay for visual feedback
    setTimeout(() => {
      login(role);
      const dest = role === "seller" ? "/seller" : role === "buyer" ? "/buyer" : "/admin";
      navigate({ to: dest });
    }, 600);
  };

  // If already logged in, show quick-switch or redirect option
  if (isLoggedIn && user && !isLoggingIn) {
    const dest = user.role === "seller" ? "/seller" : user.role === "buyer" ? "/buyer" : "/admin";
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
            <Logo />
          </div>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
          <div className="card-surface mx-auto max-w-md p-8 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="size-8" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-ink">Already logged in</h1>
            <p className="mt-2 text-muted-foreground">
              You're signed in as <span className="font-semibold text-ink">{user.name}</span> ({user.label})
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button size="lg" onClick={() => navigate({ to: dest })}>
                <ArrowRight className="size-4" />
                Go to {user.label} dashboard
              </Button>
              <p className="text-xs text-muted-foreground">Or switch to a different persona:</p>
              <div className="flex justify-center gap-2">
                {(["seller", "buyer", "admin"] as Role[])
                  .filter((r) => r !== user.role)
                  .map((r) => (
                    <Button key={r} variant="outline" size="sm" onClick={() => handleLogin(r)}>
                      {PERSONAS[r].label}
                    </Button>
                  ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Logo />
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center px-4 py-12 md:py-20">
        {/* Hero text */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-primary/10">
            <LogIn className="size-7 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-ink md:text-5xl">
            Choose your <span className="text-primary">persona</span>
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            This is a demo. Pick a role to explore every side of the OwnerFi platform — no sign-up required.
          </p>
        </div>

        {/* Role cards */}
        <div className="mt-12 grid w-full max-w-5xl gap-6 md:grid-cols-3">
          {ROLE_CARDS.map((card) => {
            const isActive = selected === card.role;
            const p = PERSONAS[card.role];
            return (
              <button
                key={card.role}
                onClick={() => handleLogin(card.role)}
                disabled={isLoggingIn}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 text-left transition-all duration-300",
                  "hover:border-transparent hover:shadow-xl",
                  isActive && `border-transparent shadow-2xl ${card.glow} scale-[1.02]`,
                  isLoggingIn && !isActive && "opacity-50 pointer-events-none",
                )}
              >
                {/* Gradient strip at top */}
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r transition-all duration-300",
                    card.gradient,
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                />

                {/* Icon + persona badge */}
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      "grid size-12 place-items-center rounded-xl bg-gradient-to-br text-white transition-transform duration-300 group-hover:scale-110",
                      card.gradient,
                    )}
                  >
                    <card.icon className="size-6" />
                  </div>
                  {isActive && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary animate-in fade-in zoom-in-75">
                      Logging in…
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 className="mt-5 text-xl font-bold text-ink">{p.label}</h2>
                <p className="mt-0.5 text-sm font-medium text-primary">{p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.email}</p>

                {/* Description */}
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>

                {/* Feature list */}
                <ul className="mt-4 flex-1 space-y-1.5">
                  {card.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-ink/80">
                      <ShieldCheck className="size-3.5 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div
                  className={cn(
                    "mt-6 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-300",
                    isActive
                      ? `bg-gradient-to-r ${card.gradient} text-white`
                      : "bg-surface text-ink group-hover:bg-gradient-to-r group-hover:" + card.gradient + " group-hover:text-white",
                  )}
                >
                  <ArrowRight className="size-4" />
                  Enter as {p.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="mt-10 text-center text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 inline size-3.5 text-success" />
          Demo mode — no real data, no real accounts. Switch roles anytime from the top bar.
        </p>
      </main>
    </div>
  );
}
