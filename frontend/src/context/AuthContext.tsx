"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  role: string;
  credits_balance: number;
  is_verified: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  quickDemoLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const userData = await apiRequest<User>("/auth/me");
      setUser(userData);
    } catch {
      // Token expired or invalid
      setUser(null);
      setToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("fombo_token");
      }
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("fombo_token");
    if (savedToken) {
      setToken(savedToken);
      refreshUser().finally(() => setLoading(false));
    } else {
      // Auto-initialize demo creator session for frictionless experience
      quickDemoLogin().finally(() => setLoading(false));
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem("fombo_token", res.access_token);
  };

  const register = async (email: string, username: string, password: string, fullName?: string) => {
    const res = await apiRequest<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password, full_name: fullName }),
    });
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem("fombo_token", res.access_token);
  };

  const quickDemoLogin = async () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const demoEmail = `producer_${randomSuffix}@fombo.studio`;
    const demoUsername = `soundwave_${randomSuffix}`;
    try {
      await register(demoEmail, demoUsername, "StudioPass2026!", "Fombo Producer");
    } catch {
      // If collision, standard fallback
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("fombo_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser,
        quickDemoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
