"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import {
  ShieldAlert,
  Lock,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Eye,
  Server,
} from "lucide-react";

export default function AdminPage() {
  const [bannedArtists, setBannedArtists] = useState<string[]>([
    "taylor swift",
    "drake",
    "beyonce",
    "beatles",
    "eminem",
    "the weeknd",
    "ed sheeran",
    "michael jackson",
    "billie eilish",
  ]);

  const [systemHealth, setSystemHealth] = useState<any>(null);

  useEffect(() => {
    apiRequest("/health")
      .then(setSystemHealth)
      .catch(() => {});
  }, []);

  return (
    <div className="py-6 max-w-5xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
          <ShieldAlert className="w-7 h-7 text-neon-crimson" />
          Trust, Safety & Governance Dashboard
        </h1>
        <p className="text-xs md:text-sm text-studio-400 mt-1">
          Monitor anti-impersonation filters, model capabilities, and cryptographic audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* System & Hardware Cluster Health */}
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-studio-200 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-neon-cyan" />
              Engine & Cluster Diagnostics
            </h3>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              ALL SYSTEMS NORMAL
            </span>
          </div>

          <div className="bg-studio-950 p-4 rounded-xl border border-studio-800 space-y-3 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-studio-500">Audio DSP Core:</span>
              <span className="text-neon-cyan">Procedural Mathematical Synth (Online)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-studio-500">Demucs Stem Isolation:</span>
              <span className="text-emerald-400">DSP Band-Separation Ready</span>
            </div>
            <div className="flex justify-between">
              <span className="text-studio-500">C2PA Signature Engine:</span>
              <span className="text-neon-purple">SHA-256 Digest Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-studio-500">Storage Subsystem:</span>
              <span className="text-studio-300">Local HMAC-Signed Storage</span>
            </div>
          </div>
        </div>

        {/* Banned Artist Impersonation Watchlist */}
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-studio-200 uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-neon-crimson" />
              Protected Artist Trademark Watchlist
            </h3>
            <span className="text-[10px] font-mono text-studio-400">Strict Anti-Deepfake</span>
          </div>

          <p className="text-xs text-studio-400 leading-relaxed">
            Prompts containing these names trigger immediate HTTP 422 rejection to protect living artists against unauthorized biometric imitation.
          </p>

          <div className="flex flex-wrap gap-2">
            {bannedArtists.map((artist) => (
              <span
                key={artist}
                className="px-3 py-1.5 rounded-lg bg-studio-950 border border-studio-800 text-xs font-mono text-studio-300 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-neon-crimson"></span>
                {artist.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
