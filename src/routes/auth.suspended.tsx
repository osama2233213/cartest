import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { ButtonLink } from "@/components/kit";

export const Route = createFileRoute("/auth/suspended")({
  head: () => ({ meta: [{ title: "Account on hold · OwnerFi" }] }),
  component: () => (
    <div className="flex flex-col items-center px-5 py-10 text-center md:px-8">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <Lock aria-hidden className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-[28px] font-bold leading-9">Your account is on hold</h1>
      <p className="mt-2 text-muted">Contact support to find out why and how to get back in.</p>
      <a href="mailto:support@ownerfi.example" className="mt-4 font-medium text-primary hover:underline">
        support@ownerfi.example
      </a>
      <ButtonLink to="/auth/login" variant="secondary" className="mt-6">
        Back to log in
      </ButtonLink>
    </div>
  ),
});
