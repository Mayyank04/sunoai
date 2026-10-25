"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  RotateCcw,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Radio,
  FileText,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import { ProvenanceModal } from "@/components/provenance/ProvenanceModal";
import { AuthModal } from "@/components/ui/auth-modal";

interface ProviderCap {
  provider_id: string;
  display_name: string;
  description: string;
  supports_text_to_audio: boolean;
  supports_audio_to_audio: boolean;
  supports_stems: boolean;
  supports_lyrics: boolean;
  supports_vocals: boolean;
  supports_instrumental_toggle: boolean;
  supports_bpm_control: boolean;
  supports_key_control: boolean;
  supports_instrument_selection: boolean;
  supports_dual_variants: boolean;
  min_duration_seconds: number;
  max_duration_seconds: number;
  models_available: string[];
  is_configured: boolean;
  configuration_message?: string;
  commercial_grade: boolean;
  attribution_required: boolean;
  provider_type?: string;
  status_label?: string;
  model_revision?: string;
}

const AVAILABLE_INSTRUMENTS = [
  "Analog Synthesizer",
  "808 Bass",
  "Grand Piano",
  "Electric Guitar",
  "Acoustic Drums",
  "String Quartet",
  "Brass Ensemble",
  "Ambient Pads",
  "Sub Bass",
  "Vintage Rhodes",
];

const GENRES = [
  "Synthwave",
  "Cyberpunk",
  "Lo-Fi",
  "Ambient",
  "Cinematic",
  "Deep House",
  "Hip Hop",
  "Neo-Classical",
  "Rock",
];

const MOODS = [
  "Nostalgic",
  "Energetic",
  "Melancholic",
  "Dreamy",
  "Dark & Menacing",
  "Euphoric",
  "Chill & Relaxed",
  "Epic & Triumphant",
];

