"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import {
  UserCheck,
  ShieldAlert,
  Mic,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Trash2,
  History,
  FileAudio,
  ShieldCheck,
  X,
  Volume2,
} from "lucide-react";

interface VoiceModel {
  id: string;
  name: string;
  description?: string;
  voice_type: string;
  supports_singing: boolean;
  enrollment_status: string;
  reference_audio_url: string;
  sample_rate: number;
  pitch_range?: string;
  timbre_description?: string;
  ownership_attestation_confirmed: boolean;
  is_active: boolean;
  created_at: string;
  revoked_at?: string;
}

interface AuditLog {
  id: string;
  action: string;
  details: Record<string, any>;
  ip_address: string;
  created_at: string;
}

export default function VoiceConsentPage() {
  const [challenge, setChallenge] = useState<{
    challenge_id: string;
    phonetic_phrase: string;
    instructions: string;
  } | null>(null);

  // Form State
  const [voiceName, setVoiceName] = useState("Studio Lead Vocalist");
  const [description, setDescription] = useState("Warm lyrical alto with natural vibrato");
  const [voiceType, setVoiceType] = useState<"singing_voice" | "spoken_tts">("singing_voice");
  const [supportsSinging, setSupportsSinging] = useState<boolean>(true);
  const [pitchRange, setPitchRange] = useState("D3 - A5");
  const [timbreDescription, setTimbreDescription] = useState("Warm Studio Alto");
  const [acknowledged, setAcknowledged] = useState(false);

  // Enrolled Models & Audit
  const [enrolledModels, setEnrolledModels] = useState<VoiceModel[]>([]);
  const [selectedAuditModel, setSelectedAuditModel] = useState<VoiceModel | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch challenge phrase
    apiRequest<{ challenge_id: string; phonetic_phrase: string; instructions: string }>(
      "/voice-consent/challenge",
      { method: "POST" }
    )
      .then(setChallenge)
      .catch(() => {});

    // 2. Fetch user's enrolled voice models
    loadVoiceModels();
  }, []);

  const loadVoiceModels = () => {
    apiRequest<VoiceModel[]>("/voice-models")
      .then(setEnrolledModels)
      .catch(() => {});
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    if (!acknowledged) {
      setErrorMessage("You must affirm explicit ownership and consent attestation.");
      return;
    }

    // Check TTS vs Singing mismatch
    if (voiceType === "spoken_tts" && supportsSinging) {
      setErrorMessage(
        "Governance Error: Ordinary spoken TTS engines cannot be registered as singing models unless verified singing synthesis weights are provided."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await apiRequest("/voice-models/enroll", {
        method: "POST",
        body: JSON.stringify({
          name: voiceName,
          description,
          voice_type: voiceType,
          supports_singing: supportsSinging,
          reference_audio_url: "/api/v1/storage/file/uploads/consent_sample.wav",
          ownership_attestation_confirmed: acknowledged,
          challenge_id: challenge.challenge_id,
          pitch_range: pitchRange,
          timbre_description: timbreDescription,
        }),
      });

      setStatusMessage(`Voice model '${res.name}' enrolled and cryptographically attested.`);
      loadVoiceModels();
      // Reset form
      setVoiceName("");
      setAcknowledged(false);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revoke Consent
  const handleRevokeConsent = async (model: VoiceModel) => {
    if (!confirm(`Are you sure you want to revoke consent for '${model.name}'? All synthesis access will be terminated immediately.`)) {
      return;
    }
    try {
      await apiRequest(`/voice-models/${model.id}/revoke`, { method: "POST" });
      setStatusMessage(`Consent revoked for '${model.name}'. Inference access halted.`);
      loadVoiceModels();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // Delete Voice Model
  const handleDeleteModel = async (model: VoiceModel) => {
    if (!confirm(`Permanently delete voice model '${model.name}'? This action is irreversible.`)) {
      return;
    }
    try {
      await apiRequest(`/voice-models/${model.id}`, { method: "DELETE" });
      setStatusMessage(`Voice model '${model.name}' permanently deleted.`);
      loadVoiceModels();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // View Audit Logs
  const handleViewAuditLogs = async (model: VoiceModel) => {
    setSelectedAuditModel(model);
    try {
      const logs = await apiRequest<AuditLog[]>(`/voice-models/${model.id}/audit-logs`);
      setAuditLogs(logs);
    } catch {}
  };

  return (
    <div className="py-6 max-w-5xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
          <UserCheck className="w-8 h-8 text-emerald-400" />
          <span>Voice Consent & Identity Governance Center</span>
        </h1>
        <p className="text-xs md:text-sm text-studio-400 mt-1">
          Cryptographically verified voice ownership, strict anti-impersonation protections, and immutable audit logs.
        </p>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {statusMessage}
          </span>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-400">
            &times;
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            {errorMessage}
          </span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400">
            &times;
          </button>
        </div>
      )}

      {/* Anti-Impersonation Policy Alert */}
      <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-4 text-amber-200">
        <ShieldAlert className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs leading-relaxed">
          <strong className="font-bold text-sm text-amber-300 block">
            Strict Ethical Policy: Celebrity & Unauthorized Cloning Prohibited
          </strong>
          <p>
            You may only enroll vocal models for voices you personally own or have secured explicit, written legal clearance to synthesize. Unauthorized impersonation of artists (e.g. Drake, Taylor Swift, The Weeknd, Arijit Singh) is programmatically blocked and will trigger immediate account termination.
          </p>
        </div>
      </div>

      {/* Enrollment Card */}
      <form onSubmit={handleEnrollSubmit} className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-6">
        <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-studio-800 pb-3">
          <Lock className="w-4 h-4 text-neon-cyan" />
          <span>New Custom Voice Model Enrollment</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-mono font-semibold uppercase text-studio-300 block">
              Vocal Model Name
            </label>
            <input
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="e.g. Maya - Studio Lyric Soprano"
              className="w-full bg-studio-950 border border-studio-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-neon-cyan"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono font-semibold uppercase text-studio-300 block">
              Vocal Model Type
            </label>
            <select
              value={voiceType}
              onChange={(e) => {
                const val = e.target.value as "singing_voice" | "spoken_tts";
                setVoiceType(val);
                setSupportsSinging(val === "singing_voice");
              }}
              className="w-full bg-studio-950 border border-studio-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-neon-cyan"
            >
              <option value="singing_voice">Full Singing Vocal Model (Supports Pitch/Melody)</option>
              <option value="spoken_tts">Spoken Speech TTS Only (No Singing)</option>
            </select>
          </div>
        </div>

        {/* Capability Banner */}
        <div className="p-3.5 rounded-xl bg-studio-950 border border-studio-800 flex items-center justify-between text-xs font-mono">
          <div className="space-y-0.5">
            <span className="text-studio-300 font-bold block">Singing Synthesis Capability:</span>
            <p className="text-[11px] text-studio-400">
              {supportsSinging
                ? "This model will be enabled for melodic composition and lead singing."
                : "This model is locked to speech narration only and cannot be assigned to song leads."}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-lg text-[10px] font-bold ${
              supportsSinging
                ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-950/40 text-amber-400 border border-amber-500/30"
            }`}
          >
            {supportsSinging ? "SINGING ENABLED" : "SPOKEN ONLY"}
          </span>
        </div>

        {/* Dynamic Phoneme Liveness Challenge */}
        <div className="bg-studio-950/80 p-5 rounded-xl border border-studio-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-neon-cyan uppercase flex items-center gap-1.5">
              <Mic className="w-4 h-4" /> Randomized Phoneme Liveness Challenge
            </span>
            <span className="text-[10px] font-mono text-studio-500">Anti-Spoofing Verification</span>
          </div>

          <div className="p-4 rounded-lg bg-studio-900 border border-studio-700/60 font-mono text-sm text-white italic">
            &ldquo;{challenge?.phonetic_phrase || "I explicitly consent to Fombo Music AI modeling my acoustic vocal characteristics."}&rdquo;
          </div>

          <p className="text-[11px] text-studio-400">
            Recite this exact sentence clearly to certify acoustic biometric liveness and affirm consent.
          </p>
        </div>

        {/* Legal Affirmation Checkbox */}
        <div className="flex items-start gap-3 pt-2">
          <input
            type="checkbox"
            id="consent-check"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-studio-700 text-neon-cyan focus:ring-neon-cyan/30 bg-studio-950"
            required
          />
          <label htmlFor="consent-check" className="text-xs text-studio-300 leading-relaxed cursor-pointer select-none">
            I certify under penalty of perjury that I hold complete, unencumbered rights to this vocal timbre. I explicitly authorize Fombo Music AI to generate a cryptographic voice signature hash bound to my account ID.
          </label>
        </div>

        <button
          type="submit"
          disabled={!acknowledged || isSubmitting}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-neon-cyan text-studio-950 font-bold text-xs uppercase tracking-wide hover:opacity-95 disabled:opacity-50 transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{isSubmitting ? "Enrolling & Attesting..." : "Sign & Enroll Custom Voice Model"}</span>
        </button>
      </form>

      {/* Enrolled Voice Models Directory */}
      <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center justify-between border-b border-studio-800 pb-3">
          <span className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-neon-purple" />
            <span>Enrolled Voice Models Directory</span>
          </span>
          <span className="text-xs font-mono text-studio-400">
            Active: {enrolledModels.filter((m) => m.is_active).length}
          </span>
        </h2>

        {enrolledModels.length === 0 ? (
          <p className="text-xs text-studio-400 font-mono py-4 text-center">
            No custom voice models enrolled yet. Complete the liveness verification above to enroll your first model.
          </p>
        ) : (
          <div className="divide-y divide-studio-800">
            {enrolledModels.map((model) => (
              <div key={model.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{model.name}</span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase ${
                        model.enrollment_status === "enrolled"
                          ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                          : "bg-rose-950/40 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {model.enrollment_status}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                        model.supports_singing
                          ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20"
                          : "bg-studio-800 text-studio-400 border-studio-700"
                      }`}
                    >
                      {model.supports_singing ? "Singing Voice" : "Spoken TTS Only"}
                    </span>
                  </div>
                  <p className="text-xs text-studio-400 font-mono">
                    {model.timbre_description || "Custom Timbre"} &bull; {model.pitch_range || "Full Range"} &bull; Enrolled on{" "}
                    {new Date(model.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewAuditLogs(model)}
                    className="px-3 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-200 border border-studio-700 text-xs font-medium flex items-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Audit Logs</span>
                  </button>

                  {model.enrollment_status === "enrolled" && (
                    <button
                      onClick={() => handleRevokeConsent(model)}
                      className="px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 border border-amber-500/30 text-xs font-medium"
                    >
                      Revoke Consent
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteModel(model)}
                    className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-500/30"
                    title="Delete Model"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Log Modal */}
      {selectedAuditModel && (
        <div className="fixed inset-0 z-50 bg-studio-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-studio-900 border border-studio-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-studio-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-neon-cyan" />
                <span>Compliance Audit Trail &bull; {selectedAuditModel.name}</span>
              </h3>
              <button onClick={() => setSelectedAuditModel(null)} className="text-studio-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-studio-800 max-h-80 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between text-studio-400">
                    <span className="text-neon-cyan font-bold uppercase">{log.action}</span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <pre className="text-[11px] text-studio-300 bg-studio-950 p-2 rounded overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
