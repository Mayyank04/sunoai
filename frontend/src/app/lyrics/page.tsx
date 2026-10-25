"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  Send,
  Music,
  ArrowRight,
  Save,
  RotateCcw,
  Globe,
  Sliders,
  Layers,
  Download,
  History,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Plus,
  Wand2,
  Edit3,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Cpu,
  Bookmark,
} from "lucide-react";

interface LyricLine {
  text: string;
  syllables: number;
  rhyme_tag: string;
}

interface LyricSection {
  section_name: string;
  lines: LyricLine[];
}

interface LyricDraft {
  id: string;
  title: string;
  content: string;
  language: string;
  topic?: string;
  theme?: string;
  tone?: string;
  genre?: string;
  bpm?: number;
  musical_key?: string;
  time_signature?: string;
  vocal_style?: string;
  instrument_preferences?: string[];
  persona?: string;
  versions_count: number;
  updated_at: string;
}

interface LyricVersion {
  id: string;
  version_number: number;
  title: string;
  content: string;
  language: string;
  change_summary?: string;
  created_at: string;
}

const LANGUAGES = [
  { id: "hi", name: "Hindi (हिंदी)" },
  { id: "hinglish", name: "Hinglish (Urban Blend)" },
  { id: "pa", name: "Punjabi (ਪੰਜਾਬੀ)" },
  { id: "en", name: "English" },
  { id: "es", name: "Spanish (Español)" },
];

const GENRES = [
  "Bollywood Pop",
  "Punjabi Pop/Bhangra",
  "Desi Hip Hop",
  "Ghazal & Sufi",
  "Synthwave",
  "Lo-Fi Chill",
  "Pop Anthem",
  "R&B & Soul",
  "Rock",
];

const THEMES = [
  "Romance & Longing",
  "Heartbreak & Solitude",
  "Hustle & Street Ambition",
  "Celebration & Nightlife",
  "Sufi & Devotion",
  "Nostalgia & Childhood",
  "Rebellion & Freedom",
];

const TONES = [
  "Emotional & Soulful",
  "Aggressive & Punchy",
  "Poetic & Metaphorical",
  "Playful & Flirtatious",
  "Melancholic & Reflective",
  "Anthemic & Triumphant",
];

const AVAILABLE_INSTRUMENTS = [
  "Dhol & Dholak",
  "Sitar",
  "Acoustic Guitar",
  "808 Bass",
  "Bansuri Flute",
  "Grand Piano",
  "Analog Synthesizer",
  "Harmonium",
  "Tabla",
  "String Quartet",
];

