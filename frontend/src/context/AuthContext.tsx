"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/api";
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from "@/lib/supabase";

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
  isSupabaseActive: boolean;
  supabaseStatusMessage: string;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, fullName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  quickDemoLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const configStatus = getSupabaseConfigStatus();

  const refreshUser = async () => {
    try {
      const userData = await apiRequest<User>("/auth/me");
      setUser(userData);
    } catch {
      setUser(null);
      setToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("fombo_token");
      }
    }
  };

  useEffect(() => {
    // If Supabase is configured, listen to onAuthStateChange
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const accessToken = session.access_token;
          setToken(accessToken);
          localStorage.setItem("fombo_token", accessToken);
          refreshUser().finally(() => setLoading(false));
        } else {
          checkLocalToken();
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (session) {
            setToken(session.access_token);
            localStorage.setItem("fombo_token", session.access_token);
            await refreshUser();
          } else {
            setUser(null);
            setToken(null);
            localStorage.removeItem("fombo_token");
          }
          setLoading(false);
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    } else {
      checkLocalToken();
    }
  }, []);

  const checkLocalToken = () => {
    const savedToken = typeof window !== "undefined" ? localStorage.getItem("fombo_token") : null;
    if (savedToken) {
      setToken(savedToken);
      refreshUser().finally(() => setLoading(false));
    } else {
      quickDemoLogin().finally(() => setLoading(false));
    }
  };

  const login = async (email: string, password: string) => {
    // 1. If Supabase configured, authenticate with Supabase first
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        throw new Error(`Supabase Auth Error: ${error.message}`);
      }
      if (data.session) {
        setToken(data.session.access_token);
        localStorage.setItem("fombo_token", data.session.access_token);
      }
    }

    // 2. Synchronize with backend API session
    const res = await apiRequest<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem("fombo_token", res.access_token);
  };

  const register = async (email: string, username: string, password: string, fullName?: string) => {
    // 1. If Supabase configured, register with Supabase
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, full_name: fullName },
        },
      });
      if (error) {
        throw new Error(`Supabase Registration Error: ${error.message}`);
      }
    }

    // 2. Create in backend DB
    const res = await apiRequest<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password, full_name: fullName }),
    });

    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem("fombo_token", res.access_token);
  };

  const resetPassword = async (email: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/settings`,
      });
      if (error) {
        return { success: false, message: error.message };
      }
      return {
        success: true,
        message: "Password reset email sent via Supabase. Check your inbox.",
      };
    }
    return {
      success: true,
      message:
        "Supabase credentials not configured in env. In production, password reset instructions are dispatched via Supabase Auth.",
    };
  };

  const quickDemoLogin = async () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const demoEmail = `producer_${randomSuffix}@fombo.studio`;
    const demoUsername = `soundwave_${randomSuffix}`;
    try {
      await register(demoEmail, demoUsername, "StudioPass2026!", "Fombo Producer");
    } catch {
      // Fallback if user already created
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("fombo_token");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isSupabaseActive: isSupabaseConfigured,
        supabaseStatusMessage: configStatus.message,
        login,
        register,
        resetPassword,
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
