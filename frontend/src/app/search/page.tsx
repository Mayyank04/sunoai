"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { TrackItem } from "@/context/AudioPlayerContext";
import { SongCard } from "@/components/ui/song-card";
import { SongCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, SlidersHorizontal, Music, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [selectedKey, setSelectedKey] = useState("All");
  const [minBpm, setMinBpm] = useState(60);
  const [maxBpm, setMaxBpm] = useState(180);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const popularTags = ["synthwave", "analog", "80s", "lo-fi", "chill", "sub-bass", "piano", "cyberpunk"];
  const musicalKeys = ["All", "C Major", "C Minor", "D Minor", "Eb Major", "F Minor", "G Minor", "A Minor", "Bb Major"];

  useEffect(() => {
    setLoading(true);
    apiRequest<{ tracks: TrackItem[] }>("/library/tracks?public_only=true&limit=40")
      .then((res) => {
        setTracks(res.tracks || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredTracks = tracks.filter((track) => {
    const qLower = query.toLowerCase();
    const matchesQuery =
      !query.trim() ||
      track.title.toLowerCase().includes(qLower) ||
      (track.genre && track.genre.toLowerCase().includes(qLower));

    const matchesKey = selectedKey === "All" || track.musical_key === selectedKey;
    const matchesBpm = !track.bpm || (track.bpm >= minBpm && track.bpm <= maxBpm);
    const matchesTag =
      !selectedTag ||
      (track.genre && track.genre.toLowerCase().includes(selectedTag.toLowerCase()));

    return matchesQuery && matchesKey && matchesBpm && matchesTag;
  });

  return (
    <div className="py-6 max-w-7xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
          <Search className="w-7 h-7 text-neon-cyan" />
          Acoustic Search & Tag Filtering
        </h1>
        <p className="text-xs md:text-sm text-studio-400 mt-1">
          Filter through generated catalogs by BPM tempo, harmonic scale key, and genre prompt tags.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="bg-studio-900 border border-studio-800 rounded-2xl p-4 shadow-xl space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-studio-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by track name, genre, atmosphere, or style tags..."
            className="w-full bg-studio-950 border border-studio-800 rounded-xl pl-11 pr-10 py-3 text-sm text-studio-100 placeholder-studio-500 focus:outline-none focus:border-neon-cyan/50 transition"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-studio-500 hover:text-studio-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
          {/* Musical Key */}
          <div className="space-y-1">
            <span className="text-studio-400 font-mono block">HARMONIC KEY</span>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-studio-200 focus:outline-none"
            >
              {musicalKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          {/* BPM Filter */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono text-studio-400">
              <span>BPM RANGE</span>
              <span className="text-neon-cyan font-bold">{minBpm} - {maxBpm}</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="range"
                min="60"
                max="180"
                value={minBpm}
                onChange={(e) => setMinBpm(parseInt(e.target.value))}
                className="w-full h-1 bg-studio-800 rounded accent-neon-cyan"
              />
              <input
                type="range"
                min="60"
                max="180"
                value={maxBpm}
                onChange={(e) => setMaxBpm(parseInt(e.target.value))}
                className="w-full h-1 bg-studio-800 rounded accent-neon-purple"
              />
            </div>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setSelectedKey("All");
                setMinBpm(60);
                setMaxBpm(180);
                setSelectedTag(null);
              }}
              className="w-full"
            >
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Popular Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-mono text-studio-500 uppercase">Tags:</span>
          {popularTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-lg text-xs transition ${
                selectedTag === tag
                  ? "bg-neon-cyan text-studio-950 font-bold"
                  : "bg-studio-800 hover:bg-studio-750 text-studio-300 border border-studio-700/60"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-studio-400">
          <span>{filteredTracks.length} recordings found</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <SongCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredTracks.length === 0 ? (
          <EmptyState
            icon={Music}
            title="No Matching Audio Found"
            description="Try adjusting your BPM range, clearing tag filters, or using different keyword search terms."
            actionLabel="Reset Filters"
            onAction={() => {
              setQuery("");
              setSelectedKey("All");
              setMinBpm(60);
              setMaxBpm(180);
              setSelectedTag(null);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredTracks.map((track) => (
              <SongCard key={track.id} track={track} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center space-y-3 font-mono text-xs text-studio-400">
          <div className="w-8 h-8 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin mx-auto" />
          <p>Initializing search filters...</p>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

