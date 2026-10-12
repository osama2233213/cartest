import { Navigate, createFileRoute } from "@tanstack/react-router";

// The Deal Room lives at /deals/:id for everyone.
export const Route = createFileRoute("/seller/deals/$dealId/")({
  component: function SellerDealRedirect() {
    const { dealId } = Route.useParams();
    return <Navigate to="/deals/$id" params={{ id: dealId }} search={{ as: "seller" } as never} replace />;
  },
});
