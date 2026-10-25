"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Send,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  RotateCcw,
  Plus,
  Layers,
  Wand2,
  Trash2,
  ChevronDown,
  Volume2,
  Radio,
  FileAudio,
  UserCheck,
  Flame,
  Info,
  Clock,
  Settings2,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

export interface PlannedOperation {
  op_id: string;
  operation_type:
    | "addTrack"
    | "moveClip"
    | "changeGain"
    | "addEffect"
    | "generateStem"
    | "replaceSection"
    | "splitClip"
    | "duplicateClip"
    | "deleteClip"
    | "deleteTrack"
    | string;
  parameters: Record<string, any>;
  description: string;
  is_destructive: boolean;
  requires_confirmation: boolean;
  undo_available: boolean;
}

export interface MusicPersona {
  id: string;
  name: string;
  description?: string;
  genre_preferences: string[];
  vocal_style?: string;
  typical_bpm_range?: string;
  prompt_template?: string;
  system_instructions?: string;
}

export interface ProducerChatMessage {
  id: string;
  sender: "user" | "producer";
  text: string;
  timestamp: string;
  reasoning?: string;
  personaName?: string;
  plannedOperations?: PlannedOperation[];
}

export interface ProducerActionLog {
  id: string;
  operation: PlannedOperation;
  timestamp: string;
}

interface AiProducerPanelProps {
  projectState: {
    tracks: any[];
    bpm: number;
    masterVolume?: number;
    loopEnabled?: boolean;
    projectId?: string | null;
  };
  onExecuteOperation: (op: PlannedOperation) => void;
  onUndoLastOperation: () => void;
  canUndo: boolean;
  onClose?: () => void;
}

const DEFAULT_PERSONAS: MusicPersona[] = [
  {
    id: "persona_cyber",
    name: "Cyberpunk Synthwave Architect",
    description: "Analog warm basslines, arpeggiated retro leads, and neon spatial reverb.",
    genre_preferences: ["Synthwave", "Cyberpunk", "Darksynth"],
    vocal_style: "Robotic Vocoder & Lush Detuned Chants",
    typical_bpm_range: "115 - 128",
    system_instructions: "Emphasize lush analog delay, driving 808 sidechaining, and retro-futuristic timbres.",
  },
  {
    id: "persona_drill",
    name: "Trap & Drill Hitmaker",
    description: "Sliding 808s, rapid hi-hat rolls, hard clipping dynamics, and vocal chops.",
    genre_preferences: ["Trap", "UK Drill", "Hip-Hop"],
    vocal_style: "Aggressive Auto-Tuned Flow",
    typical_bpm_range: "140 - 144",
    system_instructions: "Prioritize punchy low-end punch, snappy transients, and sharp high frequencies.",
  },
  {
    id: "persona_neosoul",
    name: "Neo-Soul & Lofi Arranger",
    description: "Vintage Rhodes chords, vinyl flutter, warm lowpass filters, and relaxed swing.",
    genre_preferences: ["Neo-Soul", "Lofi Hip-Hop", "R&B"],
    vocal_style: "Silky Velvet falsetto",
    typical_bpm_range: "80 - 92",
    system_instructions: "Maintain organic acoustic warmth, subtle saturation, and unhurried syncopation.",
  },
  {
    id: "persona_bollywood",
    name: "Bollywood & Punjabi Pop Producer",
    description: "High-energy dhol rhythms, tumbi melodies, rich vocal hooks, and modern bass.",
    genre_preferences: ["Punjabi Pop", "Bollywood", "Bhangra Fusion"],
    vocal_style: "Soaring Melismatic Lead",
    typical_bpm_range: "98 - 110",
    system_instructions: "Focus on infectious rhythmic drive, celebratory instrumentation, and bright dynamic masters.",
  },
];

