import { createFileRoute } from "@tanstack/react-router";
import { DealsPage } from "@/components/app/DealsPage";

export const Route = createFileRoute("/seller/deals/")({
  head: () => ({ meta: [{ title: "Deals · OwnerFi" }] }),
  component: () => <DealsPage role="seller" />,
});
