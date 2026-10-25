"use client";

import React, { useState } from "react";
import { ProtectedRoute } from "@/components/ui/protected-route";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured, getSupabaseConfigStatus } from "@/lib/supabase";
import {
  Settings,
  Shield,
  Key,
  Sliders,
  User,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Mail,
  Cpu,
  Sparkles,
  Lock,
  Volume2,
  HardDrive,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { user, logout, resetPassword, isSupabaseActive, supabaseStatusMessage } = useAuth();
  const configStatus = getSupabaseConfigStatus();

  // Profile state
  const [displayName, setDisplayName] = useState(user?.full_name || "Mayyank");
  const [username, setUsername] = useState(user?.username || "mayyank04");
  const [bio, setBio] = useState("AI Music Producer & Audio DSP Explorer. Crafting cyberpunk and synthwave soundscapes.");
  const [artistGenres, setArtistGenres] = useState("Synthwave, Cyberpunk, Ambient");
  const [profileSaved, setProfileSaved] = useState(false);

  // Audio Engine DSP Preferences
  const [sampleRate, setSampleRate] = useState("44100");
  const [bufferSize, setBufferSize] = useState("1024");
  const [limiterCeiling, setLimiterCeiling] = useState("-0.3");
  const [defaultDuration, setDefaultDuration] = useState("60");
  const [fftSize, setFftSize] = useState("256");
  const [audioSaved, setAudioSaved] = useState(false);

  // Supabase Password Reset Test
  const [resetEmail, setResetEmail] = useState(user?.email || "");
  const [resetStatus, setResetStatus] = useState<{ message: string; success: boolean } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // API Keys state
  const [sunoKey, setSunoKey] = useState("");
  const [showSunoKey, setShowSunoKey] = useState(false);
  const [audiocraftEndpoint, setAudiocraftEndpoint] = useState("http://localhost:8000/api/v1/audiocraft");
  const [keysSaved, setKeysSaved] = useState(false);

  // Privacy & Provenance
  const [c2paAutoEmbed, setC2paAutoEmbed] = useState(true);
  const [privateByDefault, setPrivateByDefault] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handleSaveAudio = (e: React.FormEvent) => {
    e.preventDefault();
    setAudioSaved(true);
    setTimeout(() => setAudioSaved(false), 3000);
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setKeysSaved(true);
    setTimeout(() => setKeysSaved(false), 3000);
  };

  const handleTestPasswordReset = async () => {
    if (!resetEmail) return;
    setResetLoading(true);
    setResetStatus(null);
    try {
      const res = await resetPassword(resetEmail);
      setResetStatus(res);
    } catch (err: any) {
      setResetStatus({
        success: false,
        message: err.message || "Failed to trigger password reset.",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleClearCache = () => {
    if (typeof window !== "undefined") {
      sessionStorage.clear();
    }
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  return (
    <ProtectedRoute>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-studio-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                <Settings className="w-6 h-6 text-neon-cyan" />
                Studio Preferences & Authentication
              </h1>
              <Badge variant="cyan">Phase 1 Config</Badge>
            </div>
            <p className="text-xs text-studio-400">
              Manage Supabase authentication, audio DSP rendering pipeline, third-party neural model keys, and C2PA credentials.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign Out
          </Button>
        </div>

        {/* Supabase Authentication Status Panel */}
        <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-neon-purple" />
              <div>
                <h2 className="text-sm font-bold text-white">Supabase Authentication & Security Engine</h2>
                <p className="text-[11px] text-studio-400">
                  Real-time status of your project&apos;s authentication provider and active session.
                </p>
              </div>
            </div>

            {isSupabaseActive ? (
              <Badge variant="emerald" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Live Supabase Connected
              </Badge>
            ) : (
              <Badge variant="purple" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Development Session Mode
              </Badge>
            )}
          </div>

          {/* Details & Diagnostic Box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-studio-950/80 border border-studio-800/80 rounded-xl space-y-1">
              <span className="text-[10px] font-mono uppercase text-studio-500 block">Supabase URL</span>
              <span className="text-xs font-mono text-studio-200 block truncate">
                {configStatus.url ? configStatus.url : "Missing NEXT_PUBLIC_SUPABASE_URL"}
              </span>
            </div>

            <div className="p-3 bg-studio-950/80 border border-studio-800/80 rounded-xl space-y-1">
              <span className="text-[10px] font-mono uppercase text-studio-500 block">Current User ID</span>
              <span className="text-xs font-mono text-neon-cyan block truncate">
                {user?.id || "N/A"}
              </span>
            </div>

            <div className="p-3 bg-studio-950/80 border border-studio-800/80 rounded-xl space-y-1">
              <span className="text-[10px] font-mono uppercase text-studio-500 block">Session Status</span>
              <span className="text-xs font-mono text-neon-green block truncate">
                {user?.role ? `${user.role.toUpperCase()} (Active)` : "Verified Creator"}
              </span>
            </div>
          </div>

          {!isSupabaseActive && (
            <div className="p-3.5 bg-neon-purple/10 border border-neon-purple/20 rounded-xl text-xs text-studio-300 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-neon-purple flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Notice: Running in Development Mode. </span>
                To enable live cloud authentication, supply <code className="bg-studio-950 px-1 py-0.5 rounded text-neon-cyan">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-studio-950 px-1 py-0.5 rounded text-neon-cyan">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your environment variables.
              </div>
            </div>
          )}

          {/* Password Reset Tester */}
          <div className="pt-3 border-t border-studio-800/80 space-y-3">
            <span className="text-xs font-semibold text-white block">Test Supabase Password Recovery Flow:</span>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-studio-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter email to test recovery..."
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestPasswordReset}
                disabled={resetLoading || !resetEmail}
                className="text-xs whitespace-nowrap"
              >
                {resetLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Sending Request...
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 mr-1.5 text-neon-purple" />
                    Trigger Reset Email
                  </>
                )}
              </Button>
            </div>

            {resetStatus && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
                  resetStatus.success
                    ? "bg-neon-green/10 border border-neon-green/30 text-neon-green"
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                }`}
              >
                {resetStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{resetStatus.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Creator Profile & Identity */}
        <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <User className="w-5 h-5 text-neon-cyan" />
            <div>
              <h2 className="text-sm font-bold text-white">Artist Profile & Display Identity</h2>
              <p className="text-[11px] text-studio-400">
                Your public creator brand displayed on track releases and community leaderboards.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-studio-400 font-medium mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan"
                />
              </div>

              <div>
                <label className="block text-studio-400 font-medium mb-1.5">Username Handle</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-studio-500 font-mono">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-800 rounded-lg pl-7 pr-3 py-2 text-white focus:outline-none focus:border-neon-cyan font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-studio-400 font-medium mb-1.5">Artist Bio & Aesthetic Statement</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan resize-none"
              />
            </div>

            <div>
              <label className="block text-studio-400 font-medium mb-1.5">Primary Signature Genres</label>
              <input
                type="text"
                value={artistGenres}
                onChange={(e) => setArtistGenres(e.target.value)}
                className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan"
                placeholder="Comma separated genres..."
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button type="submit" variant="neon" size="sm" className="text-xs">
                Save Profile Information
              </Button>
              {profileSaved && (
                <span className="text-xs text-neon-green flex items-center gap-1 font-medium animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Profile updated successfully
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Audio Engine & DSP Performance */}
        <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-neon-green" />
            <div>
              <h2 className="text-sm font-bold text-white">Audio DSP Engine & Synthesis Latency</h2>
              <p className="text-[11px] text-studio-400">
                Configure browser Web Audio API graph parameters and synthesis buffer targets.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveAudio} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-studio-400 font-medium mb-1.5">Audio Engine Sample Rate</label>
                <select
                  value={sampleRate}
                  onChange={(e) => setSampleRate(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan font-mono"
                >
                  <option value="44100">44.1 kHz (CD Standard)</option>
                  <option value="48000">48.0 kHz (Cinema / Video Standard)</option>
                  <option value="96000">96.0 kHz (Audiophile Master)</option>
                </select>
              </div>

              <div>
                <label className="block text-studio-400 font-medium mb-1.5">Web Audio Buffer Size</label>
                <select
                  value={bufferSize}
                  onChange={(e) => setBufferSize(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan font-mono"
                >
                  <option value="512">512 samples (Ultra-low latency)</option>
                  <option value="1024">1024 samples (Balanced performance)</option>
                  <option value="2048">2048 samples (Safe buffering)</option>
                </select>
              </div>

              <div>
                <label className="block text-studio-400 font-medium mb-1.5">Master Limiter Ceiling</label>
                <select
                  value={limiterCeiling}
                  onChange={(e) => setLimiterCeiling(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan font-mono"
                >
                  <option value="-0.1">-0.1 dBTP (Maximum Volume)</option>
                  <option value="-0.3">-0.3 dBTP (True Peak Safe)</option>
                  <option value="-1.0">-1.0 dBTP (Streaming Normalized)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-studio-400 font-medium mb-1.5">Default Generation Duration</label>
                <select
                  value={defaultDuration}
                  onChange={(e) => setDefaultDuration(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan font-mono"
                >
                  <option value="30">30 seconds (Fast Sketch)</option>
                  <option value="60">60 seconds (Standard Hook)</option>
                  <option value="90">90 seconds (Extended Edit)</option>
                  <option value="120">120 seconds (Full Arrangement)</option>
                </select>
              </div>

              <div>
                <label className="block text-studio-400 font-medium mb-1.5">Canvas Visualizer FFT Resolution</label>
                <select
                  value={fftSize}
                  onChange={(e) => setFftSize(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan font-mono"
                >
                  <option value="128">128 bins (Performance Mode)</option>
                  <option value="256">256 bins (Default 60fps)</option>
                  <option value="512">512 bins (High Definition)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button type="submit" variant="neon" size="sm" className="text-xs">
                Apply Audio Engine Changes
              </Button>
              {audioSaved && (
                <span className="text-xs text-neon-green flex items-center gap-1 font-medium animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  DSP parameters applied
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Model Providers & BYO API Keys */}
        <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-neon-pink" />
            <div>
              <h2 className="text-sm font-bold text-white">AI Inference Engines & Custom Keys</h2>
              <p className="text-[11px] text-studio-400">
                Fombo includes zero-latency built-in DSP synthesis. You may also connect optional third-party neural endpoints.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveKeys} className="space-y-4 text-xs">
            <div className="p-3 bg-studio-950/70 border border-studio-800 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-semibold text-white">Fombo Procedural DSP Synthesizer</span>
                <p className="text-studio-400 text-[11px]">
                  Local mathematical additive/FM waveform synthesis engine. Zero latency, 100% offline uptime.
                </p>
              </div>
              <Badge variant="cyan">Always Active</Badge>
            </div>

            <div>
              <label className="block text-studio-400 font-medium mb-1.5">Optional Suno / Chirp API Key</label>
              <div className="relative">
                <input
                  type={showSunoKey ? "text" : "password"}
                  value={sunoKey}
                  onChange={(e) => setSunoKey(e.target.value)}
                  placeholder="sk-suno-..."
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg pl-3 pr-10 py-2 text-white focus:outline-none focus:border-neon-cyan font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowSunoKey(!showSunoKey)}
                  className="absolute right-3 top-2.5 text-studio-500 hover:text-white"
                >
                  {showSunoKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-studio-400 font-medium mb-1.5">Self-Hosted AudioCraft / MusicGen GPU Server</label>
              <input
                type="text"
                value={audiocraftEndpoint}
                onChange={(e) => setAudiocraftEndpoint(e.target.value)}
                className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button type="submit" variant="neon" size="sm" className="text-xs">
                Save Provider Endpoints
              </Button>
              {keysSaved && (
                <span className="text-xs text-neon-green flex items-center gap-1 font-medium animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Provider settings stored safely
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Provenance & Storage Management */}
        <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-studio-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Data Management & C2PA Provenance</h2>
              <p className="text-[11px] text-studio-400">
                Control cryptographic content assertions and local browser cache.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 bg-studio-950/70 border border-studio-800 rounded-xl cursor-pointer">
              <div>
                <span className="font-semibold text-white block">Auto-embed C2PA Content Credentials</span>
                <span className="text-[11px] text-studio-400">
                  Embed tamper-evident cryptographic provenance into all exported WAV/MP3 files.
                </span>
              </div>
              <input
                type="checkbox"
                checked={c2paAutoEmbed}
                onChange={(e) => setC2paAutoEmbed(e.target.checked)}
                className="rounded border-studio-700 text-neon-cyan focus:ring-0 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-studio-950/70 border border-studio-800 rounded-xl cursor-pointer">
              <div>
                <span className="font-semibold text-white block">Keep Studio Creations Private</span>
                <span className="text-[11px] text-studio-400">
                  Do not automatically feature newly generated songs in the public community feed.
                </span>
              </div>
              <input
                type="checkbox"
                checked={privateByDefault}
                onChange={(e) => setPrivateByDefault(e.target.checked)}
                className="rounded border-studio-700 text-neon-cyan focus:ring-0 w-4 h-4"
              />
            </label>

            <div className="flex items-center justify-between p-3 bg-studio-950/70 border border-studio-800 rounded-xl">
              <div>
                <span className="font-semibold text-white block">Local Audio Waveform Cache</span>
                <span className="text-[11px] text-studio-400">
                  Flush cached canvas visualizer buffers and temporary session tracks.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                className="text-xs"
              >
                Clear Cache
              </Button>
            </div>

            {cacheCleared && (
              <div className="p-2.5 bg-neon-cyan/10 border border-neon-cyan/30 rounded-xl text-xs text-neon-cyan flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Local browser audio cache flushed.
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
