import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/components/app/Inbox";

export const Route = createFileRoute("/seller/inbox/")({
  head: () => ({ meta: [{ title: "Messages · OwnerFi" }] }),
  component: () => <InboxPage role="seller" />,
});
