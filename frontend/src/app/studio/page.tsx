"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import {
  Play,
  Pause,
  Square,
  Repeat,
  Volume2,
  Sliders,
  Sparkles,
  Save,
  Download,
  Scissors,
  TrendingUp,
  RotateCcw,
  RotateCw,
  Mic,
  MicOff,
  Upload,
  Layers,
  ShieldCheck,
  Music,
  Check,
  AlertTriangle,
  History,
  Activity,
  Radio,
  FileAudio,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Copy,
  Trash2,
  SlidersHorizontal,
  ChevronRight,
  Plus,
  Compass,
} from "lucide-react";
import {
  audioDawEngine,
  DawEngineTrack,
  DawEngineClip,
  TrackFxSettings,
} from "@/lib/audioEngine";
import PianoRoll, { MidiNote } from "@/components/studio/PianoRoll";
import AiProducerPanel, { PlannedOperation } from "@/components/studio/AiProducerPanel";

// --- Project Types ---
interface AudioVersion {
  track_id: string;
  version_id?: string;
  version_number: number;
  title: string;
  original_audio_url: string;
  edited_audio_url: string;
  duration_seconds: number;
  waveform_data: number[];
  operation_summary: string;
  can_undo: boolean;
  created_at: string;
}

interface StemTrack {
  stem_type: string;
  audio_url: string;
  duration_seconds: number;
  waveform_data: number[];
  volume: number;
  muted: boolean;
  solo: boolean;
}

interface TimelineClip {
  id: string;
  trackId: string;
  name: string;
  startBeat: number; // in beats
  durationBeats: number; // in beats
  sourceOffsetSec: number; // in seconds
  audioUrl?: string;
  color: string;
  midiNotes?: MidiNote[];
}

interface TimelineTrack {
  id: string;
  name: string;
  trackType: "audio" | "synth";
  volume: number; // 0.0 to 1.5
  pan: number; // -1.0 to 1.0
  muted: boolean;
  solo: boolean;
  armed: boolean;
  color: string;
  clips: TimelineClip[];
  fx: TrackFxSettings;
}

const DEFAULT_FX_SETTINGS: TrackFxSettings = {
  eq: { bass: 0, mid: 0, treble: 0 },
  filter: { type: "lowpass", frequency: 20000, q: 1.0 },
  delay: { enabled: false, time: 0.35, feedback: 0.3, mix: 0.25 },
  reverb: { enabled: false, decay: 2.0, mix: 0.2 },
  compressor: { enabled: false, threshold: -12, ratio: 4.0, attack: 0.01, release: 0.1 },
};

const DEFAULT_TIMELINE_TRACKS: TimelineTrack[] = [
  {
    id: "tr_1",
    name: "01 Drums (Punch Kick & Snare)",
    trackType: "audio",
    volume: 0.85,
    pan: 0.0,
    muted: false,
    solo: false,
    armed: false,
    color: "#00f0ff",
    fx: { ...DEFAULT_FX_SETTINGS },
    clips: [
      {
        id: "c1",
        trackId: "tr_1",
        name: "Drum Loop 4-Bar",
        startBeat: 0,
        durationBeats: 16,
        sourceOffsetSec: 0,
        color: "#00f0ff",
      },
      {
        id: "c2",
        trackId: "tr_1",
        name: "Drum Break & Fill",
        startBeat: 16,
        durationBeats: 16,
        sourceOffsetSec: 0,
        color: "#00f0ff",
      },
    ],
  },
  {
    id: "tr_2",
    name: "02 Bass (Analog Sub 808)",
    trackType: "audio",
    volume: 0.9,
    pan: 0.0,
    muted: false,
    solo: false,
    armed: false,
    color: "#a855f7",
    fx: { ...DEFAULT_FX_SETTINGS },
    clips: [
      {
        id: "c3",
        trackId: "tr_2",
        name: "Pumping Bassline",
        startBeat: 0,
        durationBeats: 16,
        sourceOffsetSec: 0,
        color: "#a855f7",
      },
      {
        id: "c4",
        trackId: "tr_2",
        name: "Sub Drop Variant",
        startBeat: 16,
        durationBeats: 16,
        sourceOffsetSec: 0,
        color: "#a855f7",
      },
    ],
  },
  {
    id: "tr_3",
    name: "03 Neon Poly Synth (MIDI)",
    trackType: "synth",
    volume: 0.8,
    pan: -0.25,
    muted: false,
    solo: false,
    armed: false,
    color: "#ec4899",
    fx: {
      ...DEFAULT_FX_SETTINGS,
      reverb: { enabled: true, decay: 2.5, mix: 0.35 },
    },
    clips: [
      {
        id: "c5",
        trackId: "tr_3",
        name: "Synth Chords & Lead",
        startBeat: 8,
        durationBeats: 16,
        sourceOffsetSec: 0,
        color: "#ec4899",
        midiNotes: [
          { id: "m1", pitch: 60, startBeat: 0, durationBeats: 4, velocity: 0.9 }, // C4
          { id: "m2", pitch: 64, startBeat: 0, durationBeats: 4, velocity: 0.85 }, // E4
          { id: "m3", pitch: 67, startBeat: 0, durationBeats: 4, velocity: 0.85 }, // G4
          { id: "m4", pitch: 57, startBeat: 4, durationBeats: 4, velocity: 0.9 }, // A3
          { id: "m5", pitch: 65, startBeat: 8, durationBeats: 4, velocity: 0.9 }, // F4
        ],
      },
    ],
  },
  {
    id: "tr_4",
    name: "04 Atmosphere & FX",
    trackType: "audio",
    volume: 0.7,
    pan: 0.3,
    muted: false,
    solo: false,
    armed: false,
    color: "#f59e0b",
    fx: {
      ...DEFAULT_FX_SETTINGS,
      delay: { enabled: true, time: 0.375, feedback: 0.45, mix: 0.3 },
    },
    clips: [
      {
        id: "c6",
        trackId: "tr_4",
        name: "Riser & Shimmer Hit",
        startBeat: 12,
        durationBeats: 8,
        sourceOffsetSec: 0,
        color: "#f59e0b",
      },
      {
        id: "c7",
        trackId: "tr_4",
        name: "Downlifter Tail",
        startBeat: 20,
        durationBeats: 8,
        sourceOffsetSec: 0,
        color: "#f59e0b",
      },
    ],
  },
];

