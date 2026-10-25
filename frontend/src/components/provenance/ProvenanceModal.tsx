"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  ShieldCheck,
  X,
  Copy,
  Check,
  FileCode,
  AlertTriangle,
  Scale,
  Download,
  Plus,
  Info,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProvenanceData {
  id: string;
  track_id: string;
  creator_id: string;
  model_provider: string;
  model_version: string;
  generation_seed: number;
  generation_timestamp: string;
  input_prompt_hash: string;
  output_audio_sha256: string;
  license_type: string;
  license_version: string;
  commercial_use_eligibility: string; // 'eligible', 'ineligible', 'restricted'
  commercial_eligibility_reasons?: string[];
  user_supplied_assets?: Array<{ asset_id: string; name: string; asset_type: string }>;
  source_asset_rights_declarations?: Record<string, any>;
  prompt_reference?: any;
  edit_history?: any[];
  c2pa_manifest: any;
  c2pa_manifest_hash?: string;
  legal_disclaimer: string;
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
  const [activeTab, setActiveTab] = useState<"summary" | "declarations" | "json">("summary");

  // Rights Declaration form state
  const [showDeclForm, setShowDeclForm] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [clearanceType, setClearanceType] = useState("original_composition");
  const [rightsHolder, setRightsHolder] = useState("");
  const [attestation, setAttestation] = useState("");
  const [declSubmitting, setDeclSubmitting] = useState(false);

  const fetchProvenance = () => {
    setLoading(true);
    apiRequest<ProvenanceData>(`/provenance/track/${trackId}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProvenance();
  }, [trackId]);

  const handleCopyJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data.c2pa_manifest, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegisterRights = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId.trim() || !attestation.trim()) return;
    setDeclSubmitting(true);
    try {
      const updated = await apiRequest<ProvenanceData>(
        `/provenance/track/${trackId}/rights-declaration`,
        {
          method: "POST",
          body: JSON.stringify({
            asset_id: assetId.trim(),
            clearance_type: clearanceType,
            rights_holder_name: rightsHolder.trim() || "Authenticated Creator",
            attestation_statement: attestation.trim(),
            commercial_allowed: clearanceType !== "non_commercial",
          }),
        }
      );
      setData(updated);
      setShowDeclForm(false);
      setAssetId("");
      setAttestation("");
    } catch (err: any) {
      alert(err.message || "Failed to register rights declaration");
    } finally {
      setDeclSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-studio-900 border border-studio-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-studio-800 bg-studio-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-neon-cyan" />
            </div>
            <div>
              <h3 className="font-semibold text-studio-100 flex items-center gap-2 text-sm md:text-base">
                C2PA Provenance & Rights Registry
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
            Lineage & Commercial Status
          </button>
          <button
            onClick={() => setActiveTab("declarations")}
            className={`pb-3 font-medium transition flex items-center gap-1.5 ${
              activeTab === "declarations"
                ? "text-neon-cyan border-b-2 border-neon-cyan"
                : "text-studio-400 hover:text-studio-200"
            }`}
          >
            <Info className="w-4 h-4" />
            Source Assets & Declarations
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
            C2PA Manifest
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {loading ? (
            <div className="py-12 text-center text-xs font-mono text-studio-400 animate-pulse">
              Querying cryptographic provenance ledger...
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-xs font-mono text-studio-400">
              No provenance record found for this asset.
            </div>
          ) : activeTab === "summary" ? (
            <>
              {/* Commercial Eligibility Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  data.commercial_use_eligibility === "eligible"
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                    : data.commercial_use_eligibility === "restricted"
                    ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
                    : "bg-red-950/20 border-red-500/30 text-red-200"
                }`}
              >
                <div className="mt-0.5">
                  {data.commercial_use_eligibility === "eligible" ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">
                      {data.commercial_use_eligibility === "eligible"
                        ? "Commercial Use Permitted"
                        : data.commercial_use_eligibility === "restricted"
                        ? "Commercial Use Restricted (Asset Declaration Required)"
                        : "Non-Commercial Personal Use Only"}
                    </h4>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-black/40 border border-current">
                      {data.license_version}
                    </span>
                  </div>
                  {data.commercial_eligibility_reasons && (
                    <ul className="text-xs space-y-0.5 list-disc list-inside pt-1 opacity-90">
                      {data.commercial_eligibility_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Verified Lineage Record */}
              <div className="bg-studio-950/60 p-4 rounded-xl border border-studio-800 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-studio-400">Model Provider & Version:</span>
                  <span className="font-mono text-neon-cyan bg-neon-cyan/10 px-2 py-0.5 rounded border border-neon-cyan/20">
                    {data.model_provider} v{data.model_version}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-studio-400">Generation Seed:</span>
                  <span className="font-mono text-studio-300">{data.generation_seed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-studio-400">Timestamp:</span>
                  <span className="font-mono text-studio-300">
                    {new Date(data.generation_timestamp || data.verified_at).toUTCString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-studio-400">License Version:</span>
                  <span className="font-mono text-studio-200">{data.license_version}</span>
                </div>
              </div>

              {/* Cryptographic Digests */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-studio-400 font-medium block mb-1">
                    Output Audio SHA-256 Digest
                  </label>
                  <div className="p-2.5 rounded-lg bg-studio-950 border border-studio-800 font-mono text-studio-300 break-all select-all">
                    {data.output_audio_sha256}
                  </div>
                </div>
                <div>
                  <label className="text-studio-400 font-medium block mb-1">
                    Input Prompt Hash (SHA-256)
                  </label>
                  <div className="p-2.5 rounded-lg bg-studio-950 border border-studio-800 font-mono text-studio-300 break-all select-all">
                    {data.input_prompt_hash}
                  </div>
                </div>
              </div>

              {/* Statutory Non-Infringement Disclaimer */}
              <div className="text-[11px] text-studio-400 bg-studio-950/60 p-3.5 rounded-xl border border-studio-800 leading-relaxed space-y-1">
                <strong className="text-studio-200 block uppercase font-mono text-[10px]">
                  Statutory Rights & Non-Infringement Notice
                </strong>
                <p>{data.legal_disclaimer}</p>
              </div>
            </>
          ) : activeTab === "declarations" ? (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white">Source Asset Rights Declarations</h4>
                  <p className="text-studio-400 text-[11px]">
                    User-supplied sample clearance, stems ownership, and licensing attestations.
                  </p>
                </div>
                <Button
                  variant="neon"
                  size="sm"
                  onClick={() => setShowDeclForm(!showDeclForm)}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Add Declaration</span>
                </Button>
              </div>

              {showDeclForm && (
                <form
                  onSubmit={handleRegisterRights}
                  className="bg-studio-950 p-4 rounded-xl border border-studio-800 space-y-3"
                >
                  <div className="space-y-1">
                    <label className="text-studio-300 font-mono">Asset ID / Name</label>
                    <input
                      type="text"
                      required
                      value={assetId}
                      onChange={(e) => setAssetId(e.target.value)}
                      placeholder="e.g. sample_vocal_hook.wav"
                      className="w-full bg-studio-900 border border-studio-800 rounded-lg px-3 py-1.5 text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-studio-300 font-mono">Clearance Type</label>
                    <select
                      value={clearanceType}
                      onChange={(e) => setClearanceType(e.target.value)}
                      className="w-full bg-studio-900 border border-studio-800 rounded-lg px-3 py-1.5 text-white focus:outline-none"
                    >
                      <option value="original_composition">100% Original Composition (User Owned)</option>
                      <option value="commercially_licensed">Commercially Licensed Sample</option>
                      <option value="cc0_public_domain">CC0 Public Domain</option>
                      <option value="non_commercial">Non-Commercial CC (Personal Only)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-studio-300 font-mono">Rights Holder Name</label>
                    <input
                      type="text"
                      value={rightsHolder}
                      onChange={(e) => setRightsHolder(e.target.value)}
                      placeholder="e.g. Legal full name or licensing authority"
                      className="w-full bg-studio-900 border border-studio-800 rounded-lg px-3 py-1.5 text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-studio-300 font-mono">Attestation Statement</label>
                    <textarea
                      required
                      rows={2}
                      value={attestation}
                      onChange={(e) => setAttestation(e.target.value)}
                      placeholder="I attest under penalty of perjury that I hold necessary rights to incorporate this asset..."
                      className="w-full bg-studio-900 border border-studio-800 rounded-lg px-3 py-1.5 text-white focus:outline-none resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeclForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="neon" size="sm" disabled={declSubmitting}>
                      {declSubmitting ? "Attesting..." : "Save Declaration"}
                    </Button>
                  </div>
                </form>
              )}

              {/* Existing declarations */}
              {data.source_asset_rights_declarations &&
              Object.keys(data.source_asset_rights_declarations).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(data.source_asset_rights_declarations).map(([k, decl]: any) => (
                    <div
                      key={k}
                      className="p-3 rounded-lg bg-studio-950 border border-studio-800 space-y-1"
                    >
                      <div className="flex justify-between font-mono text-[11px]">
                        <span className="font-bold text-white">{k}</span>
                        <span className="text-neon-cyan uppercase">{decl.clearance_type}</span>
                      </div>
                      <p className="text-studio-300 text-xs italic">{decl.attestation_statement}</p>
                      <span className="text-[10px] text-studio-500 font-mono block">
                        Holder: {decl.rights_holder_name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-lg bg-studio-950 border border-studio-800 text-center text-studio-500 font-mono text-xs">
                  No external user assets attached. Output generated purely via verified procedural DSP.
                </div>
              )}
            </div>
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
        <div className="px-6 py-3.5 border-t border-studio-800 bg-studio-950/60 flex items-center justify-between">
          <a
            href={`/api/v1/provenance/track/${trackId}/certificate`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-neon-cyan hover:underline flex items-center gap-1.5 font-mono"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Verified Certificate (JSON)</span>
          </a>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      </div>
    </div>
  );
};
