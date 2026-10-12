import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppLink } from "@/components/kit";
import { IdentityFlow } from "@/components/app/IdentityFlow";

export const Route = createFileRoute("/seller/onboarding/identity")({
  head: () => ({ meta: [{ title: "Verify your identity · OwnerFi" }] }),
  component: () => (
    <div className="mx-auto max-w-xl">
      <AppLink to="/seller/onboarding" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to checklist
      </AppLink>
      <h1 className="text-[28px] font-bold leading-9">Verify your identity</h1>
      <p className="mb-6 mt-1 text-muted">Buyers trust sellers who are real. We check your ID once.</p>
      <IdentityFlow next={{ label: "Set up payouts", to: "/seller/onboarding/payouts" }} backTo={{ label: "Back to checklist", to: "/seller/onboarding" }} />
    </div>
  ),
});
