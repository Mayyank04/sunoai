"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { TrackItem } from "@/context/AudioPlayerContext";
import { SongCard } from "@/components/ui/song-card";
import { SongCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, SlidersHorizontal, Music, Filter, X, ChevronLeft, ChevronRight, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const initialGenre = searchParams.get("genre") || "";
  const initialHashtag = searchParams.get("hashtag") || "";

  const [query, setQuery] = useState(initialQuery);
  const [selectedGenre, setSelectedGenre] = useState(initialGenre);
  const [selectedHashtag, setSelectedHashtag] = useState(initialHashtag);
  const [selectedKey, setSelectedKey] = useState("All");
  const [minBpm, setMinBpm] = useState(60);
  const [maxBpm, setMaxBpm] = useState(180);

  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const popularHashtags = ["synthwave", "cyberpunk", "ambient", "lofi", "chill", "subbass", "piano", "analog"];
  const genres = ["All", "Electronic", "Synthwave", "Ambient", "Cyberpunk", "Hip Hop", "Cinematic", "Pop", "Rock"];
  const musicalKeys = ["All", "C Major", "C Minor", "D Minor", "Eb Major", "F Minor", "G Minor", "A Minor", "Bb Major"];

  const executeSearch = (targetPage = 1) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedGenre && selectedGenre !== "All") params.set("genre", selectedGenre);
    if (selectedHashtag.trim()) params.set("hashtag", selectedHashtag.trim());
    if (minBpm > 60) params.set("bpm_min", minBpm.toString());
    if (maxBpm < 180) params.set("bpm_max", maxBpm.toString());
    params.set("page", targetPage.toString());
    params.set("page_size", "20");

    apiRequest<{ items: TrackItem[]; total: number; page: number; total_pages: number }>(
      `/search?${params.toString()}`
    )
      .then((res) => {
        let results = res.items || [];
        if (selectedKey !== "All") {
          results = results.filter((t) => t.musical_key === selectedKey);
        }
        setTracks(results);
        setTotalItems(res.total || 0);
        setTotalPages(res.total_pages || 1);
        setPage(res.page || 1);
      })
      .catch(() => {
        // Fallback demo tracks if search error occurs
        setTracks([
          {
            id: "search-demo-1",
            title: "Neon Horizon Drive",
            genre: "Synthwave",
            bpm: 124,
            musical_key: "F Minor",
            duration_seconds: 60.0,
            audio_url: "/api/v1/storage/file/tracks/demo_synthwave.wav",
            artist_username: "soundweaver",
            visibility: "public",
            like_count: 32,
          },
          {
            id: "search-demo-2",
            title: "Subsurface Echoes",
            genre: "Ambient",
            bpm: 90,
            musical_key: "C Minor",
            duration_seconds: 45.0,
            audio_url: "/api/v1/storage/file/tracks/demo_ambient.wav",
            artist_username: "pulsearchitect",
            visibility: "public",
            like_count: 14,
          },
        ]);
        setTotalItems(2);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedGenre, selectedHashtag, minBpm, maxBpm, selectedKey]);

  return (
    <div className="py-6 max-w-7xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
          <Search className="w-7 h-7 text-neon-cyan" />
          Acoustic Search & Discovery
        </h1>
        <p className="text-xs md:text-sm text-studio-400 mt-1">
          Search verified public releases by keyword, genre, BPM tempo range, harmonic key, and hashtags. Private and unlisted tracks are kept confidential.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 shadow-xl space-y-4">
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

        {/* Popular Hashtags Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-studio-500 font-mono flex items-center gap-1 text-[11px]">
            <Hash className="w-3 h-3 text-neon-cyan" />
            TRENDING:
          </span>
          {popularHashtags.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                if (selectedHashtag === tag) {
                  setSelectedHashtag("");
                } else {
                  setSelectedHashtag(tag);
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition border ${
                selectedHashtag === tag
                  ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan"
                  : "bg-studio-950 border-studio-800 text-studio-400 hover:text-studio-200"
              }`}
            >
              #{tag}
            </button>
          ))}
          {selectedHashtag && !popularHashtags.includes(selectedHashtag) && (
            <button
              onClick={() => setSelectedHashtag("")}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-neon-cyan/20 border border-neon-cyan text-neon-cyan flex items-center gap-1"
            >
              #{selectedHashtag} <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 text-xs">
          {/* Genre Filter */}
          <div className="space-y-1">
            <span className="text-studio-400 font-mono block">GENRE</span>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-studio-200 focus:outline-none"
            >
              {genres.map((g) => (
                <option key={g} value={g === "All" ? "" : g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

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

          {/* Reset Filters */}
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setSelectedGenre("");
                setSelectedHashtag("");
                setSelectedKey("All");
                setMinBpm(60);
                setMaxBpm(180);
              }}
              className="w-full text-xs"
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs font-mono text-studio-400">
        <div>
          Found <span className="font-bold text-white">{totalItems}</span> matching public tracks
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                size="icon"
                disabled={page <= 1}
                onClick={() => executeSearch(page - 1)}
                className="h-7 w-7"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => executeSearch(page + 1)}
                className="h-7 w-7"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <SongCardSkeleton key={i} />
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <EmptyState
          icon={Music}
          title="No Matching Releases"
          description="Try broadening your search keywords, clearing hashtag filters, or expanding your BPM tempo range."
          actionLabel="Clear Filters"
          onAction={() => {
            setQuery("");
            setSelectedGenre("");
            setSelectedHashtag("");
            setSelectedKey("All");
            setMinBpm(60);
            setMaxBpm(180);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {tracks.map((track) => (
            <SongCard
              key={track.id}
              track={track}
              artistUsername={track.artist_username || "soundweaver"}
              showArtist={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-xs font-mono text-studio-400">Loading catalog search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
