"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Square,
  Sliders,
  Sparkles,
  Trash2,
  Volume2,
  X,
  Plus,
  Music,
} from "lucide-react";
import { audioDawEngine, SynthSettings } from "@/lib/audioEngine";

export interface MidiNote {
  id: string;
  pitch: number; // 36 (C2) to 96 (C7)
  startBeat: number; // 0.0, 0.25, 0.5...
  durationBeats: number; // 1.0, 0.5, 0.25...
  velocity: number; // 0.0 to 1.0
}

interface PianoRollProps {
  clipName: string;
  bpm: number;
  notes: MidiNote[];
  onNotesChange: (notes: MidiNote[]) => void;
  onClose: () => void;
}

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getNoteLabel(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  const name = PITCH_NAMES[pitch % 12];
  return `${name}${octave}`;
}

function isBlackKey(pitch: number): boolean {
  const mod = pitch % 12;
  return [1, 3, 6, 8, 10].includes(mod);
}

export default function PianoRoll({
  clipName,
  bpm,
  notes,
  onNotesChange,
  onClose,
}: PianoRollProps) {
  // Pitches from 84 (C6) down to 36 (C2) -> 49 keys
  const minPitch = 36;
  const maxPitch = 84;
  const totalBeats = 16; // 4 bars

  const [quantize, setQuantize] = useState<number>(0.25); // 1/16 note = 0.25 beat
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentPlayheadBeat, setCurrentPlayheadBeat] = useState<number>(0);

  // Synth Parameters
  const [synthSettings, setSynthSettings] = useState<SynthSettings>({
    waveform: "sawtooth",
    attack: 0.02,
    decay: 0.15,
    sustain: 0.7,
    release: 0.2,
    filterCutoff: 3800,
    filterResonance: 3.5,
  });

  // Dragging state
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [resizingNoteId, setResizingNoteId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [initialStartBeat, setInitialStartBeat] = useState<number>(0);
  const [initialPitch, setInitialPitch] = useState<number>(0);
  const [initialDuration, setInitialDuration] = useState<number>(0);

  const gridRef = useRef<HTMLDivElement | null>(null);

  // Audition a note using the Web Audio Synth Engine
  const auditionNote = (pitch: number, durationSec: number = 0.4) => {
    audioDawEngine.playSynthNote(pitch, durationSec, synthSettings);
  };

  // Keyboard controls for live synth playing
  useEffect(() => {
    const keyToPitch: Record<string, number> = {
      a: 60, // C4
      w: 61, // C#4
      s: 62, // D4
      e: 63, // D#4
      d: 64, // E4
      f: 65, // F4
      t: 66, // F#4
      g: 67, // G4
      y: 68, // G#4
      h: 69, // A4
      u: 70, // A#4
      j: 71, // B4
      k: 72, // C5
      o: 73, // C#5
      l: 74, // D5
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const pitch = keyToPitch[e.key.toLowerCase()];
      if (pitch) {
        auditionNote(pitch, 0.4);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [synthSettings]);

  // Playback timer loop
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      const beatIntervalMs = ((60 / bpm) * 1000) / 16;
      interval = setInterval(() => {
        setCurrentPlayheadBeat((prev) => {
          const next = prev + 0.0625;
          if (next >= totalBeats) {
            return 0;
          }
          // Check notes triggered at this tick
          const triggered = notes.filter(
            (n) => Math.abs(n.startBeat - next) < 0.04
          );
          triggered.forEach((n) => {
            const durSec = (n.durationBeats * 60) / bpm;
            auditionNote(n.pitch, durSec);
          });
          return next;
        });
      }, beatIntervalMs);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, bpm, notes, synthSettings]);

  // Grid Dimensions
  const beatWidthPx = 48; // 48px per beat
  const keyHeightPx = 22; // 22px per row

  // Handle Cell Click to Add Note
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingNoteId || resizingNoteId) return;
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rawBeat = x / beatWidthPx;
    const snappedBeat = Math.floor(rawBeat / quantize) * quantize;

    const rowIndex = Math.floor(y / keyHeightPx);
    const pitch = maxPitch - rowIndex;

    if (pitch < minPitch || pitch > maxPitch || snappedBeat >= totalBeats) return;

    // Check if clicking on an existing note
    const clickedExisting = notes.find(
      (n) =>
        n.pitch === pitch &&
        snappedBeat >= n.startBeat &&
        snappedBeat < n.startBeat + n.durationBeats
    );

    if (!clickedExisting) {
      // Add new note
      const newNote: MidiNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        pitch,
        startBeat: snappedBeat,
        durationBeats: quantize,
        velocity: 0.85,
      };
      onNotesChange([...notes, newNote]);
      setSelectedNoteId(newNote.id);
      auditionNote(pitch, (quantize * 60) / bpm);
    }
  };

  // Quantize All Notes
  const handleQuantizeAll = () => {
    const quantized = notes.map((n) => ({
      ...n,
      startBeat: Math.round(n.startBeat / quantize) * quantize,
      durationBeats: Math.max(quantize, Math.round(n.durationBeats / quantize) * quantize),
    }));
    onNotesChange(quantized);
  };

  // Delete Selected Note
  const handleDeleteSelected = () => {
    if (!selectedNoteId) return;
    onNotesChange(notes.filter((n) => n.id !== selectedNoteId));
    setSelectedNoteId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-studio-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-studio-900 border border-studio-800 rounded-3xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header & Transport */}
        <div className="p-4 border-b border-studio-800 flex flex-wrap items-center justify-between gap-4 bg-studio-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center text-neon-purple">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>MIDI Piano Roll & Synthesizer</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neon-purple/10 text-neon-purple border border-neon-purple/20">
                  {clipName}
                </span>
              </h2>
              <p className="text-[11px] text-studio-400 font-mono">
                Web Audio Polyphonic Synth &bull; {bpm} BPM &bull; {notes.length} Notes
              </p>
            </div>
          </div>

          {/* Transport & Quantize */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold transition shadow ${
                isPlaying
                  ? "bg-neon-pink text-white"
                  : "bg-neon-purple text-white shadow-neon-purple/20"
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentPlayheadBeat(0);
              }}
              className="w-9 h-9 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-300 flex items-center justify-center border border-studio-700 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Quantize selector */}
            <div className="flex items-center bg-studio-950 px-2 py-1 rounded-xl border border-studio-800 text-xs font-mono">
              <span className="text-studio-500 mr-2 text-[10px]">SNAP</span>
              <select
                value={quantize}
                onChange={(e) => setQuantize(parseFloat(e.target.value))}
                className="bg-transparent text-neon-purple font-bold focus:outline-none"
              >
                <option value={1.0}>1/4 Beat</option>
                <option value={0.5}>1/8 Beat</option>
                <option value={0.25}>1/16 Beat</option>
                <option value={0.125}>1/32 Beat</option>
              </select>
            </div>

            <button
              onClick={handleQuantizeAll}
              className="px-3 py-1.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-200 border border-studio-700 text-xs font-medium transition"
            >
              Quantize All
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={!selectedNoteId}
              className={`p-2 rounded-xl border transition ${
                selectedNoteId
                  ? "bg-rose-950/40 border-rose-500/30 text-rose-300 hover:bg-rose-900/50"
                  : "opacity-40 cursor-not-allowed bg-studio-900 border-studio-800 text-studio-500"
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-400 hover:text-white flex items-center justify-center border border-studio-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Middle: Synth Rack */}
        <div className="px-6 py-2.5 border-b border-studio-800 bg-studio-950/40 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-studio-500 font-bold uppercase">SYNTH ENGINE:</span>
            <div className="flex items-center gap-1.5">
              {(["sawtooth", "square", "sine", "triangle"] as OscillatorType[]).map((wf) => (
                <button
                  key={wf}
                  onClick={() => setSynthSettings({ ...synthSettings, waveform: wf })}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition ${
                    synthSettings.waveform === wf
                      ? "bg-neon-purple text-white shadow"
                      : "bg-studio-800 text-studio-400 hover:text-studio-200"
                  }`}
                >
                  {wf}
                </button>
              ))}
            </div>
          </div>

          {/* ADSR & Filter Quick Sliders */}
          <div className="flex items-center gap-4 text-[11px] text-studio-400">
            <div className="flex items-center gap-1.5">
              <span className="text-studio-500 text-[10px]">ATTACK</span>
              <input
                type="range"
                min="0.01"
                max="0.5"
                step="0.01"
                value={synthSettings.attack}
                onChange={(e) =>
                  setSynthSettings({ ...synthSettings, attack: parseFloat(e.target.value) })
                }
                className="w-14 h-1 bg-studio-800 rounded accent-neon-purple"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-studio-500 text-[10px]">DECAY</span>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={synthSettings.decay}
                onChange={(e) =>
                  setSynthSettings({ ...synthSettings, decay: parseFloat(e.target.value) })
                }
                className="w-14 h-1 bg-studio-800 rounded accent-neon-purple"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-studio-500 text-[10px]">SUSTAIN</span>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={synthSettings.sustain}
                onChange={(e) =>
                  setSynthSettings({ ...synthSettings, sustain: parseFloat(e.target.value) })
                }
                className="w-14 h-1 bg-studio-800 rounded accent-neon-purple"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-studio-500 text-[10px]">CUTOFF</span>
              <input
                type="range"
                min="200"
                max="12000"
                step="200"
                value={synthSettings.filterCutoff}
                onChange={(e) =>
                  setSynthSettings({ ...synthSettings, filterCutoff: parseFloat(e.target.value) })
                }
                className="w-16 h-1 bg-studio-800 rounded accent-neon-cyan"
              />
            </div>
          </div>
        </div>

        {/* Main Grid: Vertical Piano Keys + Note Matrix */}
        <div className="flex-1 overflow-auto flex relative select-none">
          {/* Vertical Piano Keyboard Sidebar */}
          <div className="w-20 bg-studio-950 border-r border-studio-800 shrink-0 sticky left-0 z-30 divide-y divide-studio-900/60 shadow-lg">
            {Array.from({ length: maxPitch - minPitch + 1 }).map((_, i) => {
              const pitch = maxPitch - i;
              const isBlack = isBlackKey(pitch);
              const label = getNoteLabel(pitch);
              const isC = pitch % 12 === 0;

              return (
                <div
                  key={pitch}
                  onClick={() => auditionNote(pitch, 0.5)}
                  style={{ height: `${keyHeightPx}px` }}
                  className={`flex items-center justify-between px-2 text-[10px] font-mono cursor-pointer transition active:brightness-125 ${
                    isBlack
                      ? "bg-studio-950 text-studio-400 hover:bg-studio-900"
                      : isC
                      ? "bg-studio-900 text-white font-bold border-l-2 border-neon-cyan"
                      : "bg-studio-900/80 text-studio-300 hover:bg-studio-850"
                  }`}
                >
                  <span>{label}</span>
                  {isC && <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan"></span>}
                </div>
              );
            })}
          </div>

          {/* Note Matrix & Timeline Canvas */}
          <div
            ref={gridRef}
            onClick={handleGridClick}
            style={{
              width: `${totalBeats * beatWidthPx}px`,
              height: `${(maxPitch - minPitch + 1) * keyHeightPx}px`,
            }}
            className="relative bg-studio-950/80 cursor-crosshair"
          >
            {/* Horizontal Key Grid Lines */}
            {Array.from({ length: maxPitch - minPitch + 1 }).map((_, i) => {
              const pitch = maxPitch - i;
              const isBlack = isBlackKey(pitch);
              return (
                <div
                  key={i}
                  style={{
                    top: `${i * keyHeightPx}px`,
                    height: `${keyHeightPx}px`,
                  }}
                  className={`absolute left-0 right-0 border-b border-studio-850/40 pointer-events-none ${
                    isBlack ? "bg-studio-900/30" : "bg-transparent"
                  }`}
                />
              );
            })}

            {/* Vertical Beat Ruler Lines */}
            {Array.from({ length: totalBeats * 4 }).map((_, step) => {
              const isBar = step % 16 === 0;
              const isBeat = step % 4 === 0;
              return (
                <div
                  key={step}
                  style={{ left: `${step * (beatWidthPx / 4)}px` }}
                  className={`absolute top-0 bottom-0 pointer-events-none ${
                    isBar
                      ? "border-l-2 border-studio-700/80"
                      : isBeat
                      ? "border-l border-studio-800/80"
                      : "border-l border-studio-900/40"
                  }`}
                />
              );
            })}

            {/* Playhead Marker */}
            {isPlaying && (
              <div
                style={{ left: `${currentPlayheadBeat * beatWidthPx}px` }}
                className="absolute top-0 bottom-0 w-0.5 bg-neon-pink shadow-[0_0_8px_#ec4899] z-20 pointer-events-none transition-all duration-75"
              />
            )}

            {/* Rendered MIDI Note Blocks */}
            {notes.map((note) => {
              const rowIndex = maxPitch - note.pitch;
              const top = rowIndex * keyHeightPx + 1;
              const left = note.startBeat * beatWidthPx;
              const width = Math.max(12, note.durationBeats * beatWidthPx - 2);
              const isSelected = selectedNoteId === note.id;

              return (
                <div
                  key={note.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNoteId(note.id);
                    auditionNote(note.pitch, (note.durationBeats * 60) / bpm);
                  }}
                  style={{
                    top: `${top}px`,
                    left: `${left}px`,
                    width: `${width}px`,
                    height: `${keyHeightPx - 2}px`,
                  }}
                  className={`absolute rounded-md px-1.5 flex items-center justify-between text-[10px] font-mono font-bold cursor-move transition shadow-md ${
                    isSelected
                      ? "bg-neon-cyan text-studio-950 ring-2 ring-white shadow-neon-cyan/40"
                      : "bg-neon-purple hover:brightness-110 text-white shadow-neon-purple/20"
                  }`}
                >
                  <span className="truncate">{getNoteLabel(note.pitch)}</span>
                  {/* Resize handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setResizingNoteId(note.id);
                    }}
                    className="w-2 h-full cursor-ew-resize opacity-60 hover:opacity-100"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Guidance */}
        <div className="p-3 border-t border-studio-800 bg-studio-950/80 flex items-center justify-between text-[11px] font-mono text-studio-400">
          <span>Click to place notes &bull; Drag to move &bull; Play live via Computer Keyboard (A, W, S, E, D, F...)</span>
          <span className="text-neon-cyan">Polyphonic Voice Engine: Active</span>
        </div>
      </div>
    </div>
  );
}
