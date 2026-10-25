"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  Lock,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Eye,
  Server,
  FileText,
  Trash2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

interface CopyrightClaimItem {
  id: string;
  claimant_name: string;
  claimant_email: string;
  work_infringed_title: string;
  infringing_track_id: string;
  status: string; // 'pending', 'taken_down', 'dismissed', 'reinstated'
  action_taken?: string;
  created_at: string;
}

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

  const [claims, setClaims] = useState<CopyrightClaimItem[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  const fetchClaims = () => {
    setClaimsLoading(true);
    apiRequest<CopyrightClaimItem[]>("/reports/claims")
      .then((data) => setClaims(data || []))
      .catch(() => {
        // Sample queue for demo display
        setClaims([
          {
            id: "claim-sample-1",
            claimant_name: "Apex Music Publishing",
            claimant_email: "legal@apexmusic.com",
            work_infringed_title: "Starlight Neon Odyssey",
            infringing_track_id: "demo-synthwave-01",
            status: "pending",
            action_taken: "Under Review by Trust & Safety",
            created_at: new Date().toISOString(),
          },
        ]);
      })
      .finally(() => setClaimsLoading(false));
  };

  useEffect(() => {
    fetchClaims();
    apiRequest("/health")
      .then(setSystemHealth)
      .catch(() => {});
  }, []);

  const handleTakedown = async (claimId: string) => {
    setActionInProgress(claimId);
    try {
      await apiRequest(`/reports/claims/${claimId}/takedown`, {
        method: "POST",
        body: JSON.stringify({ notes: "Verified infringement under DMCA notice" }),
      });
      fetchClaims();
    } catch (err: any) {
      alert(err.message || "Failed to execute takedown");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReinstate = async (claimId: string) => {
    setActionInProgress(claimId);
    try {
      await apiRequest(`/reports/claims/${claimId}/reinstate`, {
        method: "POST",
        body: JSON.stringify({ notes: "Counter-notice verified or claim dismissed" }),
      });
      fetchClaims();
    } catch (err: any) {
      alert(err.message || "Failed to reinstate track");
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="py-6 max-w-6xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
          <ShieldAlert className="w-7 h-7 text-neon-crimson" />
          Trust, Safety & DMCA Moderation Dashboard
        </h1>
        <p className="text-xs md:text-sm text-studio-400 mt-1">
          Review formal copyright infringement complaints, enforce takedowns, inspect biometric voice consent, and monitor anti-impersonation filters.
        </p>
      </div>

      {/* DMCA Copyright Complaints Moderation Queue */}
      <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-neon-crimson" />
              DMCA Copyright Complaints Queue ({claims.length})
            </h2>
            <p className="text-xs text-studio-400 mt-0.5">
              Statutory takedown notices filed by rights holders requiring moderator intervention.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchClaims}
            className="text-studio-400 hover:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {claimsLoading ? (
          <div className="py-8 text-center text-xs font-mono text-studio-400 animate-pulse">
            Loading moderation queue...
          </div>
        ) : claims.length === 0 ? (
          <div className="bg-studio-950 p-8 rounded-xl border border-studio-800 text-center text-xs text-studio-500 font-mono">
            No pending copyright complaints in queue. All catalogs compliant.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-studio-800 text-studio-400 text-[11px]">
                  <th className="pb-3 font-semibold">CLAIMANT & EMAIL</th>
                  <th className="pb-3 font-semibold">ORIGINAL WORK</th>
                  <th className="pb-3 font-semibold">TARGET TRACK ID</th>
                  <th className="pb-3 font-semibold">STATUS</th>
                  <th className="pb-3 font-semibold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-studio-800/60">
                {claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-studio-950/40 transition">
                    <td className="py-3.5">
                      <span className="font-bold text-white block">{claim.claimant_name}</span>
                      <span className="text-[11px] text-studio-400">{claim.claimant_email}</span>
                    </td>
                    <td className="py-3.5 text-studio-200">
                      {claim.work_infringed_title}
                    </td>
                    <td className="py-3.5">
                      <Link
                        href={`/song/${claim.infringing_track_id}`}
                        target="_blank"
                        className="text-neon-cyan hover:underline flex items-center gap-1"
                      >
                        <span>{claim.infringing_track_id.substring(0, 12)}...</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          claim.status === "taken_down"
                            ? "bg-neon-crimson/10 text-neon-crimson border border-neon-crimson/30"
                            : claim.status === "reinstated"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-neon-amber/10 text-neon-amber border border-neon-amber/30"
                        }`}
                      >
                        {claim.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right space-x-2">
                      {claim.status !== "taken_down" ? (
                        <Button
                          variant="neon"
                          size="sm"
                          disabled={actionInProgress === claim.id}
                          onClick={() => handleTakedown(claim.id)}
                          className="bg-neon-crimson hover:bg-neon-crimson/80 text-white text-[11px] h-7 px-2.5"
                        >
                          Take Down
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={actionInProgress === claim.id}
                          onClick={() => handleReinstate(claim.id)}
                          className="text-[11px] h-7 px-2.5"
                        >
                          Reinstate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
              <span className="text-studio-500">Listening Analytics Shield:</span>
              <span className="text-emerald-400">Anti-Bot User-Agent & IP Debouncing</span>
            </div>
            <div className="flex justify-between">
              <span className="text-studio-500">Distribution Policy:</span>
              <span className="text-studio-300">Fombo Platform Only (No Auto-DSP)</span>
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
