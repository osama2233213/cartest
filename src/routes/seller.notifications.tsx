import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/components/app/NotificationsPage";

export const Route = createFileRoute("/seller/notifications")({
  head: () => ({ meta: [{ title: "Notifications · OwnerFi" }] }),
  component: () => <NotificationsPage role="seller" />,
});
