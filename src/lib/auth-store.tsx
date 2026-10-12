import React, { createContext, useContext, useEffect, useMemo } from "react";
import { PERSONAS, type Role } from "./demo-data";
import { auth, hydrateSession, useCurrentUser, useSessionReady } from "./session";

export interface MockUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  city: string;
  label: string;
  avatar: string;
}

interface AuthContextValue {
  /** False until the saved login has been read from storage (guards must wait for it) */
  ready: boolean;
  /** Current logged-in user, or null if logged out */
  user: MockUser | null;
  /** Whether a user is currently authenticated */
  isLoggedIn: boolean;
  /** Jump straight into a seeded demo persona (demo toolbar) */
  login: (role: Role) => void;
  /** Log out (clears session) */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LABEL: Record<Role, string> = { seller: "Seller", buyer: "Buyer", admin: "Admin" };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const current = useCurrentUser();
  const ready = useSessionReady();

  useEffect(() => {
    hydrateSession();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user: MockUser | null = current
      ? {
          id: current.id,
          role: current.role,
          name: current.name,
          email: current.email,
          city: PERSONAS[current.role].city,
          label: LABEL[current.role],
          avatar: current.name[0] ?? "?",
        }
      : null;
    return {
      ready,
      user,
      isLoggedIn: user !== null,
      login: (role) => auth.setPersona(role),
      logout: () => auth.logout(),
    };
  }, [current, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
