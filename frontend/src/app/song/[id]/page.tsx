"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAudioPlayer, TrackItem } from "@/context/AudioPlayerContext";
import { CanvasVisualizer } from "@/components/player/CanvasVisualizer";
import { ProvenanceModal } from "@/components/provenance/ProvenanceModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Disc,
  ShieldCheck,
  Download,
  Sliders,
  Layers,
  FileText,
  Clock,
  Radio,
  Share2,
  Check,
  Sparkles,
} from "lucide-react";

export default function SongDetailPage() {
  const params = useParams();
  const router = useRouter();
  const trackId = params.id as string;

  const { playTrack, currentTrack, isPlaying, togglePlay, currentTime, duration, seek } =
    useAudioPlayer();

  const [track, setTrack] = useState<TrackItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProvenance, setShowProvenance] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiRequest<TrackItem>(`/library/tracks/${trackId}`)
      .then(setTrack)
      .catch(() => {
        // Fallback for demo tracks
        setTrack({
          id: trackId,
          title: "Midnight Chrome Drive",
          genre: "Synthwave",
          bpm: 124,
          musical_key: "F Minor",
          duration_seconds: 60.0,
          audio_url: "/api/v1/storage/file/tracks/demo_synthwave.wav",
          commercial_rights_status: "commercial_granted",
        });
      })
      .finally(() => setLoading(false));
  }, [trackId]);

  const isThisPlaying = isPlaying && currentTrack?.id === track?.id;

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? "0" : ""}${rem}`;
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin mx-auto"></div>
        <p className="text-xs text-studio-400 font-mono">Loading audio asset and waveform...</p>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="py-24 text-center text-studio-400">
        Recording not found.
      </div>
    );
  }

  return (
    <div className="py-6 max-w-5xl mx-auto space-y-8">
      {/* Song Header & Playback Station */}
      <div className="bg-gradient-to-r from-studio-900 via-studio-850 to-studio-900 border border-studio-800 rounded-3xl p-6 md:p-10 shadow-2xl space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Vinyl Visualizer Artwork */}
          <div className="w-32 h-32 rounded-2xl bg-studio-950 border border-studio-700/60 overflow-hidden flex items-center justify-center relative flex-shrink-0 shadow-2xl group">
            <Disc
              className={`w-16 h-16 text-neon-cyan transition-all duration-300 ${
                isThisPlaying ? "animate-spin scale-110" : ""
              }`}
            />
            <button
              onClick={() => (isThisPlaying ? togglePlay() : playTrack(track))}
              aria-label={isThisPlaying ? "Pause" : "Play"}
              className="absolute inset-0 bg-black/40 flex items-center justify-center transition cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-neon-cyan text-studio-950 flex items-center justify-center shadow-xl">
                {isThisPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </div>
            </button>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant="cyan">{track.genre || "Electronic"}</Badge>
              {track.bpm && <Badge variant="outline">{track.bpm} BPM</Badge>}
              {track.musical_key && <Badge variant="outline">{track.musical_key}</Badge>}
              <Badge
                variant={
                  track.commercial_rights_status === "commercial_granted"
                    ? "emerald"
                    : "default"
                }
              >
                {track.commercial_rights_status === "commercial_granted"
                  ? "COMMERCIAL GRANT"
                  : "NON-COMMERCIAL (CC)"}
              </Badge>
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
              {track.title}
            </h1>
            <p className="text-xs text-studio-400 font-mono">
              Asset ID: {track.id} • 44.1kHz 16-bit PCM Audio
            </p>

            {/* Actions Row */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowProvenance(true)}
              >
                <ShieldCheck className="w-4 h-4 text-neon-cyan" />
                <span>C2PA Provenance</span>
              </Button>
              <a href={`/stems?track_id=${track.id}`}>
                <Button variant="secondary" size="sm">
                  <Layers className="w-4 h-4 text-neon-purple" />
                  <span>Isolate Stems</span>
                </Button>
              </a>
              <a href="/studio">
                <Button variant="secondary" size="sm">
                  <Sliders className="w-4 h-4 text-neon-cyan" />
                  <span>Open in DAW</span>
                </Button>
              </a>
              <a href={track.audio_url} download={`${track.title}.wav`}>
                <Button variant="secondary" size="sm">
                  <Download className="w-4 h-4" />
                  <span>Download WAV</span>
                </Button>
              </a>
              <Button variant="ghost" size="icon" onClick={handleShare} aria-label="Share Song Link">
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Big Waveform & Scrubber Station */}
        <div className="bg-studio-950 p-6 rounded-2xl border border-studio-800 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-studio-400">
            <span>
              {isThisPlaying ? formatTime(currentTime) : "0:00"}
            </span>
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-neon-cyan animate-pulse" />
              <span>Interactive Waveform Scrubber</span>
            </div>
            <span>
              {formatTime(isThisPlaying && duration > 0 ? duration : track.duration_seconds)}
            </span>
          </div>

          {/* Waveform Bar Canvas / Representation */}
          <div
            className="h-20 flex items-end gap-1 cursor-pointer group relative"
            onClick={(e) => {
              if (isThisPlaying && duration > 0) {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                seek(pos * duration);
              } else {
                playTrack(track);
              }
            }}
          >
            {(track.waveform_data || [
              20, 35, 55, 75, 90, 85, 60, 40, 65, 80, 95, 100, 75, 50, 70, 85, 90, 65, 45, 60, 80, 95,
              70, 50, 65, 85, 90, 75, 55, 40, 60, 80, 95, 70, 45, 30,
            ]).map((h, i) => (
              <span
                key={i}
                className={`flex-1 rounded-full transition-all group-hover:brightness-125 ${
                  isThisPlaying ? "bg-neon-cyan" : "bg-studio-700"
                }`}
                style={{ height: `${Math.max(12, h)}%` }}
              ></span>
            ))}
          </div>

          <div className="flex justify-center pt-2">
            <CanvasVisualizer width={240} height={32} />
          </div>
        </div>
      </div>

      {showProvenance && (
        <ProvenanceModal trackId={track.id} onClose={() => setShowProvenance(false)} />
      )}
    </div>
  );
}
