import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/app/Account";

export const Route = createFileRoute("/seller/account/$section")({
  head: () => ({ meta: [{ title: "Account · OwnerFi" }] }),
  component: function SellerAccount() {
    const { section } = Route.useParams();
    return <AccountPage role="seller" section={section} />;
  },
});
