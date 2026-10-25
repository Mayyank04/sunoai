"use client";

import React, { useState } from "react";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { CanvasVisualizer } from "./CanvasVisualizer";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  ShieldCheck,
  Disc,
  Radio,
} from "lucide-react";
import { ProvenanceModal } from "@/components/provenance/ProvenanceModal";

export const GlobalPlayer: React.FC = () => {
  const { currentTrack, isPlaying, playbackError, togglePlay, currentTime, duration, seek, volume, setVolume } =
    useAudioPlayer();

  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  const [showProvenance, setShowProvenance] = useState(false);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setVolume(prevVolume || 0.8);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-studio-950/90 border-t border-studio-800 flex items-center justify-between px-6 z-40 text-xs text-studio-400">
        <div className="flex items-center gap-3">
          <Radio className="w-4 h-4 text-studio-500 animate-pulse" />
          <span>Fombo Master Audio Engine Ready • Select or generate a track to begin playback</span>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-studio-300 font-mono">44.1kHz • 16-bit PCM Audio</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-studio-950/95 backdrop-blur-xl border-t border-studio-800/80 px-4 md:px-8 flex items-center justify-between z-40 shadow-2xl">
        {/* Track Info */}
        <div className="flex items-center gap-3.5 min-w-[200px] max-w-[30%]">
          <div className="w-12 h-12 rounded-lg bg-studio-850 border border-studio-700/60 flex items-center justify-center relative overflow-hidden flex-shrink-0 group shadow-md">
            <Disc className={`w-6 h-6 text-neon-cyan ${isPlaying ? "animate-spin" : ""}`} />
          </div>
          <div className="truncate">
            <h4 className="text-sm font-semibold text-studio-100 truncate flex items-center gap-2">
              {currentTrack.title}
              {currentTrack.commercial_rights_status === "commercial_granted" ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                  COMMERCIAL
                </span>
              ) : (
                <span className="text-[10px] bg-studio-800 text-studio-400 border border-studio-700 px-1.5 py-0.5 rounded font-mono">
                  NC
                </span>
              )}
            </h4>
            {playbackError && <p role="alert" title={playbackError} className="text-[11px] text-amber-400 truncate">{playbackError}</p>}
            <div className="flex items-center gap-2 text-xs text-studio-400 mt-0.5">
              <span>{currentTrack.genre || "Electronic"}</span>
              {currentTrack.bpm && <span>• {currentTrack.bpm} BPM</span>}
              {currentTrack.musical_key && <span>• {currentTrack.musical_key}</span>}
            </div>
          </div>
        </div>

        {/* Player Transport Controls & Timeline */}
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-xl px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => seek(Math.max(0, currentTime - 10))}
              className="text-studio-400 hover:text-studio-100 transition"
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple text-studio-950 flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-lg shadow-neon-cyan/20"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
            <button
              onClick={() => seek(Math.min(duration, currentTime + 10))}
              className="text-studio-400 hover:text-studio-100 transition"
              title="Forward 10s"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline Bar */}
          <div className="w-full flex items-center gap-3 text-[11px] font-mono text-studio-400">
            <span>{formatTime(currentTime)}</span>
            <div
              className="flex-1 h-2 bg-studio-850 rounded-full overflow-hidden cursor-pointer relative group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickPos = (e.clientX - rect.left) / rect.width;
                seek(clickPos * duration);
              }}
            >
              <div
                className="h-full bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink rounded-full transition-all relative"
                style={{ width: `${progressPercent}%` }}
              >
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition"></span>
              </div>
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Visualizer & Right Controls */}
        <div className="flex items-center gap-4 min-w-[200px] justify-end">
          <div className="hidden lg:block">
            <CanvasVisualizer width={120} height={28} />
          </div>

          {/* Provenance Badge */}
          <button
            onClick={() => setShowProvenance(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-studio-850 hover:bg-studio-800 border border-studio-700/60 text-xs text-neon-cyan transition"
            title="Inspect C2PA Provenance Manifest & Rights"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-mono text-[11px]">C2PA</span>
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleMuteToggle}
              className="text-studio-400 hover:text-studio-100 transition"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-neon-crimson" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setIsMuted(false);
                setVolume(parseFloat(e.target.value));
              }}
              className="w-20 h-1 bg-studio-800 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
            />
          </div>
        </div>
      </div>

      {showProvenance && currentTrack && (
        <ProvenanceModal trackId={currentTrack.id} onClose={() => setShowProvenance(false)} />
      )}
    </>
  );
};
