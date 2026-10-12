import { createFileRoute } from "@tanstack/react-router";
import { PortalLayout } from "@/components/app/PortalShell";

export const Route = createFileRoute("/seller")({
  component: () => <PortalLayout role="seller" />,
});
