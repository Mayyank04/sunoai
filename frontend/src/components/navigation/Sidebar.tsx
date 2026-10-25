"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Sparkles,
  Sliders,
  FolderHeart,
  Search,
  ListMusic,
  UploadCloud,
  CreditCard,
  Settings,
  ShieldAlert,
  Radio,
  Disc,
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const primaryLinks = [
    { label: "Studio Feed", href: "/", icon: Compass },
    { label: "Explore Music", href: "/explore", icon: Disc },
    { label: "Search & Tags", href: "/search", icon: Search },
    { label: "Create Studio", href: "/create", icon: Sparkles, badge: "AI" },
    { label: "Multitrack DAW", href: "/studio", icon: Sliders, badge: "PRO" },
    { label: "My Library", href: "/library", icon: FolderHeart },
    { label: "Playlists", href: "/playlists", icon: ListMusic },
  ];

  const distributionLinks = [
    { label: "Publish Master", href: "/publish", icon: UploadCloud },
    { label: "Pricing & Quotas", href: "/pricing", icon: CreditCard },
    { label: "Studio Settings", href: "/settings", icon: Settings },
    { label: "Trust & Safety", href: "/admin", icon: ShieldAlert },
  ];

  return (
    <aside className="hidden lg:flex w-64 bg-studio-950/95 border-r border-studio-800/80 flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand Logo */}
      <div className="h-16 flex items-center px-6 border-b border-studio-800/80 gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-neon-cyan via-neon-purple to-neon-pink p-0.5 shadow-lg shadow-neon-cyan/20">
          <div className="w-full h-full bg-studio-950 rounded-[10px] flex items-center justify-center">
            <Radio className="w-5 h-5 text-neon-cyan animate-pulse" />
          </div>
        </div>
        <div>
          <span className="font-extrabold text-base tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-neon-cyan via-white to-neon-purple">
            FOMBO
          </span>
          <span className="text-[10px] font-mono block text-neon-cyan tracking-widest -mt-1 font-bold">
            MUSIC AI STUDIO
          </span>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          <div className="px-3 pb-2 text-[10px] font-mono text-studio-500 uppercase tracking-wider font-semibold">
            Audio Creation
          </div>
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                  isActive
                    ? "bg-gradient-to-r from-studio-850 to-studio-800/90 text-neon-cyan border border-neon-cyan/30 shadow-lg shadow-neon-cyan/5"
                    : "text-studio-400 hover:text-studio-200 hover:bg-studio-900/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? "text-neon-cyan" : "text-studio-400 group-hover:text-studio-200"
                    }`}
                  />
                  <span>{link.label}</span>
                </div>
                {link.badge && (
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isActive
                        ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                        : "bg-studio-800 text-studio-400 border border-studio-700"
                    }`}
                  >
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="space-y-1">
          <div className="px-3 pb-2 text-[10px] font-mono text-studio-500 uppercase tracking-wider font-semibold">
            Publishing & Settings
          </div>
          {distributionLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                  isActive
                    ? "bg-gradient-to-r from-studio-850 to-studio-800/90 text-neon-cyan border border-neon-cyan/30 shadow-lg shadow-neon-cyan/5"
                    : "text-studio-400 hover:text-studio-200 hover:bg-studio-900/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? "text-neon-cyan" : "text-studio-400 group-hover:text-studio-200"
                    }`}
                  />
                  <span>{link.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Engine Status Banner */}
      <div className="p-4 border-t border-studio-800/80 bg-studio-950/60 text-xs">
        <div className="bg-studio-900/90 p-3 rounded-xl border border-studio-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-studio-400 font-medium">Audio DSP Engine</span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              ONLINE
            </span>
          </div>
          <div className="text-[10px] text-studio-500 font-mono">
            44.1kHz • 16-bit PCM Core
          </div>
        </div>
      </div>
    </aside>
  );
};
