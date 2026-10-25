"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { useAudioPlayer, TrackItem } from "@/context/AudioPlayerContext";
import {
  Layers,
  Sparkles,
  Download,
  Sliders,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Disc,
} from "lucide-react";

interface StemItem {
  stem_type: string;
  audio_url: string;
  duration_seconds: number;
  waveform_data?: number[];
}

export default function StemsPage() {
  const { playTrack, currentTrack, isPlaying, togglePlay } = useAudioPlayer();
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [isSeparating, setIsSeparating] = useState(false);
  const [stems, setStems] = useState<StemItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ tracks: TrackItem[] }>("/library/tracks?limit=20")
      .then((res) => {
        setTracks(res.tracks || []);
        if (res.tracks && res.tracks.length > 0) {
          setSelectedTrackId(res.tracks[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleSeparateStems = async () => {
    if (!selectedTrackId) return;
    setIsSeparating(true);
    setErrorMessage(null);
    try {
      const res = await apiRequest<{ track_id: string; stems: StemItem[] }>("/stems/separate", {
        method: "POST",
        body: JSON.stringify({
          track_id: selectedTrackId,
          stem_model: "htdemucs_v4",
        }),
      });
      setStems(res.stems);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to separate stems.");
    } finally {
      setIsSeparating(false);
    }
  };

  const stemColors: Record<string, string> = {
    vocals: "#ec4899",
    drums: "#00f0ff",
    bass: "#a855f7",
    other: "#f59e0b",
  };

  return (
    <div className="py-6 max-w-5xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
          <Layers className="w-7 h-7 text-neon-cyan" />
          Neural Stem Separation Studio
        </h1>
        <p className="text-xs md:text-sm text-studio-400 mt-1">
          Deconstruct stereo masters into discrete 4-track stems: Vocals, Drums, Bass, and Melody with Demucs v4 architecture.
        </p>
      </div>

      {/* Track Selector Card */}
      <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-4">
        <label className="text-xs font-mono font-semibold uppercase text-studio-300 block">
          Select Master Track from Library
        </label>
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={selectedTrackId}
            onChange={(e) => setSelectedTrackId(e.target.value)}
            className="flex-1 bg-studio-950 border border-studio-800 rounded-xl px-4 py-3 text-sm text-studio-200 focus:outline-none focus:border-neon-cyan/50"
          >
            {tracks.length > 0 ? (
              tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.genre || "Electronic"} • {Math.round(t.duration_seconds)}s)
                </option>
              ))
            ) : (
              <option value="">No library tracks available. Create one first.</option>
            )}
          </select>
          <button
            onClick={handleSeparateStems}
            disabled={!selectedTrackId || isSeparating}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-studio-950 font-bold text-xs uppercase tracking-wide hover:opacity-95 disabled:opacity-50 transition shadow-lg shadow-neon-cyan/20 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>{isSeparating ? "Separating Stems..." : "Isolate 4 Stems (Demucs)"}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-neon-crimson/10 border border-neon-crimson/30 flex items-center gap-2.5 text-neon-crimson text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Stems 4-Track Mixer Display */}
      {stems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono font-bold text-studio-200 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Isolated Multitrack Channels (4 Stems)
            </h2>
            <a
              href="/studio"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-750 text-neon-cyan text-xs font-semibold border border-neon-cyan/30 transition"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Import to DAW Session</span>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {stems.map((stem) => {
              const color = stemColors[stem.stem_type] || "#00f0ff";
              const isThisPlaying = isPlaying && currentTrack?.audio_url === stem.audio_url;

              return (
                <div
                  key={stem.stem_type}
                  className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl hover:border-studio-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-mono font-bold uppercase tracking-wider"
                      style={{ color }}
                    >
                      {stem.stem_type} STEM
                    </span>
                    <a
                      href={stem.audio_url}
                      download={`${stem.stem_type}.wav`}
                      className="p-1.5 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 transition"
                      title="Download WAV"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Waveform Micro Representation */}
                  <div className="h-14 bg-studio-950 rounded-xl p-3 flex items-end gap-1 border border-studio-800/80">
                    {(stem.waveform_data || [10, 30, 60, 45, 80, 50, 70, 90, 40, 65, 85, 30, 55, 75, 95, 40]).map(
                      (h, i) => (
                        <span
                          key={i}
                          className="flex-1 rounded-full transition-all"
                          style={{
                            height: `${Math.max(15, h)}%`,
                            backgroundColor: color,
                            opacity: isThisPlaying ? 1.0 : 0.6,
                          }}
                        ></span>
                      )
                    )}
                  </div>

                  {/* Play Action */}
                  <button
                    onClick={() =>
                      isThisPlaying
                        ? togglePlay()
                        : playTrack({
                            id: `${selectedTrackId}_${stem.stem_type}`,
                            title: `${stem.stem_type.toUpperCase()} Stem`,
                            duration_seconds: stem.duration_seconds,
                            audio_url: stem.audio_url,
                          })
                    }
                    className="w-full py-2.5 rounded-xl bg-studio-850 hover:bg-studio-800 text-studio-200 text-xs font-bold transition flex items-center justify-center gap-2 border border-studio-750"
                  >
                    {isThisPlaying ? (
                      <>
                        <Pause className="w-4 h-4 fill-current text-neon-pink" /> Pause Stem
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current ml-0.5 text-neon-cyan" /> Play Stem Solo
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
