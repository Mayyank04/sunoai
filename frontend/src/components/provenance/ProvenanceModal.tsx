"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { ShieldCheck, X, Copy, Check, FileCode, AlertTriangle, Scale } from "lucide-react";

interface ProvenanceData {
  track_id: string;
  creator_id: string;
  model_provider: string;
  generation_seed: number;
  input_prompt_hash: string;
  output_audio_sha256: string;
  license_type: string;
  commercial_eligibility: boolean;
  disclaimer: string;
  c2pa_manifest: any;
  verified_at: string;
}

interface ProvenanceModalProps {
  trackId: string;
  onClose: () => void;
}

export const ProvenanceModal: React.FC<ProvenanceModalProps> = ({ trackId, onClose }) => {
  const [data, setData] = useState<ProvenanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "json">("summary");

  useEffect(() => {
    apiRequest<ProvenanceData>(`/provenance/${trackId}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [trackId]);

  const handleCopyJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data.c2pa_manifest, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-studio-900 border border-studio-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-studio-800 bg-studio-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-neon-cyan" />
            </div>
            <div>
              <h3 className="font-semibold text-studio-100 flex items-center gap-2">
                C2PA Audio Provenance & Rights Registry
              </h3>
              <p className="text-xs text-studio-400 font-mono">Asset ID: {trackId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-studio-400 hover:text-studio-100 hover:bg-studio-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-4 px-6 pt-4 border-b border-studio-800/60 bg-studio-900/60 text-xs">
          <button
            onClick={() => setActiveTab("summary")}
            className={`pb-3 font-medium transition flex items-center gap-1.5 ${
              activeTab === "summary"
                ? "text-neon-cyan border-b-2 border-neon-cyan"
                : "text-studio-400 hover:text-studio-200"
            }`}
          >
            <Scale className="w-4 h-4" />
            License & Lineage Audit
          </button>
          <button
            onClick={() => setActiveTab("json")}
            className={`pb-3 font-medium transition flex items-center gap-1.5 ${
              activeTab === "json"
                ? "text-neon-cyan border-b-2 border-neon-cyan"
                : "text-studio-400 hover:text-studio-200"
            }`}
          >
            <FileCode className="w-4 h-4" />
            Raw C2PA JSON Manifest
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {loading ? (
            <div className="py-12 text-center text-studio-400">Loading cryptographic verification record...</div>
          ) : !data ? (
            <div className="py-12 text-center text-studio-400">No provenance record found for this asset.</div>
          ) : activeTab === "summary" ? (
            <>
              {/* Commercial Eligibility Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  data.commercial_eligibility
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                    : "bg-amber-950/20 border-amber-500/30 text-amber-200"
                }`}
              >
                <div className="mt-0.5">
                  {data.commercial_eligibility ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-sm">
                    {data.commercial_eligibility ? "Commercial Use Permitted" : "Non-Commercial Personal Use Only"}
                  </h4>
                  <p className="text-xs opacity-90 mt-1 leading-relaxed">{data.disclaimer}</p>
                </div>
              </div>

              {/* Verified License */}
              <div className="bg-studio-950/60 p-4 rounded-xl border border-studio-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-studio-400 font-medium">Model / Engine:</span>
                  <span className="font-mono text-neon-cyan bg-neon-cyan/10 px-2 py-0.5 rounded border border-neon-cyan/20">
                    {data.model_provider}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-studio-400 font-medium">Declared License:</span>
                  <span className="text-studio-200 font-medium">{data.license_type}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-studio-400 font-medium">Generation Seed:</span>
                  <span className="font-mono text-studio-300">{data.generation_seed}</span>
                </div>
              </div>

              {/* Cryptographic Hashes */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-studio-400 font-medium block mb-1">
                    Output Audio SHA-256 Cryptographic Hash
                  </label>
                  <div className="p-2.5 rounded-lg bg-studio-950 border border-studio-800 font-mono text-studio-300 break-all select-all">
                    {data.output_audio_sha256}
                  </div>
                </div>
                <div>
                  <label className="text-studio-400 font-medium block mb-1">
                    Input Prompt SHA-256 Digest
                  </label>
                  <div className="p-2.5 rounded-lg bg-studio-950 border border-studio-800 font-mono text-studio-300 break-all select-all">
                    {data.input_prompt_hash}
                  </div>
                </div>
              </div>

              {/* Legal Notice */}
              <div className="text-[11px] text-studio-500 bg-studio-950/40 p-3 rounded-lg border border-studio-800/60">
                Notice: In adherence to international intellectual property and U.S. Copyright Office guidance, AI audio outputs are not guaranteed exclusive copyright registerability. Fombo Music AI certifies parameter provenance without promising zero third-party infringement risk.
              </div>
            </>
          ) : (
            <div className="relative">
              <button
                onClick={handleCopyJson}
                className="absolute top-2 right-2 px-2.5 py-1 rounded bg-studio-800 hover:bg-studio-700 text-xs text-studio-200 flex items-center gap-1.5 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy JSON"}</span>
              </button>
              <pre className="p-4 rounded-xl bg-studio-950 border border-studio-800 font-mono text-xs text-studio-300 overflow-x-auto max-h-[50vh]">
                {JSON.stringify(data.c2pa_manifest, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-studio-800 bg-studio-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-studio-800 hover:bg-studio-700 text-studio-200 text-xs font-medium transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
