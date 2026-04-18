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
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("nexusai_token");
    const storedUser = localStorage.getItem("nexusai_user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { access_token, user: userData } = res.data;
    localStorage.setItem("nexusai_token", access_token);
    localStorage.setItem("nexusai_user", JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("nexusai_token");
    localStorage.removeItem("nexusai_user");
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  const hasPermission = (permission: string) => {
    return user?.role?.permissions?.includes(permission) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, hasPermission, isLoading }}
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
