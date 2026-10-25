"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAudioPlayer, TrackItem } from "@/context/AudioPlayerContext";
import { apiRequest } from "@/lib/api";
import {
  Sparkles,
  Play,
  Pause,
  Sliders,
  ShieldCheck,
  Disc,
  Flame,
  Radio,
  ArrowRight,
} from "lucide-react";
import { ProvenanceModal } from "@/components/provenance/ProvenanceModal";

// Featured Starter Tracks for Explore Feed
const CURATED_EXPLORE_TRACKS: TrackItem[] = [
  {
    id: "curated_synthwave_01",
    title: "Midnight Chrome Drive",
    genre: "Synthwave",
    bpm: 124,
    musical_key: "F Minor",
    duration_seconds: 60.0,
    audio_url: "/api/v1/storage/file/tracks/demo_synthwave.wav",
    waveform_data: [12, 28, 45, 68, 85, 92, 75, 54, 88, 96, 62, 40, 72, 85, 90, 60, 48, 80, 95, 70],
    commercial_rights_status: "commercial_granted",
  },
  {
    id: "curated_lofi_02",
    title: "Rainy Cafe Memories",
    genre: "Lo-Fi Hip Hop",
    bpm: 84,
    musical_key: "Eb Major",
    duration_seconds: 45.0,
    audio_url: "/api/v1/storage/file/tracks/demo_lofi.wav",
    waveform_data: [8, 15, 30, 42, 55, 60, 48, 35, 58, 65, 50, 32, 45, 55, 62, 44, 30, 52, 60, 42],
    commercial_rights_status: "commercial_granted",
  },
  {
    id: "curated_cyberpunk_03",
    title: "Neon Overdrive Inversion",
    genre: "Cyberpunk Industrial",
    bpm: 140,
    musical_key: "D Minor",
    duration_seconds: 50.0,
    audio_url: "/api/v1/storage/file/tracks/demo_cyber.wav",
    waveform_data: [20, 45, 75, 90, 98, 85, 92, 80, 95, 100, 88, 70, 85, 96, 90, 75, 60, 88, 95, 82],
    commercial_rights_status: "non_commercial_personal",
  },
  {
    id: "curated_ambient_04",
    title: "Orbital Aurora Drifting",
    genre: "Ambient Space",
    bpm: 90,
    musical_key: "A Minor",
    duration_seconds: 75.0,
    audio_url: "/api/v1/storage/file/tracks/demo_ambient.wav",
    waveform_data: [10, 18, 25, 35, 42, 50, 45, 38, 48, 55, 46, 32, 40, 48, 52, 40, 28, 44, 50, 35],
    commercial_rights_status: "commercial_granted",
  },
];

