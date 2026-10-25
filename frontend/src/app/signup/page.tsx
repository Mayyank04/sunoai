"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Lock, Mail, User as UserIcon, Music2, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const { register, isSupabaseActive, supabaseStatusMessage } = useAuth();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      await register(email, username, password, fullName || undefined);
      setSuccess("Account successfully created! 50 complimentary studio credits allocated. Redirecting...");
      setTimeout(() => {
        router.push("/create");
      }, 700);
    } catch (err: any) {
      setError(err?.message || "Registration failed. Please check that email/username are not already registered.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-7 bg-studio-900/80 border border-studio-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-neon-purple to-neon-cyan p-0.5 mx-auto shadow-lg shadow-neon-purple/20">
            <div className="w-full h-full bg-studio-950 rounded-[14px] flex items-center justify-center">
              <Music2 className="w-7 h-7 text-neon-cyan" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Create Creator Account</h1>
            <p className="text-xs text-studio-400 mt-1 font-mono">
              Includes 50 Free Monthly Credits & Browser Multitrack DAW
            </p>
          </div>
        </div>

        {/* Supabase Status Pill */}
        <div className="p-2.5 rounded-xl bg-studio-950/80 border border-studio-800 flex items-center justify-between text-[11px] font-mono">
          <span className="text-studio-400">Auth Engine:</span>
          <span className={isSupabaseActive ? "text-neon-cyan flex items-center gap-1.5" : "text-amber-400 flex items-center gap-1.5"}>
            <span className={`w-2 h-2 rounded-full ${isSupabaseActive ? "bg-neon-cyan animate-pulse" : "bg-amber-400"}`} />
            {supabaseStatusMessage}
          </span>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div className="p-3.5 rounded-xl bg-neon-crimson/10 border border-neon-crimson/30 flex items-start gap-2.5 text-neon-crimson text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-start gap-2.5 text-neon-cyan text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-studio-300 block">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-studio-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="producer@fombo.studio"
                className="w-full bg-studio-950 border border-studio-800 focus:border-neon-cyan rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-studio-600 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-studio-300 block">
                Username *
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-studio-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="soundmaster"
                  className="w-full bg-studio-950 border border-studio-800 focus:border-neon-cyan rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-studio-600 outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-studio-300 block">
                Artist / Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Mercer"
                className="w-full bg-studio-950 border border-studio-800 focus:border-neon-cyan rounded-xl px-3 py-2 text-xs text-white placeholder-studio-600 outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-studio-300 block">
              Password (Min 8 characters) *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-studio-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-studio-950 border border-studio-800 focus:border-neon-cyan rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-studio-600 outline-none transition"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            variant="neon"
            className="w-full py-3 text-xs tracking-wider uppercase font-bold flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span>Creating Creator Account...</span>
            ) : (
              <>
                <span>Get Started with 50 Free Credits</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </form>

        {/* Footer link to Login */}
        <div className="text-center pt-2 border-t border-studio-800/60">
          <p className="text-xs text-studio-400">
            Already have a producer account?{" "}
            <Link
              href="/login"
              className="font-bold text-neon-cyan hover:underline ml-1"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
