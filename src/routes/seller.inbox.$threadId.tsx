import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/components/app/Inbox";

export const Route = createFileRoute("/seller/inbox/$threadId")({
  head: () => ({ meta: [{ title: "Messages · OwnerFi" }] }),
  component: function SellerThread() {
    const { threadId } = Route.useParams();
    return <InboxPage role="seller" threadId={threadId} />;
  },
});
