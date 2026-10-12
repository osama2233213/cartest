import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/app/Account";

export const Route = createFileRoute("/buyer/account/$section")({
  head: () => ({ meta: [{ title: "Account · OwnerFi" }] }),
  component: function BuyerAccount() {
    const { section } = Route.useParams();
    return <AccountPage role="buyer" section={section} />;
  },
});
