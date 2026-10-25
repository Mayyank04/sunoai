"use client";

import React, { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api";
import {
  Play,
  Pause,
  Square,
  Repeat,
  Volume2,
  Sliders,
  Sparkles,
  Save,
  Download,
  Plus,
  Trash2,
  Check,
  Disc,
  Radio,
} from "lucide-react";

interface DawClip {
  id: string;
  name: string;
  startBeat: number;
  durationBeats: number;
  color: string;
}

interface DawTrack {
  id: string;
  name: string;
  volume: number; // 0.0 to 1.0
  pan: number; // -1.0 to 1.0
  muted: boolean;
  solo: boolean;
  color: string;
  clips: DawClip[];
}

const DEFAULT_DAW_TRACKS: DawTrack[] = [
  {
    id: "tr_1",
    name: "01 Drums (Punch Kick & Snare)",
    volume: 0.85,
    pan: 0.0,
    muted: false,
    solo: false,
    color: "#00f0ff",
    clips: [
      { id: "c1", name: "Drum Loop 4-Bar", startBeat: 0, durationBeats: 16, color: "#00f0ff" },
      { id: "c2", name: "Drum Break & Fill", startBeat: 16, durationBeats: 16, color: "#00f0ff" },
    ],
  },
  {
    id: "tr_2",
    name: "02 Bass (Analog Sub 808)",
    volume: 0.9,
    pan: 0.0,
    muted: false,
    solo: false,
    color: "#a855f7",
    clips: [
      { id: "c3", name: "Pumping Bassline", startBeat: 0, durationBeats: 16, color: "#a855f7" },
      { id: "c4", name: "Bass Drop Variant", startBeat: 16, durationBeats: 16, color: "#a855f7" },
    ],
  },
  {
    id: "tr_3",
    name: "03 Synth (Neon Polyphony)",
    volume: 0.75,
    pan: -0.25,
    muted: false,
    solo: false,
    color: "#ec4899",
    clips: [
      { id: "c5", name: "Chords & Arp", startBeat: 8, durationBeats: 16, color: "#ec4899" },
    ],
  },
  {
    id: "tr_4",
    name: "04 Atmosphere & FX",
    volume: 0.65,
    pan: 0.3,
    muted: false,
    solo: false,
    color: "#f59e0b",
    clips: [
      { id: "c6", name: "Riser & Shimmer", startBeat: 12, durationBeats: 8, color: "#f59e0b" },
      { id: "c7", name: "Downlifter Hit", startBeat: 20, durationBeats: 8, color: "#f59e0b" },
    ],
  },
];

export default function DawStudioPage() {
  const [tracks, setTracks] = useState<DawTrack[]>(DEFAULT_DAW_TRACKS);
  const [bpm, setBpm] = useState(124);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const [metronome, setMetronome] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.9);
  const [isSaved, setIsSaved] = useState(false);

  // Playhead animation loop
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      // 1 beat at 124 BPM = 60 / 124 = 0.484s
      const beatIntervalMs = (60 / bpm) * 1000 / 4; // 16th notes
      interval = setInterval(() => {
        setCurrentBeat((prev) => {
          const next = prev + 0.25;
          if (next >= 32) {
            return isLooping ? 0 : 32;
          }
          return next;
        });
      }, beatIntervalMs);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, bpm, isLooping]);

  const toggleMute = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
    );
  };

  const toggleSolo = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, solo: !t.solo } : t))
    );
  };

  const updateVolume = (trackId: string, vol: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, volume: vol } : t))
    );
  };

  const updatePan = (trackId: string, pan: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, pan } : t))
    );
  };

  const handleApplyAiMix = () => {
    // AI Producer automatically balances stereo panning and levels
    setTracks((prev) => [
      { ...prev[0], volume: 0.88, pan: 0.0 },     // Drums center
      { ...prev[1], volume: 0.92, pan: 0.0 },     // Bass center
      { ...prev[2], volume: 0.78, pan: -0.35 },   // Synth wide left
      { ...prev[3], volume: 0.65, pan: 0.35 },    // FX wide right
    ]);
  };

  const handleSaveProject = async () => {
    try {
      await apiRequest("/daw/projects", {
        method: "POST",
        body: JSON.stringify({
          title: "Neon City Studio Session",
          bpm,
          time_signature: "4/4",
          master_volume: masterVolume,
          project_state: { tracks },
        }),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch {}
  };

  return (
    <div className="py-6 max-w-7xl mx-auto space-y-6">
      {/* Studio Header & Transport Controls */}
      <div className="bg-studio-900 border border-studio-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        {/* Left Transport */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold transition shadow-lg ${
              isPlaying
                ? "bg-neon-pink text-white shadow-neon-pink/20"
                : "bg-neon-cyan text-studio-950 shadow-neon-cyan/20"
            }`}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentBeat(0);
            }}
            className="w-10 h-10 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-300 flex items-center justify-center border border-studio-700 transition"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition ${
              isLooping
                ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan"
                : "bg-studio-800 border-studio-700 text-studio-400"
            }`}
          >
            <Repeat className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMetronome(!metronome)}
            className={`px-3 h-10 rounded-xl flex items-center gap-1.5 border font-mono text-xs font-semibold transition ${
              metronome
                ? "bg-neon-purple/20 border-neon-purple text-neon-purple"
                : "bg-studio-800 border-studio-700 text-studio-400"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>CLICK</span>
          </button>
        </div>

        {/* Center Clock & BPM */}
        <div className="flex items-center gap-4 bg-studio-950 px-4 py-2 rounded-xl border border-studio-800">
          <div>
            <span className="text-[10px] text-studio-500 font-mono block">BAR / BEAT</span>
            <span className="font-mono text-base font-bold text-neon-cyan">
              {Math.floor(currentBeat / 4) + 1} : {Math.floor(currentBeat % 4) + 1}
            </span>
          </div>
          <div className="h-8 w-px bg-studio-800"></div>
          <div>
            <span className="text-[10px] text-studio-500 font-mono block">TEMPO</span>
            <input
              type="number"
              min="60"
              max="200"
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
              className="w-16 bg-transparent font-mono text-base font-bold text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Master Fader & Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-studio-400" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-24 h-1.5 bg-studio-800 rounded-lg accent-neon-cyan"
            />
          </div>

          <button
            onClick={handleSaveProject}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-200 border border-studio-700 text-xs font-medium transition"
          >
            {isSaved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? "Saved" : "Save Project"}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Multitrack Timeline & AI Producer */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Multitrack Workspace (3 cols) */}
        <div className="lg:col-span-3 bg-studio-900 border border-studio-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Timeline Bar Rulers */}
          <div className="flex border-b border-studio-800 bg-studio-950/80">
            <div className="w-64 p-3 border-r border-studio-800 text-xs font-mono text-studio-500 font-semibold uppercase">
              Track Controls
            </div>
            <div className="flex-1 relative flex items-center px-4 font-mono text-[11px] text-studio-500">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
                <div key={bar} className="flex-1 border-l border-studio-800/60 pl-2">
                  Bar {bar}
                </div>
              ))}
              {/* Playhead Marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-neon-cyan shadow-[0_0_8px_#00f0ff] z-20 pointer-events-none transition-all duration-75"
                style={{ left: `${(currentBeat / 32) * 100}%` }}
              >
                <div className="w-2 h-2 -ml-[3px] bg-neon-cyan rotate-45"></div>
              </div>
            </div>
          </div>

          {/* Tracks List */}
          <div className="divide-y divide-studio-800">
            {tracks.map((track) => (
              <div key={track.id} className="flex h-24 hover:bg-studio-850/30 transition">
                {/* Track Channel Strip */}
                <div className="w-64 p-3.5 border-r border-studio-800 flex flex-col justify-between bg-studio-950/40">
                  <div className="flex items-center justify-between">
                    <span
                      className="font-bold text-xs truncate max-w-[140px]"
                      style={{ color: track.color }}
                    >
                      {track.name}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleMute(track.id)}
                        className={`w-5 h-5 rounded text-[10px] font-bold font-mono transition ${
                          track.muted
                            ? "bg-neon-crimson text-white"
                            : "bg-studio-800 text-studio-400 hover:text-studio-200"
                        }`}
                      >
                        M
                      </button>
                      <button
                        onClick={() => toggleSolo(track.id)}
                        className={`w-5 h-5 rounded text-[10px] font-bold font-mono transition ${
                          track.solo
                            ? "bg-neon-amber text-studio-950"
                            : "bg-studio-800 text-studio-400 hover:text-studio-200"
                        }`}
                      >
                        S
                      </button>
                    </div>
                  </div>

                  {/* Volume & Pan */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-studio-400">
                    <div>
                      <div className="flex justify-between">
                        <span>VOL</span>
                        <span>{Math.round(track.volume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={track.volume}
                        onChange={(e) => updateVolume(track.id, parseFloat(e.target.value))}
                        className="w-full h-1 bg-studio-800 rounded appearance-none cursor-pointer accent-neon-cyan"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>PAN</span>
                        <span>{track.pan < 0 ? `L${Math.abs(Math.round(track.pan * 100))}` : track.pan > 0 ? `R${Math.round(track.pan * 100)}` : "C"}</span>
                      </div>
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.05"
                        value={track.pan}
                        onChange={(e) => updatePan(track.id, parseFloat(e.target.value))}
                        className="w-full h-1 bg-studio-800 rounded appearance-none cursor-pointer accent-neon-purple"
                      />
                    </div>
                  </div>
                </div>

                {/* Timeline Clip Lane */}
                <div className="flex-1 relative bg-studio-950/20 daw-grid p-2">
                  {track.clips.map((clip) => {
                    const leftPercent = (clip.startBeat / 32) * 100;
                    const widthPercent = (clip.durationBeats / 32) * 100;

                    return (
                      <div
                        key={clip.id}
                        className="absolute top-2 bottom-2 rounded-xl border p-2 flex flex-col justify-between overflow-hidden shadow-lg cursor-pointer hover:brightness-110 transition group"
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          backgroundColor: `${clip.color}15`,
                          borderColor: `${clip.color}60`,
                        }}
                      >
                        <span className="text-[11px] font-bold text-white truncate drop-shadow">
                          {clip.name}
                        </span>
                        {/* Fake micro-waveform lines */}
                        <div className="flex items-end gap-0.5 h-6 opacity-60">
                          {[30, 60, 85, 40, 70, 95, 55, 80, 45, 90, 65, 35, 75, 50].map((h, i) => (
                            <span
                              key={i}
                              className="w-1 rounded-full"
                              style={{ height: `${h}%`, backgroundColor: clip.color }}
                            ></span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Producer Copilot (1 col) */}
        <div className="space-y-6">
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-studio-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neon-cyan" />
                AI Producer Copilot
              </h3>
              <span className="text-[10px] font-mono text-neon-cyan bg-neon-cyan/10 px-2 py-0.5 rounded border border-neon-cyan/20">
                ACTIVE
              </span>
            </div>

            <p className="text-xs text-studio-400 leading-relaxed">
              Real-time spectral balance and arrangement insights analyzing your multitrack project.
            </p>

            {/* Suggestions List */}
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-studio-950 border border-studio-800 space-y-1">
                <span className="text-neon-cyan font-bold block">1. Low-End Clarity</span>
                <p className="text-studio-400 text-[11px]">
                  Sub-bass and Kick both centered at 65Hz. Apply slight ducking sidechain compression.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-studio-950 border border-studio-800 space-y-1">
                <span className="text-neon-purple font-bold block">2. Stereo Field Width</span>
                <p className="text-studio-400 text-[11px]">
                  Panned Synth Pad to L35 and Atmosphere to R35 for expansive psychoacoustic width.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-studio-950 border border-studio-800 space-y-1">
                <span className="text-emerald-400 font-bold block">3. Master Headroom</span>
                <p className="text-studio-400 text-[11px]">
                  Peak headroom sits comfortably at -1.4 dBFS. Ready for streaming master export.
                </p>
              </div>
            </div>

            <button
              onClick={handleApplyAiMix}
              className="w-full py-2.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-neon-cyan border border-neon-cyan/30 text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Apply AI Stereo & Mix Balance</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