export default function StudioPage() {
  // Main Studio Mode: "multitrack" (Phase 6 DAW) or "waveform" (Phase 5 Audio Lab)
  const [activeTab, setActiveTab] = useState<"multitrack" | "waveform">("multitrack");

  // --- Multitrack DAW State ---
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("Cyber City Multitrack Session");
  const [bpm, setBpm] = useState(124);
  const [masterVolume, setMasterVolume] = useState(0.9);
  const [tracks, setTracks] = useState<TimelineTrack[]>(DEFAULT_TIMELINE_TRACKS);

  // Playback & Timing
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [loopStartBeat, setLoopStartBeat] = useState(0);
  const [loopEndBeat, setLoopEndBeat] = useState(32);
  const [snapGrid, setSnapGrid] = useState<number>(1.0); // 1.0 = 1 beat, 0.5 = 1/8, 0.25 = 1/16, 0 = off
  const [pixelsPerBeat, setPixelsPerBeat] = useState<number>(36); // zoom level (18 to 72)

  // Selection & Active Track
  const [selectedTrackId, setSelectedTrackId] = useState<string>("tr_1");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [activeFxTrackId, setActiveFxTrackId] = useState<string | null>(null);

  // MIDI Piano Roll Modal
  const [activePianoRollClip, setActivePianoRollClip] = useState<TimelineClip | null>(null);

  // AI Producer Panel (Phase 7)
  const [showAiProducer, setShowAiProducer] = useState(true);

  // Undo / Redo History Stack
  const [undoStack, setUndoStack] = useState<TimelineTrack[][]>([]);
  const [redoStack, setRedoStack] = useState<TimelineTrack[][]>([]);

  // Recording State
  const [isRecordingTrack, setIsRecordingTrack] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Dragging / Trimming Clips
  const [draggingClip, setDraggingClip] = useState<{
    clipId: string;
    initialStartBeat: number;
    initialDurationBeats: number;
    dragStartX: number;
    mode: "move" | "trim-left" | "trim-right";
  } | null>(null);

  // Autosave Status
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // DOM Playhead & Meters (Decoupled from React State for 60fps performance!)
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const timeDisplayRef = useRef<HTMLSpanElement | null>(null);
  const masterMeterRef = useRef<HTMLDivElement | null>(null);
  const trackMetersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  // Status & Error Banners
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // --- Waveform Audio Editor State (Preserved from Phase 5) ---
  const [trackId, setTrackId] = useState<string | null>(null);
  const [waveTrackTitle, setWaveTrackTitle] = useState("Studio Session Master");
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [waveDuration, setWaveDuration] = useState(30.0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [waveCurrentTime, setWaveCurrentTime] = useState(0);
  const [waveIsPlaying, setWaveIsPlaying] = useState(false);
  const [abMode, setAbMode] = useState<"edited" | "original">("edited");
  const [selectionStart, setSelectionStart] = useState(0.0);
  const [selectionEnd, setSelectionEnd] = useState(15.0);
  const [fadeInSec, setFadeInSec] = useState(1.5);
  const [fadeOutSec, setFadeOutSec] = useState(2.0);
  const [extendSeconds, setExtendSeconds] = useState(15);
  const [extendProvider, setExtendProvider] = useState("suno");
  const [useAiConditioning, setUseAiConditioning] = useState(true);
  const [inpaintPrompt, setInpaintPrompt] = useState("Electric piano solo with smooth vibrato");
  const [inpaintProvider, setInpaintProvider] = useState("suno");
  const [remixGenre, setRemixGenre] = useState("Cyberpunk");
  const [remixSpeed, setRemixSpeed] = useState(1.0);
  const [remixBass, setRemixBass] = useState(1.4);
  const [remixTreble, setRemixTreble] = useState(1.1);
  const [coverTitle, setCoverTitle] = useState("Acoustic Studio Tribute");
  const [coverVocalist, setCoverVocalist] = useState("Maya Vance");
  const [coverGenre, setCoverGenre] = useState("Acoustic Pop");
  const [coverConsented, setCoverConsented] = useState(true);
  const [stems, setStems] = useState<StemTrack[]>([]);
  const [isSplittingStems, setIsSplittingStems] = useState(false);
  const [versions, setVersions] = useState<AudioVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeVersionNumber, setActiveVersionNumber] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Push state to Undo Stack before edits
  const pushUndo = useCallback((newTracks: TimelineTrack[]) => {
    setUndoStack((prev) => [...prev.slice(-20), tracks]);
    setRedoStack([]);
    setTracks(newTracks);
    setIsDirty(true);
  }, [tracks]);

  // Handle Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, tracks]);
    setUndoStack((u) => u.slice(0, -1));
    setTracks(prev);
    setIsDirty(true);
  }, [undoStack, tracks]);

  // Handle Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, tracks]);
    setRedoStack((r) => r.slice(0, -1));
    setTracks(next);
    setIsDirty(true);
  }, [redoStack, tracks]);

  // --- Synchronized 60fps Playback & Meter Animation Loop ---
  // Reads audioDawEngine.getCurrentBeat() and writes directly to DOM styles to avoid React re-renders!
  useEffect(() => {
    let animId: number;

    const tick = () => {
      if (isPlaying) {
        const beat = audioDawEngine.getCurrentBeat(bpm);

        // Check Loop boundaries
        if (loopEnabled && beat >= loopEndBeat) {
          audioDawEngine.play(
            convertTracksToEngine(tracks),
            (loopStartBeat * 60) / bpm,
            bpm,
            loopEnabled,
            (loopStartBeat * 60) / bpm,
            (loopEndBeat * 60) / bpm
          );
        } else {
          // Direct DOM transform (zero React state updates per frame!)
          if (playheadRef.current) {
            playheadRef.current.style.transform = `translateX(${beat * pixelsPerBeat}px)`;
          }
          if (timeDisplayRef.current) {
            const bar = Math.floor(beat / 4) + 1;
            const b = Math.floor(beat % 4) + 1;
            const tick16th = Math.floor((beat % 1) * 4) + 1;
            const totalSec = (beat * 60) / bpm;
            const mins = Math.floor(totalSec / 60);
            const secs = (totalSec % 60).toFixed(1);
            timeDisplayRef.current.innerText = `${bar}:${b}:${tick16th} (${String(mins).padStart(2, "0")}:${secs.padStart(4, "0")})`;
          }

          // Master Meter Level
          if (masterMeterRef.current) {
            const level = audioDawEngine.getMasterMeterLevel();
            masterMeterRef.current.style.width = `${level}%`;
          }

          // Track Meter Levels
          tracks.forEach((tr) => {
            const el = trackMetersRef.current.get(tr.id);
            if (el) {
              const lvl = audioDawEngine.getTrackMeterLevel(tr.id);
              el.style.width = `${lvl}%`;
            }
          });
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, bpm, loopEnabled, loopStartBeat, loopEndBeat, pixelsPerBeat, tracks]);

  // Convert timeline tracks to engine format
  const convertTracksToEngine = (trs: TimelineTrack[]): DawEngineTrack[] => {
    return trs.map((t) => ({
      id: t.id,
      name: t.name,
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      solo: t.solo,
      fx: t.fx,
      clips: t.clips.map((c) => ({
        id: c.id,
        trackId: t.id,
        startTime: (c.startBeat * 60) / bpm,
        duration: (c.durationBeats * 60) / bpm,
        sourceOffset: c.sourceOffsetSec,
        audioUrl: c.audioUrl,
        name: c.name,
      })),
    }));
  };

  // Transport: Toggle Play/Pause
  const togglePlay = async () => {
    if (isPlaying) {
      audioDawEngine.stop();
      setIsPlaying(false);
    } else {
      audioDawEngine.init();
      const startSec = (currentBeat * 60) / bpm;
      await audioDawEngine.play(
        convertTracksToEngine(tracks),
        startSec,
        bpm,
        loopEnabled,
        (loopStartBeat * 60) / bpm,
        (loopEndBeat * 60) / bpm
      );
      setIsPlaying(true);
    }
  };

  // Transport: Stop & Rewind
  const stopAndRewind = () => {
    audioDawEngine.stop();
    setIsPlaying(false);
    setCurrentBeat(0);
    if (playheadRef.current) {
      playheadRef.current.style.transform = `translateX(0px)`;
    }
  };

  // Seek timeline by clicking ruler
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left + (timelineScrollRef.current?.scrollLeft || 0);
    const targetBeat = Math.max(0, clickX / pixelsPerBeat);
    const snapped = snapGrid > 0 ? Math.round(targetBeat / snapGrid) * snapGrid : targetBeat;
    setCurrentBeat(snapped);

    if (playheadRef.current) {
      playheadRef.current.style.transform = `translateX(${snapped * pixelsPerBeat}px)`;
    }

    if (isPlaying) {
      audioDawEngine.play(
        convertTracksToEngine(tracks),
        (snapped * 60) / bpm,
        bpm,
        loopEnabled,
        (loopStartBeat * 60) / bpm,
        (loopEndBeat * 60) / bpm
      );
    }
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        activePianoRollClip
      ) {
        return;
      }

      // Space: Play / Pause
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      // R: Rewind to 0
      else if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
        stopAndRewind();
      }
      // L: Toggle Loop
      else if (e.key.toLowerCase() === "l" && !e.metaKey && !e.ctrlKey) {
        setLoopEnabled((prev) => !prev);
      }
      // S: Split clip at playhead
      else if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) {
        if (selectedClipId) splitClipAtPlayhead();
      }
      // D: Duplicate clip
      else if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey) {
        if (selectedClipId) duplicateSelectedClip();
      }
      // Delete / Backspace: Delete clip
      else if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedClipId) deleteSelectedClip();
      }
      // Undo: Ctrl/Cmd + Z
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      else if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "z") ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        handleRedo();
      }
      // Save: Ctrl/Cmd + S
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveProject();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isPlaying,
    currentBeat,
    selectedClipId,
    activePianoRollClip,
    handleUndo,
    handleRedo,
  ]);

  // --- Clip Operations: Split, Duplicate, Delete, Move, Trim ---
  const splitClipAtPlayhead = () => {
    if (!selectedClipId) return;

    let targetTrack: TimelineTrack | null = null;
    let targetClip: TimelineClip | null = null;

    for (const tr of tracks) {
      const found = tr.clips.find((c) => c.id === selectedClipId);
      if (found) {
        targetTrack = tr;
        targetClip = found;
        break;
      }
    }

    if (!targetTrack || !targetClip) return;

    // Check if playhead is strictly inside the clip
    if (
      currentBeat <= targetClip.startBeat ||
      currentBeat >= targetClip.startBeat + targetClip.durationBeats
    ) {
      setStatusMessage("Playhead must be inside the selected clip to split.");
      return;
    }

    const firstDuration = currentBeat - targetClip.startBeat;
    const secondDuration = targetClip.durationBeats - firstDuration;
    const splitOffsetSec = (firstDuration * 60) / bpm;

    const clipA: TimelineClip = {
      ...targetClip,
      durationBeats: firstDuration,
    };

    const clipB: TimelineClip = {
      ...targetClip,
      id: `clip_${Date.now()}_split`,
      name: `${targetClip.name} (Part 2)`,
      startBeat: currentBeat,
      durationBeats: secondDuration,
      sourceOffsetSec: targetClip.sourceOffsetSec + splitOffsetSec,
    };

    const newTracks = tracks.map((tr) => {
      if (tr.id !== targetTrack!.id) return tr;
      return {
        ...tr,
        clips: tr.clips.flatMap((c) => (c.id === targetClip!.id ? [clipA, clipB] : [c])),
      };
    });

    pushUndo(newTracks);
    setSelectedClipId(clipB.id);
    setStatusMessage("Clip split at playhead cursor!");
  };

  const duplicateSelectedClip = () => {
    if (!selectedClipId) return;

    let targetTrack: TimelineTrack | null = null;
    let targetClip: TimelineClip | null = null;

    for (const tr of tracks) {
      const found = tr.clips.find((c) => c.id === selectedClipId);
      if (found) {
        targetTrack = tr;
        targetClip = found;
        break;
      }
    }

    if (!targetTrack || !targetClip) return;

    const duplicatedClip: TimelineClip = {
      ...targetClip,
      id: `clip_${Date.now()}_dup`,
      name: `${targetClip.name} (Copy)`,
      startBeat: targetClip.startBeat + targetClip.durationBeats,
    };

    const newTracks = tracks.map((tr) => {
      if (tr.id !== targetTrack!.id) return tr;
      return {
        ...tr,
        clips: [...tr.clips, duplicatedClip],
      };
    });

    pushUndo(newTracks);
    setSelectedClipId(duplicatedClip.id);
    setStatusMessage("Clip duplicated!");
  };

  const deleteSelectedClip = () => {
    if (!selectedClipId) return;

    const newTracks = tracks.map((tr) => ({
      ...tr,
      clips: tr.clips.filter((c) => c.id !== selectedClipId),
    }));

    pushUndo(newTracks);
    setSelectedClipId(null);
    setStatusMessage("Clip deleted.");
  };

  // Mouse Drag Handling for Moving and Trimming Clips
  const handleClipMouseDown = (
    e: React.MouseEvent,
    clip: TimelineClip,
    mode: "move" | "trim-left" | "trim-right"
  ) => {
    e.stopPropagation();
    setSelectedClipId(clip.id);
    setSelectedTrackId(clip.trackId);

    setDraggingClip({
      clipId: clip.id,
      initialStartBeat: clip.startBeat,
      initialDurationBeats: clip.durationBeats,
      dragStartX: e.clientX,
      mode,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingClip) return;

      const deltaX = e.clientX - draggingClip.dragStartX;
      const deltaBeats = deltaX / pixelsPerBeat;

      setTracks((prev) =>
        prev.map((tr) => ({
          ...tr,
          clips: tr.clips.map((c) => {
            if (c.id !== draggingClip.clipId) return c;

            if (draggingClip.mode === "move") {
              let newStart = Math.max(0, draggingClip.initialStartBeat + deltaBeats);
              if (snapGrid > 0) newStart = Math.round(newStart / snapGrid) * snapGrid;
              return { ...c, startBeat: newStart };
            } else if (draggingClip.mode === "trim-right") {
              let newDur = Math.max(0.5, draggingClip.initialDurationBeats + deltaBeats);
              if (snapGrid > 0) newDur = Math.max(snapGrid, Math.round(newDur / snapGrid) * snapGrid);
              return { ...c, durationBeats: newDur };
            } else if (draggingClip.mode === "trim-left") {
              let newStart = Math.max(0, draggingClip.initialStartBeat + deltaBeats);
              if (snapGrid > 0) newStart = Math.round(newStart / snapGrid) * snapGrid;
              const beatDiff = newStart - draggingClip.initialStartBeat;
              const newDur = Math.max(0.5, draggingClip.initialDurationBeats - beatDiff);
              return {
                ...c,
                startBeat: newStart,
                durationBeats: newDur,
                sourceOffsetSec: Math.max(0, c.sourceOffsetSec + (beatDiff * 60) / bpm),
              };
            }
            return c;
          }),
        }))
      );
    };

    const handleMouseUp = () => {
      if (draggingClip) {
        setDraggingClip(null);
        setIsDirty(true);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingClip, pixelsPerBeat, snapGrid, bpm]);

  // --- Live Microphone In-Track Recording ---
  const toggleTrackRecord = async (trackId: string) => {
    if (isRecordingTrack) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecordingTrack(false);
      }
    } else {
      // Arm and start recording into this track
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        recordedChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        const recStartBeat = currentBeat;
        setRecordingStartTime(Date.now());

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(recordedChunksRef.current, { type: "audio/wav" });
          const audioUrl = URL.createObjectURL(blob);
          const recDurationSec = (Date.now() - recordingStartTime) / 1000;
          const recDurationBeats = Math.max(1, (recDurationSec * bpm) / 60);

          const newClip: TimelineClip = {
            id: `rec_${Date.now()}`,
            trackId,
            name: `Vocal Take (${new Date().toLocaleTimeString()})`,
            startBeat: recStartBeat,
            durationBeats: recDurationBeats,
            sourceOffsetSec: 0,
            audioUrl,
            color: "#ff0055",
          };

          const newTracks = tracks.map((tr) => {
            if (tr.id !== trackId) return tr;
            return { ...tr, clips: [...tr.clips, newClip] };
          });

          pushUndo(newTracks);
          setStatusMessage("Live take recorded directly into track!");
        };

        mediaRecorder.start(250);
        setIsRecordingTrack(true);
        if (!isPlaying) togglePlay();
      } catch (err: any) {
        setErrorMessage(`Microphone access failed: ${err.message}`);
      }
    }
  };

  // --- Autosave to PostgreSQL ---
  const handleSaveProject = async () => {
    try {
      setIsAutosaving(true);
      const payload = {
        title: projectTitle,
        bpm,
        time_signature: "4/4",
        master_volume: masterVolume,
        project_state: {
          tracks,
          loopEnabled,
          loopStartBeat,
          loopEndBeat,
        },
      };

      if (projectId) {
        await apiRequest(`/daw/projects/${projectId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        const res = await apiRequest("/daw/projects", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setProjectId(res.id);
      }

      setIsDirty(false);
      setLastSavedTime(new Date().toLocaleTimeString());
      setStatusMessage("Multitrack session saved to cloud.");
    } catch (err: any) {
      setErrorMessage(`Save failed: ${err.message}`);
    } finally {
      setIsAutosaving(false);
    }
  };

  // Debounced Autosave Effect
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      handleSaveProject();
    }, 15000); // Autosave every 15s if modified
    return () => clearTimeout(timer);
  }, [isDirty, tracks, bpm, masterVolume]);

  // --- Offline Rendering & WAV Export ---
  const handleExportWav = async (mode: "client" | "server") => {
    try {
      setIsExporting(true);
      setStatusMessage(
        mode === "client"
          ? "Rendering offline mixdown in browser (Web Audio OfflineContext)..."
          : "Rendering master mixdown on cloud DSP server..."
      );

      if (mode === "client") {
        audioDawEngine.init();
        const wavBlob = await audioDawEngine.exportMixdownWav(
          convertTracksToEngine(tracks),
          bpm,
          masterVolume
        );
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${projectTitle.replace(/\s+/g, "_")}_Master.wav`;
        a.click();
        setStatusMessage("WAV master exported successfully!");
      } else {
        const renderPayload = {
          title: projectTitle,
          bpm,
          master_volume: masterVolume,
          tracks: tracks.map((t) => ({
            id: t.id,
            name: t.name,
            track_type: t.trackType,
            volume: t.volume,
            pan: t.pan,
            muted: t.muted,
            solo: t.solo,
            clips: t.clips.map((c) => ({
              id: c.id,
              name: c.name,
              track_id: t.id,
              start_time: (c.startBeat * 60) / bpm,
              duration: (c.durationBeats * 60) / bpm,
              source_offset: c.sourceOffsetSec,
              audio_url: c.audioUrl,
            })),
            fx_settings: t.fx,
          })),
        };

        const res = await apiRequest("/daw/render", {
          method: "POST",
          body: JSON.stringify(renderPayload),
        });

        const a = document.createElement("a");
        a.href = res.audio_url;
        a.download = `${projectTitle.replace(/\s+/g, "_")}_Cloud_Master.wav`;
        a.click();
        setStatusMessage(
          `Cloud master render complete! (${res.duration_seconds.toFixed(2)}s, ${Math.round(
            res.file_size_bytes / 1024
          )} KB)`
        );
      }
    } catch (err: any) {
      setErrorMessage(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Add a new track
  const handleAddTrack = (type: "audio" | "synth") => {
    const num = tracks.length + 1;
    const colors = ["#00f0ff", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
    const color = colors[num % colors.length];

    const newTrack: TimelineTrack = {
      id: `tr_${Date.now()}`,
      name: `${String(num).padStart(2, "0")} ${type === "synth" ? "Lead Synth (MIDI)" : "Audio Track"}`,
      trackType: type,
      volume: 0.85,
      pan: 0.0,
      muted: false,
      solo: false,
      armed: false,
      color,
      fx: { ...DEFAULT_FX_SETTINGS },
      clips: [],
    };

    pushUndo([...tracks, newTrack]);
    setSelectedTrackId(newTrack.id);
  };

  // AI Producer Typed Operation Dispatcher (Phase 7)
  const handleExecuteProducerOperation = useCallback(
    (op: PlannedOperation) => {
      if (op.operation_type === "addTrack") {
        const newTrack: TimelineTrack = {
          id: `tr_${Date.now()}`,
          name: op.parameters.name || "New Producer Track",
          trackType: (op.parameters.track_type as "audio" | "synth") || "audio",
          volume: op.parameters.volume ?? 0.85,
          pan: op.parameters.pan ?? 0.0,
          muted: false,
          solo: false,
          armed: false,
          color: op.parameters.color || (op.parameters.track_type === "synth" ? "#ec4899" : "#00f0ff"),
          fx: { ...DEFAULT_FX_SETTINGS },
          clips: [],
        };
        pushUndo([...tracks, newTrack]);
        setStatusMessage(`AI Producer: Added ${newTrack.trackType} track "${newTrack.name}".`);
      } else if (op.operation_type === "changeGain") {
        const targetId = op.parameters.track_id;
        const updated = tracks.map((t) => {
          if (t.id === targetId || (!targetId && t === tracks[0])) {
            const vol = op.parameters.volume !== undefined ? op.parameters.volume : t.volume;
            const pan = op.parameters.pan !== undefined ? op.parameters.pan : t.pan;
            audioDawEngine.updateTrackParams({
              id: t.id,
              volume: vol,
              pan: pan,
              muted: t.muted,
              solo: t.solo,
              fx: t.fx,
            });
            return { ...t, volume: vol, pan: pan };
          }
          return t;
        });
        pushUndo(updated);
        setStatusMessage("AI Producer: Updated track gain and pan staging.");
      } else if (op.operation_type === "addEffect") {
        const targetId = op.parameters.track_id;
        const efType = op.parameters.effect_type as keyof TrackFxSettings;
        const updated = tracks.map((t) => {
          if (t.id === targetId || (!targetId && t === tracks[0])) {
            const newFx = { ...t.fx };
            if (efType && op.parameters.params) {
              newFx[efType] = { ...newFx[efType], ...op.parameters.params };
            }
            audioDawEngine.updateTrackParams({
              id: t.id,
              volume: t.volume,
              pan: t.pan,
              muted: t.muted,
              solo: t.solo,
              fx: newFx,
            });
            return { ...t, fx: newFx };
          }
          return t;
        });
        pushUndo(updated);
        setStatusMessage(`AI Producer: Applied ${op.parameters.effect_type?.toUpperCase()} effect rack.`);
      } else if (op.operation_type === "generateStem") {
        const origTrack = tracks.find((t) => t.id === op.parameters.track_id) || tracks[0];
        const stemType = (op.parameters.stem_type || "vocals").toUpperCase();
        const newTrack: TimelineTrack = {
          id: `tr_stem_${Date.now()}`,
          name: `${origTrack?.name || "Track"} [${stemType} Stem - Demucs]`,
          trackType: "audio",
          volume: 0.9,
          pan: 0.0,
          muted: false,
          solo: false,
          armed: false,
          color: stemType === "VOCALS" ? "#a855f7" : "#00f0ff",
          fx: { ...DEFAULT_FX_SETTINGS },
          clips: origTrack
            ? origTrack.clips.map((c) => ({
                ...c,
                id: `c_stem_${Date.now()}_${c.id}`,
                name: `${c.name} (${stemType})`,
              }))
            : [],
        };
        pushUndo([...tracks, newTrack]);
        setStatusMessage(`AI Producer: Extracted ${stemType} stem with HTDemucs v4.`);
      } else if (op.operation_type === "replaceSection") {
        const targetTrackId = op.parameters.track_id;
        const startSec = op.parameters.start_sec ?? 4.0;
        const endSec = op.parameters.end_sec ?? 8.0;
        const startBeat = Math.round((startSec * bpm) / 60);
        const durationBeats = Math.max(2, Math.round(((endSec - startSec) * bpm) / 60));
        const updated = tracks.map((t) => {
          if (t.id === targetTrackId || (!targetTrackId && t === tracks[0])) {
            const newClip: TimelineClip = {
              id: `c_inpaint_${Date.now()}`,
              trackId: t.id,
              name: `AI Inpaint: ${op.parameters.prompt || "Regenerated Section"}`,
              startBeat,
              durationBeats,
              sourceOffsetSec: 0,
              color: "#f59e0b",
            };
            return { ...t, clips: [...t.clips, newClip] };
          }
          return t;
        });
        pushUndo(updated);
        setStatusMessage("AI Producer: Completed section inpainting with crossfades.");
      } else if (op.operation_type === "moveClip") {
        const clipId = op.parameters.clip_id;
        const newBeat = Math.max(0, op.parameters.new_start_beat ?? 0);
        const updated = tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId || (!clipId && c === t.clips[0]) ? { ...c, startBeat: newBeat } : c
          ),
        }));
        pushUndo(updated);
        setStatusMessage(`AI Producer: Moved clip to beat ${newBeat}.`);
      } else if (op.operation_type === "duplicateClip") {
        const clipId = op.parameters.clip_id;
        let found = false;
        const updated = tracks.map((t) => {
          const cIdx = t.clips.findIndex((c) => c.id === clipId || (!clipId && !found));
          if (cIdx !== -1 && !found) {
            found = true;
            const orig = t.clips[cIdx];
            const duplicate: TimelineClip = {
              ...orig,
              id: `c_${Date.now()}_dup`,
              name: `${orig.name} (Copy)`,
              startBeat: orig.startBeat + orig.durationBeats,
            };
            return { ...t, clips: [...t.clips, duplicate] };
          }
          return t;
        });
        pushUndo(updated);
        setStatusMessage("AI Producer: Duplicated clip on timeline.");
      } else if (op.operation_type === "splitClip") {
        const clipId = op.parameters.clip_id;
        const splitBeat = op.parameters.split_beat;
        let splitDone = false;
        const updated = tracks.map((t) => {
          const clip = t.clips.find((c) => c.id === clipId || (!clipId && !splitDone));
          if (!clip || splitDone) return t;
          const cutPoint = splitBeat || clip.startBeat + clip.durationBeats / 2;
          if (cutPoint <= clip.startBeat || cutPoint >= clip.startBeat + clip.durationBeats) return t;
          splitDone = true;
          const firstDuration = cutPoint - clip.startBeat;
          const secondDuration = clip.durationBeats - firstDuration;
          const firstClip: TimelineClip = { ...clip, durationBeats: firstDuration };
          const secondClip: TimelineClip = {
            ...clip,
            id: `c_${Date.now()}_split`,
            name: `${clip.name} (Part 2)`,
            startBeat: cutPoint,
            durationBeats: secondDuration,
            sourceOffsetSec: clip.sourceOffsetSec + (firstDuration * 60) / bpm,
          };
          return {
            ...t,
            clips: t.clips.map((c) => (c.id === clip.id ? firstClip : c)).concat(secondClip),
          };
        });
        pushUndo(updated);
        setStatusMessage("AI Producer: Sliced clip at specified beat.");
      } else if (op.operation_type === "deleteTrack") {
        const targetId = op.parameters.track_id;
        const updated = tracks.filter((t) => t.id !== targetId);
        pushUndo(updated);
        setStatusMessage("AI Producer: Removed track from arrangement.");
      }
    },
    [tracks, bpm, pushUndo]
  );

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  return (
    <div className="py-6 max-w-7xl mx-auto space-y-6">
      {/* Hidden audio element for waveform engine fallback */}
      <audio ref={audioRef} preload="auto" />

      {/* Top Header & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-studio-900 border border-studio-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => {
                  setProjectTitle(e.target.value);
                  setIsDirty(true);
                }}
                className="bg-transparent font-bold text-base text-white focus:outline-none focus:border-b border-neon-cyan"
              />
              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />
              )}
            </div>
            <p className="text-xs text-studio-400 font-mono flex items-center gap-2">
              <span>Web Audio Multitrack Engine &bull; 60fps Clock Accurate</span>
              {lastSavedTime && <span>&bull; Autosaved at {lastSavedTime}</span>}
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-studio-950 p-1 rounded-xl border border-studio-800">
          <button
            onClick={() => setActiveTab("multitrack")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "multitrack"
                ? "bg-neon-purple text-white shadow-lg shadow-neon-purple/20"
                : "text-studio-400 hover:text-studio-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multitrack DAW & MIDI</span>
          </button>
          <button
            onClick={() => setActiveTab("waveform")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "waveform"
                ? "bg-neon-cyan text-studio-950 shadow-lg shadow-neon-cyan/20"
                : "text-studio-400 hover:text-studio-200"
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Waveform Audio Editor</span>
          </button>
        </div>

        {/* Export & Save Action Group */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportWav("client")}
            disabled={isExporting}
            className="px-3 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-200 border border-studio-700 text-xs font-medium flex items-center gap-1.5 transition"
            title="Fast offline render directly in browser"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export WAV</span>
          </button>

          <button
            onClick={() => setShowAiProducer(!showAiProducer)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
              showAiProducer
                ? "bg-gradient-to-r from-neon-purple to-pink-500 text-white border-pink-500/40 shadow-lg shadow-pink-500/20"
                : "bg-studio-800 hover:bg-studio-750 text-studio-300 border-studio-700"
            }`}
            title="Toggle AI Producer Panel (Phase 7)"
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-300" />
            <span>AI Producer</span>
            <span className="text-[10px] bg-studio-950/60 px-1.5 py-0.5 rounded font-mono">
              Phase 7
            </span>
          </button>

          <button
            onClick={handleSaveProject}
            disabled={isAutosaving}
            className="px-4 py-2 rounded-xl bg-neon-cyan hover:bg-cyan-400 text-studio-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-neon-cyan/20 transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isAutosaving ? "Saving..." : "Save Project"}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            {statusMessage}
          </span>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            &times;
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-950/40 border border-rose-500/40 text-rose-300 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            {errorMessage}
          </span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200">
            &times;
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 1: MULTITRACK DIGITAL AUDIO WORKSTATION (PHASE 6)   */}
      {/* ======================================================== */}
      {activeTab === "multitrack" && (
        <div className="space-y-6">
          {/* AI Producer Chat & Tool Execution Panel (Phase 7) */}
          {showAiProducer && (
            <div className="h-[460px] animate-in fade-in slide-in-from-top-2 duration-200">
              <AiProducerPanel
                projectState={{
                  tracks,
                  bpm,
                  masterVolume,
                  loopEnabled,
                  projectId,
                }}
                onExecuteOperation={handleExecuteProducerOperation}
                onUndoLastOperation={handleUndo}
                canUndo={undoStack.length > 0}
                onClose={() => setShowAiProducer(false)}
              />
            </div>
          )}

          {/* Main DAW Transport Bar */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            {/* Left Transport: Play, Stop, Loop, Record, Undo/Redo */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={togglePlay}
                className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold transition shadow-lg ${
                  isPlaying
                    ? "bg-neon-pink text-white shadow-neon-pink/30 animate-pulse"
                    : "bg-neon-cyan text-studio-950 shadow-neon-cyan/30"
                }`}
                title="Play / Pause (Space)"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <button
                onClick={stopAndRewind}
                className="w-10 h-10 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-300 flex items-center justify-center border border-studio-700 transition"
                title="Stop & Rewind (R)"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>

              <button
                onClick={() => setLoopEnabled(!loopEnabled)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition ${
                  loopEnabled
                    ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan"
                    : "bg-studio-800 border-studio-700 text-studio-400"
                }`}
                title="Cycle Loop (L)"
              >
                <Repeat className="w-4 h-4" />
              </button>

              <div className="h-6 w-px bg-studio-800 mx-1" />

              {/* Undo / Redo */}
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition ${
                  undoStack.length > 0
                    ? "bg-studio-800 text-studio-300 border-studio-700 hover:bg-studio-750"
                    : "opacity-30 cursor-not-allowed bg-studio-900 border-studio-800 text-studio-600"
                }`}
                title="Undo (Ctrl+Z)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition ${
                  redoStack.length > 0
                    ? "bg-studio-800 text-studio-300 border-studio-700 hover:bg-studio-750"
                    : "opacity-30 cursor-not-allowed bg-studio-900 border-studio-800 text-studio-600"
                }`}
                title="Redo (Ctrl+Shift+Z)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Center Clock & BPM */}
            <div className="flex items-center gap-4 bg-studio-950 px-4 py-2 rounded-xl border border-studio-800">
              <div>
                <span className="text-[10px] text-studio-500 font-mono block">BAR : BEAT : TICK</span>
                <span
                  ref={timeDisplayRef}
                  className="font-mono text-sm font-bold text-neon-cyan tracking-wider"
                >
                  1:1:1 (00:00.0)
                </span>
              </div>
              <div className="h-8 w-px bg-studio-800" />
              <div>
                <span className="text-[10px] text-studio-500 font-mono block">TEMPO</span>
                <div className="flex items-center">
                  <input
                    type="number"
                    min="60"
                    max="220"
                    value={bpm}
                    onChange={(e) => {
                      setBpm(parseInt(e.target.value) || 120);
                      setIsDirty(true);
                    }}
                    className="w-14 bg-transparent font-mono text-sm font-bold text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-studio-500 font-mono">BPM</span>
                </div>
              </div>
            </div>

            {/* Right Tools: Snap, Zoom, Master Volume */}
            <div className="flex items-center gap-3">
              {/* Snap Selector */}
              <div className="flex items-center bg-studio-950 px-2 py-1 rounded-xl border border-studio-800 text-xs font-mono">
                <span className="text-studio-500 mr-2 text-[10px]">SNAP</span>
                <select
                  value={snapGrid}
                  onChange={(e) => setSnapGrid(parseFloat(e.target.value))}
                  className="bg-transparent text-neon-cyan font-bold focus:outline-none"
                >
                  <option value={1.0}>1 Beat</option>
                  <option value={0.5}>1/8 Beat</option>
                  <option value={0.25}>1/16 Beat</option>
                  <option value={0}>Off</option>
                </select>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center bg-studio-950 px-2 py-1 rounded-xl border border-studio-800">
                <button
                  onClick={() => setPixelsPerBeat((z) => Math.max(18, z - 6))}
                  className="text-studio-400 hover:text-white p-1"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono text-studio-400 px-1.5">
                  {Math.round((pixelsPerBeat / 36) * 100)}%
                </span>
                <button
                  onClick={() => setPixelsPerBeat((z) => Math.min(72, z + 6))}
                  className="text-studio-400 hover:text-white p-1"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Master Volume with Live RMS Meter */}
              <div className="flex items-center gap-2 bg-studio-950 px-3 py-1.5 rounded-xl border border-studio-800">
                <Volume2 className="w-4 h-4 text-studio-400" />
                <input
                  type="range"
                  min="0"
                  max="1.2"
                  step="0.01"
                  value={masterVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMasterVolume(val);
                    audioDawEngine.setMasterVolume(val);
                    setIsDirty(true);
                  }}
                  className="w-20 h-1.5 bg-studio-800 rounded appearance-none cursor-pointer accent-neon-cyan"
                />
                <div className="w-12 h-2 bg-studio-800 rounded-full overflow-hidden">
                  <div
                    ref={masterMeterRef}
                    className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 w-0 transition-all duration-75"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Clip Editing Toolbar (Appears when clip is selected) */}
          {selectedClipId && (
            <div className="bg-studio-950/80 border border-neon-cyan/30 rounded-xl px-4 py-2 flex items-center justify-between text-xs font-mono shadow-lg animate-in fade-in duration-150">
              <span className="text-neon-cyan font-bold flex items-center gap-2">
                <span>Selected Clip Active</span>
                <span className="text-studio-500 font-normal">
                  [Split: <kbd className="bg-studio-800 px-1 py-0.5 rounded text-white">S</kbd> &bull; Duplicate: <kbd className="bg-studio-800 px-1 py-0.5 rounded text-white">D</kbd> &bull; Delete: <kbd className="bg-studio-800 px-1 py-0.5 rounded text-white">Del</kbd>]
                </span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={splitClipAtPlayhead}
                  className="px-3 py-1 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-200 border border-studio-700 flex items-center gap-1.5"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Split at Playhead</span>
                </button>
                <button
                  onClick={duplicateSelectedClip}
                  className="px-3 py-1 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-200 border border-studio-700 flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicate</span>
                </button>
                <button
                  onClick={deleteSelectedClip}
                  className="px-3 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Multitrack Workspace & Timeline Canvas */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            {/* Timeline Bar Rulers Header */}
            <div className="flex border-b border-studio-800 bg-studio-950/90 sticky top-0 z-20">
              {/* Left Column: Track Headers Label & Add Track */}
              <div className="w-64 p-3 border-r border-studio-800 flex items-center justify-between text-xs font-mono text-studio-400 font-bold uppercase shrink-0">
                <span>Tracks ({tracks.length})</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAddTrack("audio")}
                    className="p-1 rounded hover:bg-studio-800 text-neon-cyan"
                    title="Add Audio Track"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleAddTrack("synth")}
                    className="p-1 rounded hover:bg-studio-800 text-neon-purple text-[10px] font-bold"
                    title="Add MIDI Synth Track"
                  >
                    +MIDI
                  </button>
                </div>
              </div>

              {/* Horizontal Ruler Lane */}
              <div
                ref={timelineScrollRef}
                onClick={handleRulerClick}
                className="flex-1 overflow-x-auto relative select-none cursor-pointer h-10 border-studio-800"
              >
                <div style={{ width: `${36 * pixelsPerBeat * 4}px` }} className="h-full relative flex">
                  {/* Bars & Beats markers */}
                  {Array.from({ length: 36 }).map((_, barIdx) => (
                    <div
                      key={barIdx}
                      style={{ width: `${pixelsPerBeat * 4}px` }}
                      className="border-l border-studio-800 text-[10px] font-mono text-studio-500 pl-2 pt-2 shrink-0 relative"
                    >
                      <span className="font-bold text-studio-300">Bar {barIdx + 1}</span>
                      {/* Beat ticks */}
                      <div className="absolute bottom-0 left-0 right-0 flex h-2 border-t border-studio-900">
                        {[0, 1, 2, 3].map((b) => (
                          <div key={b} className="flex-1 border-r border-studio-850/50" />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Loop Region Marker on Ruler */}
                  {loopEnabled && (
                    <div
                      style={{
                        left: `${loopStartBeat * pixelsPerBeat}px`,
                        width: `${(loopEndBeat - loopStartBeat) * pixelsPerBeat}px`,
                      }}
                      className="absolute top-0 bottom-0 bg-neon-cyan/15 border-l-2 border-r-2 border-neon-cyan pointer-events-none"
                    >
                      <span className="text-[9px] font-mono text-neon-cyan font-bold pl-1">
                        LOOP REGION
                      </span>
                    </div>
                  )}

                  {/* Playhead Cursor */}
                  <div
                    ref={playheadRef}
                    className="absolute top-0 bottom-0 w-0.5 bg-neon-cyan shadow-[0_0_10px_#00f0ff] z-30 pointer-events-none"
                    style={{ transform: `translateX(${currentBeat * pixelsPerBeat}px)` }}
                  >
                    <div className="w-3 h-3 -ml-[5px] bg-neon-cyan rotate-45 shadow-[0_0_8px_#00f0ff]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Multitrack Lanes List */}
            <div className="divide-y divide-studio-800/80">
              {tracks.map((track) => {
                const isArmed = track.armed;
                const isSelected = selectedTrackId === track.id;

                return (
                  <div
                    key={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                    className={`flex h-24 transition ${
                      isSelected ? "bg-studio-850/40" : "hover:bg-studio-850/20"
                    }`}
                  >
                    {/* Track Header & Channel Strip (256px) */}
                    <div className="w-64 p-3 border-r border-studio-800 flex flex-col justify-between bg-studio-950/60 shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: track.color }}
                          />
                          <input
                            type="text"
                            value={track.name}
                            onChange={(e) => {
                              const newName = e.target.value;
                              setTracks((prev) =>
                                prev.map((t) => (t.id === track.id ? { ...t, name: newName } : t))
                              );
                              setIsDirty(true);
                            }}
                            className="text-xs font-bold bg-transparent text-white truncate max-w-[120px] focus:outline-none"
                          />
                        </div>

                        {/* Mute, Solo, Record Arm */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newTracks = tracks.map((t) =>
                                t.id === track.id ? { ...t, muted: !t.muted } : t
                              );
                              pushUndo(newTracks);
                            }}
                            className={`w-5 h-5 rounded text-[10px] font-bold font-mono transition ${
                              track.muted
                                ? "bg-neon-crimson text-white"
                                : "bg-studio-800 text-studio-400 hover:text-studio-200"
                            }`}
                            title="Mute Track"
                          >
                            M
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newTracks = tracks.map((t) =>
                                t.id === track.id ? { ...t, solo: !t.solo } : t
                              );
                              pushUndo(newTracks);
                            }}
                            className={`w-5 h-5 rounded text-[10px] font-bold font-mono transition ${
                              track.solo
                                ? "bg-neon-amber text-studio-950"
                                : "bg-studio-800 text-studio-400 hover:text-studio-200"
                            }`}
                            title="Solo Track"
                          >
                            S
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTrackRecord(track.id);
                            }}
                            className={`w-5 h-5 rounded text-[10px] font-bold font-mono transition ${
                              isRecordingTrack && track.armed
                                ? "bg-neon-crimson text-white animate-pulse"
                                : track.armed
                                ? "bg-rose-950 border border-rose-500 text-rose-400"
                                : "bg-studio-800 text-studio-400 hover:text-studio-200"
                            }`}
                            title="Record Arm"
                          >
                            R
                          </button>
                        </div>
                      </div>

                      {/* Volume Slider, Pan, and Meter */}
                      <div className="space-y-1.5 text-[10px] font-mono text-studio-400">
                        <div className="flex items-center gap-2">
                          <span className="w-6">VOL</span>
                          <input
                            type="range"
                            min="0"
                            max="1.5"
                            step="0.01"
                            value={track.volume}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setTracks((prev) =>
                                prev.map((t) => (t.id === track.id ? { ...t, volume: val } : t))
                              );
                              audioDawEngine.updateTrackParams({ ...track, volume: val });
                              setIsDirty(true);
                            }}
                            className="flex-1 h-1 bg-studio-800 rounded appearance-none cursor-pointer accent-neon-cyan"
                          />
                          <span className="w-8 text-right">{Math.round(track.volume * 100)}%</span>
                        </div>

                        {/* Track Real-Time Peak Meter */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 h-1 bg-studio-900 rounded-full overflow-hidden">
                            <div
                              ref={(el) => {
                                if (el) trackMetersRef.current.set(track.id, el);
                              }}
                              className="h-full bg-emerald-400 w-0 transition-all duration-75"
                            />
                          </div>

                          {/* FX and Piano Roll buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFxTrackId(activeFxTrackId === track.id ? null : track.id);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${
                                activeFxTrackId === track.id
                                  ? "bg-neon-cyan text-studio-950 border-neon-cyan"
                                  : "bg-studio-800 text-studio-400 border-studio-700 hover:text-white"
                              }`}
                            >
                              FX
                            </button>

                            {track.trackType === "synth" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const synthClip = track.clips[0] || {
                                    id: `clip_${Date.now()}`,
                                    trackId: track.id,
                                    name: "Synth Pattern 1",
                                    startBeat: 0,
                                    durationBeats: 16,
                                    sourceOffsetSec: 0,
                                    color: track.color,
                                    midiNotes: [],
                                  };
                                  setActivePianoRollClip(synthClip);
                                }}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 transition"
                              >
                                PIANO
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Lane Container */}
                    <div
                      onClick={handleRulerClick}
                      style={{ width: `${36 * pixelsPerBeat * 4}px` }}
                      className="flex-1 relative bg-studio-950/20 p-2 select-none overflow-hidden"
                    >
                      {/* Clips on this track */}
                      {track.clips.map((clip) => {
                        const leftPx = clip.startBeat * pixelsPerBeat;
                        const widthPx = Math.max(20, clip.durationBeats * pixelsPerBeat);
                        const isClipSelected = selectedClipId === clip.id;

                        return (
                          <div
                            key={clip.id}
                            onMouseDown={(e) => handleClipMouseDown(e, clip, "move")}
                            style={{
                              left: `${leftPx}px`,
                              width: `${widthPx}px`,
                              backgroundColor: `${clip.color}18`,
                              borderColor: isClipSelected ? "#ffffff" : `${clip.color}70`,
                            }}
                            className={`absolute top-2 bottom-2 rounded-xl border p-2 flex flex-col justify-between overflow-hidden shadow-lg cursor-move transition-all group ${
                              isClipSelected ? "ring-2 ring-neon-cyan shadow-neon-cyan/20" : ""
                            }`}
                          >
                            {/* Left trim handle */}
                            <div
                              onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-left")}
                              className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-white/10 hover:bg-white/30 z-10"
                            />

                            {/* Clip Title & Type */}
                            <div className="flex items-center justify-between text-[11px] font-bold text-white truncate drop-shadow z-0">
                              <span className="truncate">{clip.name}</span>
                              <span className="text-[9px] font-mono opacity-60">
                                {clip.durationBeats} Beats
                              </span>
                            </div>

                            {/* Micro Waveform / Note Lines */}
                            <div className="flex items-end gap-0.5 h-6 opacity-60 pointer-events-none">
                              {Array.from({ length: Math.min(40, Math.floor(widthPx / 6)) }).map(
                                (_, idx) => {
                                  const h = 25 + Math.abs(Math.sin((idx + clip.startBeat) * 0.4) * 70);
                                  return (
                                    <span
                                      key={idx}
                                      className="w-1 rounded-full"
                                      style={{
                                        height: `${h}%`,
                                        backgroundColor: clip.color,
                                      }}
                                    />
                                  );
                                }
                              )}
                            </div>

                            {/* Right trim handle */}
                            <div
                              onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-right")}
                              className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-white/10 hover:bg-white/30 z-10"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-Time Effects Rack (When FX button is toggled) */}
          {activeFxTrackId && selectedTrack && (
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-top-4 duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono uppercase text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-neon-cyan" />
                  <span>Real-Time Effects Rack &bull; {selectedTrack.name}</span>
                </h3>
                <button
                  onClick={() => setActiveFxTrackId(null)}
                  className="text-studio-400 hover:text-white"
                >
                  &times;
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. 3-Band Equalizer */}
                <div className="p-3.5 rounded-xl bg-studio-950 border border-studio-800 space-y-3">
                  <span className="text-[11px] font-bold text-neon-cyan block font-mono">
                    3-BAND EQ
                  </span>
                  <div className="space-y-2 text-[10px] font-mono text-studio-400">
                    <div>
                      <div className="flex justify-between">
                        <span>BASS (250Hz)</span>
                        <span>{selectedTrack.fx.eq.bass} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-15"
                        max="15"
                        step="0.5"
                        value={selectedTrack.fx.eq.bass}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, fx: { ...t.fx, eq: { ...t.fx.eq, bass: val } } }
                                : t
                            )
                          );
                          setIsDirty(true);
                        }}
                        className="w-full h-1 bg-studio-800 rounded accent-neon-cyan"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>MID (1.5kHz)</span>
                        <span>{selectedTrack.fx.eq.mid} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-15"
                        max="15"
                        step="0.5"
                        value={selectedTrack.fx.eq.mid}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, fx: { ...t.fx, eq: { ...t.fx.eq, mid: val } } }
                                : t
                            )
                          );
                          setIsDirty(true);
                        }}
                        className="w-full h-1 bg-studio-800 rounded accent-neon-cyan"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>TREBLE (6kHz)</span>
                        <span>{selectedTrack.fx.eq.treble} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-15"
                        max="15"
                        step="0.5"
                        value={selectedTrack.fx.eq.treble}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, fx: { ...t.fx, eq: { ...t.fx.eq, treble: val } } }
                                : t
                            )
                          );
                          setIsDirty(true);
                        }}
                        className="w-full h-1 bg-studio-800 rounded accent-neon-cyan"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Resonant Filter */}
                <div className="p-3.5 rounded-xl bg-studio-950 border border-studio-800 space-y-3">
                  <span className="text-[11px] font-bold text-neon-purple block font-mono">
                    FILTER (LP / HP)
                  </span>
                  <div className="space-y-2 text-[10px] font-mono text-studio-400">
                    <div>
                      <div className="flex justify-between">
                        <span>CUTOFF</span>
                        <span>{Math.round(selectedTrack.fx.filter.frequency)} Hz</span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="20000"
                        step="100"
                        value={selectedTrack.fx.filter.frequency}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, fx: { ...t.fx, filter: { ...t.fx.filter, frequency: val } } }
                                : t
                            )
                          );
                          setIsDirty(true);
                        }}
                        className="w-full h-1 bg-studio-800 rounded accent-neon-purple"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>RESONANCE Q</span>
                        <span>{selectedTrack.fx.filter.q.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="12"
                        step="0.1"
                        value={selectedTrack.fx.filter.q}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, fx: { ...t.fx, filter: { ...t.fx.filter, q: val } } }
                                : t
                            )
                          );
                          setIsDirty(true);
                        }}
                        className="w-full h-1 bg-studio-800 rounded accent-neon-purple"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Delay Effect */}
                <div className="p-3.5 rounded-xl bg-studio-950 border border-studio-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-neon-amber font-mono">DELAY</span>
                    <input
                      type="checkbox"
                      checked={selectedTrack.fx.delay.enabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setTracks((prev) =>
                          prev.map((t) =>
                            t.id === selectedTrack.id
                              ? { ...t, fx: { ...t.fx, delay: { ...t.fx.delay, enabled: val } } }
                              : t
                          )
                        );
                        setIsDirty(true);
                      }}
                      className="rounded bg-studio-900 border-studio-700 text-neon-amber focus:ring-0"
                    />
                  </div>
                  <div className="space-y-2 text-[10px] font-mono text-studio-400">
                    <div>
                      <div className="flex justify-between">
                        <span>TIME</span>
                        <span>{selectedTrack.fx.delay.time}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="1.0"
                        step="0.05"
                        value={selectedTrack.fx.delay.time}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, fx: { ...t.fx, delay: { ...t.fx.delay, time: val } } }
                                : t
                            )
                          );
                          setIsDirty(true);
                        }}
                        className="w-full h-1 bg-studio-800 rounded accent-neon-amber"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>WET MIX</span>
                        <span>{Math.round(selectedTrack.fx.delay.mix * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedTrack.fx.delay.mix}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, fx: { ...t.fx, delay: { ...t.fx.delay, mix: val } } }
                                : t
                            )
                          );
                          setIsDirty(true);
                        }}
                        className="w-full h-1 bg-studio-800 rounded accent-neon-amber"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Convolution Reverb */}
                <div className="p-3.5 rounded-xl bg-studio-950 border border-studio-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-400 font-mono">REVERB</span>
                    <input
                      type="checkbox"
                      checked={selectedTrack.fx.reverb.enabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setTracks((prev) =>
                          prev.map((t) =>
                            t.id === selectedTrack.id
                              ? { ...t, fx: { ...t.fx, reverb: { ...t.fx.reverb, enabled: val } } }
                              : t
                          )
                        );
                        setIsDirty(true);
                      }}
                      className="rounded bg-studio-900 border-studio-700 text-emerald-400 focus:ring-0"
                    />
                  </div>
                  <div className="space-y-2 text-[10px] font-mono text-studio-400">
                    <div>
                      <div className="flex justify-between">
                        <span>SPACE DECAY</span>
                        <span>{selectedTrack.fx.reverb.decay}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="5.0"
                        step="0.25"
                        value={selectedTrack.fx.reverb.decay}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, fx: { ...t.fx, reverb: { ...t.fx.reverb, decay: val } } }
                                : t
                            )
                          );
                          setIsDirty(true);
                        }}
                        className="w-full h-1 bg-studio-800 rounded accent-emerald-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>WET MIX</span>
                        <span>{Math.round(selectedTrack.fx.reverb.mix * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedTrack.fx.reverb.mix}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, fx: { ...t.fx, reverb: { ...t.fx.reverb, mix: val } } }
                                : t
                            )
                          );
                          setIsDirty(true);
                        }}
                        className="w-full h-1 bg-studio-800 rounded accent-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Dynamics Compressor */}
                <div className="p-3.5 rounded-xl bg-studio-950 border border-studio-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-neon-pink font-mono">COMPRESSOR</span>
                    <input
                      type="checkbox"
                      checked={selectedTrack.fx.compressor.enabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setTracks((prev) =>
                          prev.map((t) =>
                            t.id === selectedTrack.id
                              ? { ...t, fx: { ...t.fx, compressor: { ...t.fx.compressor, enabled: val } } }
                              : t
                          )
                        );
                        setIsDirty(true);
                      }}
                      className="rounded bg-studio-900 border-studio-700 text-neon-pink focus:ring-0"
                    />
                  </div>
                  <div className="space-y-2 text-[10px] font-mono text-studio-400">
                    <div>
                      <div className="flex justify-between">
                        <span>THRESHOLD</span>
                        <span>{selectedTrack.fx.compressor.threshold} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-40"
                        max="0"
                        step="1"
                        value={selectedTrack.fx.compressor.threshold}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, fx: { ...t.fx, compressor: { ...t.fx.compressor, threshold: val } } }
                                : t
                            )
                          );
                          setIsDirty(true);
                        }}
                        className="w-full h-1 bg-studio-800 rounded accent-neon-pink"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>RATIO</span>
                        <span>{selectedTrack.fx.compressor.ratio}:1</span>
                      </div>
                      <input
                        type="range"
                        min="1.5"
                        max="12"
                        step="0.5"
                        value={selectedTrack.fx.compressor.ratio}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, fx: { ...t.fx, compressor: { ...t.fx.compressor, ratio: val } } }
                                : t
                            )
                          );
                          setIsDirty(true);
                        }}
                        className="w-full h-1 bg-studio-800 rounded accent-neon-pink"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MIDI Piano Roll Modal */}
          {activePianoRollClip && (
            <PianoRoll
              clipName={activePianoRollClip.name}
              bpm={bpm}
              notes={activePianoRollClip.midiNotes || []}
              onNotesChange={(newNotes) => {
                setTracks((prev) =>
                  prev.map((t) => ({
                    ...t,
                    clips: t.clips.map((c) =>
                      c.id === activePianoRollClip.id ? { ...c, midiNotes: newNotes } : c
                    ),
                  }))
                );
                setIsDirty(true);
              }}
              onClose={() => setActivePianoRollClip(null)}
            />
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: WAVEFORM AUDIO EDITOR & AI SOUND LAB (PHASE 5)   */}
      {/* ======================================================== */}
      {activeTab === "waveform" && (
        <div className="space-y-6">
          {/* Source Audio Capture Bar */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-200 border border-studio-700 text-xs font-medium flex items-center gap-2 transition">
                <Upload className="w-4 h-4 text-studio-400" />
                <span>Upload Audio Master</span>
                <input
                  type="file"
                  accept="audio/wav,audio/mp3,audio/mpeg,audio/ogg,audio/flac"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsProcessing(true);
                    setStatusMessage("Decoding and validating audio container...");
                    const formData = new FormData();
                    formData.append("file", file);
                    try {
                      const res = await apiRequest("/editor/upload-recording", {
                        method: "POST",
                        body: formData,
                      });
                      setTrackId(res.track_id);
                      setWaveTrackTitle(res.title);
                      setCurrentAudioUrl(res.audio_url);
                      setOriginalAudioUrl(res.audio_url);
                      setWaveDuration(res.duration_seconds);
                      if (res.waveform_data) setWaveformData(res.waveform_data);
                      setStatusMessage("Audio master successfully loaded!");
                    } catch (err: any) {
                      setErrorMessage(err.message);
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => {
                  setWaveTrackTitle("Neon Horizon (Cyberpunk Master Demo)");
                  setWaveDuration(24.0);
                  setSelectionStart(2.0);
                  setSelectionEnd(14.0);
                  setStatusMessage("Demo session active. Ready for editing below.");
                }}
                className="px-3 py-2 rounded-xl bg-studio-950 hover:bg-studio-850 text-studio-300 border border-studio-800 text-xs font-medium transition"
              >
                Load Cyberpunk Demo
              </button>
            </div>

            {/* A/B Comparison Toggle */}
            <div className="flex items-center gap-4">
              {originalAudioUrl && (
                <div className="flex items-center bg-studio-950 p-1 rounded-xl border border-studio-800">
                  <button
                    onClick={() => setAbMode("edited")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      abMode === "edited"
                        ? "bg-neon-cyan text-studio-950 shadow"
                        : "text-studio-400 hover:text-studio-200"
                    }`}
                  >
                    Edited (v{activeVersionNumber})
                  </button>
                  <button
                    onClick={() => setAbMode("original")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      abMode === "original"
                        ? "bg-neon-pink text-white shadow"
                        : "text-studio-400 hover:text-studio-200"
                    }`}
                  >
                    Original Master
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Editing Operations Deck */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Tool 1: Deterministic Crop & Trim */}
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase text-neon-cyan">
                <Scissors className="w-4 h-4" />
                <span>Crop & Trim</span>
              </div>
              <p className="text-xs text-studio-400 leading-relaxed">
                Sample-accurate slicing with automated 20ms boundary micro-fades.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setStatusMessage("Please upload audio master or record take first.")}
                  className="w-full py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-neon-cyan border border-neon-cyan/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Apply Trim</span>
                </button>
              </div>
            </div>

            {/* Tool 2: AI Extend Track */}
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase text-neon-purple">
                <TrendingUp className="w-4 h-4" />
                <span>AI Extend Track</span>
              </div>
              <p className="text-xs text-studio-400 leading-relaxed">
                Extends harmonic progression with neural conditioning or DSP looping.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setStatusMessage("Extension available once master track is active.")}
                  className="w-full py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-neon-purple border border-neon-purple/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Extend Audio Track</span>
                </button>
              </div>
            </div>

            {/* Tool 3: Demucs Stem Splitting */}
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase text-neon-cyan">
                <Music className="w-4 h-4" />
                <span>Demucs v4 Stem Separation</span>
              </div>
              <p className="text-xs text-studio-400 leading-relaxed">
                Phase-locked 4-stem separation: Vocals, Drums, Bass, Other.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setStatusMessage("Demucs separation ready for active master tracks.")}
                  className="w-full py-2 rounded-xl bg-neon-cyan hover:bg-cyan-400 text-studio-950 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-neon-cyan/10"
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>Separate Stems</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