export default function LyricsWorkspacePage() {
  const router = useRouter();
  const { user } = useAuth();

  // Generator & Arrangement State
  const [topic, setTopic] = useState("Midnight drive in a rain-soaked metropolis");
  const [theme, setTheme] = useState("Romance & Longing");
  const [tone, setTone] = useState("Emotional & Soulful");
  const [language, setLanguage] = useState("hinglish");
  const [rhymeScheme, setRhymeScheme] = useState("AABB");
  const [genre, setGenre] = useState("Bollywood Pop");
  const [bpm, setBpm] = useState(120);
  const [musicalKey, setMusicalKey] = useState("F Minor");
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [vocalStyle, setVocalStyle] = useState("Melodic Female");
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([
    "Acoustic Guitar",
    "808 Bass",
  ]);
  const [negativePrompt, setNegativePrompt] = useState("cliché words, harsh slang, violent expressions");
  const [persona, setPersona] = useState("Urban Delhi Indie Pop Songwriter");
  const [structure, setStructure] = useState<string[]>([
    "Verse 1",
    "Chorus",
    "Verse 2",
    "Chorus",
    "Bridge",
    "Outro",
  ]);

  // Workspace Editor State
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("Raat Ka Safar (Opus)");
  const [rawLyrics, setRawLyrics] = useState(
    "[Verse 1]\nNeon streetlights glow karti hai across the street\nDil mera dhoonde tujhe with every single beat\nCity ki ye vibe thodi nostalgic ho gayi\nMemories purani suddenly unlock ho gayi\n\n[Chorus]\nBaby chal mere saath into the moonlight\nSab kuch bhula ke let's make it feel right\nTere bina subah bhi lagti hai dark\nTere mere beech mein hai wo electric spark\n\n[Verse 2]\nLate night driving on the empty avenue\nBas ek hi wish hai to be right next to you\nBassline bump kare through the car stereo\nYe moment rewind kare like a vintage video\n\n[Outro]\nElectric pulse and that starry sky\nNever let go, just you and I"
  );
  const [editorView, setEditorView] = useState<"interactive" | "raw">("interactive");
  const [sections, setSections] = useState<LyricSection[]>([]);
  const [symmetryScore, setSymmetryScore] = useState<number>(88);

  // Drafts & Version History
  const [savedDrafts, setSavedDrafts] = useState<LyricDraft[]>([]);
  const [versions, setVersions] = useState<LyricVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [activeHookList, setActiveHookList] = useState<any[]>([]);

  // Processing & UI Feedback
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showArrangementAccordion, setShowArrangementAccordion] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Load User Drafts on Mount
  useEffect(() => {
    loadDrafts();
    analyzeSyllables(rawLyrics, language);
  }, []);

  const loadDrafts = async () => {
    try {
      const drafts = await apiRequest<LyricDraft[]>("/lyrics/drafts");
      setSavedDrafts(drafts);
    } catch {}
  };

  const loadVersions = async (id: string) => {
    try {
      const list = await apiRequest<LyricVersion[]>(`/lyrics/drafts/${id}/versions`);
      setVersions(list);
    } catch {}
  };

  // Analyze Syllables & Structure
  const analyzeSyllables = async (text: string, lang: string) => {
    try {
      const res = await apiRequest<{
        total_lines: number;
        rhythm_symmetry_score: number;
        lines: any[];
      }>("/lyrics/analyze-syllables", {
        method: "POST",
        body: JSON.stringify({ text, language: lang }),
      });
      setSymmetryScore(res.rhythm_symmetry_score);

      // Parse text into structured sections
      parseRawIntoSections(text);
    } catch {
      parseRawIntoSections(text);
    }
  };

  const parseRawIntoSections = (text: string) => {
    const rawLines = text.split("\n");
    const secList: LyricSection[] = [];
    let currentSec: LyricSection = { section_name: "Intro", lines: [] };

    for (const line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        if (currentSec.lines.length > 0) {
          secList.push(currentSec);
        }
        currentSec = {
          section_name: trimmed.replace("[", "").replace("]", ""),
          lines: [],
        };
      } else {
        currentSec.lines.push({
          text: trimmed,
          syllables: Math.max(1, trimmed.split(" ").length * 2 - 1),
          rhyme_tag: "A",
        });
      }
    }
    if (currentSec.lines.length > 0) {
      secList.push(currentSec);
    }
    setSections(secList);
  };

  // Generate Lyrics
  const handleGenerateLyrics = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setStatusNotice(null);

    try {
      const res = await apiRequest<{
        title: string;
        raw_text: string;
        sections: LyricSection[];
      }>("/lyrics/generate", {
        method: "POST",
        body: JSON.stringify({
          topic,
          theme,
          tone,
          rhyme_scheme: rhymeScheme,
          language,
          structure,
          genre,
          mood: tone,
          bpm,
          musical_key: musicalKey,
          time_signature: timeSignature,
          instrument_preferences: selectedInstruments,
          vocal_style: vocalStyle,
          negative_prompt: negativePrompt,
          persona,
        }),
      });

      setDraftTitle(res.title);
      setRawLyrics(res.raw_text);
      setSections(res.sections);
      analyzeSyllables(res.raw_text, language);
      setStatusNotice({ type: "success", text: "New lyrics composed successfully." });
    } catch (err: any) {
      setStatusNotice({ type: "error", text: err.message || "Failed to generate lyrics." });
    } finally {
      setIsGenerating(false);
    }
  };

  // Rewrite Line Action
  const handleRewriteLine = async (lineText: string, instruction: string) => {
    try {
      const res = await apiRequest<{ rewritten_line: string }>("/lyrics/rewrite-line", {
        method: "POST",
        body: JSON.stringify({ line: lineText, instruction, language }),
      });
      const updated = rawLyrics.replace(lineText, res.rewritten_line);
      setRawLyrics(updated);
      analyzeSyllables(updated, language);
      setStatusNotice({ type: "success", text: `Line rewritten (${instruction}).` });
    } catch (err: any) {
      setStatusNotice({ type: "error", text: err.message || "Rewrite failed." });
    }
  };

  // Rewrite Section Action
  const handleRewriteSection = async (sectionName: string, lines: LyricLine[]) => {
    try {
      const res = await apiRequest<{ raw_section: string }>("/lyrics/rewrite-section", {
        method: "POST",
        body: JSON.stringify({
          section_name: sectionName,
          section_lines: lines.map((l) => l.text),
          instruction: "more energetic and poetic",
          language,
          genre,
        }),
      });
      // Replace section in raw text
      const regex = new RegExp(`\\[${sectionName}\\][\\s\\S]*?(?=\\n\\[|$)`, "i");
      const updated = rawLyrics.replace(regex, res.raw_section);
      setRawLyrics(updated);
      analyzeSyllables(updated, language);
      setStatusNotice({ type: "success", text: `Section [${sectionName}] rewritten.` });
    } catch (err: any) {
      setStatusNotice({ type: "error", text: err.message || "Section rewrite failed." });
    }
  };

  // Translate Lyrics
  const handleTranslate = async (targetLang: string) => {
    try {
      const res = await apiRequest<{
        translated_content: string;
        sections: LyricSection[];
      }>("/lyrics/translate", {
        method: "POST",
        body: JSON.stringify({ content: rawLyrics, target_language: targetLang }),
      });
      setLanguage(targetLang);
      setRawLyrics(res.translated_content);
      setSections(res.sections);
      analyzeSyllables(res.translated_content, targetLang);
      setStatusNotice({
        type: "success",
        text: `Lyrics translated to ${LANGUAGES.find((l) => l.id === targetLang)?.name}.`,
      });
    } catch (err: any) {
      setStatusNotice({ type: "error", text: err.message || "Translation failed." });
    }
  };

  // Regenerate Hook Alternatives
  const handleRegenerateHook = async () => {
    try {
      const res = await apiRequest<{ hooks: any[] }>("/lyrics/regenerate-hook", {
        method: "POST",
        body: JSON.stringify({ topic, genre, language, tone }),
      });
      setActiveHookList(res.hooks);
      setStatusNotice({ type: "success", text: "Generated 3 hook variations." });
    } catch (err: any) {
      setStatusNotice({ type: "error", text: err.message || "Hook generation failed." });
    }
  };

  const insertHook = (hookLines: string[]) => {
    const hookBlock = `[Chorus]\n` + hookLines.join("\n");
    let updated = rawLyrics;
    if (updated.includes("[Chorus]")) {
      const regex = /\[Chorus\][\s\S]*?(?=\n\[|$)/i;
      updated = updated.replace(regex, hookBlock);
    } else {
      updated += `\n\n${hookBlock}`;
    }
    setRawLyrics(updated);
    analyzeSyllables(updated, language);
    setActiveHookList([]);
    setStatusNotice({ type: "success", text: "Hook inserted into Chorus." });
  };

  // Save or Update Draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    setStatusNotice(null);
    try {
      if (draftId) {
        // Update existing draft
        const res = await apiRequest<LyricDraft>(`/lyrics/drafts/${draftId}`, {
          method: "PUT",
          body: JSON.stringify({
            title: draftTitle,
            content: rawLyrics,
            language,
            topic,
            theme,
            tone,
            genre,
            bpm,
            musical_key: musicalKey,
            time_signature: timeSignature,
            vocal_style: vocalStyle,
            instrument_preferences: selectedInstruments,
            negative_prompt: negativePrompt,
            persona,
            create_version_snapshot: true,
            change_summary: "Manual lyrics studio update",
          }),
        });
        setStatusNotice({ type: "success", text: `Draft saved (Version ${res.versions_count}).` });
        loadVersions(draftId);
      } else {
        // Create new draft
        const res = await apiRequest<LyricDraft>("/lyrics/drafts", {
          method: "POST",
          body: JSON.stringify({
            title: draftTitle,
            content: rawLyrics,
            language,
            topic,
            theme,
            tone,
            genre,
            bpm,
            musical_key: musicalKey,
            time_signature: timeSignature,
            vocal_style: vocalStyle,
            instrument_preferences: selectedInstruments,
            negative_prompt: negativePrompt,
            persona,
          }),
        });
        setDraftId(res.id);
        setStatusNotice({ type: "success", text: "New draft saved to library." });
        loadDrafts();
        loadVersions(res.id);
      }
    } catch (err: any) {
      setStatusNotice({ type: "error", text: err.message || "Failed to save draft." });
    } finally {
      setIsSaving(false);
    }
  };

  // Revert Version
  const handleRevertVersion = async (verNum: number) => {
    if (!draftId) return;
    try {
      const res = await apiRequest<LyricDraft>(`/lyrics/drafts/${draftId}/revert/${verNum}`, {
        method: "POST",
      });
      setRawLyrics(res.content);
      setDraftTitle(res.title);
      setLanguage(res.language);
      analyzeSyllables(res.content, res.language);
      loadVersions(draftId);
      setStatusNotice({ type: "success", text: `Draft reverted to Version ${verNum}.` });
    } catch (err: any) {
      setStatusNotice({ type: "error", text: err.message || "Revert failed." });
    }
  };

  // Export Lyrics File
  const handleExport = (formatType: "txt" | "lrc" | "leadsheet" | "json") => {
    if (draftId) {
      window.open(`/api/v1/lyrics/drafts/${draftId}/export?format=${formatType}`, "_blank");
    } else {
      // Direct local download
      let data = rawLyrics;
      if (formatType === "lrc") {
        data = `[ti:${draftTitle}]\n[ar:Fombo Studio]\n\n` + rawLyrics;
      }
      const blob = new Blob([data], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${draftTitle}.${formatType}`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setStatusNotice({ type: "success", text: `Exported as .${formatType}` });
  };

  // Send to Composition Studio (/create) with Strict Governance Check
  const handleSendToMusicStudio = async () => {
    try {
      const res = await apiRequest<{ status: string; prompt: string; lyrics: string }>(
        "/lyrics/send-to-music",
        {
          method: "POST",
          body: JSON.stringify({
            title: draftTitle,
            lyrics: rawLyrics,
            provider: "suno", // Suno confirms lyrics support
            genre,
            bpm,
            musical_key: musicalKey,
            time_signature: timeSignature,
            vocal_style: vocalStyle,
          }),
        }
      );

      // Route to create with pre-filled lyrics and arrangement
      router.push(
        `/create?prompt=${encodeURIComponent(res.prompt)}&genre=${encodeURIComponent(genre)}&key=${encodeURIComponent(musicalKey)}&bpm=${bpm}`
      );
    } catch (err: any) {
      setStatusNotice({
        type: "error",
        text: err.message || "Provider does not support lyrics synthesis.",
      });
    }
  };

  return (
    <div className="py-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-studio-800/80 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <FileText className="w-7 h-7 text-neon-purple" />
            AI Lyrics Intelligence Studio
          </h1>
          <p className="text-xs md:text-sm text-studio-400 mt-1">
            Multilingual songwriting workspace for Hindi, English, Hinglish, Punjabi & Spanish with live syllable meter and musical arrangement governance.
          </p>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-100 border border-studio-700 text-xs font-mono font-semibold flex items-center gap-1.5 transition"
          >
            <Save className="w-3.5 h-3.5 text-neon-cyan" />
            <span>{isSaving ? "Saving..." : "Save Draft"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (draftId) loadVersions(draftId);
              setShowVersions(!showVersions);
            }}
            className="px-3 py-2 rounded-xl bg-studio-850 hover:bg-studio-800 text-studio-300 border border-studio-750 text-xs font-mono flex items-center gap-1.5 transition"
          >
            <History className="w-3.5 h-3.5 text-neon-purple" />
            <span>Versions</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="px-3 py-2 rounded-xl bg-studio-850 hover:bg-studio-800 text-studio-300 border border-studio-750 text-xs font-mono flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <div className="absolute right-0 mt-1 w-36 bg-studio-900 border border-studio-800 rounded-xl shadow-xl hidden group-hover:block z-30 py-1 text-xs">
              <button
                type="button"
                onClick={() => handleExport("txt")}
                className="w-full text-left px-3 py-1.5 hover:bg-studio-800 text-studio-200"
              >
                Text (.txt)
              </button>
              <button
                type="button"
                onClick={() => handleExport("lrc")}
                className="w-full text-left px-3 py-1.5 hover:bg-studio-800 text-studio-200"
              >
                Sync LRC (.lrc)
              </button>
              <button
                type="button"
                onClick={() => handleExport("leadsheet")}
                className="w-full text-left px-3 py-1.5 hover:bg-studio-800 text-studio-200"
              >
                Lead Sheet
              </button>
              <button
                type="button"
                onClick={() => handleExport("json")}
                className="w-full text-left px-3 py-1.5 hover:bg-studio-800 text-studio-200"
              >
                JSON Schema
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendToMusicStudio}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan text-studio-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition hover:opacity-95 shadow-md shadow-neon-purple/20"
          >
            <Music className="w-3.5 h-3.5 fill-current" />
            <span>Compose Music</span>
          </button>
        </div>
      </div>

      {/* Global Status Notice */}
      {statusNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 transition ${
            statusNotice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-neon-crimson/10 border-neon-crimson/30 text-neon-crimson"
          }`}
        >
          {statusNotice.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-neon-crimson flex-shrink-0" />
          )}
          <span>{statusNotice.text}</span>
        </div>
      )}

      {/* 3-Column Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Parameters & Arrangement (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <form
            onSubmit={handleGenerateLyrics}
            className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-studio-200 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-neon-purple" />
                AI Lyric Generator
              </h3>
              <span className="text-[10px] font-mono text-studio-500 uppercase">Multilingual</span>
            </div>

            {/* Language Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-studio-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-neon-cyan" /> LANGUAGE
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-studio-200 focus:outline-none focus:border-neon-purple/50 font-medium"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Topic Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-studio-400">TOPIC & STORYLINE</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={2}
                placeholder="What is the central story or emotion of this song?"
                className="w-full bg-studio-950 border border-studio-800 rounded-xl p-2.5 text-xs text-studio-200 placeholder-studio-600 focus:outline-none focus:border-neon-purple/50 resize-none"
                required
              />
            </div>

            {/* Theme & Tone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-studio-400">THEME</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-800 rounded-xl px-2 py-1.5 text-xs text-studio-200 focus:outline-none"
                >
                  {THEMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-studio-400">TONE</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-800 rounded-xl px-2 py-1.5 text-xs text-studio-200 focus:outline-none"
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rhyme Scheme */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-studio-400">RHYME SCHEME</label>
              <div className="flex gap-2">
                {["AABB", "ABAB", "AAAA", "Free Verse"].map((scheme) => (
                  <button
                    key={scheme}
                    type="button"
                    onClick={() => setRhymeScheme(scheme)}
                    className={`flex-1 py-1.5 rounded-lg border text-[11px] font-mono transition ${
                      rhymeScheme === scheme
                        ? "bg-neon-purple/20 border-neon-purple text-neon-purple font-bold"
                        : "bg-studio-950 border-studio-800 text-studio-400"
                    }`}
                  >
                    {scheme}
                  </button>
                ))}
              </div>
            </div>

            {/* Musical Arrangement Accordion Toggle */}
            <div className="pt-2 border-t border-studio-800/80">
              <button
                type="button"
                onClick={() => setShowArrangementAccordion(!showArrangementAccordion)}
                className="w-full flex items-center justify-between text-xs font-mono text-studio-300 hover:text-white transition py-1"
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-neon-cyan" />
                  Song Arrangement & Metadata
                </span>
                {showArrangementAccordion ? (
                  <ChevronUp className="w-4 h-4 text-studio-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-studio-500" />
                )}
              </button>

              {showArrangementAccordion && (
                <div className="mt-3 space-y-3 pt-2 border-t border-studio-800/50">
                  {/* Genre */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-studio-400">GENRE PRESET</label>
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full bg-studio-950 border border-studio-800 rounded-xl px-2 py-1.5 text-xs text-studio-200 focus:outline-none"
                    >
                      {GENRES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* BPM & Musical Key */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-studio-400">TEMPO ({bpm} BPM)</label>
                      <input
                        type="range"
                        min="60"
                        max="180"
                        value={bpm}
                        onChange={(e) => setBpm(parseInt(e.target.value))}
                        className="w-full h-1 bg-studio-800 rounded accent-neon-purple cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-studio-400">KEY</label>
                      <select
                        value={musicalKey}
                        onChange={(e) => setMusicalKey(e.target.value)}
                        className="w-full bg-studio-950 border border-studio-800 rounded-xl px-2 py-1 text-xs text-studio-200 focus:outline-none"
                      >
                        <option value="C Major">C Major</option>
                        <option value="C Minor">C Minor</option>
                        <option value="D Minor">D Minor</option>
                        <option value="Eb Major">Eb Major</option>
                        <option value="F Minor">F Minor</option>
                        <option value="G Minor">G Minor</option>
                        <option value="A Minor">A Minor</option>
                        <option value="Bb Major">Bb Major</option>
                      </select>
                    </div>
                  </div>

                  {/* Vocal Style */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-studio-400">VOCAL STYLE</label>
                    <select
                      value={vocalStyle}
                      onChange={(e) => setVocalStyle(e.target.value)}
                      className="w-full bg-studio-950 border border-studio-800 rounded-xl px-2 py-1.5 text-xs text-studio-200 focus:outline-none"
                    >
                      <option value="Melodic Female">Melodic Female (Bollywood Pop)</option>
                      <option value="Husky Male">Husky Male (Acoustic Soul)</option>
                      <option value="Autotuned Rap">Autotuned Rap (Desi Hip Hop)</option>
                      <option value="Semi-Classical Sufi">Semi-Classical Sufi</option>
                      <option value="High-Pitch Female">High-Pitch Female (Hyperpop)</option>
                    </select>
                  </div>

                  {/* Persona Metadata */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-studio-400">ARTIST PERSONA</label>
                    <input
                      type="text"
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      className="w-full bg-studio-950 border border-studio-800 rounded-xl px-2.5 py-1.5 text-xs text-studio-200 focus:outline-none"
                      placeholder="e.g. Delhi street lyricist, Sufi poet..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-3.5 rounded-xl bg-neon-purple text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-95 transition shadow-lg shadow-neon-purple/20 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>{isGenerating ? "Composing Lyrics..." : "Generate Lyrics with AI"}</span>
            </button>
          </form>

          {/* Quick Translation & Hook Assistant Card */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-3.5 shadow-xl">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-studio-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-neon-cyan" />
              Quick Translate Lyrics
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleTranslate(l.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition ${
                    language === l.id
                      ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan font-bold"
                      : "bg-studio-950 border-studio-800 text-studio-400 hover:border-studio-750"
                  }`}
                >
                  {l.name.split(" ")[0]}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-studio-800/80">
              <button
                type="button"
                onClick={handleRegenerateHook}
                className="w-full py-2.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-200 border border-studio-700 text-xs font-mono flex items-center justify-center gap-2 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-neon-pink" />
                <span>Regenerate Hook Alternatives</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center Column: Live Lyrics Editor & Syllable Guidance (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-4 shadow-xl">
            {/* Title & Symmetry Meter Header */}
            <div className="flex items-center justify-between pb-3 border-b border-studio-800">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="bg-transparent text-sm font-bold text-white focus:outline-none border-b border-transparent focus:border-neon-purple w-2/3"
                placeholder="Song Title..."
              />

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-studio-400">Rhythm Balance</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/20">
                  {symmetryScore}%
                </span>
              </div>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex gap-1 bg-studio-950 p-1 rounded-lg border border-studio-800">
                <button
                  type="button"
                  onClick={() => setEditorView("interactive")}
                  className={`px-3 py-1 rounded text-[11px] font-mono transition ${
                    editorView === "interactive"
                      ? "bg-studio-800 text-white font-bold"
                      : "text-studio-500 hover:text-studio-300"
                  }`}
                >
                  Interactive Phrasing
                </button>
                <button
                  type="button"
                  onClick={() => setEditorView("raw")}
                  className={`px-3 py-1 rounded text-[11px] font-mono transition ${
                    editorView === "raw"
                      ? "bg-studio-800 text-white font-bold"
                      : "text-studio-500 hover:text-studio-300"
                  }`}
                >
                  Raw Lead Sheet
                </button>
              </div>

              <span className="text-[11px] font-mono text-studio-500">
                {rawLyrics.split("\n").filter((x) => x.trim()).length} lines
              </span>
            </div>

            {/* Interactive Phrasing View (Line-by-Line with Syllable & Rewrite Tools) */}
            {editorView === "interactive" ? (
              <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
                {sections.map((sec, secIdx) => (
                  <div
                    key={secIdx}
                    className="p-3.5 rounded-xl bg-studio-950 border border-studio-800/80 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-neon-purple">
                      <span>[{sec.section_name}]</span>
                      <button
                        type="button"
                        onClick={() => handleRewriteSection(sec.section_name, sec.lines)}
                        className="text-[10px] text-studio-400 hover:text-neon-cyan flex items-center gap-1 transition"
                      >
                        <RotateCcw className="w-3 h-3" /> Rewrite Section
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {sec.lines.map((line, lineIdx) => (
                        <div
                          key={lineIdx}
                          className="flex items-center justify-between group py-1 px-2 rounded-lg hover:bg-studio-900 transition"
                        >
                          <span className="text-xs text-studio-100 flex-1 font-sans">{line.text}</span>

                          <div className="flex items-center gap-2">
                            {/* Syllables Badge */}
                            <span
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-studio-850 text-studio-400 border border-studio-750"
                              title="Syllables in line"
                            >
                              {line.syllables} syl
                            </span>

                            {/* Inline Rewrite Line Actions */}
                            <div className="hidden group-hover:flex items-center gap-1 text-[10px] font-mono">
                              <button
                                type="button"
                                onClick={() => handleRewriteLine(line.text, "punchier")}
                                className="px-1.5 py-0.5 rounded bg-studio-800 hover:bg-studio-750 text-neon-cyan"
                                title="Make punchier"
                              >
                                Punch
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRewriteLine(line.text, "poetic")}
                                className="px-1.5 py-0.5 rounded bg-studio-800 hover:bg-studio-750 text-neon-pink"
                                title="More poetic"
                              >
                                Poet
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Raw Editable Textarea View */
              <div className="space-y-2">
                <textarea
                  value={rawLyrics}
                  onChange={(e) => {
                    setRawLyrics(e.target.value);
                    analyzeSyllables(e.target.value, language);
                  }}
                  rows={20}
                  className="w-full bg-studio-950 border border-studio-800 rounded-xl p-3 text-xs text-studio-100 font-mono leading-relaxed focus:outline-none focus:border-neon-purple/50 resize-y"
                  placeholder="Paste or write lyrics with [Verse], [Chorus] tags..."
                />
              </div>
            )}
          </div>

          {/* Hook Alternatives Tray (if generated) */}
          {activeHookList.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-studio-900 to-studio-850 border border-neon-pink/30 space-y-3 shadow-2xl">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-neon-pink font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> REGENERATED HOOK OPTIONS
                </span>
                <button
                  type="button"
                  onClick={() => setActiveHookList([])}
                  className="text-[10px] font-mono text-studio-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="space-y-2.5">
                {activeHookList.map((h, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-studio-950 border border-studio-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-studio-300">
                      <span className="font-semibold text-neon-cyan">{h.hook_name}</span>
                      <span className="text-[10px] text-studio-500">{h.cadence}</span>
                    </div>
                    <div className="text-xs text-studio-100 font-sans space-y-0.5">
                      {h.lines.map((l: string, idx: number) => (
                        <p key={idx}>{l}</p>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => insertHook(h.lines)}
                      className="w-full mt-1 py-1.5 rounded-lg bg-neon-pink/20 hover:bg-neon-pink/30 text-neon-pink border border-neon-pink/40 text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3" /> Insert into Chorus
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Drafts Library & Model Governance (3 cols) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Music Model Capability Governance Card */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-3.5 shadow-xl">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-studio-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-neon-cyan" />
              Model Governance
            </h4>

            <div className="p-3 rounded-xl bg-studio-950 border border-studio-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-studio-200">Suno Music API</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                  Lyrics Supported
                </span>
              </div>
              <p className="text-[11px] text-studio-400">
                Full neural vocal synthesis confirmed for Hindi, English, Hinglish, Punjabi & Spanish singing voices.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-studio-950/60 border border-studio-850 text-xs space-y-1 text-studio-500">
              <div className="flex items-center justify-between">
                <span>Procedural / AudioCraft</span>
                <span className="text-[10px] font-mono text-studio-600">Instrumental Only</span>
              </div>
              <p className="text-[10px]">
                These providers enforce strict capability checks; lyrics will not be silently dropped.
              </p>
            </div>
          </div>

          {/* User Drafts Drawer */}
          <div className="bg-studio-900 border border-studio-800 rounded-2xl p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-studio-300 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-neon-purple" />
                Saved Drafts
              </h4>
              <span className="text-[10px] font-mono text-studio-500">{savedDrafts.length}</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {savedDrafts.map((d) => (
                <div
                  key={d.id}
                  onClick={() => {
                    setDraftId(d.id);
                    setDraftTitle(d.title);
                    setRawLyrics(d.content);
                    setLanguage(d.language);
                    analyzeSyllables(d.content, d.language);
                    loadVersions(d.id);
                  }}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                    draftId === d.id
                      ? "bg-studio-850 border-neon-purple/50 text-white"
                      : "bg-studio-950 border-studio-800 text-studio-400 hover:border-studio-700"
                  }`}
                >
                  <p className="font-semibold text-studio-200 truncate">{d.title}</p>
                  <div className="flex items-center justify-between text-[10px] text-studio-500 mt-1 font-mono">
                    <span>{d.language.toUpperCase()}</span>
                    <span>v{d.versions_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Version History Drawer (if opened) */}
          {showVersions && (
            <div className="bg-studio-900 border border-neon-purple/40 rounded-2xl p-5 space-y-3.5 shadow-2xl animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neon-purple flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Version History
                </h4>
                <button
                  type="button"
                  onClick={() => setShowVersions(false)}
                  className="text-[10px] font-mono text-studio-400"
                >
                  Close
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-xl bg-studio-950 border border-studio-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="font-bold text-white">Version {v.version_number}</span>
                      <button
                        type="button"
                        onClick={() => handleRevertVersion(v.version_number)}
                        className="text-[10px] text-neon-cyan hover:underline"
                      >
                        Revert
                      </button>
                    </div>
                    {v.change_summary && (
                      <p className="text-[11px] text-studio-400">{v.change_summary}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
