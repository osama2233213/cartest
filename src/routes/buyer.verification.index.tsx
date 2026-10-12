import { Navigate, createFileRoute } from "@tanstack/react-router";
import { nextVerifyStep } from "@/lib/buyer-data";
import { useCurrentUser } from "@/lib/session";

export const Route = createFileRoute("/buyer/verification/")({
  component: function VerificationIndex() {
    const user = useCurrentUser();
    if (!user) return null;
    const s = nextVerifyStep(user);
    return <Navigate to="/buyer/verification/$step" params={{ step: s }} replace />;
  },
});
