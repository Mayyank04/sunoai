"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { useAudioPlayer, TrackItem } from "@/context/AudioPlayerContext";
import {
  FolderHeart,
  Play,
  Pause,
  Trash2,
  ShieldCheck,
  Disc,
  Download,
  Sliders,
  Sparkles,
} from "lucide-react";
import { ProvenanceModal } from "@/components/provenance/ProvenanceModal";

export default function LibraryPage() {
  const { playTrack, currentTrack, isPlaying, togglePlay } = useAudioPlayer();
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectProvenanceId, setInspectProvenanceId] = useState<string | null>(null);

  const loadTracks = () => {
    setLoading(true);
    apiRequest<{ tracks: TrackItem[] }>("/library/tracks?limit=50")
      .then((res) => setTracks(res.tracks || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTracks();
  }, []);

  const handleDelete = async (trackId: string) => {
    if (!confirm("Are you sure you want to delete this track from your library?")) return;
    try {
      await apiRequest(`/library/tracks/${trackId}`, { method: "DELETE" });
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
    } catch {}
  };

  return (
    <div className="py-6 max-w-6xl mx-auto space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <FolderHeart className="w-7 h-7 text-neon-cyan" />
            My Audio Library
          </h1>
          <p className="text-xs md:text-sm text-studio-400 mt-1">
            Manage your generated masters, isolated stems, and DAW project sessions.
          </p>
        </div>
        <a
          href="/create"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neon-cyan text-studio-950 font-bold text-xs hover:opacity-90 transition shadow-lg shadow-neon-cyan/20"
        >
          <Sparkles className="w-4 h-4 fill-current" />
          <span>New Track</span>
        </a>
      </div>

      {/* Library Table / List */}
      <div className="bg-studio-900 border border-studio-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-studio-800 flex items-center justify-between text-xs font-mono text-studio-400 uppercase font-semibold">
          <span>{tracks.length} Master Recordings</span>
          <span>Provenance Verified</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-studio-500 text-sm">Loading library tracks...</div>
        ) : tracks.length === 0 ? (
          <div className="py-16 text-center text-studio-500 space-y-3">
            <Disc className="w-10 h-10 mx-auto text-studio-600" />
            <p className="text-sm">Your library is currently empty. Generate a song in the Creation Studio!</p>
          </div>
        ) : (
          <div className="divide-y divide-studio-800">
            {tracks.map((track) => {
              const isThisPlaying = isPlaying && currentTrack?.id === track.id;

              return (
                <div
                  key={track.id}
                  className="p-4 flex items-center justify-between hover:bg-studio-850/50 transition gap-4 group"
                >
                  {/* Left Play & Title */}
                  <div className="flex items-center gap-3.5 min-w-[240px]">
                    <button
                      onClick={() => (isThisPlaying ? togglePlay() : playTrack(track))}
                      className="w-10 h-10 rounded-xl bg-studio-800 group-hover:bg-neon-cyan text-studio-300 group-hover:text-studio-950 flex items-center justify-center transition shadow"
                    >
                      {isThisPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>
                    <div className="truncate">
                      <h4 className="font-semibold text-sm text-studio-100 group-hover:text-neon-cyan transition truncate">
                        {track.title}
                      </h4>
                      <p className="text-xs text-studio-400">
                        {track.genre || "Electronic"} • {Math.round(track.duration_seconds)}s
                        {track.musical_key && ` • ${track.musical_key}`}
                      </p>
                    </div>
                  </div>

                  {/* Waveform Visualization */}
                  <div className="hidden md:flex items-end gap-0.5 h-6 w-48 flex-shrink-0 opacity-80">
                    {(track.waveform_data || [20, 50, 75, 40, 85, 95, 60, 30, 70, 90, 50, 40, 80]).slice(0, 24).map((h, i) => (
                      <span
                        key={i}
                        className={`w-1 rounded-full ${
                          isThisPlaying ? "bg-neon-cyan" : "bg-studio-700"
                        }`}
                        style={{ height: `${Math.max(15, h)}%` }}
                      ></span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInspectProvenanceId(track.id)}
                      className="p-2 rounded-lg bg-studio-800 hover:bg-studio-750 text-neon-cyan transition"
                      title="Inspect C2PA Provenance"
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </button>
                    <a
                      href={`/stems?track_id=${track.id}`}
                      className="p-2 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 transition"
                      title="Isolate Stems"
                    >
                      <Sliders className="w-4 h-4" />
                    </a>
                    <a
                      href={track.audio_url}
                      download={`${track.title}.wav`}
                      className="p-2 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 transition"
                      title="Download Master WAV"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDelete(track.id)}
                      className="p-2 rounded-lg bg-studio-800 hover:bg-neon-crimson/20 text-studio-400 hover:text-neon-crimson transition"
                      title="Delete Track"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {inspectProvenanceId && (
        <ProvenanceModal trackId={inspectProvenanceId} onClose={() => setInspectProvenanceId(null)} />
      )}
    </div>
  );
}
