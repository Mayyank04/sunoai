"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAudioPlayer, TrackItem } from "@/context/AudioPlayerContext";
import {
  Sparkles,
  Sliders,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  Music,
} from "lucide-react";
import { ProvenanceModal } from "@/components/provenance/ProvenanceModal";

interface ProviderCap {
  provider_id: string;
  display_name: string;
  is_configured: boolean;
  configuration_message?: string;
  models_available: string[];
}

export default function CreateStudioPage() {
  const { user, refreshUser } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay } = useAudioPlayer();

  // Prompt Form State
  const [prompt, setPrompt] = useState(
    "80s retro synthwave anthem with lush analog pads, pumping gated snare and neon arpeggio bassline"
  );
  const [negativePrompt, setNegativePrompt] = useState("distortion, clipping, harsh lo-fi noise");
  const [genre, setGenre] = useState("Synthwave");
  const [bpm, setBpm] = useState(124);
  const [musicalKey, setMusicalKey] = useState("F Minor");
  const [duration, setDuration] = useState(30);

  // Provider State
  const [providers, setProviders] = useState<ProviderCap[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("fombo_procedural");
  const [selectedModel, setSelectedModel] = useState<string>("procedural-dsp-v1");

  // Job Progress State
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobProgress, setJobProgress] = useState<{
    phase: string;
    progress: number;
    job_id?: string;
    track_id?: string;
    audio_url?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdTrack, setCreatedTrack] = useState<TrackItem | null>(null);
  const [inspectProvenanceId, setInspectProvenanceId] = useState<string | null>(null);

  // Load Providers on mount
  useEffect(() => {
    apiRequest<ProviderCap[]>("/generation/providers")
      .then((data) => {
        setProviders(data);
        const procedural = data.find((p) => p.provider_id === "fombo_procedural");
        if (procedural) {
          setSelectedProvider(procedural.provider_id);
          setSelectedModel(procedural.models_available[0] || "procedural-dsp-v1");
        }
      })
      .catch(() => {});
  }, []);

  const handleProviderChange = (provId: string) => {
    setSelectedProvider(provId);
    const p = providers.find((x) => x.provider_id === provId);
    if (p && p.models_available.length > 0) {
      setSelectedModel(p.models_available[0]);
    }
  };

  const handleStylePreset = (tag: string, targetGenre: string, targetKey: string, targetBpm: number) => {
    setPrompt((prev) => `${prev}, ${tag}`);
    setGenre(targetGenre);
    setMusicalKey(targetKey);
    setBpm(targetBpm);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsGenerating(true);
    setJobProgress({ phase: "Submitting generation task...", progress: 5 });

    try {
      const res = await apiRequest<{
        job_id: string;
        status: string;
        remaining_balance: number;
      }>("/generation/create", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          negative_prompt: negativePrompt,
          genre,
          style_tags: [genre.toLowerCase(), "studio-master", musicalKey],
          bpm,
          musical_key: musicalKey,
          duration_seconds: duration,
          provider: selectedProvider,
          model_name: selectedModel,
        }),
      });

      refreshUser();
      const jobId = res.job_id;
      setJobProgress({ phase: "Queued in audio worker cluster...", progress: 15, job_id: jobId });

      // Connect to SSE stream
      const eventSource = new EventSource(`/api/v1/jobs/${jobId}/stream`);

      eventSource.addEventListener("progress", (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          setJobProgress({
            phase: payload.phase.replace(/_/g, " "),
            progress: payload.progress_percentage,
            job_id: jobId,
          });
        } catch {}
      });

      eventSource.addEventListener("complete", (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          eventSource.close();
          setIsGenerating(false);
          setJobProgress(null);

          const newTrack: TrackItem = {
            id: payload.track_id,
            title: `${genre} Opus ${musicalKey}`,
            genre,
            duration_seconds: payload.duration_seconds || duration,
            audio_url: payload.audio_url,
            waveform_data: payload.waveform,
            bpm,
            musical_key: musicalKey,
            commercial_rights_status: user?.role in ["pro_producer", "studio"] ? "commercial_granted" : "non_commercial_personal",
          };

          setCreatedTrack(newTrack);
          playTrack(newTrack);
        } catch {}
      });

      eventSource.addEventListener("error", (evt: any) => {
        eventSource.close();
        setIsGenerating(false);
        try {
          const errData = JSON.parse(evt.data || "{}");
          setErrorMessage(errData.error_message || "Generation worker encountered an error.");
        } catch {
          setErrorMessage("Connection to generation worker was interrupted.");
        }
      });
    } catch (err: any) {
      setIsGenerating(false);
      setJobProgress(null);
      setErrorMessage(err.message || "Failed to start generation.");
    }
  };

  const activeProviderObj = providers.find((p) => p.provider_id === selectedProvider);

  return (
    <div className="py-6 max-w-5xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-neon-cyan" />
          AI Composition Studio
        </h1>
        <p className="text-xs md:text-sm text-studio-400 mt-1">
          Craft algorithmic polyphony, full songs, or stem foundations with honest provider capability governance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Form (2 cols) */}
        <form onSubmit={handleGenerate} className="lg:col-span-2 space-y-6">
          {/* Prompt Box */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase font-mono tracking-wider text-studio-300">
                Acoustic & Harmonic Prompt
              </label>
              <span className="text-[11px] font-mono text-studio-500">{prompt.length} / 1500</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Describe instruments, tempo, atmosphere, mood, rhythm..."
              className="w-full bg-studio-950 border border-studio-800 rounded-xl p-3 text-sm text-studio-100 placeholder-studio-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition resize-none"
              required
            />

            {/* Quick Style Tags */}
            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => handleStylePreset("80s gated snare, analog brass", "Synthwave", "F Minor", 124)}
                className="px-2.5 py-1 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 border border-studio-700 transition"
              >
                + Synthwave 80s
              </button>
              <button
                type="button"
                onClick={() => handleStylePreset("dusty vinyl crackle, rhodes piano", "Lo-Fi", "Eb Major", 85)}
                className="px-2.5 py-1 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 border border-studio-700 transition"
              >
                + Lo-Fi Chill
              </button>
              <button
                type="button"
                onClick={() => handleStylePreset("orchestral brass, pounding timpani", "Cinematic", "D Minor", 110)}
                className="px-2.5 py-1 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 border border-studio-700 transition"
              >
                + Cinematic Hans
              </button>
              <button
                type="button"
                onClick={() => handleStylePreset("deep 808 sub, four on the floor", "Deep House", "G Minor", 126)}
                className="px-2.5 py-1 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 border border-studio-700 transition"
              >
                + Deep House
              </button>
            </div>
          </div>

          {/* Negative Prompt */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-2 shadow-xl">
            <label className="text-xs font-semibold uppercase font-mono tracking-wider text-studio-400">
              Negative Conditioning (Exclude from Audio)
            </label>
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="e.g. vocals, harsh noise, acoustic guitars"
              className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-studio-200 placeholder-studio-600 focus:outline-none focus:border-neon-cyan/50 transition"
            />
          </div>

          {/* Musical Parameters Grid */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-5 shadow-xl">
            {/* BPM */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-studio-400 font-mono">TEMPO</span>
                <span className="text-neon-cyan font-mono font-bold">{bpm} BPM</span>
              </div>
              <input
                type="range"
                min="60"
                max="180"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value))}
                className="w-full h-1.5 bg-studio-800 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
              />
            </div>

            {/* Musical Key */}
            <div className="space-y-1.5">
              <span className="text-xs text-studio-400 font-mono block">MUSICAL KEY</span>
              <select
                value={musicalKey}
                onChange={(e) => setMusicalKey(e.target.value)}
                className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-1.5 text-xs text-studio-200 focus:outline-none focus:border-neon-cyan/50"
              >
                <option value="C Major">C Major</option>
                <option value="C Minor">C Minor</option>
                <option value="D Minor">D Minor</option>
                <option value="Eb Major">Eb Major</option>
                <option value="F Minor">F Minor</option>
                <option value="G Minor">G Minor</option>
                <option value="A Minor">A Minor</option>
                <option value="Bb Major">Bb Major</option>
              </select>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <span className="text-xs text-studio-400 font-mono block">DURATION</span>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-1.5 text-xs text-studio-200 focus:outline-none focus:border-neon-cyan/50"
              >
                <option value={15}>15 Seconds (Quick Preview)</option>
                <option value={30}>30 Seconds (Standard Track)</option>
                <option value={60}>60 Seconds (Full Theme)</option>
                <option value={120}>120 Seconds (Extended Opus)</option>
              </select>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-neon-crimson/10 border border-neon-crimson/30 flex items-start gap-3 text-neon-crimson text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Configuration / Validation Notice</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink text-studio-950 font-bold text-sm tracking-wide uppercase hover:opacity-95 active:scale-[0.99] disabled:opacity-50 transition shadow-xl shadow-neon-cyan/20 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>{isGenerating ? "Synthesizing Audio..." : "Generate Master Track (5 Credits)"}</span>
          </button>
        </form>

        {/* Right Sidebar: Provider Capability & Status (1 col) */}
        <div className="space-y-6">
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-studio-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-neon-cyan" />
              Model & Engine Provider
            </h3>

            {/* Provider Selector */}
            <div className="space-y-2.5">
              {providers.map((p) => {
                const isSelected = selectedProvider === p.provider_id;
                return (
                  <div
                    key={p.provider_id}
                    onClick={() => handleProviderChange(p.provider_id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                      isSelected
                        ? "bg-studio-850 border-neon-cyan/50 text-studio-100 shadow-md shadow-neon-cyan/5"
                        : "bg-studio-950 border-studio-800 hover:border-studio-700 text-studio-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-studio-200">{p.display_name}</span>
                      {p.is_configured ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                          <AlertCircle className="w-3 h-3" /> Needs Key
                        </span>
                      )}
                    </div>
                    {p.configuration_message && (
                      <p className="text-[11px] text-studio-500 mt-1">{p.configuration_message}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Model checkpoint dropdown */}
            {activeProviderObj && activeProviderObj.models_available.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-studio-800">
                <span className="text-[11px] text-studio-400 font-mono block">CHECKPOINT</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-1.5 text-xs text-studio-200 focus:outline-none"
                >
                  {activeProviderObj.models_available.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Active Generation Progress Card */}
          {isGenerating && jobProgress && (
            <div className="bg-studio-900 border border-neon-cyan/30 rounded-2xl p-5 space-y-3 animate-pulse shadow-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-neon-cyan font-semibold">SYNTHESIS ACTIVE</span>
                <span className="font-mono text-studio-300">{jobProgress.progress}%</span>
              </div>
              <div className="w-full h-2 bg-studio-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple rounded-full transition-all duration-300"
                  style={{ width: `${jobProgress.progress}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-studio-400 capitalize">{jobProgress.phase}</p>
            </div>
          )}

          {/* Result Card */}
          {createdTrack && (
            <div className="bg-gradient-to-br from-studio-900 to-studio-850 border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> MASTER RENDERED
                </span>
                <button
                  onClick={() => setInspectProvenanceId(createdTrack.id)}
                  className="text-[10px] font-mono text-neon-cyan flex items-center gap-1 bg-neon-cyan/10 px-2 py-0.5 rounded border border-neon-cyan/20"
                >
                  <ShieldCheck className="w-3 h-3" /> C2PA
                </button>
              </div>

              <div>
                <h4 className="font-bold text-sm text-white">{createdTrack.title}</h4>
                <p className="text-xs text-studio-400 mt-0.5">
                  {createdTrack.genre} • {createdTrack.bpm} BPM • {createdTrack.musical_key}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    isPlaying && currentTrack?.id === createdTrack.id
                      ? togglePlay()
                      : playTrack(createdTrack)
                  }
                  className="flex-1 py-2.5 rounded-xl bg-neon-cyan text-studio-950 font-bold text-xs flex items-center justify-center gap-2 transition hover:opacity-90"
                >
                  {isPlaying && currentTrack?.id === createdTrack.id ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current ml-0.5" /> Play Master
                    </>
                  )}
                </button>
                <a
                  href={`/stems?track_id=${createdTrack.id}`}
                  className="px-3 py-2.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-200 text-xs flex items-center gap-1.5 transition border border-studio-700"
                  title="Separate into 4 Stems"
                >
                  <Layers className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {inspectProvenanceId && (
        <ProvenanceModal trackId={inspectProvenanceId} onClose={() => setInspectProvenanceId(null)} />
      )}
    </div>
  );
}
