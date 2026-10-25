"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Sparkles,
  Sliders,
  FolderHeart,
  Menu,
  X,
  Search,
  ListMusic,
  Settings,
  ShieldAlert,
  CreditCard,
  UserCheck,
  Disc,
  UploadCloud,
} from "lucide-react";

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mainTabs = [
    { label: "Feed", href: "/", icon: Compass },
    { label: "Explore", href: "/explore", icon: Disc },
    { label: "Create", href: "/create", icon: Sparkles, highlight: true },
    { label: "Studio", href: "/studio", icon: Sliders },
    { label: "Library", href: "/library", icon: FolderHeart },
  ];

  const drawerLinks = [
    { label: "Search & Filter", href: "/search", icon: Search },
    { label: "Publish Master", href: "/publish", icon: UploadCloud },
    { label: "Curated Playlists", href: "/playlists", icon: ListMusic },
    { label: "Lyrics Lab", href: "/lyrics", icon: Sparkles },
    { label: "Stem Separation", href: "/stems", icon: Sliders },
    { label: "Voice Governance", href: "/voice", icon: UserCheck },
    { label: "Pricing & Quotas", href: "/pricing", icon: CreditCard },
    { label: "Studio Settings", href: "/settings", icon: Settings },
    { label: "Trust & Safety", href: "/admin", icon: ShieldAlert },
  ];

  return (
    <>
      {/* Fixed Bottom Mobile Bar (visible on md and below) */}
      <div className="lg:hidden fixed bottom-20 left-0 right-0 h-16 bg-studio-950/95 backdrop-blur-xl border-t border-studio-800 z-30 flex items-center justify-around px-2 shadow-2xl">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition ${
                isActive
                  ? "text-neon-cyan font-bold"
                  : "text-studio-400 hover:text-studio-200"
              }`}
            >
              <div
                className={`p-1 rounded-lg ${
                  tab.highlight
                    ? "bg-gradient-to-r from-neon-cyan to-neon-purple text-studio-950 p-1.5 shadow"
                    : ""
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </Link>
          );
        })}

        {/* Drawer Toggle */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 text-studio-400 hover:text-studio-200 transition"
          aria-label="Open More Navigation Menu"
        >
          <div className="p-1">
            <Menu className="w-4 h-4" />
          </div>
          <span className="text-[10px]">More</span>
        </button>
      </div>

      {/* Slide-out Drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-studio-950 border-l border-studio-800 p-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-studio-800">
                <span className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                  Navigation
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 rounded-lg text-studio-400 hover:text-white"
                  aria-label="Close Navigation Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {drawerLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                        isActive
                          ? "bg-studio-850 text-neon-cyan border border-neon-cyan/30"
                          : "text-studio-300 hover:bg-studio-900"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-studio-800 text-[11px] font-mono text-studio-500 text-center">
              Fombo Music AI • v1.0.0
            </div>
          </div>
        </div>
      )}
    </>
  );
};
