import { createFileRoute } from "@tanstack/react-router";
import { DealsPage } from "@/components/app/DealsPage";

export const Route = createFileRoute("/buyer/deals/")({
  head: () => ({ meta: [{ title: "Deals · OwnerFi" }] }),
  component: () => <DealsPage role="buyer" />,
});