export default function AiProducerPanel({
  projectState,
  onExecuteOperation,
  onUndoLastOperation,
  canUndo,
  onClose,
}: AiProducerPanelProps) {
  // Personas
  const [personas, setPersonas] = useState<MusicPersona[]>(DEFAULT_PERSONAS);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(DEFAULT_PERSONAS[0].id);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaGenre, setNewPersonaGenre] = useState("");
  const [newPersonaVocal, setNewPersonaVocal] = useState("");
  const [newPersonaInstructions, setNewPersonaInstructions] = useState("");

  // Chat conversation
  const [messages, setMessages] = useState<ProducerChatMessage[]>([
    {
      id: "msg_intro",
      sender: "producer",
      text: "Greetings, Producer. I am connected to your multitrack session clock and signal chains. Tell me what arrangement changes, stem splits, gain staging, or synth textures you want to lay down.",
      reasoning: "Session telemetry active. 60fps clock synchronized. Ready for typed editing operations.",
      personaName: DEFAULT_PERSONAS[0].name,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  // Staged Preview & Confirmation
  const [stagedOp, setStagedOp] = useState<PlannedOperation | null>(null);
  const [destructiveConfirmed, setDestructiveConfirmed] = useState(false);

  // Executed Action Logs
  const [actionHistory, setActionHistory] = useState<ProducerActionLog[]>([]);

  // Fetch registered personas from backend API
  useEffect(() => {
    async function loadPersonas() {
      try {
        const data = await apiRequest<MusicPersona[]>("/personas");
        if (Array.isArray(data) && data.length > 0) {
          setPersonas([...data, ...DEFAULT_PERSONAS.filter((dp) => !data.some((d) => d.id === dp.id))]);
        }
      } catch {
        // Fallback to default presets gracefully
      }
    }
    loadPersonas();
  }, []);

  const activePersona = personas.find((p) => p.id === selectedPersonaId) || personas[0];

  // Quick Prompt Dispatch
  const handleQuickPrompt = (prompt: string) => {
    setInputPrompt(prompt);
  };

  // Submit Prompt to AI Producer Backend
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = inputPrompt.trim();
    if (!prompt || isThinking) return;

    const userMessage: ProducerChatMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt("");
    setIsThinking(true);

    try {
      const response = await apiRequest<{
        assistant_message: string;
        musical_reasoning: string;
        planned_operations: PlannedOperation[];
        persona_used: string;
        confidence_score: number;
      }>("/producer/chat", {
        method: "POST",
        body: JSON.stringify({
          message: prompt,
          project_state: {
            bpm: projectState.bpm,
            tracks: projectState.tracks.map((t) => ({
              id: t.id,
              name: t.name,
              track_type: t.trackType,
              volume: t.volume,
              pan: t.pan,
              clips: t.clips,
            })),
          },
          persona_id: selectedPersonaId,
        }),
      });

      const producerMessage: ProducerChatMessage = {
        id: `prod_${Date.now()}`,
        sender: "producer",
        text: response.assistant_message,
        reasoning: response.musical_reasoning,
        personaName: response.persona_used || activePersona.name,
        plannedOperations: response.planned_operations,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, producerMessage]);

      // Automatically stage the first planned operation in the preview card
      if (response.planned_operations && response.planned_operations.length > 0) {
        setStagedOp(response.planned_operations[0]);
        setDestructiveConfirmed(false);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "producer",
          text: `Arrangement advisory: ${err.message || "Failed to parse producer request."}`,
          reasoning: "Execution halted. Session state remains intact.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  // Execute Planned Operation
  const handleExecute = () => {
    if (!stagedOp) return;
    if ((stagedOp.is_destructive || stagedOp.requires_confirmation) && !destructiveConfirmed) {
      alert("Please check the confirmation box before executing a destructive operation.");
      return;
    }

    onExecuteOperation(stagedOp);

    // Record in history log
    setActionHistory((prev) => [
      {
        id: `act_${Date.now()}`,
        operation: stagedOp,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev.slice(0, 9),
    ]);

    setStagedOp(null);
    setDestructiveConfirmed(false);
  };

  // Create Custom Persona
  const handleCreatePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonaName.trim()) return;

    try {
      const created = await apiRequest<MusicPersona>("/personas", {
        method: "POST",
        body: JSON.stringify({
          name: newPersonaName.trim(),
          description: "Custom producer profile",
          genre_preferences: newPersonaGenre.split(",").map((s) => s.trim()).filter(Boolean),
          vocal_style: newPersonaVocal.trim() || "Dynamic Studio Vocal",
          system_instructions: newPersonaInstructions.trim() || "Balanced dynamic production style.",
        }),
      });

      setPersonas((prev) => [created, ...prev]);
      setSelectedPersonaId(created.id);
      setShowPersonaModal(false);
      setNewPersonaName("");
      setNewPersonaGenre("");
      setNewPersonaVocal("");
      setNewPersonaInstructions("");
    } catch (err: any) {
      alert(`Could not save persona: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-studio-900 border border-studio-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* Top Header & Persona Selector */}
      <div className="p-3.5 bg-studio-950 border-b border-studio-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-neon-purple to-pink-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">AI Producer Panel</h3>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-neon-purple/20 text-neon-purple border border-neon-purple/30">
                Phase 7
              </span>
            </div>
            <p className="text-[10px] text-studio-400">Context-Aware Multitrack Arranger & Ethics Core</p>
          </div>
        </div>

        {/* Persona Picker */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedPersonaId}
              onChange={(e) => setSelectedPersonaId(e.target.value)}
              className="bg-studio-900 text-studio-200 text-xs px-2.5 py-1.5 pr-7 rounded-lg border border-studio-750 focus:border-neon-purple focus:outline-none cursor-pointer appearance-none max-w-[170px] truncate"
              title="Select active producer persona"
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-studio-400 absolute right-2 top-2.5 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowPersonaModal(true)}
            className="w-7 h-7 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 flex items-center justify-center border border-studio-700 transition"
            title="Create new musical persona"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-400 hover:text-white flex items-center justify-center border border-studio-700 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Active Persona Banner */}
      <div className="px-3.5 py-2 bg-gradient-to-r from-studio-950 via-purple-950/20 to-studio-950 border-b border-studio-800/60 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 overflow-hidden">
          <Flame className="w-3.5 h-3.5 text-pink-400 shrink-0" />
          <span className="font-semibold text-studio-200 truncate">{activePersona.name}</span>
          <span className="text-studio-500 hidden sm:inline">&bull;</span>
          <span className="text-studio-400 truncate hidden sm:inline">{activePersona.vocal_style}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono bg-studio-900 text-studio-300 px-2 py-0.5 rounded border border-studio-800">
            {projectState.bpm} BPM
          </span>
          {canUndo && (
            <button
              onClick={onUndoLastOperation}
              className="text-[10px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30 transition"
              title="Undo last DAW action"
            >
              <RotateCcw className="w-3 h-3" />
              Undo Action
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-studio-800">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed shadow-lg ${
                m.sender === "user"
                  ? "bg-neon-purple text-white rounded-br-none"
                  : "bg-studio-800/90 border border-studio-750 text-studio-200 rounded-bl-none"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-70 font-mono">
                <span>{m.sender === "user" ? "Producer Instruction" : m.personaName || "AI Producer"}</span>
                <span>{m.timestamp}</span>
              </div>
              <p>{m.text}</p>

              {/* Musical Reasoning Accordion */}
              {m.reasoning && (
                <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] font-mono text-studio-300 flex items-start gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-neon-cyan shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-neon-cyan font-sans uppercase text-[9px] tracking-wider block">
                      Acoustic & Harmonic Reasoning:
                    </strong>
                    {m.reasoning}
                  </span>
                </div>
              )}

              {/* Planned Operations in Message */}
              {m.plannedOperations && m.plannedOperations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-studio-700/60 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-studio-400 flex items-center gap-1.5">
                    <Sliders className="w-3 h-3 text-neon-pink" />
                    <span>Proposed DAW Tool Operations ({m.plannedOperations.length})</span>
                  </div>
                  {m.plannedOperations.map((op) => (
                    <div
                      key={op.op_id}
                      onClick={() => setStagedOp(op)}
                      className="bg-studio-950/70 border border-studio-700/80 hover:border-neon-cyan/70 p-2 rounded-xl flex items-center justify-between cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            op.is_destructive
                              ? "bg-rose-950 text-rose-400 border border-rose-800"
                              : "bg-cyan-950 text-neon-cyan border border-cyan-800"
                          }`}
                        >
                          {op.operation_type}
                        </span>
                        <span className="text-[11px] text-studio-200 group-hover:text-neon-cyan truncate">
                          {op.description}
                        </span>
                      </div>
                      <span className="text-[10px] text-studio-400 group-hover:text-white shrink-0 ml-2 font-mono">
                        Review &rarr;
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 text-xs text-studio-400 italic font-mono animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-spin" />
            Analyzing harmonic headroom and queuing typed tool operations...
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* EDITABLE ACTION PREVIEW & DESTRUCTIVE CONFIRMATION MODAL  */}
      {/* ======================================================== */}
      {stagedOp && (
        <div className="m-3 p-3.5 bg-studio-950 border border-neon-cyan/50 rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  stagedOp.is_destructive
                    ? "bg-rose-950 text-rose-300 border border-rose-600 animate-pulse"
                    : "bg-cyan-950 text-neon-cyan border border-cyan-500"
                }`}
              >
                {stagedOp.operation_type}
              </span>
              <h4 className="text-xs font-bold text-white">Editable Action Preview</h4>
            </div>
            <button
              onClick={() => {
                setStagedOp(null);
                setDestructiveConfirmed(false);
              }}
              className="text-studio-400 hover:text-white text-xs font-mono"
            >
              &times; Discard
            </button>
          </div>

          <p className="text-xs text-studio-300 mb-3">{stagedOp.description}</p>

          {/* Operation Specific Editable Controls */}
          <div className="space-y-2.5 mb-3 bg-studio-900/80 p-3 rounded-xl border border-studio-800 text-xs">
            {/* 1. addTrack Controls */}
            {stagedOp.operation_type === "addTrack" && (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-studio-400 block mb-1">Track Name</label>
                  <input
                    type="text"
                    value={stagedOp.parameters.name || ""}
                    onChange={(e) =>
                      setStagedOp({
                        ...stagedOp,
                        parameters: { ...stagedOp.parameters, name: e.target.value },
                      })
                    }
                    className="w-full bg-studio-950 border border-studio-750 px-2 py-1 rounded text-white text-xs focus:outline-none focus:border-neon-cyan"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-studio-400 block mb-1">Track Type</label>
                  <select
                    value={stagedOp.parameters.track_type || "audio"}
                    onChange={(e) =>
                      setStagedOp({
                        ...stagedOp,
                        parameters: { ...stagedOp.parameters, track_type: e.target.value },
                      })
                    }
                    className="w-full bg-studio-950 border border-studio-750 px-2 py-1 rounded text-white text-xs focus:outline-none focus:border-neon-cyan"
                  >
                    <option value="audio">Audio Waveform Track</option>
                    <option value="synth">Polyphonic Synth & MIDI Track</option>
                  </select>
                </div>
              </div>
            )}

            {/* 2. changeGain Controls */}
            {stagedOp.operation_type === "changeGain" && (
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] text-studio-400 mb-1">
                    <span>Gain Volume</span>
                    <span className="font-mono text-white">
                      {Math.round((stagedOp.parameters.volume ?? 0.85) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={stagedOp.parameters.volume ?? 0.85}
                    onChange={(e) =>
                      setStagedOp({
                        ...stagedOp,
                        parameters: { ...stagedOp.parameters, volume: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-neon-cyan"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-studio-400 mb-1">
                    <span>Stereo Pan</span>
                    <span className="font-mono text-white">
                      {stagedOp.parameters.pan < 0
                        ? `${Math.round(Math.abs(stagedOp.parameters.pan) * 100)}% L`
                        : stagedOp.parameters.pan > 0
                        ? `${Math.round(stagedOp.parameters.pan * 100)}% R`
                        : "Center"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={stagedOp.parameters.pan ?? 0.0}
                    onChange={(e) =>
                      setStagedOp({
                        ...stagedOp,
                        parameters: { ...stagedOp.parameters, pan: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-neon-purple"
                  />
                </div>
              </div>
            )}

            {/* 3. addEffect Controls */}
            {stagedOp.operation_type === "addEffect" && (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-studio-400 block mb-1">Effect Type</label>
                  <select
                    value={stagedOp.parameters.effect_type || "reverb"}
                    onChange={(e) =>
                      setStagedOp({
                        ...stagedOp,
                        parameters: { ...stagedOp.parameters, effect_type: e.target.value },
                      })
                    }
                    className="w-full bg-studio-950 border border-studio-750 px-2 py-1 rounded text-white text-xs focus:outline-none focus:border-neon-cyan"
                  >
                    <option value="reverb">Algorithmic Reverb</option>
                    <option value="delay">Stereo Delay</option>
                    <option value="compressor">Optical Compressor</option>
                    <option value="filter">State-Variable Filter</option>
                    <option value="eq">3-Band Parametric EQ</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-studio-400 block mb-1">Wet / Dry Mix</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={stagedOp.parameters.params?.mix ?? 0.3}
                    onChange={(e) =>
                      setStagedOp({
                        ...stagedOp,
                        parameters: {
                          ...stagedOp.parameters,
                          params: { ...stagedOp.parameters.params, mix: parseFloat(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-studio-950 border border-studio-750 px-2 py-1 rounded text-white text-xs focus:outline-none focus:border-neon-cyan"
                  />
                </div>
              </div>
            )}

            {/* 4. generateStem Controls */}
            {stagedOp.operation_type === "generateStem" && (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-studio-400 block mb-1">Isolate Stem</label>
                  <select
                    value={stagedOp.parameters.stem_type || "vocals"}
                    onChange={(e) =>
                      setStagedOp({
                        ...stagedOp,
                        parameters: { ...stagedOp.parameters, stem_type: e.target.value },
                      })
                    }
                    className="w-full bg-studio-950 border border-studio-750 px-2 py-1 rounded text-white text-xs focus:outline-none focus:border-neon-cyan"
                  >
                    <option value="vocals">Vocals (Acapella)</option>
                    <option value="drums">Drums & Percussion</option>
                    <option value="bass">Bassline Sub</option>
                    <option value="other">Instrumental Backing</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-studio-400 block mb-1">Separation Model</label>
                  <div className="bg-studio-950 px-2 py-1.5 rounded border border-studio-800 text-[10px] font-mono text-neon-cyan">
                    HTDemucs v4 (Phase-Locked)
                  </div>
                </div>
              </div>
            )}

            {/* 5. replaceSection (DESTRUCTIVE INPAINTING) */}
            {stagedOp.operation_type === "replaceSection" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-studio-400 block mb-1">Start Time (sec)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={stagedOp.parameters.start_sec ?? 4.0}
                      onChange={(e) =>
                        setStagedOp({
                          ...stagedOp,
                          parameters: { ...stagedOp.parameters, start_sec: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full bg-studio-950 border border-studio-750 px-2 py-1 rounded text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-studio-400 block mb-1">End Time (sec)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={stagedOp.parameters.end_sec ?? 8.0}
                      onChange={(e) =>
                        setStagedOp({
                          ...stagedOp,
                          parameters: { ...stagedOp.parameters, end_sec: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full bg-studio-950 border border-studio-750 px-2 py-1 rounded text-white text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-studio-400 block mb-1">Inpainting Prompt</label>
                  <input
                    type="text"
                    value={stagedOp.parameters.prompt || ""}
                    onChange={(e) =>
                      setStagedOp({
                        ...stagedOp,
                        parameters: { ...stagedOp.parameters, prompt: e.target.value },
                      })
                    }
                    className="w-full bg-studio-950 border border-studio-750 px-2 py-1 rounded text-white text-xs"
                  />
                </div>
              </div>
            )}

            {/* 6. moveClip Controls */}
            {stagedOp.operation_type === "moveClip" && (
              <div>
                <label className="text-[10px] text-studio-400 block mb-1">New Target Beat</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={stagedOp.parameters.new_start_beat ?? 0}
                  onChange={(e) =>
                    setStagedOp({
                      ...stagedOp,
                      parameters: { ...stagedOp.parameters, new_start_beat: parseInt(e.target.value) },
                    })
                  }
                  className="w-full bg-studio-950 border border-studio-750 px-2 py-1 rounded text-white text-xs"
                />
              </div>
            )}
          </div>

          {/* Destructive Warning Confirmation Check */}
          {(stagedOp.is_destructive || stagedOp.requires_confirmation) && (
            <div className="bg-rose-950/60 border border-rose-500/50 p-2.5 rounded-xl mb-3 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Destructive Operation Alert</span>
              </div>
              <p className="text-[11px] text-rose-200/90 leading-tight">
                This operation will permanently overwrite or alter audio regions in the active multitrack
                session. Please verify before proceeding.
              </p>
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={destructiveConfirmed}
                  onChange={(e) => setDestructiveConfirmed(e.target.checked)}
                  className="rounded border-rose-500 text-rose-500 focus:ring-rose-500 accent-rose-500 w-4 h-4"
                />
                <span className="text-[11px] text-white font-medium">
                  I confirm replacing or removing this audio region
                </span>
              </label>
            </div>
          )}

          {/* Action Execution Footer */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setStagedOp(null);
                setDestructiveConfirmed(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              disabled={
                (stagedOp.is_destructive || stagedOp.requires_confirmation) && !destructiveConfirmed
              }
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition ${
                (stagedOp.is_destructive || stagedOp.requires_confirmation) && !destructiveConfirmed
                  ? "opacity-50 cursor-not-allowed bg-studio-800 text-studio-500"
                  : stagedOp.is_destructive
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                  : "bg-neon-cyan hover:bg-cyan-400 text-studio-950 shadow-neon-cyan/20"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apply Operation to DAW</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick Prompt Recommendation Pills */}
      <div className="px-3 py-2 bg-studio-950/60 border-t border-studio-850 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <span className="text-[10px] text-studio-400 font-mono uppercase shrink-0">Quick Tools:</span>
        <button
          onClick={() => handleQuickPrompt("Add a new synth lead track with neon styling")}
          className="text-[11px] bg-studio-800 hover:bg-studio-750 text-studio-200 px-2.5 py-1 rounded-lg border border-studio-700 shrink-0 transition"
        >
          + Add Synth Lead
        </button>
        <button
          onClick={() => handleQuickPrompt("Turn down volume on track 1 and pan left")}
          className="text-[11px] bg-studio-800 hover:bg-studio-750 text-studio-200 px-2.5 py-1 rounded-lg border border-studio-700 shrink-0 transition"
        >
          &bull; Gain & Pan Left
        </button>
        <button
          onClick={() => handleQuickPrompt("Add lush reverb effect to track 1")}
          className="text-[11px] bg-studio-800 hover:bg-studio-750 text-studio-200 px-2.5 py-1 rounded-lg border border-studio-700 shrink-0 transition"
        >
          &bull; Add Reverb
        </button>
        <button
          onClick={() => handleQuickPrompt("Isolate vocals using Demucs stem separation")}
          className="text-[11px] bg-studio-800 hover:bg-studio-750 text-studio-200 px-2.5 py-1 rounded-lg border border-studio-700 shrink-0 transition"
        >
          &bull; Demucs Vocal Stem
        </button>
        <button
          onClick={() => handleQuickPrompt("Replace section between 4s and 8s with dynamic guitar riff")}
          className="text-[11px] bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 px-2.5 py-1 rounded-lg border border-rose-800/80 shrink-0 transition"
        >
          ⚠️ Inpaint Section (Destructive)
        </button>
      </div>

      {/* Input Prompt Form */}
      <form onSubmit={handleSendMessage} className="p-3 bg-studio-950 border-t border-studio-800">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={`Instruct ${activePersona.name}... (e.g. "Add synth pad", "Cut clip at beat 8", "Pan drums right")`}
            className="w-full bg-studio-900 border border-studio-750 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-studio-500 focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple transition"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isThinking}
            className={`absolute right-2 w-7 h-7 rounded-lg flex items-center justify-center transition ${
              inputPrompt.trim() && !isThinking
                ? "bg-gradient-to-r from-neon-purple to-pink-500 text-white shadow-md shadow-pink-500/20"
                : "bg-studio-800 text-studio-500 cursor-not-allowed"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* ======================================================== */}
      {/* NEW PERSONA CREATION MODAL                               */}
      {/* ======================================================== */}
      {showPersonaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-studio-900 border border-studio-750 rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 border-b border-studio-800 pb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-pink-400" />
                <h3 className="text-sm font-bold text-white">Create Music Persona</h3>
              </div>
              <button
                onClick={() => setShowPersonaModal(false)}
                className="text-studio-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreatePersona} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] text-studio-300 block mb-1">Persona Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vintage Funk Bass Maestro"
                  value={newPersonaName}
                  onChange={(e) => setNewPersonaName(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-750 px-3 py-2 rounded-xl text-white focus:outline-none focus:border-neon-purple"
                />
              </div>

              <div>
                <label className="text-[11px] text-studio-300 block mb-1">
                  Genre Preferences (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Funk, Disco, Soul"
                  value={newPersonaGenre}
                  onChange={(e) => setNewPersonaGenre(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-750 px-3 py-2 rounded-xl text-white focus:outline-none focus:border-neon-purple"
                />
              </div>

              <div>
                <label className="text-[11px] text-studio-300 block mb-1">Vocal & Production Style</label>
                <input
                  type="text"
                  placeholder="e.g. Slap bass emphasis, groovy wah filters"
                  value={newPersonaVocal}
                  onChange={(e) => setNewPersonaVocal(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-750 px-3 py-2 rounded-xl text-white focus:outline-none focus:border-neon-purple"
                />
              </div>

              <div>
                <label className="text-[11px] text-studio-300 block mb-1">Arranger Directives</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Keep transients crisp, accentuate syncopation."
                  value={newPersonaInstructions}
                  onChange={(e) => setNewPersonaInstructions(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-750 px-3 py-2 rounded-xl text-white focus:outline-none focus:border-neon-purple"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPersonaModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-studio-800 text-studio-300 hover:bg-studio-750 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-neon-purple to-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-500/20"
                >
                  Save Persona
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
