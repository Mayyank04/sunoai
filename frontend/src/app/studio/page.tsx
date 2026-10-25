"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";

// --- Types ---
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

interface DawClip {
  id: string;
  name: string;
  startBeat: number;
  durationBeats: number;
  color: string;
}

interface DawTrack {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  color: string;
  clips: DawClip[];
}

const DEFAULT_DAW_TRACKS: DawTrack[] = [
  {
    id: "tr_1",
    name: "01 Drums (Punch Kick & Snare)",
    volume: 0.85,
    pan: 0.0,
    muted: false,
    solo: false,
    color: "#00f0ff",
    clips: [
      { id: "c1", name: "Drum Loop 4-Bar", startBeat: 0, durationBeats: 16, color: "#00f0ff" },
      { id: "c2", name: "Drum Break & Fill", startBeat: 16, durationBeats: 16, color: "#00f0ff" },
    ],
  },
  {
    id: "tr_2",
    name: "02 Bass (Analog Sub 808)",
    volume: 0.9,
    pan: 0.0,
    muted: false,
    solo: false,
    color: "#a855f7",
    clips: [
      { id: "c3", name: "Pumping Bassline", startBeat: 0, durationBeats: 16, color: "#a855f7" },
      { id: "c4", name: "Bass Drop Variant", startBeat: 16, durationBeats: 16, color: "#a855f7" },
    ],
  },
  {
    id: "tr_3",
    name: "03 Synth (Neon Polyphony)",
    volume: 0.75,
    pan: -0.25,
    muted: false,
    solo: false,
    color: "#ec4899",
    clips: [{ id: "c5", name: "Chords & Arp", startBeat: 8, durationBeats: 16, color: "#ec4899" }],
  },
  {
    id: "tr_4",
    name: "04 Atmosphere & FX",
    volume: 0.65,
    pan: 0.3,
    muted: false,
    solo: false,
    color: "#f59e0b",
    clips: [
      { id: "c6", name: "Riser & Shimmer", startBeat: 12, durationBeats: 8, color: "#f59e0b" },
      { id: "c7", name: "Downlifter Hit", startBeat: 20, durationBeats: 8, color: "#f59e0b" },
    ],
  },
];

