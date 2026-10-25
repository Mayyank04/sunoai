"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Search, Sparkles, Coins, Crown, User as UserIcon } from "lucide-react";

export const Topbar: React.FC = () => {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-studio-950/80 backdrop-blur-md border-b border-studio-800/80 fixed top-0 left-64 right-0 z-20 flex items-center justify-between px-8">
      {/* Search Bar */}
      <div className="relative w-80">
        <Search className="w-4 h-4 text-studio-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search prompts, genres, tracks, BPM..."
          className="w-full bg-studio-900 border border-studio-800 rounded-xl pl-9 pr-4 py-2 text-xs text-studio-200 placeholder-studio-500 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition"
        />
      </div>

      {/* Right User Bar */}
      <div className="flex items-center gap-4">
        {/* Credits Balance Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-studio-900 border border-studio-800 text-xs">
          <Coins className="w-4 h-4 text-neon-amber" />
          <span className="font-mono font-bold text-studio-200">
            {user ? user.credits_balance : 50}
          </span>
          <span className="text-studio-500 text-[11px]">credits</span>
        </div>

        {/* Tier Badge */}
        <Link
          href="/pricing"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-800 text-xs text-neon-purple transition group"
        >
          <Crown className="w-3.5 h-3.5 text-neon-purple group-hover:scale-110 transition-transform" />
          <span className="font-mono font-semibold uppercase text-[11px]">
            {user?.role === "studio" ? "Studio" : user?.role === "pro_producer" ? "Pro" : "Free"}
          </span>
        </Link>

        {/* Create Quick Action */}
        <Link
          href="/create"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-studio-950 font-semibold text-xs hover:opacity-95 active:scale-95 transition shadow-lg shadow-neon-cyan/20"
        >
          <Sparkles className="w-3.5 h-3.5 fill-current" />
          <span>Create Song</span>
        </Link>

        {/* User Avatar */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-studio-800">
          <div className="w-8 h-8 rounded-full bg-studio-850 border border-studio-700 flex items-center justify-center text-xs font-semibold text-neon-cyan">
            {user?.username ? user.username.substring(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden lg:block text-left">
            <span className="block text-xs font-medium text-studio-200 truncate max-w-[100px]">
              {user?.username || "Guest"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
