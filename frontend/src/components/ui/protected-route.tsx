"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "./button";
import { AuthModal } from "./auth-modal";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin mx-auto"></div>
        <p className="text-xs text-studio-400 font-mono">Verifying authentication status...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="py-20 text-center max-w-md mx-auto space-y-5 bg-studio-900/60 border border-studio-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-white">Authentication Required</h2>
            <p className="text-xs text-studio-400">
              Please sign in with your Supabase credentials or create a creator account to access this studio workspace.
            </p>
          </div>
          <Button variant="neon" onClick={() => setShowAuthModal(true)} className="w-full">
            Sign In / Create Account
          </Button>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  return <>{children}</>;
};
