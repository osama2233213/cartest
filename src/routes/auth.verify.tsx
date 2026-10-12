import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/kit";
import { VerifyCode } from "@/components/auth/VerifyCode";
import { afterLogin, auth, useSession } from "@/lib/session";

export const Route = createFileRoute("/auth/verify")({
  validateSearch: (s: Record<string, unknown>): { next?: string | undefined } =>
    typeof s["next"] === "string" ? { next: s["next"] } : {},
  head: () => ({ meta: [{ title: "Verify your email · OwnerFi" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const { next } = Route.useSearch();
  const { pending } = useSession();
  const navigate = useNavigate();
  if (!pending || pending.purpose === "2fa") return <Navigate to="/auth/login" search={{}} replace />;
  return (
    <div className="space-y-5 p-5 md:p-8">
      <VerifyCode mode="verify" onVerified={(r) => navigate({ to: afterLogin(r.role, { next }) as never, replace: true })} />
      <Button
        variant="secondary"
        fullWidth
        onClick={() => navigate({ to: afterLogin(auth.continueUnverified(), { next }) as never, replace: true })}
      >
        Verify later
      </Button>
      <p className="text-center text-sm text-muted">You can still look around. Some things stay locked until you verify.</p>
    </div>
  );
}
