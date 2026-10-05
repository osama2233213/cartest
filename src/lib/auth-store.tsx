import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { PERSONAS, type Role } from "./demo-data";

export interface MockUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  city: string;
  label: string;
  avatar: string;
}

const MOCK_IDS: Record<Role, string> = {
  seller: "usr_seller_001",
  buyer: "usr_buyer_002",
  admin: "usr_admin_003",
};

function userFromRole(role: Role): MockUser {
  const p = PERSONAS[role];
  return {
    id: MOCK_IDS[role],
    role,
    name: p.name,
    email: p.email,
    city: p.city,
    label: p.label,
    avatar: p.name[0] ?? "?",
  };
}

interface AuthContextValue {
  /** Current logged-in user, or null if logged out */
  user: MockUser | null;
  /** Whether a user is currently authenticated */
  isLoggedIn: boolean;
  /** Log in as a specific role */
  login: (role: Role) => void;
  /** Log out (clears session) */
  logout: () => void;
}

const AUTH_STORAGE_KEY = "ownerfi_mock_auth";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const role = raw as Role;
        if (role === "seller" || role === "buyer" || role === "admin") {
          return userFromRole(role);
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, user.role);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [user]);

  const login = useCallback((role: Role) => {
    setUser(userFromRole(role));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoggedIn: user !== null,
      login,
      logout,
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
