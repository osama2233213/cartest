import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { VerifyCode } from "@/components/auth/VerifyCode";
import { afterLogin, useSession } from "@/lib/session";

export const Route = createFileRoute("/auth/2fa")({
  validateSearch: (s: Record<string, unknown>): { next?: string | undefined } =>
    typeof s["next"] === "string" ? { next: s["next"] } : {},
  head: () => ({ meta: [{ title: "Two-step check · OwnerFi" }] }),
  component: TwoFactorPage,
});

function TwoFactorPage() {
  const { next } = Route.useSearch();
  const { pending } = useSession();
  const navigate = useNavigate();
  if (!pending || pending.purpose !== "2fa") return <Navigate to="/auth/login" search={{}} replace />;
  return (
    <div className="p-5 md:p-8">
      <VerifyCode mode="2fa" onVerified={(r) => navigate({ to: afterLogin(r.role, { next }) as never, replace: true })} />
    </div>
  );
}