function CreateStudioContent() {
  const { user, refreshUser } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay } = useAudioPlayer();

  // Mode: "simple" | "custom"
  const [mode, setMode] = useState<"simple" | "custom">("custom");

  // Core Prompt State
  const [prompt, setPrompt] = useState(
    "80s retro synthwave anthem with lush analog pads, pumping gated snare and neon arpeggio bassline"
  );
  const [negativePrompt, setNegativePrompt] = useState("distortion, clipping, harsh lo-fi noise");
  const [makeInstrumental, setMakeInstrumental] = useState(true);
  const [lyrics, setLyrics] = useState("");
  const [genre, setGenre] = useState("Synthwave");
  const [mood, setMood] = useState("Nostalgic");
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([
    "Analog Synthesizer",
    "808 Bass",
  ]);
  const [bpm, setBpm] = useState(124);
  const [musicalKey, setMusicalKey] = useState("F Minor");
  const [duration, setDuration] = useState(30);
  const [generateTwoVariants, setGenerateTwoVariants] = useState(true);

  // URL query params synchronization
  const searchParams = useSearchParams();
  useEffect(() => {
    const p = searchParams.get("prompt");
    const g = searchParams.get("genre");
    const k = searchParams.get("key");
    const b = searchParams.get("bpm");
    if (p) {
      setPrompt(p);
      setMakeInstrumental(false);
    }
    if (g) setGenre(g);
    if (k) setMusicalKey(k);
    if (b) setBpm(parseInt(b));
  }, [searchParams]);

  // Provider State
  const [providers, setProviders] = useState<ProviderCap[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("fombo_procedural");
  const [selectedModel, setSelectedModel] = useState<string>("procedural-dsp-v1");
  const [estimatedCredits, setEstimatedCredits] = useState<number>(5);

  // Job Progress & Telemetry State
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{
    phase: string;
    progress: number;
    current_stage?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedJobId, setLastFailedJobId] = useState<string | null>(null);

  // Completed Tracks (Variant A and Variant B)
  const [variantA, setVariantA] = useState<TrackItem | null>(null);
  const [variantB, setVariantB] = useState<TrackItem | null>(null);
  const [inspectProvenanceId, setInspectProvenanceId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch Providers on Mount
  useEffect(() => {
    apiRequest<ProviderCap[]>("/generation/providers")
      .then((data) => {
        setProviders(data);
        const procedural = data.find((p) => p.provider_id === "fombo_procedural");
        if (procedural) {
          setSelectedProviderId(procedural.provider_id);
          setSelectedModel(procedural.models_available[0] || "procedural-dsp-v1");
          setGenerateTwoVariants(procedural.supports_dual_variants);
        }
      })
      .catch(() => {});
  }, []);

  // Update Selected Provider
  const handleProviderSelect = (provId: string) => {
    setSelectedProviderId(provId);
    const p = providers.find((x) => x.provider_id === provId);
    if (p) {
      if (p.models_available.length > 0) {
        setSelectedModel(p.models_available[0]);
      }
      if (!p.supports_dual_variants) {
        setGenerateTwoVariants(false);
      }
      if (duration > p.max_duration_seconds) {
        setDuration(p.max_duration_seconds);
      } else if (duration < p.min_duration_seconds) {
        setDuration(p.min_duration_seconds);
      }
    }
  };

  const activeProvider = providers.find((p) => p.provider_id === selectedProviderId);

  // Estimate Credits when options change
  useEffect(() => {
    let cost = 5;
    if (generateTwoVariants && activeProvider?.supports_dual_variants) {
      cost += 3;
    }
    if (duration > 60) {
      cost += 2;
    }
    setEstimatedCredits(cost);
  }, [selectedProviderId, generateTwoVariants, duration, activeProvider]);

  // Instrument toggle
  const toggleInstrument = (inst: string) => {
    setSelectedInstruments((prev) =>
      prev.includes(inst) ? prev.filter((i) => i !== inst) : [...prev, inst]
    );
  };

  // Preset style helper
  const applyPreset = (tag: string, g: string, k: string, b: number, m: string) => {
    setPrompt((prev) => `${prev}, ${tag}`);
    setGenre(g);
    setMusicalKey(k);
    setBpm(b);
    setMood(m);
  };

  const cleanupJobMonitoring = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupJobMonitoring();
    };
  }, []);

  const handleJobCompleted = (payload: {
    track_id: string;
    audio_url: string;
    second_audio_url?: string | null;
    duration_seconds?: number;
    waveform?: number[];
  }) => {
    cleanupJobMonitoring();
    setIsGenerating(false);
    setJobProgress(null);
    setActiveJobId(null);
    refreshUser();

    if (payload.track_id && payload.audio_url) {
      const trackA: TrackItem = {
        id: payload.track_id,
        title: `${genre} Opus ${musicalKey} (Take 1)`,
        genre,
        duration_seconds: payload.duration_seconds || duration,
        audio_url: payload.audio_url,
        waveform_data: payload.waveform,
        bpm,
        musical_key: musicalKey,
        commercial_rights_status:
          user?.role === "pro_producer" || user?.role === "studio"
            ? "commercial_granted"
            : "non_commercial_personal",
      };
      setVariantA(trackA);
      playTrack(trackA);

      if (payload.second_audio_url) {
        const trackB: TrackItem = {
          id: `${payload.track_id}-take2`,
          title: `${genre} Opus ${musicalKey} (Take 2 - Alternate Harmonics)`,
          genre,
          duration_seconds: payload.duration_seconds || duration,
          audio_url: payload.second_audio_url,
          bpm,
          musical_key: musicalKey,
          commercial_rights_status:
            user?.role === "pro_producer" || user?.role === "studio"
              ? "commercial_granted"
              : "non_commercial_personal",
        };
        setVariantB(trackB);
      } else {
        setVariantB(null);
      }
    }
  };

  const handleJobFailed = (jobId: string, errMessage: string) => {
    cleanupJobMonitoring();
    setIsGenerating(false);
    setJobProgress(null);
    setActiveJobId(null);
    setLastFailedJobId(jobId);
    setErrorMessage(errMessage || "Generation worker encountered an error.");
    refreshUser();
  };

  // Cancel Job Action
  const handleCancelJob = async () => {
    if (!activeJobId) return;
    try {
      cleanupJobMonitoring();
      await apiRequest(`/generation/${activeJobId}/cancel`, { method: "POST" });
      setIsGenerating(false);
      setJobProgress(null);
      setActiveJobId(null);
      setErrorMessage("Generation task was cancelled. Reserved credits have been refunded.");
      refreshUser();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to cancel generation job.");
    }
  };

  // Retry Failed Job Action
  const handleRetryJob = async () => {
    if (!lastFailedJobId) return;
    setErrorMessage(null);
    setIsGenerating(true);
    setJobProgress({ phase: "Enqueuing retry task...", progress: 5, current_stage: "Queued" });

    try {
      const res = await apiRequest<{
        job_id: string;
        status: string;
        remaining_balance: number;
      }>(`/generation/${lastFailedJobId}/retry`, { method: "POST" });

      refreshUser();
      setActiveJobId(res.job_id);
      attachStream(res.job_id);
    } catch (err: any) {
      setIsGenerating(false);
      setJobProgress(null);
      setErrorMessage(err.message || "Retry failed.");
    }
  };

  // Dual SSE Stream Listener & Polling Fallback
  const attachStream = (jobId: string) => {
    cleanupJobMonitoring();

    // 1. Setup Server-Sent Events (SSE) for zero-latency progress updates
    try {
      const eventSource = new EventSource(`/api/v1/jobs/${jobId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("progress", (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          setJobProgress({
            phase: payload.phase ? payload.phase.replace(/_/g, " ") : "Processing",
            progress: payload.progress_percentage || 25,
            current_stage: payload.current_stage || "Synthesizing audio",
          });
        } catch {}
      });

      eventSource.addEventListener("complete", (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          handleJobCompleted(payload);
        } catch {}
      });

      eventSource.addEventListener("error", () => {
        // SSE disconnected or closed; smoothly transition to polling fallback without interrupting user
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      });
    } catch {
      // EventSource not supported or failed to construct; polling fallback will handle status
    }

    // 2. Setup Active Polling Fallback (ensures completion even if SSE is interrupted or proxied)
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusData = await apiRequest<{
          job_id: string;
          status: string;
          progress_percentage?: number;
          track_id?: string;
          audio_url?: string;
          second_audio_url?: string;
          duration_seconds?: number;
          error_code?: string;
          error_message?: string;
        }>(`/generation/${jobId}/status`);

        if (statusData.status === "completed" || statusData.status === "succeeded") {
          handleJobCompleted({
            track_id: statusData.track_id!,
            audio_url: statusData.audio_url!,
            second_audio_url: statusData.second_audio_url,
            duration_seconds: statusData.duration_seconds,
          });
        } else if (statusData.status === "failed") {
          handleJobFailed(jobId, statusData.error_message || "Generation worker encountered an error.");
        } else if (statusData.status === "cancelled") {
          cleanupJobMonitoring();
          setIsGenerating(false);
          setJobProgress(null);
          setActiveJobId(null);
          setErrorMessage("Generation task was cancelled.");
          refreshUser();
        } else if (statusData.progress_percentage) {
          setJobProgress((prev) => ({
            phase: statusData.status === "processing" ? "Synthesizing audio harmonics" : (prev?.phase || "In queue"),
            progress: Math.max(prev?.progress || 10, statusData.progress_percentage || 20),
            current_stage: prev?.current_stage || "Rendering soundscape",
          }));
        }
      } catch {
        // Polling retry on next interval tick
      }
    }, 2000);
  };

  // Submit Generation Request
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setVariantA(null);
    setVariantB(null);

    // Authentication Guard
    if (!user) {
      setShowAuthModal(true);
      setErrorMessage("Please sign in or create an account to generate AI music. New creator accounts receive 50 complimentary credits.");
      return;
    }

    // Client-side Capability Validation Checks
    if (activeProvider) {
      if (lyrics.trim() && !activeProvider.supports_lyrics) {
        setErrorMessage(
          `Provider '${activeProvider.display_name}' does not support lyrics synthesis. Please clear lyrics or switch to a lyric-capable provider (e.g. Suno).`
        );
        return;
      }
      if (!makeInstrumental && !activeProvider.supports_vocals) {
        setErrorMessage(
          `Provider '${activeProvider.display_name}' does not support singing or vocal synthesis. Please enable Instrumental mode or select a vocal-capable provider.`
        );
        return;
      }
    }

    setIsGenerating(true);
    setJobProgress({
      phase: "Submitting generation task...",
      progress: 5,
      current_stage: "Validating provider constraints",
    });

    try {
      const res = await apiRequest<{
        job_id: string;
        status: string;
        remaining_balance: number;
        variants_supported: boolean;
      }>("/generation/create", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          negative_prompt: mode === "custom" ? negativePrompt : undefined,
          make_instrumental: makeInstrumental,
          lyrics: !makeInstrumental && lyrics.trim() ? lyrics : undefined,
          genre,
          mood,
          instruments: selectedInstruments,
          style_tags: [genre.toLowerCase(), mood.toLowerCase(), ...selectedInstruments.slice(0, 2)],
          bpm,
          musical_key: musicalKey,
          duration_seconds: duration,
          provider: selectedProviderId,
          model_name: selectedModel,
          generate_two_variants: generateTwoVariants && (activeProvider?.supports_dual_variants ?? false),
        }),
      });

      refreshUser();
      const jobId = res.job_id;
      setActiveJobId(jobId);
      setJobProgress({
        phase: "Queued in audio inference cluster...",
        progress: 15,
        current_stage: "Synthesizing audio harmonics",
      });

      attachStream(jobId);
    } catch (err: any) {
      setIsGenerating(false);
      setJobProgress(null);
      setErrorMessage(err.message || "Failed to start generation.");
    }
  };

  // Warning calculations
  const lyricsWarning =
    Boolean(lyrics.trim()) && activeProvider && !activeProvider.supports_lyrics;
  const vocalsWarning =
    !makeInstrumental && activeProvider && !activeProvider.supports_vocals;

  return (
    <div className="py-6 max-w-6xl mx-auto space-y-8">
      {/* Studio Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-studio-800/80 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-neon-cyan" />
            AI Music Creation Studio
          </h1>
          <p className="text-xs md:text-sm text-studio-400 mt-1">
            Real asynchronous AI music synthesis with verified provider governance and C2PA provenance.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 bg-studio-900 border border-studio-800 p-1.5 rounded-xl self-start md:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setMode("simple")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono tracking-wider transition ${
              mode === "simple"
                ? "bg-neon-cyan text-studio-950 shadow-md font-bold"
                : "text-studio-400 hover:text-studio-200"
            }`}
          >
            Simple Mode
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono tracking-wider transition ${
              mode === "custom"
                ? "bg-neon-cyan text-studio-950 shadow-md font-bold"
                : "text-studio-400 hover:text-studio-200"
            }`}
          >
            Custom Studio Mode
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Creation Form (2 cols) */}
        <form onSubmit={handleGenerate} className="lg:col-span-2 space-y-6">
          {/* Unconfigured Provider Banner */}
          {activeProvider && !activeProvider.is_configured && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong className="font-semibold block mb-0.5">Generation Engine Not Configured</strong>
                <p>
                  Inference worker for &quot;{activeProvider.display_name}&quot; is not connected. Connect an actual self-hosted GPU worker (e.g. RunPod, Modal, or local Torch node) or switch to the built-in CC0 Procedural Synthesizer to compose audio.
                </p>
                {activeProvider.configuration_message && (
                  <p className="mt-1 font-mono text-[11px] text-amber-400/80">
                    {activeProvider.configuration_message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Capability Warnings Banner if controls exceed provider capacity */}
          {(lyricsWarning || vocalsWarning) && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong className="font-semibold block mb-0.5">Model Capability Notice</strong>
                {vocalsWarning && (
                  <p>
                    Provider &quot;{activeProvider?.display_name}&quot; does not support singing vocals.
                    Switch to Suno API or enable Instrumental mode.
                  </p>
                )}
                {lyricsWarning && (
                  <p>
                    Provider &quot;{activeProvider?.display_name}&quot; does not synthesize lyrics. Lyrics
                    will be ignored unless a vocal-capable provider is chosen.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Instrumental vs Vocal Toggle */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
            <div className="space-y-0.5">
              <span className="text-xs font-bold uppercase font-mono tracking-wider text-studio-200 block">
                Instrumental Master
              </span>
              <p className="text-[11px] text-studio-400">
                {makeInstrumental
                  ? "Pure polyphonic instrumentation (no vocals or singing voices)"
                  : "Include singing voices and vocal harmonies (requires vocal-capable provider)"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMakeInstrumental(!makeInstrumental)}
              className={`p-1.5 rounded-xl border transition flex items-center gap-2 text-xs font-mono font-bold ${
                makeInstrumental
                  ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan"
                  : "bg-studio-800 border-studio-700 text-studio-300"
              }`}
            >
              {makeInstrumental ? (
                <>
                  <ToggleRight className="w-5 h-5 text-neon-cyan" /> Instrumental On
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-studio-400" /> Vocals Enabled
                </>
              )}
            </button>
          </div>

          {/* Optional Lyrics Box (Shown in Custom mode or when instrumental is turned OFF) */}
          {(!makeInstrumental || mode === "custom") && (
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase font-mono tracking-wider text-studio-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-neon-pink" />
                  Optional Lyrics & Song Structure
                </label>
                <span className="text-[11px] font-mono text-studio-500">
                  {lyrics.length} / 5000 chars
                </span>
              </div>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={4}
                placeholder="[Verse 1]&#10;Neon streetlights in the rain&#10;Echoes of a forgotten name...&#10;&#10;[Chorus]&#10;Carry me through the electric night..."
                className="w-full bg-studio-950 border border-studio-800 rounded-xl p-3 text-xs text-studio-100 placeholder-studio-600 focus:outline-none focus:border-neon-pink/50 transition font-mono resize-y"
              />
              <p className="text-[11px] text-studio-500">
                Tip: Structure lyrics using tags like [Verse], [Chorus], [Bridge], [Outro] for optimal phrasing.
              </p>
            </div>
          )}

          {/* Prompt Box */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase font-mono tracking-wider text-studio-300">
                Acoustic & Musical Prompt
              </label>
              <span className="text-[11px] font-mono text-studio-500">{prompt.length} / 1500</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Describe instruments, tempo, atmosphere, mood, rhythm, chord progressions..."
              className="w-full bg-studio-950 border border-studio-800 rounded-xl p-3 text-sm text-studio-100 placeholder-studio-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition resize-none"
              required
            />

            {/* Quick Style Presets */}
            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() =>
                  applyPreset("80s gated snare, analog brass", "Synthwave", "F Minor", 124, "Nostalgic")
                }
                className="px-2.5 py-1 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 border border-studio-700 transition"
              >
                + Synthwave 80s
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset("dusty vinyl crackle, rhodes piano", "Lo-Fi", "Eb Major", 85, "Chill & Relaxed")
                }
                className="px-2.5 py-1 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 border border-studio-700 transition"
              >
                + Lo-Fi Chill
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset("epic brass, pounding timpani", "Cinematic", "D Minor", 110, "Epic & Triumphant")
                }
                className="px-2.5 py-1 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 border border-studio-700 transition"
              >
                + Cinematic Epic
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset("deep 808 sub, four on the floor", "Deep House", "G Minor", 126, "Euphoric")
                }
                className="px-2.5 py-1 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 border border-studio-700 transition"
              >
                + Deep House
              </button>
            </div>
          </div>

          {/* Genre and Mood Selection */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-5 shadow-xl">
            <div className="space-y-1.5">
              <label className="text-xs text-studio-400 font-mono block">GENRE</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-studio-200 focus:outline-none focus:border-neon-cyan/50"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-studio-400 font-mono block">MOOD & ATMOSPHERE</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-studio-200 focus:outline-none focus:border-neon-cyan/50"
              >
                {MOODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Mode Extra Controls */}
          {mode === "custom" && (
            <>
              {/* Instruments Multi-Select */}
              <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-3 shadow-xl">
                <label className="text-xs font-semibold uppercase font-mono tracking-wider text-studio-300 block">
                  Lead & Harmonic Instrumentation
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_INSTRUMENTS.map((inst) => {
                    const isSelected = selectedInstruments.includes(inst);
                    return (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => toggleInstrument(inst)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono transition border ${
                          isSelected
                            ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan font-semibold"
                            : "bg-studio-950 border-studio-800 text-studio-400 hover:border-studio-700"
                        }`}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {inst}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Negative Prompt Conditioning */}
              <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-2 shadow-xl">
                <label className="text-xs font-semibold uppercase font-mono tracking-wider text-studio-400">
                  Negative Conditioning (Exclude from Audio)
                </label>
                <input
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="e.g. vocals, harsh distortion, clipping, acoustic guitars"
                  className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-studio-200 placeholder-studio-600 focus:outline-none focus:border-neon-cyan/50 transition"
                />
              </div>
            </>
          )}

          {/* Musical Parameters: BPM, Key, Duration, Dual Variants */}
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
              <span className="text-xs text-studio-400 font-mono block">KEY SIGNATURE</span>
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
                <option value={15}>15s (Quick Preview)</option>
                <option value={30}>30s (Standard Opus)</option>
                <option value={60}>60s (Extended Theme)</option>
                <option value={120}>120s (Full Arrangement)</option>
              </select>
            </div>
          </div>

          {/* Dual Variant Toggle (Only if provider supports it) */}
          {activeProvider?.supports_dual_variants && (
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
              <div>
                <span className="text-xs font-bold uppercase font-mono tracking-wider text-studio-200 block">
                  Dual Output Variants (Take 1 & Take 2)
                </span>
                <p className="text-[11px] text-studio-400">
                  Synthesize two distinct harmonic variations simultaneously (+3 credits).
                </p>
              </div>
              <input
                type="checkbox"
                checked={generateTwoVariants}
                onChange={(e) => setGenerateTwoVariants(e.target.checked)}
                className="w-5 h-5 accent-neon-cyan cursor-pointer rounded"
              />
            </div>
          )}

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-neon-crimson/10 border border-neon-crimson/30 flex items-start gap-3 text-neon-crimson text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="font-semibold block mb-0.5">Generation Notice</strong>
                <span>{errorMessage}</span>
              </div>
              {lastFailedJobId && (
                <button
                  type="button"
                  onClick={handleRetryJob}
                  className="px-3 py-1.5 bg-neon-crimson text-white font-bold rounded-lg hover:opacity-90 flex items-center gap-1.5 transition self-center"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry
                </button>
              )}
            </div>
          )}

          {/* Submit & Cancel Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isGenerating || (activeProvider ? !activeProvider.is_configured : false)}
              className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink text-studio-950 font-bold text-sm tracking-wide uppercase hover:opacity-95 active:scale-[0.99] disabled:opacity-50 transition shadow-xl shadow-neon-cyan/20 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>
                {isGenerating
                  ? "Synthesizing Audio..."
                  : activeProvider && !activeProvider.is_configured
                  ? "Generation Engine Not Configured"
                  : `Generate Master Audio (${estimatedCredits} Credits)`}
              </span>
            </button>

            {isGenerating && (
              <button
                type="button"
                onClick={handleCancelJob}
                className="px-5 py-4 rounded-2xl bg-studio-800 hover:bg-neon-crimson/20 border border-studio-700 hover:border-neon-crimson text-studio-200 hover:text-neon-crimson font-bold text-xs font-mono tracking-wider transition flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" /> Cancel
              </button>
            )}
          </div>
        </form>

        {/* Right Sidebar: Provider Capabilities & Output Variants (1 col) */}
        <div className="space-y-6">
          {/* Provider Selector Card */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-studio-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-neon-cyan" />
              AI Inference Engine
            </h3>

            {/* Provider List */}
            <div className="space-y-2.5">
              {providers.map((p) => {
                const isSelected = selectedProviderId === p.provider_id;
                return (
                  <div
                    key={p.provider_id}
                    onClick={() => handleProviderSelect(p.provider_id)}
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
                      ) : p.status_label === "Worker Offline" || p.provider_type === "self_hosted" ? (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                          <AlertCircle className="w-3 h-3" /> Worker Offline
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                          <AlertCircle className="w-3 h-3" /> Needs Key
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-studio-500 mt-1 line-clamp-2">{p.description}</p>

                    {/* Capabilities Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.supports_vocals ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                          Vocals & Lyrics
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-studio-800 text-studio-500 font-mono">
                          Instrumental Only
                        </span>
                      )}
                      {p.supports_dual_variants && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan font-mono">
                          Dual Variants
                        </span>
                      )}
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-studio-800 text-studio-400 font-mono">
                        {p.min_duration_seconds}s-{p.max_duration_seconds}s
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Model Checkpoint Dropdown */}
            {activeProvider && activeProvider.models_available.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-studio-800">
                <span className="text-[11px] text-studio-400 font-mono block">CHECKPOINT</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-1.5 text-xs text-studio-200 focus:outline-none"
                >
                  {activeProvider.models_available.map((m) => (
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
            <div className="bg-studio-900 border border-neon-cyan/30 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-neon-cyan font-semibold flex items-center gap-1.5">
                  <Radio className="w-4 h-4 animate-pulse text-neon-cyan" />
                  SYNTHESIS ACTIVE
                </span>
                <span className="font-mono text-studio-300 font-bold">{jobProgress.progress}%</span>
              </div>
              <div className="w-full h-2 bg-studio-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple rounded-full transition-all duration-300"
                  style={{ width: `${jobProgress.progress}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-studio-300 capitalize">{jobProgress.current_stage || jobProgress.phase}</p>
            </div>
          )}

          {/* Variant A Result Card */}
          {variantA && (
            <div className="bg-gradient-to-br from-studio-900 to-studio-850 border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> MASTER RENDERED (TAKE 1)
                </span>
                <button
                  type="button"
                  onClick={() => setInspectProvenanceId(variantA.id)}
                  className="text-[10px] font-mono text-neon-cyan flex items-center gap-1 bg-neon-cyan/10 px-2 py-0.5 rounded border border-neon-cyan/20"
                >
                  <ShieldCheck className="w-3 h-3" /> C2PA
                </button>
              </div>

              <div>
                <h4 className="font-bold text-sm text-white">{variantA.title}</h4>
                <p className="text-xs text-studio-400 mt-0.5">
                  {variantA.genre} • {variantA.bpm} BPM • {variantA.musical_key} • {variantA.duration_seconds}s
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    isPlaying && currentTrack?.id === variantA.id ? togglePlay() : playTrack(variantA)
                  }
                  className="flex-1 py-2.5 rounded-xl bg-neon-cyan text-studio-950 font-bold text-xs flex items-center justify-center gap-2 transition hover:opacity-90"
                >
                  {isPlaying && currentTrack?.id === variantA.id ? (
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
                  href={`/studio?track_id=${variantA.id}`}
                  className="px-3 py-2.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-200 text-xs flex items-center gap-1.5 transition border border-studio-700"
                  title="Open in Multitrack Studio"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </a>
                <a
                  href={`/stems?track_id=${variantA.id}`}
                  className="px-3 py-2.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-200 text-xs flex items-center gap-1.5 transition border border-studio-700"
                  title="Separate into 4 Stems"
                >
                  <Layers className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* Variant B Result Card (If Dual Variants Generated) */}
          {variantB && (
            <div className="bg-gradient-to-br from-studio-900 to-studio-850 border border-neon-purple/30 rounded-2xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-neon-purple font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> ALTERNATE HARMONIC (TAKE 2)
                </span>
                <span className="text-[10px] font-mono text-studio-400 bg-studio-800 px-2 py-0.5 rounded">
                  Dual Variant
                </span>
              </div>

              <div>
                <h4 className="font-bold text-sm text-white">{variantB.title}</h4>
                <p className="text-xs text-studio-400 mt-0.5">
                  {variantB.genre} • {variantB.bpm} BPM • {variantB.musical_key} • {variantB.duration_seconds}s
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    isPlaying && currentTrack?.id === variantB.id ? togglePlay() : playTrack(variantB)
                  }
                  className="flex-1 py-2.5 rounded-xl bg-neon-purple text-white font-bold text-xs flex items-center justify-center gap-2 transition hover:opacity-90"
                >
                  {isPlaying && currentTrack?.id === variantB.id ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current ml-0.5" /> Play Take 2
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {inspectProvenanceId && (
        <ProvenanceModal
          trackId={inspectProvenanceId}
          onClose={() => setInspectProvenanceId(null)}
        />
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="login"
      />
    </div>
  );
}

export default function CreateStudioPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-xs font-mono text-studio-500">Loading AI Composition Studio...</div>}>
      <CreateStudioContent />
    </Suspense>
  );
}
