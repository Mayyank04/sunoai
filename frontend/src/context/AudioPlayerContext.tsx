"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { apiRequest } from "@/lib/api";

export interface TrackItem {
  id: string;
  title: string;
  artist?: string;
  artist_username?: string;
  description?: string;
  genre?: string;
  duration_seconds: number;
  audio_url: string;
  waveform_data?: number[];
  cover_image_url?: string;
  bpm?: number;
  musical_key?: string;
  user_id?: string;
  commercial_rights_status?: string;
  visibility?: string;
  moderation_status?: string;
  hashtags?: string[];
  lyrics?: string;
  like_count?: number;
  share_count?: number;
  play_count?: number;
}

interface AudioPlayerContextType {
  currentTrack: TrackItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  analyserNode: AnalyserNode | null;
  playTrack: (track: TrackItem) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  getFrequencyData: () => Uint8Array;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<TrackItem | null>(null);
  const currentTrackRef = useRef<TrackItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);

  const loggedPlaysRef = useRef<Set<string>>(new Set());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Initialize Web Audio Graph
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      const cur = audio.currentTime;
      setCurrentTime(cur);

      // Listening Analytics: Verify genuine listen at >= 15 seconds with bot/spam protections
      if (currentTrackRef.current && cur >= 15.0) {
        const tid = currentTrackRef.current.id;
        if (!loggedPlaysRef.current.has(tid)) {
          loggedPlaysRef.current.add(tid);
          const dur = audio.duration || currentTrackRef.current.duration_seconds || 60;
          apiRequest("/analytics/play", {
            method: "POST",
            body: JSON.stringify({
              track_id: tid,
              duration_listened_seconds: Math.round(cur),
              completed_ratio: Math.min(1.0, Math.round((cur / dur) * 100) / 100),
            }),
          }).catch(() => {
            // Telemetry failure ignored
          });
        }
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
    };
  }, []);

  const initAudioGraph = () => {
    if (!audioContextRef.current && audioRef.current) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const gainNode = ctx.createGain();
        gainNode.gain.value = volume;
        gainRef.current = gainNode;

        const source = ctx.createMediaElementSource(audioRef.current);
        sourceRef.current = source;

        // Connect graph: Source -> Gain -> Analyser -> Destination
        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(ctx.destination);
      } catch {
        // Fallback if browser security blocks until user gesture
      }
    }

    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
    }
  };

  const playTrack = (track: TrackItem) => {
    initAudioGraph();
    if (!audioRef.current) return;

    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    setCurrentTrack(track);
    audioRef.current.src = track.audio_url;
    audioRef.current.load();
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const togglePlay = () => {
    initAudioGraph();
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const seek = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    if (gainRef.current) {
      gainRef.current.gain.value = clamped;
    }
  };

  const getFrequencyData = (): Uint8Array => {
    if (!analyserRef.current) return new Uint8Array(64);
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    return data;
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        analyserNode: analyserRef.current,
        playTrack,
        togglePlay,
        seek,
        setVolume,
        getFrequencyData,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  }
  return context;
}
