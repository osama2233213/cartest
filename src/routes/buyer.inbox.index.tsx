import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/components/app/Inbox";

export const Route = createFileRoute("/buyer/inbox/")({
  head: () => ({ meta: [{ title: "Messages · OwnerFi" }] }),
  component: () => <InboxPage role="buyer" />,
});