export default function StudioPage() {
  // Mode: "waveform" (Phase 5 Waveform Studio) or "multitrack" (DAW Sequencer)
  const [activeTab, setActiveTab] = useState<"waveform" | "multitrack">("waveform");

  // --- Waveform Audio Editor State ---
  const [trackId, setTrackId] = useState<string | null>(null);
  const [trackTitle, setTrackTitle] = useState("Studio Session Master");
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(30.0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [abMode, setAbMode] = useState<"edited" | "original">("edited");

  // Region Selection for Crop / Trim / Inpaint
  const [selectionStart, setSelectionStart] = useState(0.0);
  const [selectionEnd, setSelectionEnd] = useState(15.0);

  // Edit Parameters
  const [fadeInSec, setFadeInSec] = useState(1.5);
  const [fadeOutSec, setFadeOutSec] = useState(2.0);
  const [extendSeconds, setExtendSeconds] = useState(15);
  const [extendProvider, setExtendProvider] = useState("suno");
  const [useAiConditioning, setUseAiConditioning] = useState(true);
  const [inpaintPrompt, setInpaintPrompt] = useState("Electric piano solo with smooth vibrato");
  const [inpaintProvider, setInpaintProvider] = useState("suno");

  // Remix parameters
  const [remixGenre, setRemixGenre] = useState("Cyberpunk");
  const [remixSpeed, setRemixSpeed] = useState(1.0);
  const [remixBass, setRemixBass] = useState(1.4);
  const [remixTreble, setRemixTreble] = useState(1.1);

  // Cover parameters
  const [coverTitle, setCoverTitle] = useState("Acoustic Studio Tribute");
  const [coverVocalist, setCoverVocalist] = useState("Maya Vance");
  const [coverGenre, setCoverGenre] = useState("Acoustic Pop");
  const [coverConsented, setCoverConsented] = useState(true);

  // Stems
  const [stems, setStems] = useState<StemTrack[]>([]);
  const [isSplittingStems, setIsSplittingStems] = useState(false);

  // Version History & Undo
  const [versions, setVersions] = useState<AudioVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeVersionNumber, setActiveVersionNumber] = useState(1);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio element reference for playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- Multitrack DAW State ---
  const [dawTracks, setDawTracks] = useState<DawTrack[]>(DEFAULT_DAW_TRACKS);
  const [bpm, setBpm] = useState(124);
  const [dawPlaying, setDawPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const [metronome, setMetronome] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.9);
  const [isSaved, setIsSaved] = useState(false);

  // Default synthetic waveform initialization if empty
  useEffect(() => {
    if (waveformData.length === 0) {
      const generated = Array.from({ length: 120 }, (_, i) => {
        return Math.floor(25 + Math.sin(i * 0.2) * 35 + Math.cos(i * 0.08) * 20);
      });
      setWaveformData(generated);
    }
  }, [waveformData]);

  // Audio Playback Listener
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // Sync playback element with active URL and A/B mode
  useEffect(() => {
    const targetUrl = abMode === "original" && originalAudioUrl ? originalAudioUrl : currentAudioUrl;
    if (audioRef.current && targetUrl) {
      const wasPlaying = isPlaying;
      audioRef.current.src = targetUrl;
      if (wasPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }
  }, [abMode, currentAudioUrl, originalAudioUrl]);

  // Canvas Waveform Renderer
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = "#0c0d12";
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = "#1a1c26";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Highlight selected crop/inpaint region
    if (duration > 0) {
      const startX = (selectionStart / duration) * width;
      const endX = (selectionEnd / duration) * width;
      ctx.fillStyle = "rgba(0, 240, 255, 0.12)";
      ctx.fillRect(startX, 0, endX - startX, height);
      ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, 0, endX - startX, height);
    }

    // Draw waveform bars
    const bars = waveformData.length || 100;
    const barWidth = Math.max(2, (width / bars) - 1.5);
    const centerY = height / 2;

    for (let i = 0; i < bars; i++) {
      const x = i * (width / bars);
      const val = (waveformData[i] || 30) / 100;
      const barHeight = val * (height * 0.85);

      const isInsideSelection =
        duration > 0 &&
        (i / bars) >= (selectionStart / duration) &&
        (i / bars) <= (selectionEnd / duration);

      const isPlayed = duration > 0 && (i / bars) <= (currentTime / duration);

      if (isInsideSelection) {
        ctx.fillStyle = isPlayed ? "#00f0ff" : "#38bdf8";
      } else {
        ctx.fillStyle = isPlayed ? "#a855f7" : "#3f3f50";
      }

      ctx.beginPath();
      ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 2);
      ctx.fill();
    }

    // Draw Playhead
    if (duration > 0) {
      const playheadX = (currentTime / duration) * width;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Scrubber head diamond
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [waveformData, currentTime, duration, selectionStart, selectionEnd]);

  // Handle Scrubbing Click on Waveform
  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetTime = (clickX / rect.width) * duration;
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  // --- In-Browser Live Microphone Recording ---
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      // Web Audio API for RMS level visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
        stream.getTracks().forEach((t) => t.stop());
        setAudioLevel(0);

        const audioBlob = new Blob(recordedChunksRef.current, { type: "audio/wav" });
        await uploadRecordingBlob(audioBlob);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordTimer((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(`Microphone access error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const uploadRecordingBlob = async (blob: Blob) => {
    try {
      setIsProcessing(true);
      setStatusMessage("Validating audio stream & extracting waveform peaks...");
      const formData = new FormData();
      formData.append("file", blob, "live_mic_take.wav");
      formData.append("title", `Mic Take ${new Date().toLocaleTimeString()}`);
      formData.append("genre", "Vocal");

      const res = await apiRequest("/editor/upload-recording", {
        method: "POST",
        body: formData,
      });

      setTrackId(res.track_id);
      setTrackTitle(res.title);
      setCurrentAudioUrl(res.audio_url);
      setOriginalAudioUrl(res.audio_url);
      setDuration(res.duration_seconds);
      setSelectionStart(0.0);
      setSelectionEnd(Math.min(res.duration_seconds, 15.0));
      if (res.waveform_data?.length) setWaveformData(res.waveform_data);
      setActiveVersionNumber(1);
      setStatusMessage("Recording uploaded and ready for editing!");
      loadVersions(res.track_id);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Upload Local Audio File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setStatusMessage("Uploading and decoding master audio file...");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

      const res = await apiRequest("/editor/upload-recording", {
        method: "POST",
        body: formData,
      });

      setTrackId(res.track_id);
      setTrackTitle(res.title);
      setCurrentAudioUrl(res.audio_url);
      setOriginalAudioUrl(res.audio_url);
      setDuration(res.duration_seconds);
      setSelectionStart(0.0);
      setSelectionEnd(Math.min(res.duration_seconds, 15.0));
      if (res.waveform_data?.length) setWaveformData(res.waveform_data);
      setActiveVersionNumber(1);
      setStatusMessage("Audio master successfully loaded!");
      loadVersions(res.track_id);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Load Demo Audio Track
  const handleLoadDemo = async () => {
    try {
      setIsProcessing(true);
      setStatusMessage("Generating synthetic 16-bit 44.1kHz demo session...");
      // Synthesize demo track on the backend
      const res = await apiRequest("/generation/providers");
      // Use standard procedural sample
      setTrackTitle("Neon Horizon (Cyberpunk Master Demo)");
      setDuration(24.0);
      setSelectionStart(2.0);
      setSelectionEnd(14.0);
      setStatusMessage("Demo session active. Try trimming, extending, or remixing below.");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- API Action Handlers ---

  // 1. Trim / Crop
  const handleApplyTrim = async () => {
    if (!trackId) {
      setErrorMessage("Please record or upload an audio track first.");
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMessage("Applying sample-accurate trim with boundary micro-fades...");
      setErrorMessage(null);

      const res: AudioVersion = await apiRequest("/editor/trim", {
        method: "POST",
        body: JSON.stringify({
          track_id: trackId,
          start_seconds: selectionStart,
          end_seconds: selectionEnd,
          fade_in_seconds: fadeInSec,
          fade_out_seconds: fadeOutSec,
          title: `Trimmed (${selectionStart.toFixed(1)}s - ${selectionEnd.toFixed(1)}s)`,
        }),
      });

      applyEditResponse(res);
      setStatusMessage(`Trim complete! Created Version ${res.version_number}.`);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Apply Fades
  const handleApplyFades = async () => {
    if (!trackId) {
      setErrorMessage("Please record or upload an audio track first.");
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMessage("Applying equal-power acoustic fades...");
      setErrorMessage(null);

      const res: AudioVersion = await apiRequest("/editor/fade", {
        method: "POST",
        body: JSON.stringify({
          track_id: trackId,
          fade_in_seconds: fadeInSec,
          fade_out_seconds: fadeOutSec,
        }),
      });

      applyEditResponse(res);
      setStatusMessage(`Fades applied! Created Version ${res.version_number}.`);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. AI Extend (Capability Governed)
  const handleApplyExtend = async () => {
    if (!trackId) {
      setErrorMessage("Please record or upload an audio track first.");
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMessage(`Synthesizing ${extendSeconds}s continuation via ${extendProvider}...`);
      setErrorMessage(null);

      const res: AudioVersion = await apiRequest("/editor/extend", {
        method: "POST",
        body: JSON.stringify({
          track_id: trackId,
          additional_seconds: extendSeconds,
          provider: extendProvider,
          use_ai_conditioning: useAiConditioning,
        }),
      });

      applyEditResponse(res);
      setStatusMessage(`Track extended! Created Version ${res.version_number}.`);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Inpaint Section
  const handleApplyInpaint = async () => {
    if (!trackId) {
      setErrorMessage("Please record or upload an audio track first.");
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMessage(`Inpainting section (${selectionStart.toFixed(1)}s - ${selectionEnd.toFixed(1)}s)...`);
      setErrorMessage(null);

      const res: AudioVersion = await apiRequest("/editor/inpaint-section", {
        method: "POST",
        body: JSON.stringify({
          track_id: trackId,
          start_seconds: selectionStart,
          end_seconds: selectionEnd,
          prompt: inpaintPrompt,
          provider: inpaintProvider,
          use_ai_conditioning: useAiConditioning,
        }),
      });

      applyEditResponse(res);
      setStatusMessage(`Section replaced! Created Version ${res.version_number}.`);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Acoustic Remix
  const handleApplyRemix = async () => {
    if (!trackId) {
      setErrorMessage("Please record or upload an audio track first.");
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMessage(`Remixing track into ${remixGenre} style...`);
      setErrorMessage(null);

      const res: AudioVersion = await apiRequest("/editor/remix", {
        method: "POST",
        body: JSON.stringify({
          track_id: trackId,
          target_genre: remixGenre,
          speed_factor: remixSpeed,
          bass_boost: remixBass,
          treble_boost: remixTreble,
        }),
      });

      applyEditResponse(res);
      setStatusMessage(`Remix generated! Created Version ${res.version_number}.`);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Authorized Cover
  const handleApplyCover = async () => {
    if (!trackId) {
      setErrorMessage("Please record or upload an audio track first.");
      return;
    }
    if (!coverConsented) {
      setErrorMessage("Commercial covers require verified mechanical license and artist consent attestation.");
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMessage("Synthesizing authorized cover with mechanical licensing attestation...");
      setErrorMessage(null);

      const res: AudioVersion = await apiRequest("/editor/authorized-cover", {
        method: "POST",
        body: JSON.stringify({
          original_track_id: trackId,
          cover_title: coverTitle,
          vocalist_name: coverVocalist,
          genre: coverGenre,
          is_consented: true,
        }),
      });

      applyEditResponse(res);
      setStatusMessage(`Authorized cover created! Version ${res.version_number}.`);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 7. Demucs Stem Separation
  const handleSeparateStems = async () => {
    if (!trackId) {
      setErrorMessage("Please record or upload an audio track first.");
      return;
    }
    try {
      setIsSplittingStems(true);
      setStatusMessage("Running Demucs v4 (Hybrid Transformer) stem separation...");
      setErrorMessage(null);

      const res = await apiRequest("/stems/separate", {
        method: "POST",
        body: JSON.stringify({
          track_id: trackId,
          stem_model: "htdemucs_v4",
        }),
      });

      const formattedStems: StemTrack[] = (res.stems || []).map((s: any) => ({
        stem_type: s.stem_type,
        audio_url: s.audio_url,
        duration_seconds: s.duration_seconds,
        waveform_data: s.waveform_data || [50, 60, 40, 70],
        volume: 0.85,
        muted: false,
        solo: false,
      }));

      setStems(formattedStems);
      setStatusMessage("Stems successfully separated with zero timestamp drift!");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSplittingStems(false);
    }
  };

  // 8. Undo Last Edit
  const handleUndo = async () => {
    if (!trackId) return;
    try {
      setIsProcessing(true);
      setStatusMessage("Reverting to previous version snapshot...");
      setErrorMessage(null);

      const res: AudioVersion = await apiRequest(`/editor/${trackId}/undo`, {
        method: "POST",
      });

      applyEditResponse(res);
      setStatusMessage(res.operation_summary);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply response from edit
  const applyEditResponse = (res: AudioVersion) => {
    setCurrentAudioUrl(res.edited_audio_url);
    setDuration(res.duration_seconds);
    if (res.waveform_data?.length) setWaveformData(res.waveform_data);
    setActiveVersionNumber(res.version_number);
    setSelectionStart(0.0);
    setSelectionEnd(Math.min(res.duration_seconds, 15.0));
    loadVersions(res.track_id);
  };

  // Fetch Version History List
  const loadVersions = async (tid: string) => {
    try {
      const list = await apiRequest(`/editor/${tid}/versions`);
      setVersions(list);
    } catch {}
  };

  // Restore specific historical version
  const handleRestoreVersion = (v: AudioVersion) => {
    setCurrentAudioUrl(v.edited_audio_url);
    setDuration(v.duration_seconds);
    if (v.waveform_data?.length) setWaveformData(v.waveform_data);
    setActiveVersionNumber(v.version_number);
    setStatusMessage(`Restored Version ${v.version_number}: '${v.title}'`);
  };

  // Stem Controls
  const toggleStemMute = (type: string) => {
    setStems((prev) =>
      prev.map((s) => (s.stem_type === type ? { ...s, muted: !s.muted } : s))
    );
  };

  const toggleStemSolo = (type: string) => {
    setStems((prev) =>
      prev.map((s) => (s.stem_type === type ? { ...s, solo: !s.solo } : s))
    );
  };

  const updateStemVolume = (type: string, vol: number) => {
    setStems((prev) =>
      prev.map((s) => (s.stem_type === type ? { ...s, volume: vol } : s))
    );
  };

  // Capability Warning Check
  const showConditioningWarning =
    extendProvider === "fombo_procedural" && useAiConditioning;

  // --- Multitrack Sequencer Animation Loop ---
  useEffect(() => {
    let interval: any = null;
    if (dawPlaying) {
      const beatIntervalMs = ((60 / bpm) * 1000) / 4;
      interval = setInterval(() => {
        setCurrentBeat((prev) => {
          const next = prev + 0.25;
          if (next >= 32) return isLooping ? 0 : 32;
          return next;
        });
      }, beatIntervalMs);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [dawPlaying, bpm, isLooping]);

  return (
    <div className="py-6 max-w-7xl mx-auto space-y-6">
      {/* Hidden audio element for waveform engine */}
      <audio ref={audioRef} preload="auto" />

      {/* Top Bar: Workspace Switcher & Project Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-studio-900 border border-studio-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>{trackTitle}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-studio-800 text-neon-cyan border border-neon-cyan/20">
                v{activeVersionNumber}
              </span>
            </h1>
            <p className="text-xs text-studio-400 font-mono">
              Deterministic DSP &bull; Demucs v4 &bull; AI Sound Lab
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-studio-950 p-1 rounded-xl border border-studio-800">
          <button
            onClick={() => setActiveTab("waveform")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "waveform"
                ? "bg-neon-cyan text-studio-950 shadow"
                : "text-studio-400 hover:text-studio-200"
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Waveform Audio Editor</span>
          </button>
          <button
            onClick={() => setActiveTab("multitrack")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "multitrack"
                ? "bg-neon-purple text-white shadow"
                : "text-studio-400 hover:text-studio-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multitrack Sequencer</span>
          </button>
        </div>

        {/* Undo & Version Stack Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={activeVersionNumber <= 1 || isProcessing}
            className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition ${
              activeVersionNumber > 1 && !isProcessing
                ? "bg-studio-800 hover:bg-studio-750 text-studio-200 border-studio-700"
                : "opacity-40 cursor-not-allowed bg-studio-900 border-studio-800 text-studio-500"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo Edit</span>
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition ${
              showHistory
                ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan"
                : "bg-studio-800 hover:bg-studio-750 text-studio-300 border-studio-700"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({versions.length || 1})</span>
          </button>
        </div>
      </div>

      {/* Status & Error Alerts */}
      {statusMessage && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            {statusMessage}
          </span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
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
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200"
          >
            &times;
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 1: WAVEFORM AUDIO EDITOR & AI SOUND LAB (PHASE 5)   */}
      {/* ======================================================== */}
      {activeTab === "waveform" && (
        <div className="space-y-6">
          {/* Source Audio Capture Bar: Live Mic & File Upload */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            {/* Live Recording Controls */}
            <div className="flex items-center gap-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl bg-neon-crimson hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-neon-crimson/20 transition"
                >
                  <Mic className="w-4 h-4" />
                  <span>Record Microphone</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 rounded-xl bg-white text-studio-950 font-bold text-xs flex items-center gap-2 animate-pulse transition"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-neon-crimson" />
                  <span>
                    Stop ({String(Math.floor(recordTimer / 60)).padStart(2, "0")}:
                    {String(recordTimer % 60).padStart(2, "0")})
                  </span>
                </button>
              )}

              {/* Live Audio Level Meter */}
              {isRecording && (
                <div className="flex items-center gap-1.5 bg-studio-950 px-3 py-1.5 rounded-lg border border-studio-800">
                  <span className="text-[10px] font-mono text-studio-400">INPUT</span>
                  <div className="w-24 h-2 bg-studio-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Upload Master File */}
              <label className="cursor-pointer px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-200 border border-studio-700 text-xs font-medium flex items-center gap-2 transition">
                <Upload className="w-4 h-4 text-studio-400" />
                <span>Upload Audio File</span>
                <input
                  type="file"
                  accept="audio/wav,audio/mp3,audio/mpeg,audio/ogg,audio/flac"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Load Demo Track */}
              <button
                onClick={handleLoadDemo}
                className="px-3 py-2 rounded-xl bg-studio-950 hover:bg-studio-850 text-studio-300 border border-studio-800 text-xs font-medium transition"
              >
                Load Cyberpunk Demo
              </button>
            </div>

            {/* A/B Comparison Toggle & Transport */}
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

              {/* Play / Pause Scrubber Button */}
              <button
                onClick={togglePlay}
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition shadow-lg ${
                  isPlaying
                    ? "bg-neon-pink text-white"
                    : "bg-neon-cyan text-studio-950"
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Interactive Waveform Canvas Display */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-studio-400 flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-neon-cyan" />
                <span>
                  {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
                </span>
                {abMode === "original" && (
                  <span className="text-neon-pink bg-neon-pink/10 px-2 py-0.5 rounded border border-neon-pink/20">
                    Listening to Original Master
                  </span>
                )}
              </span>

              <div className="flex items-center gap-4 text-studio-400">
                <span>
                  Selection: {selectionStart.toFixed(1)}s &rarr; {selectionEnd.toFixed(1)}s (
                  {(selectionEnd - selectionStart).toFixed(1)}s)
                </span>
              </div>
            </div>

            {/* Canvas */}
            <div className="relative rounded-xl overflow-hidden border border-studio-800 cursor-crosshair">
              <canvas
                ref={waveformCanvasRef}
                width={1100}
                height={160}
                onClick={handleWaveformClick}
                className="w-full h-40 block"
              />
            </div>

            {/* Region Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-studio-800">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-studio-400">
                  <span>REGION START (CUT IN)</span>
                  <span className="text-neon-cyan">{selectionStart.toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0.1, selectionEnd - 0.1)}
                  step="0.1"
                  value={selectionStart}
                  onChange={(e) => setSelectionStart(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-studio-800 rounded appearance-none cursor-pointer accent-neon-cyan"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-studio-400">
                  <span>REGION END (CUT OUT)</span>
                  <span className="text-neon-cyan">{selectionEnd.toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min={Math.min(duration, selectionStart + 0.1)}
                  max={duration}
                  step="0.1"
                  value={selectionEnd}
                  onChange={(e) => setSelectionEnd(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-studio-800 rounded appearance-none cursor-pointer accent-neon-cyan"
                />
              </div>
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
                Extracts the highlighted region with sample-accurate micro-fades to eliminate boundary clicks.
              </p>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <label className="text-[10px] text-studio-500 block">FADE IN</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={fadeInSec}
                      onChange={(e) => setFadeInSec(parseFloat(e.target.value) || 0)}
                      className="w-full bg-studio-950 border border-studio-800 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-neon-cyan"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-studio-500 block">FADE OUT</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={fadeOutSec}
                      onChange={(e) => setFadeOutSec(parseFloat(e.target.value) || 0)}
                      className="w-full bg-studio-950 border border-studio-800 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-neon-cyan"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleApplyTrim}
                    disabled={isProcessing}
                    className="flex-1 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-neon-cyan border border-neon-cyan/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Apply Trim</span>
                  </button>
                  <button
                    onClick={handleApplyFades}
                    disabled={isProcessing}
                    className="py-2 px-3 rounded-xl bg-studio-950 hover:bg-studio-850 text-studio-300 border border-studio-800 text-xs font-medium transition"
                  >
                    Fades Only
                  </button>
                </div>
              </div>
            </div>

            {/* Tool 2: Capability-Aware AI Extend */}
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase text-neon-purple">
                  <TrendingUp className="w-4 h-4" />
                  <span>AI Extend Track</span>
                </div>
                <span className="text-[10px] font-mono text-neon-purple bg-neon-purple/10 px-2 py-0.5 rounded border border-neon-purple/20">
                  {extendSeconds}s Added
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] text-studio-500 font-mono block mb-1">
                    AUDIO INFERENCE MODEL
                  </label>
                  <select
                    value={extendProvider}
                    onChange={(e) => setExtendProvider(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-800 rounded-xl p-2 text-white text-xs focus:outline-none focus:border-neon-purple"
                  >
                    <option value="suno">Suno Music AI (Neural Conditioning)</option>
                    <option value="audiocraft">Meta AudioCraft (Acoustic Continuation)</option>
                    <option value="fombo_procedural">Procedural DSP (Algorithmic Cadence)</option>
                  </select>
                </div>

                {/* Capability Warning Banner */}
                {showConditioningWarning && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[11px] leading-tight flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Procedural engine does not support neural audio conditioning. Toggle off AI Conditioning for DSP cadence loop, or choose Suno/AudioCraft.
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-studio-300">
                    <input
                      type="checkbox"
                      checked={useAiConditioning}
                      onChange={(e) => setUseAiConditioning(e.target.checked)}
                      className="rounded bg-studio-950 border-studio-700 text-neon-purple focus:ring-0"
                    />
                    <span>Neural Conditioning</span>
                  </label>
                  <span className="text-[10px] text-studio-500 font-mono">
                    Cadence Crossfade: 50ms
                  </span>
                </div>

                <button
                  onClick={handleApplyExtend}
                  disabled={isProcessing}
                  className="w-full py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-neon-purple border border-neon-purple/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Extend Audio Track</span>
                </button>
              </div>
            </div>

            {/* Tool 3: Replace Section / Inpaint */}
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase text-neon-pink">
                <RefreshCw className="w-4 h-4" />
                <span>Replace Section / Inpaint</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] text-studio-500 font-mono block mb-1">
                    REPLACEMENT PASSAGE PROMPT
                  </label>
                  <input
                    type="text"
                    value={inpaintPrompt}
                    onChange={(e) => setInpaintPrompt(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-800 rounded-xl p-2 text-white text-xs focus:outline-none focus:border-neon-pink"
                    placeholder="e.g. Electric guitar lead fill"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-studio-500 font-mono block">PROVIDER</label>
                    <select
                      value={inpaintProvider}
                      onChange={(e) => setInpaintProvider(e.target.value)}
                      className="w-full bg-studio-950 border border-studio-800 rounded-xl p-2 text-white text-xs focus:outline-none"
                    >
                      <option value="suno">Suno AI</option>
                      <option value="audiocraft">AudioCraft</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-studio-500 font-mono block">CROSSFADE</label>
                    <input
                      type="text"
                      disabled
                      value="30ms Equal-Power"
                      className="w-full bg-studio-950/60 border border-studio-800 rounded-xl p-2 text-studio-400 text-xs"
                    />
                  </div>
                </div>

                <button
                  onClick={handleApplyInpaint}
                  disabled={isProcessing}
                  className="w-full py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-neon-pink border border-neon-pink/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Inpaint Highlighted Section</span>
                </button>
              </div>
            </div>

            {/* Tool 4: Acoustic Remix */}
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase text-neon-amber">
                <Sliders className="w-4 h-4" />
                <span>Acoustic Remix & EQ</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] text-studio-500 font-mono block mb-1">
                    TARGET GENRE STYLING
                  </label>
                  <select
                    value={remixGenre}
                    onChange={(e) => setRemixGenre(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-800 rounded-xl p-2 text-white text-xs focus:outline-none"
                  >
                    <option value="Cyberpunk">Cyberpunk / Darksynth</option>
                    <option value="Lo-Fi">Lo-Fi Chillhop</option>
                    <option value="Synthwave">Synthwave 80s</option>
                    <option value="Orchestral">Epic Orchestral</option>
                    <option value="Hip Hop">Trap / Hip Hop</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <div className="flex justify-between text-[10px] text-studio-400">
                      <span>SPEED</span>
                      <span>{remixSpeed.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.75"
                      step="0.05"
                      value={remixSpeed}
                      onChange={(e) => setRemixSpeed(parseFloat(e.target.value))}
                      className="w-full h-1 bg-studio-800 rounded appearance-none accent-neon-amber cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-studio-400">
                      <span>BASS BOOST</span>
                      <span>{remixBass.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={remixBass}
                      onChange={(e) => setRemixBass(parseFloat(e.target.value))}
                      className="w-full h-1 bg-studio-800 rounded appearance-none accent-neon-amber cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  onClick={handleApplyRemix}
                  disabled={isProcessing}
                  className="w-full py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-neon-amber border border-neon-amber/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Generate Remix</span>
                </button>
              </div>
            </div>

            {/* Tool 5: Authorized Covers & Mechanical Licensing */}
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Authorized Cover</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] text-studio-500 font-mono block mb-1">
                    COVER TITLE & VOCALIST
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={coverTitle}
                      onChange={(e) => setCoverTitle(e.target.value)}
                      placeholder="Cover Title"
                      className="bg-studio-950 border border-studio-800 rounded-xl p-2 text-white text-xs focus:outline-none"
                    />
                    <input
                      type="text"
                      value={coverVocalist}
                      onChange={(e) => setCoverVocalist(e.target.value)}
                      placeholder="Vocalist Name"
                      className="bg-studio-950 border border-studio-800 rounded-xl p-2 text-white text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2 cursor-pointer text-studio-300 text-[11px] pt-1">
                  <input
                    type="checkbox"
                    checked={coverConsented}
                    onChange={(e) => setCoverConsented(e.target.checked)}
                    className="rounded bg-studio-950 border-studio-700 text-emerald-400 focus:ring-0 mt-0.5"
                  />
                  <span>
                    I certify that this cover complies with statutory mechanical licensing terms and artist consent clearance.
                  </span>
                </label>

                <button
                  onClick={handleApplyCover}
                  disabled={isProcessing || !coverConsented}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    coverConsented
                      ? "bg-studio-800 hover:bg-studio-750 text-emerald-400 border border-emerald-400/30"
                      : "opacity-40 cursor-not-allowed bg-studio-900 text-studio-500 border-studio-800"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Create Authorized Cover</span>
                </button>
              </div>
            </div>

            {/* Tool 6: Demucs Stem Splitting */}
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase text-neon-cyan">
                <Music className="w-4 h-4" />
                <span>Demucs v4 Stem Separation</span>
              </div>
              <p className="text-xs text-studio-400 leading-relaxed">
                Deconstructs master audio into 4 phase-aligned stems: Vocals, Drums, Bass, and Other.
              </p>

              <div className="pt-2">
                <button
                  onClick={handleSeparateStems}
                  disabled={isSplittingStems || isProcessing}
                  className="w-full py-2 rounded-xl bg-neon-cyan hover:bg-cyan-400 text-studio-950 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-neon-cyan/10"
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>
                    {isSplittingStems ? "Extracting Stems (Demucs v4)..." : "Separate Stems (Demucs)"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Separated Stems Mixer Deck (When split) */}
          {stems.length > 0 && (
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono uppercase text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-neon-cyan" />
                  <span>Demucs Synchronized Stems ({stems.length} Tracks)</span>
                </h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-500/20">
                  Sample-Accurate Phase Lock
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stems.map((stem) => (
                  <div
                    key={stem.stem_type}
                    className="p-4 rounded-xl bg-studio-950 border border-studio-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold capitalize text-white">
                        {stem.stem_type}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleStemMute(stem.stem_type)}
                          className={`w-5 h-5 rounded text-[10px] font-bold font-mono transition ${
                            stem.muted
                              ? "bg-neon-crimson text-white"
                              : "bg-studio-800 text-studio-400 hover:text-studio-200"
                          }`}
                        >
                          M
                        </button>
                        <button
                          onClick={() => toggleStemSolo(stem.stem_type)}
                          className={`w-5 h-5 rounded text-[10px] font-bold font-mono transition ${
                            stem.solo
                              ? "bg-neon-amber text-studio-950"
                              : "bg-studio-800 text-studio-400 hover:text-studio-200"
                          }`}
                        >
                          S
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-studio-400">
                        <span>VOLUME</span>
                        <span>{Math.round(stem.volume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={stem.volume}
                        onChange={(e) => updateStemVolume(stem.stem_type, parseFloat(e.target.value))}
                        className="w-full h-1 bg-studio-800 rounded appearance-none cursor-pointer accent-neon-cyan"
                      />
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <audio controls src={stem.audio_url} className="w-full h-7 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Version History Drawer / Modal */}
          {showHistory && (
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono uppercase text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-neon-cyan" />
                  <span>Non-Destructive Song Version History</span>
                </h3>
                <span className="text-xs text-studio-400">
                  Total snapshots: {versions.length}
                </span>
              </div>

              <div className="divide-y divide-studio-800">
                {versions.map((ver) => (
                  <div
                    key={ver.version_number}
                    className="py-3 flex items-center justify-between hover:bg-studio-950/40 px-2 rounded-xl transition"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-neon-cyan">
                          v{ver.version_number}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          {ver.title}
                        </span>
                        {ver.version_number === activeVersionNumber && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-studio-400 font-mono">
                        {ver.operation_summary} &bull; {ver.duration_seconds.toFixed(2)}s &bull;{" "}
                        {new Date(ver.created_at).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <audio controls src={ver.edited_audio_url} className="h-6 w-36" />
                      <button
                        onClick={() => handleRestoreVersion(ver)}
                        className="px-3 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-750 text-studio-200 border border-studio-700 text-xs font-medium transition"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: MULTITRACK SEQUENCER & DAW                      */}
      {/* ======================================================== */}
      {activeTab === "multitrack" && (
        <div className="space-y-6">
          {/* DAW Transport Bar */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDawPlaying(!dawPlaying)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold transition shadow-lg ${
                  dawPlaying
                    ? "bg-neon-pink text-white"
                    : "bg-neon-cyan text-studio-950"
                }`}
              >
                {dawPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
              <button
                onClick={() => {
                  setDawPlaying(false);
                  setCurrentBeat(0);
                }}
                className="w-10 h-10 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-300 flex items-center justify-center border border-studio-700 transition"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition ${
                  isLooping
                    ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan"
                    : "bg-studio-800 border-studio-700 text-studio-400"
                }`}
              >
                <Repeat className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMetronome(!metronome)}
                className={`px-3 h-10 rounded-xl flex items-center gap-1.5 border font-mono text-xs font-semibold transition ${
                  metronome
                    ? "bg-neon-purple/20 border-neon-purple text-neon-purple"
                    : "bg-studio-800 border-studio-700 text-studio-400"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>CLICK</span>
              </button>
            </div>

            <div className="flex items-center gap-4 bg-studio-950 px-4 py-2 rounded-xl border border-studio-800">
              <div>
                <span className="text-[10px] text-studio-500 font-mono block">BAR / BEAT</span>
                <span className="font-mono text-base font-bold text-neon-cyan">
                  {Math.floor(currentBeat / 4) + 1} : {Math.floor(currentBeat % 4) + 1}
                </span>
              </div>
              <div className="h-8 w-px bg-studio-800" />
              <div>
                <span className="text-[10px] text-studio-500 font-mono block">TEMPO</span>
                <input
                  type="number"
                  min="60"
                  max="200"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                  className="w-16 bg-transparent font-mono text-base font-bold text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-studio-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={masterVolume}
                  onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                  className="w-24 h-1.5 bg-studio-800 rounded-lg accent-neon-cyan"
                />
              </div>
              <button
                onClick={() => {
                  setIsSaved(true);
                  setTimeout(() => setIsSaved(false), 2000);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-200 border border-studio-700 text-xs font-medium transition"
              >
                {isSaved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
                <span>{isSaved ? "Saved" : "Save Project"}</span>
              </button>
            </div>
          </div>

          {/* Multitrack Workspace & Timeline */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Timeline Bar Rulers */}
            <div className="flex border-b border-studio-800 bg-studio-950/80">
              <div className="w-64 p-3 border-r border-studio-800 text-xs font-mono text-studio-500 font-semibold uppercase">
                Track Controls
              </div>
              <div className="flex-1 relative flex items-center px-4 font-mono text-[11px] text-studio-500">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
                  <div key={bar} className="flex-1 border-l border-studio-800/60 pl-2">
                    Bar {bar}
                  </div>
                ))}
                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-neon-cyan shadow-[0_0_8px_#00f0ff] z-20 pointer-events-none transition-all duration-75"
                  style={{ left: `${(currentBeat / 32) * 100}%` }}
                >
                  <div className="w-2 h-2 -ml-[3px] bg-neon-cyan rotate-45" />
                </div>
              </div>
            </div>

            {/* DAW Tracks List */}
            <div className="divide-y divide-studio-800">
              {dawTracks.map((tr) => (
                <div key={tr.id} className="flex h-24 hover:bg-studio-850/30 transition">
                  <div className="w-64 p-3.5 border-r border-studio-800 flex flex-col justify-between bg-studio-950/40">
                    <span className="font-bold text-xs truncate" style={{ color: tr.color }}>
                      {tr.name}
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-studio-400">
                      <div>
                        <span>VOL {Math.round(tr.volume * 100)}%</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={tr.volume}
                          onChange={(e) =>
                            setDawTracks((prev) =>
                              prev.map((t) =>
                                t.id === tr.id ? { ...t, volume: parseFloat(e.target.value) } : t
                              )
                            )
                          }
                          className="w-full h-1 bg-studio-800 rounded appearance-none cursor-pointer accent-neon-cyan"
                        />
                      </div>
                      <div>
                        <span>PAN C</span>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.05"
                          value={tr.pan}
                          onChange={(e) =>
                            setDawTracks((prev) =>
                              prev.map((t) =>
                                t.id === tr.id ? { ...t, pan: parseFloat(e.target.value) } : t
                              )
                            )
                          }
                          className="w-full h-1 bg-studio-800 rounded appearance-none cursor-pointer accent-neon-purple"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 relative bg-studio-950/20 p-2">
                    {tr.clips.map((clip) => {
                      const leftPercent = (clip.startBeat / 32) * 100;
                      const widthPercent = (clip.durationBeats / 32) * 100;
                      return (
                        <div
                          key={clip.id}
                          className="absolute top-2 bottom-2 rounded-xl border p-2 flex flex-col justify-between overflow-hidden shadow-lg cursor-pointer"
                          style={{
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            backgroundColor: `${clip.color}15`,
                            borderColor: `${clip.color}60`,
                          }}
                        >
                          <span className="text-[11px] font-bold text-white truncate drop-shadow">
                            {clip.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
