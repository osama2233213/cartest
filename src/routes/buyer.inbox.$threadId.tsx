import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/components/app/Inbox";

export const Route = createFileRoute("/buyer/inbox/$threadId")({
  head: () => ({ meta: [{ title: "Messages · OwnerFi" }] }),
  component: function BuyerThread() {
    const { threadId } = Route.useParams();
    return <InboxPage role="buyer" threadId={threadId} />;
  },
});
