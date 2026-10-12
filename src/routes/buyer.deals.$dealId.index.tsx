import { Navigate, createFileRoute } from "@tanstack/react-router";

// The Deal Room lives at /deals/:id for everyone.
export const Route = createFileRoute("/buyer/deals/$dealId/")({
  component: function BuyerDealRedirect() {
    const { dealId } = Route.useParams();
    return <Navigate to="/deals/$id" params={{ id: dealId }} search={{ as: "buyer" } as never} replace />;
  },
});
