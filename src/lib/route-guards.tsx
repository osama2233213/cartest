import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "./auth-store";
import type { Role } from "./demo-data";

/**
 * Hook to protect routes that require authentication
 * Redirects to /login if not authenticated
 */
export function useRequireAuth(requiredRole?: Role) {
  const { isLoggedIn, user, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      navigate({ to: "/auth/login", search: {} });
    } else if (requiredRole && user?.role !== requiredRole) {
      // Redirect to their appropriate dashboard if they try to access wrong role
      const dest = user?.role === "seller" ? "/seller" : user?.role === "buyer" ? "/buyer" : "/admin";
      navigate({ to: dest });
    }
  }, [ready, isLoggedIn, user, requiredRole, navigate]);

  return { isLoggedIn, user };
}

/**
 * Hook to redirect logged-in users away from public-only pages (like login)
 */
export function useRedirectIfAuthenticated() {
  const { isLoggedIn, user, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && isLoggedIn && user) {
      const dest = user.role === "seller" ? "/seller" : user.role === "buyer" ? "/buyer" : "/admin";
      navigate({ to: dest });
    }
  }, [ready, isLoggedIn, user, navigate]);

  return { isLoggedIn, user };
}