export default function ExplorePage() {
  const { currentTrack, isPlaying, playTrack, togglePlay } = useAudioPlayer();
  const [tracks, setTracks] = useState<TrackItem[]>(CURATED_EXPLORE_TRACKS);
  const [selectedGenre, setSelectedGenre] = useState<string>("All");
  const [inspectProvenanceId, setInspectProvenanceId] = useState<string | null>(null);

  useEffect(() => {
    // Attempt to fetch public tracks from backend
    apiRequest<{ tracks: TrackItem[] }>("/library/tracks?public_only=true&limit=10")
      .then((res) => {
        if (res.tracks && res.tracks.length > 0) {
          // Merge user-generated tracks with curated
          setTracks([...res.tracks, ...CURATED_EXPLORE_TRACKS]);
        }
      })
      .catch(() => {
        // Use curated defaults
      });
  }, []);

  const genres = ["All", "Synthwave", "Lo-Fi Hip Hop", "Cyberpunk Industrial", "Ambient Space", "Cinematic"];
  const filteredTracks =
    selectedGenre === "All"
      ? tracks
      : tracks.filter((t) => t.genre?.toLowerCase().includes(selectedGenre.toLowerCase()));

  return (
    <div className="py-6 max-w-7xl mx-auto space-y-10">
      {/* Hero Studio Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-studio-900 via-studio-850 to-studio-900 border border-studio-700/80 p-8 md:p-12 shadow-2xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-neon-cyan/10 via-neon-purple/5 to-transparent pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-xs font-mono font-medium">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            FOMBO ENGINE v1.0.0-PROD
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Create Master Tracks with{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-neon-cyan via-white to-neon-purple">
              Next-Gen Audio AI
            </span>
          </h1>
          <p className="text-studio-300 text-sm md:text-base leading-relaxed">
            From intuitive text prompts to 32-track browser DAW arrangements, stem separation, and certified C2PA
            provenance. Zero fake audio. Pure algorithmic & neural sound synthesis.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/create"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-studio-950 font-bold text-sm hover:opacity-95 active:scale-95 transition shadow-lg shadow-neon-cyan/25"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>Start Creation Studio</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
            <Link
              href="/studio"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-studio-850 hover:bg-studio-800 border border-studio-700 text-studio-200 font-semibold text-sm transition"
            >
              <Sliders className="w-4 h-4 text-neon-cyan" />
              <span>Open Multitrack DAW</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Genre Filter Pills */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 text-xs font-medium">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGenre(g)}
            className={`px-4 py-2 rounded-xl transition ${
              selectedGenre === g
                ? "bg-neon-cyan text-studio-950 font-bold shadow-md shadow-neon-cyan/20"
                : "bg-studio-900 hover:bg-studio-850 text-studio-400 hover:text-studio-200 border border-studio-800"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Explore Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-neon-pink" />
            <h2 className="text-lg font-bold text-studio-100">Trending Master Tracks</h2>
          </div>
          <span className="text-xs text-studio-400 font-mono">
            {filteredTracks.length} verified compositions
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredTracks.map((track) => {
            const isThisPlaying = isPlaying && currentTrack?.id === track.id;

            return (
              <div
                key={track.id}
                className="group bg-studio-900/90 hover:bg-studio-850/90 border border-studio-800 hover:border-studio-700/80 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between shadow-xl"
              >
                <div>
                  {/* Artwork / Vinyl Placeholder */}
                  <div className="relative aspect-square rounded-xl bg-gradient-to-br from-studio-800 via-studio-850 to-studio-950 border border-studio-700/60 overflow-hidden flex items-center justify-center mb-4 group-hover:border-neon-cyan/40 transition">
                    <Disc
                      className={`w-14 h-14 text-studio-600 group-hover:text-neon-cyan/60 transition ${
                        isThisPlaying ? "animate-spin text-neon-cyan" : ""
                      }`}
                    />
                    {/* Play Overlay */}
                    <button
                      onClick={() => (isThisPlaying ? togglePlay() : playTrack(track))}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                    >
                      <div className="w-12 h-12 rounded-full bg-neon-cyan text-studio-950 flex items-center justify-center shadow-lg transform group-hover:scale-105 active:scale-95 transition">
                        {isThisPlaying ? (
                          <Pause className="w-6 h-6 fill-current" />
                        ) : (
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        )}
                      </div>
                    </button>
                    {/* Tag badge */}
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-studio-950/80 backdrop-blur-md border border-studio-800 text-[10px] font-mono text-studio-300">
                      {track.bpm || 120} BPM
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-studio-100 truncate group-hover:text-neon-cyan transition">
                    {track.title}
                  </h3>
                  <p className="text-xs text-studio-400 mt-1 flex items-center gap-1.5">
                    <span>{track.genre || "Electronic"}</span>
                    {track.musical_key && <span>• {track.musical_key}</span>}
                  </p>
                </div>

                {/* Waveform Micro-Bar Preview */}
                <div className="mt-4 pt-3 border-t border-studio-800/80 flex items-center justify-between">
                  <div className="flex items-end gap-0.5 h-6 w-28">
                    {(track.waveform_data || [20, 45, 60, 30, 75, 90, 40, 80, 50, 30]).slice(0, 14).map((h, i) => (
                      <span
                        key={i}
                        className={`w-1.5 rounded-full transition-all ${
                          isThisPlaying ? "bg-neon-cyan" : "bg-studio-700 group-hover:bg-studio-500"
                        }`}
                        style={{ height: `${Math.max(15, h)}%` }}
                      ></span>
                    ))}
                  </div>

                  {/* Provenance C2PA Button */}
                  <button
                    onClick={() => setInspectProvenanceId(track.id)}
                    className="p-1.5 rounded-lg text-studio-400 hover:text-neon-cyan hover:bg-studio-800 transition"
                    title="Inspect Provenance"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {inspectProvenanceId && (
        <ProvenanceModal trackId={inspectProvenanceId} onClose={() => setInspectProvenanceId(null)} />
      )}
    </div>
  );
}
