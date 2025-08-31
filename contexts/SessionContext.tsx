"use client";

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { usePathname, useRouter } from "next/navigation";

interface User {
  id: string;
  fullName: string;
  email: string;
  role: "ISSUER" | "RECEIVER" | "ADMIN";
  issuerId?: string;
}

interface SessionContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return data.user;
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
    return null;
  }, []);

  useEffect(() => {
    fetchUser();
  }, [pathname, fetchUser]);

  const login = async () => {
    const user = await fetchUser();
    if (user) {
      router.push(`/${user.role.toLowerCase()}/dashboard`);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      router.push("/auth/login");
    }
  };

  const value = { user, isLoading, login, logout };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};
