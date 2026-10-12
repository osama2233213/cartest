import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/site/SiteChrome";

export const Route = createFileRoute("/auth")({
  component: () => (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  ),
});
