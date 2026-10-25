"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Search,
  Sparkles,
  Coins,
  Crown,
  User as UserIcon,
  LogOut,
  Settings,
  LogIn,
  Radio,
} from "lucide-react";
import { AuthModal } from "@/components/ui/auth-modal";

export const Topbar: React.FC = () => {
  const router = useRouter();
  const { user, logout, isSupabaseActive } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <>
      <header className="h-16 bg-studio-950/80 backdrop-blur-md border-b border-studio-800/80 fixed top-0 left-0 lg:left-64 right-0 z-20 flex items-center justify-between px-4 md:px-8">
        {/* Mobile Brand Title */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-neon-cyan via-neon-purple to-neon-pink p-0.5">
            <div className="w-full h-full bg-studio-950 rounded-[6px] flex items-center justify-center">
              <Radio className="w-3.5 h-3.5 text-neon-cyan" />
            </div>
          </div>
          <span className="font-extrabold text-sm text-white tracking-wider">FOMBO</span>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-48 sm:w-72 md:w-80">
          <Search className="w-4 h-4 text-studio-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks, BPM, genres..."
            className="w-full bg-studio-900 border border-studio-800 rounded-xl pl-9 pr-4 py-2 text-xs text-studio-200 placeholder-studio-500 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition"
          />
        </form>

        {/* Right User Bar */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Credits Balance Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-studio-900 border border-studio-800 text-xs">
            <Coins className="w-4 h-4 text-neon-amber" />
            <span className="font-mono font-bold text-studio-200">
              {user ? user.credits_balance : 50}
            </span>
            <span className="hidden sm:inline text-studio-500 text-[11px]">credits</span>
          </div>

          {/* Tier Badge */}
          <Link
            href="/pricing"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-800 text-xs text-neon-purple transition group"
          >
            <Crown className="w-3.5 h-3.5 text-neon-purple group-hover:scale-110 transition-transform" />
            <span className="font-mono font-semibold uppercase text-[11px]">
              {user?.role === "studio" ? "Studio" : user?.role === "pro_producer" ? "Pro" : "Free"}
            </span>
          </Link>

          {/* Create Quick Action */}
          <Link
            href="/create"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-studio-950 font-bold text-xs hover:opacity-95 active:scale-95 transition shadow-lg shadow-neon-cyan/20"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>Create</span>
          </Link>

          {/* User Account / Auth Menu */}
          <div className="relative">
            {user ? (
              <div>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 pl-2 border-l border-studio-800 hover:opacity-90 transition"
                  aria-label="User Account Menu"
                >
                  <div className="w-8 h-8 rounded-full bg-studio-850 border border-studio-700 flex items-center justify-center text-xs font-semibold text-neon-cyan shadow">
                    {user.username ? user.username.substring(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
                  </div>
                  <span className="hidden md:inline text-xs font-medium text-studio-200 truncate max-w-[100px]">
                    {user.username}
                  </span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-11 w-48 bg-studio-900 border border-studio-800 rounded-2xl p-2 shadow-2xl z-50 text-xs space-y-1">
                    <Link
                      href={`/profile/${user.username}`}
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-studio-200 hover:bg-studio-850 transition"
                    >
                      <UserIcon className="w-4 h-4 text-neon-cyan" />
                      <span>Artist Profile</span>
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-studio-200 hover:bg-studio-850 transition"
                    >
                      <Settings className="w-4 h-4 text-studio-400" />
                      <span>Studio Settings</span>
                    </Link>
                    <div className="h-px bg-studio-800 my-1"></div>
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neon-crimson hover:bg-neon-crimson/15 transition text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-studio-850 hover:bg-studio-800 border border-studio-700 text-xs text-studio-200 transition"
                >
                  <LogIn className="w-3.5 h-3.5 text-neon-cyan" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/signup"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neon-cyan/20 hover:bg-neon-cyan/30 border border-neon-cyan/40 text-xs text-neon-cyan font-bold transition"
                >
                  <span>Sign Up</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
};
