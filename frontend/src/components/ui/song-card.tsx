"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAudioPlayer, TrackItem } from "@/context/AudioPlayerContext";
import { Play, Pause, Disc, ShieldCheck, Heart, MoreVertical, Radio } from "lucide-react";
import { Badge } from "./badge";
import { ProvenanceModal } from "@/components/provenance/ProvenanceModal";

interface SongCardProps {
  track: TrackItem;
  artistUsername?: string;
  showArtist?: boolean;
}

export const SongCard: React.FC<SongCardProps> = ({
  track,
  artistUsername = "soundweaver",
  showArtist = true,
}) => {
  const { currentTrack, isPlaying, playTrack, togglePlay } = useAudioPlayer();
  const [showProvenance, setShowProvenance] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  const isThisPlaying = isPlaying && currentTrack?.id === track.id;

  const formatDuration = (secs: number) => {
    if (!secs || isNaN(secs)) return "0:30";
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? "0" : ""}${rem}`;
  };

  return (
    <>
      <div className="group bg-studio-900/90 hover:bg-studio-850/90 border border-studio-800 hover:border-studio-700/80 rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between shadow-xl">
        <div>
          {/* Artwork Container */}
          <div className="relative aspect-square rounded-xl bg-gradient-to-br from-studio-800 via-studio-850 to-studio-950 border border-studio-700/60 overflow-hidden flex items-center justify-center mb-3.5 group-hover:border-neon-cyan/40 transition">
            <Disc
              className={`w-14 h-14 text-studio-600 transition-all duration-300 ${
                isThisPlaying ? "animate-spin text-neon-cyan scale-110" : "group-hover:text-neon-cyan/60"
              }`}
            />

            {/* Play Button Overlay */}
            <button
              onClick={() => (isThisPlaying ? togglePlay() : playTrack(track))}
              aria-label={isThisPlaying ? "Pause Track" : "Play Track"}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-neon-cyan text-studio-950 flex items-center justify-center shadow-lg transform group-hover:scale-105 active:scale-95 transition">
                {isThisPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </div>
            </button>

            {/* Top Right Duration Pill */}
            <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-studio-950/80 backdrop-blur-md border border-studio-800 text-[10px] font-mono text-studio-300">
              {formatDuration(track.duration_seconds)}
            </span>

            {/* BPM Pill */}
            {track.bpm && (
              <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-studio-950/80 backdrop-blur-md border border-studio-800 text-[10px] font-mono text-neon-cyan">
                {track.bpm} BPM
              </span>
            )}
          </div>

          {/* Title & Artist */}
          <div className="space-y-1">
            <Link
              href={`/song/${track.id}`}
              className="font-bold text-sm text-studio-100 hover:text-neon-cyan transition block truncate"
            >
              {track.title}
            </Link>

            {showArtist && (
              <Link
                href={`/profile/${artistUsername}`}
                className="text-xs text-studio-400 hover:text-studio-200 transition block truncate"
              >
                @{artistUsername}
              </Link>
            )}

            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[11px] text-studio-500 font-medium">
                {track.genre || "Electronic"}
              </span>
              {track.musical_key && (
                <span className="text-[11px] text-studio-500">• {track.musical_key}</span>
              )}
            </div>
          </div>
        </div>

        {/* Card Footer: Waveform, Provenance & Like */}
        <div className="mt-3.5 pt-3 border-t border-studio-800/80 flex items-center justify-between">
          {/* Micro Waveform */}
          <div className="flex items-end gap-0.5 h-5 w-24">
            {(track.waveform_data || [15, 30, 60, 45, 80, 50, 70, 90, 40, 65, 85, 30]).slice(0, 12).map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all ${
                  isThisPlaying ? "bg-neon-cyan" : "bg-studio-700 group-hover:bg-studio-500"
                }`}
                style={{ height: `${Math.max(15, h)}%` }}
              ></span>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsLiked(!isLiked)}
              aria-label="Like track"
              className={`p-1.5 rounded-lg transition ${
                isLiked ? "text-neon-pink" : "text-studio-500 hover:text-studio-300"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-current" : ""}`} />
            </button>
            <button
              onClick={() => setShowProvenance(true)}
              aria-label="View C2PA Provenance"
              className="p-1.5 rounded-lg text-studio-400 hover:text-neon-cyan hover:bg-studio-800 transition"
              title="Inspect C2PA Manifest"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {showProvenance && (
        <ProvenanceModal trackId={track.id} onClose={() => setShowProvenance(false)} />
      )}
    </>
  );
};
