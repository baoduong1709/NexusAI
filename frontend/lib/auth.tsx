"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { authApi } from "./api";

interface User {
  id: number;
  name: string;
  email: string;
  role?: { id: number; name: string; permissions: string[] };
  skills: string[];
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await authApi.getProfile();
        setUser(res.data);
      } catch (err) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { user: userData } = res.data;
    setUser(userData);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error("Failed to logout from server", err);
    }
    setUser(null);
    window.location.href = "/login";
  };

  const hasPermission = (permission: string) => {
    return user?.role?.permissions?.includes(permission) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, hasPermission, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
