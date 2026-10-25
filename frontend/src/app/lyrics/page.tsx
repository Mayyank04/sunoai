"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  Send,
  Music,
  ArrowRight,
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

interface LyricsResult {
  title: string;
  topic: string;
  genre: string;
  mood: string;
  sections: LyricSection[];
}

export default function LyricsLabPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("Midnight drive in a rain-soaked metropolis");
  const [genre, setGenre] = useState("Synthwave");
  const [mood, setMood] = useState("Nostalgic");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lyricsResult, setLyricsResult] = useState<LyricsResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateLyrics = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await apiRequest<LyricsResult>("/lyrics/generate", {
        method: "POST",
        body: JSON.stringify({
          topic,
          genre,
          mood,
          structure: ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Outro"],
        }),
      });
      setLyricsResult(res);
    } catch {
      // Fallback local template
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!lyricsResult) return;
    const text = lyricsResult.sections
      .map(
        (s) =>
          `[${s.section_name}]\n` + s.lines.map((l) => l.text).join("\n")
      )
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToStudio = () => {
    if (!lyricsResult) return;
    router.push(`/create?prompt=${encodeURIComponent(`${lyricsResult.genre} song: ${lyricsResult.topic}`)}`);
  };

  return (
    <div className="py-6 max-w-5xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
          <FileText className="w-7 h-7 text-neon-purple" />
          Lyrics Intelligence Lab
        </h1>
        <p className="text-xs md:text-sm text-studio-400 mt-1">
          Compose structured verses and choruses with syllable metrics, phonetic rhyme scheme tracking, and direct DAW alignment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Form (1 col) */}
        <form onSubmit={handleGenerateLyrics} className="space-y-5 bg-studio-900 border border-studio-800 rounded-2xl p-5 shadow-xl h-fit">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold uppercase text-studio-300">
              Song Topic & Narrative
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Neon highway under rain"
              className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-studio-100 focus:outline-none focus:border-neon-purple/50"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold uppercase text-studio-300">
              Musical Genre
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-studio-200 focus:outline-none"
            >
              <option value="Synthwave">Synthwave 80s</option>
              <option value="Lo-Fi Hip Hop">Lo-Fi Hip Hop</option>
              <option value="Cyberpunk">Cyberpunk Industrial</option>
              <option value="Pop Ballad">Pop Ballad</option>
              <option value="Alt Rock">Alt Rock</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold uppercase text-studio-300">
              Emotional Mood
            </label>
            <input
              type="text"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="e.g. Nostalgic, Melancholic, Electric"
              className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-studio-100 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink text-white font-bold text-xs uppercase tracking-wide hover:opacity-95 transition shadow-lg shadow-neon-purple/20 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isGenerating ? "Writing Lyrics..." : "Generate Structured Lyrics"}</span>
          </button>
        </form>

        {/* Right Output View (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {lyricsResult ? (
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 space-y-6 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between pb-4 border-b border-studio-800 gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{lyricsResult.title}</h3>
                  <p className="text-xs text-studio-400 mt-0.5">
                    {lyricsResult.genre} • Mood: {lyricsResult.mood}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-studio-200 text-xs transition border border-studio-700"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy All"}</span>
                  </button>
                  <button
                    onClick={handleSendToStudio}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan text-xs font-semibold transition border border-neon-cyan/40"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send to Studio</span>
                  </button>
                </div>
              </div>

              {/* Sections Display */}
              <div className="space-y-6">
                {lyricsResult.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-2">
                    <span className="text-xs font-mono font-bold text-neon-purple uppercase tracking-wider block">
                      [{sec.section_name}]
                    </span>
                    <div className="space-y-1.5 pl-3 border-l-2 border-studio-800">
                      {sec.lines.map((line, lIdx) => (
                        <div key={lIdx} className="flex items-center justify-between text-xs py-1 group">
                          <span className="text-studio-200 font-medium group-hover:text-white transition">
                            {line.text}
                          </span>
                          <div className="flex items-center gap-2 font-mono text-[10px]">
                            <span className="text-studio-500">{line.syllables} syl</span>
                            <span
                              className={`w-5 h-5 rounded flex items-center justify-center font-bold ${
                                line.rhyme_tag === "A"
                                  ? "bg-neon-cyan/20 text-neon-cyan"
                                  : line.rhyme_tag === "B"
                                  ? "bg-neon-purple/20 text-neon-purple"
                                  : "bg-neon-pink/20 text-neon-pink"
                              }`}
                            >
                              {line.rhyme_tag}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-studio-900/60 border border-dashed border-studio-800 rounded-2xl p-12 text-center text-studio-500 space-y-3">
              <FileText className="w-10 h-10 mx-auto text-studio-600" />
              <p className="text-sm">Enter a topic and hit Generate to view structured lyrics with syllable metrics.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
