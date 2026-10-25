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
  DollarSign,
  Activity,
  Layers,
  CreditCard,
  Scale,
  List,
} from "lucide-react";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    "jobs" | "gpu" | "payments" | "moderation" | "licenses" | "audit" | "watchlist"
  >("jobs");

  // Dashboard Data States
  const [jobsData, setJobsData] = useState<any>(null);
  const [gpuData, setGpuData] = useState<any>(null);
  const [paymentsData, setPaymentsData] = useState<any>(null);
  const [moderationData, setModerationData] = useState<any>(null);
  const [licensesData, setLicensesData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [bannedArtists, setBannedArtists] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchDashboardData = () => {
    setLoading(true);
    Promise.allSettled([
      apiRequest("/admin/jobs"),
      apiRequest("/admin/gpu-costs"),
      apiRequest("/admin/payments"),
      apiRequest("/admin/moderation"),
      apiRequest("/admin/license-issues"),
      apiRequest("/admin/audit-logs"),
      apiRequest("/admin/banned-artists"),
    ]).then(([j, g, p, m, l, a, b]) => {
      if (j.status === "fulfilled") setJobsData(j.value);
      if (g.status === "fulfilled") setGpuData(g.value);
      if (p.status === "fulfilled") setPaymentsData(p.value);
      if (m.status === "fulfilled") setModerationData(m.value);
      if (l.status === "fulfilled") setLicensesData(l.value);
      if (a.status === "fulfilled") setAuditLogs(a.value || []);
      if (b.status === "fulfilled") setBannedArtists(b.value || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleTakedown = async (claimId: string) => {
    setActionInProgress(claimId);
    try {
      await apiRequest(`/reports/claims/${claimId}/takedown`, {
        method: "POST",
        body: JSON.stringify({ notes: "Verified infringement under DMCA notice" }),
      });
      fetchDashboardData();
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
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || "Failed to reinstate track");
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="py-6 max-w-7xl mx-auto space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-neon-crimson" />
            Platform Governance, Compute & Financial Administration
          </h1>
          <p className="text-xs md:text-sm text-studio-400 mt-1">
            Real-time inference queue telemetry, GPU compute accounting, Stripe & Razorpay MRR, DMCA moderation, and immutable audit logs.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchDashboardData}
          className="self-start sm:self-auto text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          <span>Refresh Metrics</span>
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-studio-800 text-xs font-semibold scrollbar-none">
        <button
          onClick={() => setActiveTab("jobs")}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "jobs"
              ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40"
              : "text-studio-400 hover:text-studio-200"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Jobs Queue ({jobsData?.summary?.total_jobs || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("gpu")}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "gpu"
              ? "bg-neon-purple/15 text-neon-purple border border-neon-purple/40"
              : "text-studio-400 hover:text-studio-200"
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>GPU Costs (${gpuData?.total_estimated_cost_usd || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "payments"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40"
              : "text-studio-400 hover:text-studio-200"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>MRR & Billing (${paymentsData?.financial_summary?.mrr_usd || 0}/mo)</span>
        </button>

        <button
          onClick={() => setActiveTab("moderation")}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "moderation"
              ? "bg-neon-crimson/15 text-neon-crimson border border-neon-crimson/40"
              : "text-studio-400 hover:text-studio-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>DMCA & Safety ({moderationData?.summary?.pending_copyright_claims || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("licenses")}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "licenses"
              ? "bg-neon-amber/15 text-neon-amber border border-neon-amber/40"
              : "text-studio-400 hover:text-studio-200"
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>License Issues ({licensesData?.restricted_tracks_count || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "audit"
              ? "bg-studio-800 text-white border border-studio-700"
              : "text-studio-400 hover:text-studio-200"
          }`}
        >
          <List className="w-4 h-4" />
          <span>Audit Logs ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("watchlist")}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "watchlist"
              ? "bg-studio-800 text-white border border-studio-700"
              : "text-studio-400 hover:text-studio-200"
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Biometric Protection</span>
        </button>
      </div>

      {/* Tab Panels */}
      {loading ? (
        <div className="py-24 text-center text-xs font-mono text-studio-400 animate-pulse">
          Loading platform administration telemetry...
        </div>
      ) : activeTab === "jobs" ? (
        /* Jobs Dashboard */
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-studio-900 border border-studio-800 rounded-xl p-4">
              <span className="text-[11px] font-mono text-studio-400 block">TOTAL TASKS</span>
              <span className="text-xl font-bold text-white block mt-1">
                {jobsData?.summary?.total_jobs || 0}
              </span>
            </div>
            <div className="bg-studio-900 border border-studio-800 rounded-xl p-4">
              <span className="text-[11px] font-mono text-studio-400 block">SUCCESS RATE</span>
              <span className="text-xl font-bold text-emerald-400 block mt-1">
                {jobsData?.summary?.success_rate_percent || 100}%
              </span>
            </div>
            <div className="bg-studio-900 border border-studio-800 rounded-xl p-4">
              <span className="text-[11px] font-mono text-studio-400 block">RUNNING NOW</span>
              <span className="text-xl font-bold text-neon-cyan block mt-1">
                {jobsData?.summary?.running || 0}
              </span>
            </div>
            <div className="bg-studio-900 border border-studio-800 rounded-xl p-4">
              <span className="text-[11px] font-mono text-studio-400 block">IN QUEUE</span>
              <span className="text-xl font-bold text-neon-amber block mt-1">
                {jobsData?.summary?.queued || 0}
              </span>
            </div>
            <div className="bg-studio-900 border border-studio-800 rounded-xl p-4">
              <span className="text-[11px] font-mono text-studio-400 block">SUCCEEDED</span>
              <span className="text-xl font-bold text-white block mt-1">
                {jobsData?.summary?.succeeded || 0}
              </span>
            </div>
            <div className="bg-studio-900 border border-studio-800 rounded-xl p-4">
              <span className="text-[11px] font-mono text-studio-400 block">FAILED</span>
              <span className="text-xl font-bold text-neon-crimson block mt-1">
                {jobsData?.summary?.failed || 0}
              </span>
            </div>
          </div>

          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Recent Async Inference & Processing Tasks
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-studio-800 text-studio-400 text-[11px]">
                    <th className="pb-3 font-semibold">JOB ID</th>
                    <th className="pb-3 font-semibold">TYPE</th>
                    <th className="pb-3 font-semibold">STATUS</th>
                    <th className="pb-3 font-semibold">DURATION</th>
                    <th className="pb-3 font-semibold">PROGRESS</th>
                    <th className="pb-3 font-semibold">STAGE</th>
                    <th className="pb-3 font-semibold text-right">CREATED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-studio-800/60">
                  {jobsData?.jobs?.map((j: any) => (
                    <tr key={j.id} className="hover:bg-studio-950/40">
                      <td className="py-3 font-bold text-studio-200">{j.id.substring(0, 10)}...</td>
                      <td className="py-3 text-neon-cyan">{j.job_type}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            j.status === "succeeded"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : j.status === "running"
                              ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 animate-pulse"
                              : j.status === "failed"
                              ? "bg-neon-crimson/10 text-neon-crimson border border-neon-crimson/30"
                              : "bg-studio-800 text-studio-300"
                          }`}
                        >
                          {j.status}
                        </span>
                      </td>
                      <td className="py-3 text-studio-300">
                        {j.duration_seconds ? `${j.duration_seconds}s` : "—"}
                      </td>
                      <td className="py-3 text-studio-300">{j.progress_percentage}%</td>
                      <td className="py-3 text-studio-400 truncate max-w-xs">{j.current_stage}</td>
                      <td className="py-3 text-right text-studio-500">
                        {new Date(j.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "gpu" ? (
        /* GPU Costs & Hardware Analytics */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6">
              <span className="text-xs font-mono text-studio-400 block">TOTAL COMPUTE TIME</span>
              <span className="text-3xl font-extrabold text-neon-cyan block mt-2">
                {gpuData?.total_compute_hours || 0} hrs
              </span>
              <span className="text-[11px] text-studio-500 font-mono mt-1 block">
                ({gpuData?.total_compute_seconds || 0} seconds elapsed)
              </span>
            </div>

            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6">
              <span className="text-xs font-mono text-studio-400 block">ESTIMATED COMPUTE COST</span>
              <span className="text-3xl font-extrabold text-emerald-400 block mt-2">
                ${gpuData?.total_estimated_cost_usd || 0}
              </span>
              <span className="text-[11px] text-studio-500 font-mono mt-1 block">
                Blended multi-cloud GPU instances
              </span>
            </div>

            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6">
              <span className="text-xs font-mono text-studio-400 block">INFERENCE EFFICIENCY</span>
              <span className="text-xl font-bold text-white block mt-2">
                {gpuData?.efficiency_score || "98.4%"}
              </span>
              <span className="text-[11px] text-studio-500 font-mono mt-1 block">
                Batch pipelined AudioCraft + Demucs
              </span>
            </div>
          </div>

          {/* Hardware Instance Breakdown Cards */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Cloud Hardware Fleet Breakdown
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {gpuData?.hardware_breakdown &&
                Object.entries(gpuData.hardware_breakdown).map(([hw, stat]: any) => (
                  <div key={hw} className="bg-studio-950 p-4 rounded-xl border border-studio-800 space-y-2">
                    <span className="font-bold text-studio-200 text-xs block">{hw}</span>
                    <div className="text-[11px] font-mono text-studio-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Rate:</span>
                        <span className="text-white">${stat.hourly_rate_usd}/hr</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Compute Time:</span>
                        <span className="text-neon-cyan">{stat.compute_hours} hrs</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-studio-800 font-bold">
                        <span>Total:</span>
                        <span className="text-emerald-400">${stat.estimated_cost_usd}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : activeTab === "payments" ? (
        /* Payments & Billing Dashboard */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6">
              <span className="text-xs font-mono text-studio-400 block">MONTHLY RECURRING REVENUE</span>
              <span className="text-3xl font-extrabold text-emerald-400 block mt-2">
                ${paymentsData?.financial_summary?.mrr_usd || 0}
              </span>
              <span className="text-[11px] text-studio-500 font-mono mt-1 block">
                ARR: ${paymentsData?.financial_summary?.arr_usd || 0}
              </span>
            </div>

            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6">
              <span className="text-xs font-mono text-studio-400 block">TOTAL PLATFORM REVENUE</span>
              <span className="text-3xl font-extrabold text-white block mt-2">
                ${paymentsData?.financial_summary?.total_revenue_usd || 0}
              </span>
              <span className="text-[11px] text-studio-500 font-mono mt-1 block">
                Processed through Stripe & Razorpay
              </span>
            </div>

            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6">
              <span className="text-xs font-mono text-studio-400 block">ACTIVE SUBSCRIBERS</span>
              <span className="text-3xl font-extrabold text-neon-cyan block mt-2">
                {paymentsData?.financial_summary?.active_subscribers || 0}
              </span>
              <span className="text-[11px] text-studio-500 font-mono mt-1 block">
                Pro: {paymentsData?.financial_summary?.subscribers_by_tier?.pro || 0} • Studio:{" "}
                {paymentsData?.financial_summary?.subscribers_by_tier?.studio || 0}
              </span>
            </div>

            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6">
              <span className="text-xs font-mono text-studio-400 block">GATEWAY DISTRIBUTION</span>
              <div className="pt-2 text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-studio-400">Stripe (Global):</span>
                  <span className="text-white font-bold">
                    {paymentsData?.financial_summary?.gateway_distribution?.stripe || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-studio-400">Razorpay (India):</span>
                  <span className="text-neon-cyan font-bold">
                    {paymentsData?.financial_summary?.gateway_distribution?.razorpay || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Recent Billing Transactions & Invoices
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-studio-800 text-studio-400 text-[11px]">
                    <th className="pb-3 font-semibold">TRANSACTION ID</th>
                    <th className="pb-3 font-semibold">AMOUNT</th>
                    <th className="pb-3 font-semibold">GATEWAY</th>
                    <th className="pb-3 font-semibold">STATUS</th>
                    <th className="pb-3 font-semibold text-right">DATE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-studio-800/60">
                  {paymentsData?.recent_transactions?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-studio-950/40">
                      <td className="py-3 font-bold text-studio-200">{p.id.substring(0, 12)}...</td>
                      <td className="py-3 font-bold text-white">
                        ${(p.amount_cents / 100).toFixed(2)} {p.currency}
                      </td>
                      <td className="py-3 text-neon-cyan uppercase">{p.provider}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 text-right text-studio-500">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "moderation" ? (
        /* DMCA & Moderation Queue */
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-neon-crimson" />
                DMCA Copyright Complaints Queue ({moderationData?.copyright_claims?.length || 0})
              </h2>
              <p className="text-xs text-studio-400 mt-0.5">
                Statutory takedown notices filed by verified rights holders.
              </p>
            </div>
          </div>

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
                {moderationData?.copyright_claims?.map((claim: any) => (
                  <tr key={claim.id} className="hover:bg-studio-950/40 transition">
                    <td className="py-3.5">
                      <span className="font-bold text-white block">{claim.claimant_name}</span>
                      <span className="text-[11px] text-studio-400">{claim.claimant_email}</span>
                    </td>
                    <td className="py-3.5 text-studio-200">{claim.work_infringed_title}</td>
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
        </div>
      ) : activeTab === "licenses" ? (
        /* License Issues */
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Tracks with Commercial Restrictions or Missing Attestations
              </h3>
              <p className="text-xs text-studio-400 mt-0.5">
                Recordings flagged due to non-commercial provider models or pending source sample rights clearance.
              </p>
            </div>
            <Badge variant="outline" className="text-neon-amber border-neon-amber/40">
              {licensesData?.restricted_tracks_count || 0} Tracks Restricted
            </Badge>
          </div>

          {licensesData?.issues?.length === 0 ? (
            <div className="py-12 text-center text-xs text-studio-500 font-mono">
              All tracks in catalog meet commercial clearance standards.
            </div>
          ) : (
            <div className="space-y-3">
              {licensesData?.issues?.map((issue: any) => (
                <div
                  key={issue.id}
                  className="bg-studio-950 p-4 rounded-xl border border-studio-800 space-y-2 text-xs font-mono"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">Track ID: {issue.track_id}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      {issue.commercial_use_eligibility}
                    </span>
                  </div>
                  <ul className="text-studio-400 text-[11px] space-y-0.5 list-disc list-inside">
                    {issue.commercial_eligibility_reasons?.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                  <div className="text-[10px] text-studio-500 flex justify-between pt-1">
                    <span>Provider: {issue.model_provider}</span>
                    <span>License: {issue.license_version}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "audit" ? (
        /* System Audit Logs */
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Immutable Administrative Audit Trail
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-studio-800 text-studio-400 text-[11px]">
                  <th className="pb-3 font-semibold">ACTION</th>
                  <th className="pb-3 font-semibold">RESOURCE TYPE</th>
                  <th className="pb-3 font-semibold">RESOURCE ID</th>
                  <th className="pb-3 font-semibold">USER ID</th>
                  <th className="pb-3 font-semibold text-right">TIMESTAMP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-studio-800/60">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-studio-950/40">
                    <td className="py-3 font-bold text-neon-cyan">{log.action}</td>
                    <td className="py-3 text-studio-300">{log.resource_type || "system"}</td>
                    <td className="py-3 text-studio-400">
                      {log.resource_id ? log.resource_id.substring(0, 16) : "—"}
                    </td>
                    <td className="py-3 text-studio-500">
                      {log.user_id ? log.user_id.substring(0, 12) : "system"}
                    </td>
                    <td className="py-3 text-right text-studio-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Biometric & Protected Artists Watchlist */
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-studio-200 uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-neon-crimson" />
              Protected Artist Trademark & Biometric Impersonation Filter
            </h3>
            <span className="text-[10px] font-mono text-studio-400">Strict Anti-Deepfake Active</span>
          </div>

          <p className="text-xs text-studio-400 leading-relaxed">
            Prompts and voice enrollment requests containing these living artist names trigger immediate HTTP 422 rejection to prevent non-consensual biometric and trademark exploitation.
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
      )}
    </div>
  );
}
