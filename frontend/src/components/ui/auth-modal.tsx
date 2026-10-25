"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { X, Lock, Mail, User as UserIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "./button";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "login" | "signup" | "reset";
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = "login",
}) => {
  const { login, register, resetPassword, isSupabaseActive, supabaseStatusMessage } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "reset">(defaultMode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(defaultMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [defaultMode, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
        onClose();
      } else if (mode === "signup") {
        await register(email, username, password, fullName);
        onClose();
      } else if (mode === "reset") {
        const res = await resetPassword(email);
        if (res.success) {
          setSuccessMsg(res.message);
        } else {
          setErrorMsg(res.message);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Authentication request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-studio-900 border border-studio-700/80 rounded-3xl w-full max-w-md p-7 shadow-2xl space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-studio-400 hover:text-studio-100 hover:bg-studio-800 transition"
          aria-label="Close Auth Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-1.5 text-center">
          <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan flex items-center justify-center mx-auto mb-2">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-white">
            {mode === "login"
              ? "Welcome to Fombo Music"
              : mode === "signup"
              ? "Join the Creator Community"
              : "Reset Account Password"}
          </h3>
          <p className="text-xs text-studio-400">
            {mode === "login"
              ? "Enter your credentials to access your studio assets and credits."
              : mode === "signup"
              ? "Get 50 free credits to generate, isolate stems, and arrange tracks."
              : "We will send recovery instructions to your email."}
          </p>
        </div>

        {/* Supabase status notice */}
        <div className="p-2.5 rounded-xl bg-studio-950 border border-studio-800 text-[11px] flex items-center gap-2 text-studio-400">
          <span
            className={`w-2 h-2 rounded-full ${
              isSupabaseActive ? "bg-emerald-400" : "bg-amber-400"
            }`}
          ></span>
          <span className="truncate">
            {isSupabaseActive ? "Supabase Auth Cloud Connected" : "Local Creator Mode (Supabase keys optional)"}
          </span>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-neon-crimson/15 border border-neon-crimson/30 text-neon-crimson text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-medium text-studio-300 block">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-studio-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="soundweaver"
                    className="w-full bg-studio-950 border border-studio-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-studio-100 focus:outline-none focus:border-neon-cyan/50"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-medium text-studio-300 block">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Maya Sound"
                  className="w-full bg-studio-950 border border-studio-800 rounded-xl px-4 py-2.5 text-xs text-studio-100 focus:outline-none focus:border-neon-cyan/50"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-studio-300 block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-studio-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="producer@fombo.studio"
                className="w-full bg-studio-950 border border-studio-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-studio-100 focus:outline-none focus:border-neon-cyan/50"
                required
              />
            </div>
          </div>

          {mode !== "reset" && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-mono font-medium text-studio-300">
                  Password
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setMode("reset")}
                    className="text-[11px] text-neon-cyan hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-studio-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-studio-950 border border-studio-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-studio-100 focus:outline-none focus:border-neon-cyan/50"
                  required
                />
              </div>
            </div>
          )}

          <Button type="submit" variant="neon" className="w-full py-3" isLoading={loading}>
            {mode === "login" ? "Sign In to Studio" : mode === "signup" ? "Create Free Account" : "Send Reset Email"}
          </Button>
        </form>

        {/* Footer switch */}
        <div className="pt-2 text-center text-xs text-studio-400">
          {mode === "login" ? (
            <p>
              Don&apos;t have an account yet?{" "}
              <button
                onClick={() => setMode("signup")}
                className="text-neon-cyan font-bold hover:underline"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-neon-cyan font-bold hover:underline"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
