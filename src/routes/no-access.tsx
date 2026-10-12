import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button, ButtonLink, EmptyState } from "@/components/kit";
import { SiteLayout } from "@/components/site/SiteChrome";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/no-access")({
  head: () => ({ meta: [{ title: "No access · OwnerFi" }] }),
  component: NoAccess,
});

function NoAccess() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <SiteLayout>
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          headingLevel={1}
          icon={<ShieldAlert aria-hidden className="h-6 w-6" />}
          title="You don’t have access to this page"
          description={
            user
              ? `This area is for a different kind of account. You’re signed in as a ${user.role}.`
              : "Log in with the right account to see this page."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {user ? (
                <>
                  <ButtonLink to={`/${user.role}`}>Go to my portal</ButtonLink>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      logout();
                      navigate({ to: "/auth/login", search: {} });
                    }}
                  >
                    Switch account
                  </Button>
                </>
              ) : (
                <ButtonLink to="/auth/login">Log in</ButtonLink>
              )}
            </div>
          }
        />
      </div>
    </SiteLayout>
  );
}
