"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { TrackItem } from "@/context/AudioPlayerContext";
import { SongCard } from "@/components/ui/song-card";
import { SongCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Disc, Flame, Sparkles, Radio, Trophy, Music } from "lucide-react";

export default function ExplorePage() {
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string>("All");

  const genres = ["All", "Synthwave", "Lo-Fi Hip Hop", "Cyberpunk", "Ambient", "Deep House", "Cinematic"];

  useEffect(() => {
    apiRequest<{ tracks: TrackItem[] }>("/library/tracks?public_only=true&limit=30")
      .then((res) => {
        setTracks(res.tracks || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredTracks =
    selectedGenre === "All"
      ? tracks
      : tracks.filter((t) => t.genre?.toLowerCase().includes(selectedGenre.toLowerCase()));

  return (
    <div className="py-6 max-w-7xl mx-auto space-y-10">
      {/* Spotlight Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-studio-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Disc className="w-7 h-7 text-neon-cyan animate-spin-slow" />
            Explore Global AI Master Catalog
          </h1>
          <p className="text-xs md:text-sm text-studio-400 mt-1">
            Discover community compositions rendered with procedural synthesis, MusicGen, and Suno AI models.
          </p>
        </div>

        {/* Live Audio Telemetry Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-studio-900 border border-studio-800 text-xs font-mono text-studio-300 w-fit">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>44.1kHz / 16-bit PCM Stream</span>
        </div>
      </div>

      {/* Genre Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-medium">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGenre(g)}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${
              selectedGenre === g
                ? "bg-neon-cyan text-studio-950 font-bold shadow-md shadow-neon-cyan/20"
                : "bg-studio-900 hover:bg-studio-850 text-studio-400 hover:text-studio-200 border border-studio-800"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Track Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <SongCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredTracks.length === 0 ? (
        <EmptyState
          icon={Music}
          title="No Master Tracks Found"
          description={`No recordings currently match the '${selectedGenre}' filter. Create the first track in our Creation Studio!`}
          actionLabel="Open Creation Studio"
          actionHref="/create"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredTracks.map((track) => (
            <SongCard key={track.id} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}
