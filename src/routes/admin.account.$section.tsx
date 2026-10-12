import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/app/Account";

export const Route = createFileRoute("/admin/account/$section")({
  head: () => ({ meta: [{ title: "Account · Admin · OwnerFi" }] }),
  component: function AdminAccount() {
    const { section } = Route.useParams();
    return <AccountPage role="admin" section={section} />;
  },
});
