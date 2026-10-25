"use client";

import React, { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ui/protected-route";
import { useAuth } from "@/context/AuthContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { apiRequest } from "@/lib/api";
import {
  UploadCloud,
  CheckCircle2,
  ShieldCheck,
  Disc,
  Download,
  Sparkles,
  Play,
  Pause,
  AlertCircle,
  Copy,
  Radio,
  Layers,
  FileAudio,
  Eye,
  Lock,
  Globe,
  Share2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Track {
  id: string;
  title: string;
  genre: string;
  audio_url: string;
  bpm?: number;
  key_signature?: string;
  duration?: number;
  c2pa_manifest_id?: string;
  c2pa_signature?: string;
  cover_image_url?: string;
  visibility?: string;
  lyrics?: string;
  hashtags?: string[];
}

export default function PublishPage() {
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay } = useAudioPlayer();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");

  // Publishing Controls
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [releaseTitle, setReleaseTitle] = useState("");
  const [primaryArtist, setPrimaryArtist] = useState(user?.username || "Fombo Creator");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("Cyberpunk / Synthwave");
  const [hashtagsInput, setHashtagsInput] = useState("#synthwave, #cyberpunk, #fombo");
  const [coverImageUrl, setCoverImageUrl] = useState("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80");
  const [lyrics, setLyrics] = useState("");
  const [bpm, setBpm] = useState(124);
  const [musicalKey, setMusicalKey] = useState("F# Minor");

  // ISRC & UPC Identifiers
  const [isrc, setIsrc] = useState("");
  const [upc, setUpc] = useState("");
  const [copiedIsrc, setCopiedIsrc] = useState(false);

  // Legal Attestation
  const [aiDisclosureConfirmed, setAiDisclosureConfirmed] = useState(true);
  const [commercialWarrantyConfirmed, setCommercialWarrantyConfirmed] = useState(true);

  // Publishing State
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResponse, setPublishResponse] = useState<any | null>(null);
  const [publishSuccessMessage, setPublishSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    if (user?.username) {
      setPrimaryArtist(user.username);
    }
  }, [user]);

  const fetchTracks = async () => {
    try {
      setLoadingTracks(true);
      const res = await apiRequest<{ tracks: Track[] }>("/library/tracks");
      if (res && res.tracks && res.tracks.length > 0) {
        setTracks(res.tracks);
        selectTrack(res.tracks[0]);
      } else {
        const fallbackTrack: Track = {
          id: "preview-synth-1",
          title: "Neon Horizon 2099",
          genre: "Synthwave",
          audio_url: "https://actions.google.com/sounds/v1/science_fiction/scifi_hum.ogg",
          bpm: 124,
          key_signature: "F# Minor",
          duration: 145,
          c2pa_manifest_id: "c2pa_urn_fombo_master_2099",
          c2pa_signature: "sha256:7f92a3c98de102ba8912ef",
          visibility: "private",
          lyrics: "[Verse 1]\nNeon silhouettes across the wire\nSignals calling through the atmospheric fire",
        };
        setTracks([fallbackTrack]);
        selectTrack(fallbackTrack);
      }
    } catch {
      // Fallback demo track
      const fallbackTrack: Track = {
        id: "preview-synth-1",
        title: "Neon Horizon 2099",
        genre: "Synthwave",
        audio_url: "https://actions.google.com/sounds/v1/science_fiction/scifi_hum.ogg",
        bpm: 124,
        key_signature: "F# Minor",
        duration: 145,
        c2pa_manifest_id: "c2pa_urn_fombo_master_2099",
        c2pa_signature: "sha256:7f92a3c98de102ba8912ef",
        visibility: "private",
      };
      setTracks([fallbackTrack]);
      selectTrack(fallbackTrack);
    } finally {
      setLoadingTracks(false);
    }
  };

  const selectTrack = (track: Track) => {
    setSelectedTrackId(track.id);
    setReleaseTitle(track.title);
    if (track.genre) setGenre(track.genre);
    if (track.bpm) setBpm(track.bpm);
    if (track.lyrics) setLyrics(track.lyrics);
    if (track.cover_image_url) setCoverImageUrl(track.cover_image_url);
    if (track.visibility) setVisibility(track.visibility as any);
    generateCodes(track.title);
  };

  const generateCodes = (titleSeed: string) => {
    const year = "26";
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const newIsrc = `US-FMB-${year}-${randomSuffix}`;
    const newUpc = `840${Math.floor(100000000 + Math.random() * 900000000)}`;
    setIsrc(newIsrc);
    setUpc(newUpc);
  };

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  const handleCopyIsrc = () => {
    navigator.clipboard.writeText(isrc);
    setCopiedIsrc(true);
    setTimeout(() => setCopiedIsrc(false), 2000);
  };

  // Submit Publishing to Fombo Community Platform
  const handlePublish = async () => {
    if (!selectedTrack) return;
    setIsPublishing(true);
    setPublishSuccessMessage(null);

    const hashtagsList = hashtagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));

    try {
      const res = await apiRequest<{
        track: Track;
        distribution_notice: string;
        c2pa_manifest_status: string;
        share_url: string;
      }>(`/tracks/${selectedTrack.id}/publish`, {
        method: "POST",
        body: JSON.stringify({
          visibility,
          title: releaseTitle,
          description,
          genre,
          hashtags: hashtagsList,
          lyrics,
          cover_image_url: coverImageUrl,
          bpm,
          musical_key: musicalKey,
        }),
      });

      setPublishResponse(res);
      setPublishSuccessMessage(`Successfully published '${releaseTitle}' as ${visibility.toUpperCase()} on Fombo!`);
    } catch (err: any) {
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-studio-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                <UploadCloud className="w-6 h-6 text-neon-cyan" />
                Publish & Content Visibility Suite
              </h1>
              <Badge variant="cyan">Phase 8</Badge>
            </div>
            <p className="text-xs text-studio-400">
              Publish your master recordings to Fombo Community, control public/unlisted/private visibility, attach album artwork, and export C2PA manifests.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateCodes(releaseTitle)}
              className="text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-neon-purple" />
              Regenerate ISRC
            </Button>
          </div>
        </div>

        {/* DISTRIBUTION TRUTHFULNESS NOTICE BANNER */}
        <div className="p-4 bg-studio-900/90 border border-amber-500/30 rounded-2xl flex items-start gap-3 shadow-lg">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-studio-300 leading-relaxed">
            <strong className="text-amber-300 font-sans uppercase text-[11px] tracking-wider block">
              Fombo Platform Community Distribution Notice
            </strong>
            <p>
              Publishing places your master recording onto Fombo&apos;s public discovery network, community playlists, and artist profile according to your chosen visibility (<code className="text-white bg-studio-950 px-1 py-0.5 rounded">Public</code>, <code className="text-white bg-studio-950 px-1 py-0.5 rounded">Unlisted</code>, <code className="text-white bg-studio-950 px-1 py-0.5 rounded">Private</code>).
            </p>
            <p className="text-studio-400 text-[11px]">
              ⚠️ <strong>Note on Commercial DSPs:</strong> Publishing to Fombo <strong>DOES NOT</strong> automatically ingest or distribute your track to external commercial streaming platforms such as Spotify, Apple Music, Tidal, or Amazon Music. To distribute to commercial DSPs, export your C2PA-signed WAV master package and submit it through an authorized digital music distributor (such as DistroKid, TuneCore, or CD Baby).
            </p>
          </div>
        </div>

        {/* Track Selection Section */}
        <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Disc className="w-4 h-4 text-neon-cyan" />
              1. Select Source Master Recording
            </h2>
            <span className="text-[11px] font-mono text-studio-400">
              {tracks.length} Master{tracks.length === 1 ? "" : "s"} Available
            </span>
          </div>

          {loadingTracks ? (
            <div className="py-8 text-center text-xs text-studio-500 font-mono">
              Loading library audio masters...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {tracks.map((track) => {
                const isSelected = selectedTrackId === track.id;
                const isTrackPlaying = isPlaying && currentTrack?.id === track.id;

                return (
                  <div
                    key={track.id}
                    onClick={() => selectTrack(track)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? "bg-studio-850 border-neon-cyan text-white shadow-lg shadow-neon-cyan/5"
                        : "bg-studio-950/60 border-studio-800 text-studio-300 hover:border-studio-700 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isTrackPlaying) {
                            togglePlay();
                          } else {
                            playTrack({
                              id: track.id,
                              title: track.title,
                              artist: primaryArtist,
                              audio_url: track.audio_url,
                              duration_seconds: track.duration || 120,
                            });
                          }
                        }}
                        className="w-8 h-8 rounded-lg bg-studio-800 flex items-center justify-center text-neon-cyan hover:bg-neon-cyan hover:text-studio-950 transition flex-shrink-0"
                      >
                        {isTrackPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>
                      <div className="truncate">
                        <span className="font-semibold text-xs block truncate">{track.title}</span>
                        <span className="text-[10px] text-studio-400 font-mono">
                          {track.genre || "Electronic"} &bull; {track.bpm || 120} BPM
                        </span>
                      </div>
                    </div>
                    {isSelected && <Badge variant="cyan">Selected</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2-Column Publishing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Columns: Metadata, Visibility & Album Artwork */}
          <div className="lg:col-span-2 space-y-6">
            {/* Visibility Mode Selector */}
            <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-neon-purple" />
                2. Content Visibility Tier
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => setVisibility("public")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition space-y-1.5 ${
                    visibility === "public"
                      ? "bg-studio-850 border-neon-cyan text-white shadow-md shadow-neon-cyan/10"
                      : "bg-studio-950/60 border-studio-800 text-studio-400 hover:border-studio-700 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-neon-cyan" />
                      Public
                    </span>
                    {visibility === "public" && <CheckCircle2 className="w-3.5 h-3.5 text-neon-cyan" />}
                  </div>
                  <p className="text-[11px] text-studio-400 leading-tight">
                    Indexed in global search, explore feeds, and visible on public profile.
                  </p>
                </div>

                <div
                  onClick={() => setVisibility("unlisted")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition space-y-1.5 ${
                    visibility === "unlisted"
                      ? "bg-studio-850 border-neon-purple text-white shadow-md shadow-neon-purple/10"
                      : "bg-studio-950/60 border-studio-800 text-studio-400 hover:border-studio-700 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-neon-purple" />
                      Unlisted
                    </span>
                    {visibility === "unlisted" && <CheckCircle2 className="w-3.5 h-3.5 text-neon-purple" />}
                  </div>
                  <p className="text-[11px] text-studio-400 leading-tight">
                    Accessible only via direct permalink; hidden from public search feeds.
                  </p>
                </div>

                <div
                  onClick={() => setVisibility("private")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition space-y-1.5 ${
                    visibility === "private"
                      ? "bg-studio-850 border-amber-400 text-white shadow-md shadow-amber-400/10"
                      : "bg-studio-950/60 border-studio-800 text-studio-400 hover:border-studio-700 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      Private
                    </span>
                    {visibility === "private" && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <p className="text-[11px] text-studio-400 leading-tight">
                    Strictly confidential. Only you and authorized session collaborators can access.
                  </p>
                </div>
              </div>
            </div>

            {/* Album Artwork & Metadata Form */}
            <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-neon-cyan" />
                3. Metadata, Lyrics & Album Artwork
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {/* Cover Art Preview */}
                <div className="space-y-2">
                  <label className="text-[11px] text-studio-400 block font-mono">ALBUM ARTWORK</label>
                  <div className="w-full aspect-square rounded-2xl bg-studio-950 border border-studio-800 overflow-hidden relative shadow-lg group">
                    <img
                      src={coverImageUrl}
                      alt="Cover Artwork"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>
                  <input
                    type="text"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder="Cover image URL..."
                    className="w-full bg-studio-950 border border-studio-800 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-neon-cyan"
                  />
                </div>

                {/* Metadata Fields */}
                <div className="sm:col-span-2 space-y-3.5">
                  <div>
                    <label className="text-[11px] text-studio-400 block font-mono mb-1">TRACK TITLE</label>
                    <input
                      type="text"
                      value={releaseTitle}
                      onChange={(e) => setReleaseTitle(e.target.value)}
                      className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-studio-400 block font-mono mb-1">PRIMARY GENRE</label>
                      <input
                        type="text"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-studio-400 block font-mono mb-1">BPM / KEY</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={bpm}
                          onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                          className="w-16 bg-studio-950 border border-studio-800 rounded-xl px-2.5 py-2 text-xs text-white font-mono"
                        />
                        <input
                          type="text"
                          value={musicalKey}
                          onChange={(e) => setMusicalKey(e.target.value)}
                          className="flex-1 bg-studio-950 border border-studio-800 rounded-xl px-2.5 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-studio-400 block font-mono mb-1">
                      HASHTAGS (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={hashtagsInput}
                      onChange={(e) => setHashtagsInput(e.target.value)}
                      placeholder="#synthwave, #cyberpunk, #electronic"
                      className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-studio-400 block font-mono mb-1">
                      LYRICS DISPLAY (Optional)
                    </label>
                    <textarea
                      rows={4}
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      placeholder="[Verse 1]&#10;Write or paste lyrics here with [Section] headers..."
                      className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-neon-cyan"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Legal Attestations */}
            <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                4. Compliance & AI Disclosure Warranties
              </h2>

              <label className="flex items-start gap-3 p-3 bg-studio-950/60 border border-studio-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiDisclosureConfirmed}
                  onChange={(e) => setAiDisclosureConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-studio-700 text-neon-cyan focus:ring-0 accent-neon-cyan"
                />
                <div>
                  <span className="font-semibold text-white text-xs">C2PA Cryptographic Provenance Disclosure</span>
                  <p className="text-studio-400 text-[11px] mt-0.5">
                    Embed cryptographic manifest disclosing AI audio generation provenance. Complies with synthetic media transparency requirements.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 bg-studio-950/60 border border-studio-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={commercialWarrantyConfirmed}
                  onChange={(e) => setCommercialWarrantyConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-studio-700 text-neon-cyan focus:ring-0 accent-neon-cyan"
                />
                <div>
                  <span className="font-semibold text-white text-xs">Platform Community Terms & Originality</span>
                  <p className="text-studio-400 text-[11px] mt-0.5">
                    I warrant that this master track does not infringe third-party copyrights or contain unauthorized voice clones.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Right Column: Identifiers, Action & Response */}
          <div className="space-y-6">
            <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-studio-400">
                Asset Identifiers
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-studio-400">ISRC Code (ISO 3901)</span>
                    <button
                      onClick={handleCopyIsrc}
                      className="text-[10px] text-neon-cyan hover:underline flex items-center gap-1 font-mono"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedIsrc ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 font-mono text-neon-cyan font-bold">
                    {isrc || "US-FMB-26-00000"}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-studio-400 block mb-1">UPC Barcode</span>
                  <div className="bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 font-mono text-studio-200">
                    {upc || "840000000000"}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="neon"
                  onClick={handlePublish}
                  disabled={isPublishing || !aiDisclosureConfirmed || !commercialWarrantyConfirmed}
                  className="w-full text-xs py-3 font-bold"
                >
                  {isPublishing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-studio-950 border-t-transparent animate-spin rounded-full mr-2" />
                      Publishing to Fombo...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 mr-1.5" />
                      Publish to Fombo ({visibility.toUpperCase()})
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Success Response & Share Card */}
            {publishResponse && (
              <div className="bg-studio-900/80 border border-neon-cyan/50 rounded-2xl p-5 space-y-4 shadow-xl animate-in zoom-in-95 duration-200 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Release Active on Fombo!</span>
                </div>

                <p className="text-studio-300 text-[11px]">
                  {publishSuccessMessage}
                </p>

                <div className="p-3 bg-studio-950 rounded-xl border border-studio-800 space-y-1.5">
                  <span className="text-[10px] font-mono text-studio-500 uppercase block">Shareable Permalink</span>
                  <div className="flex items-center justify-between font-mono text-[11px] text-neon-cyan">
                    <span>{publishResponse.share_url}</span>
                    <a
                      href={publishResponse.share_url}
                      className="underline text-studio-300 hover:text-white"
                    >
                      View Song Page &rarr;
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
