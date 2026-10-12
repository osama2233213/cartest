import { createFileRoute } from "@tanstack/react-router";
import { PortalLayout } from "@/components/app/PortalShell";

export const Route = createFileRoute("/buyer")({
  component: () => <PortalLayout role="buyer" />,
});
