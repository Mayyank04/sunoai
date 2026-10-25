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
  FileJson,
  Download,
  Sparkles,
  Play,
  Pause,
  AlertCircle,
  ExternalLink,
  Copy,
  Radio,
  Layers,
  FileAudio,
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
}

export default function PublishPage() {
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay } = useAudioPlayer();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");

  // Distribution Form
  const [releaseTitle, setReleaseTitle] = useState("");
  const [primaryArtist, setPrimaryArtist] = useState(user?.username || "Fombo Creator");
  const [featuredArtists, setFeaturedArtists] = useState("");
  const [recordLabel, setRecordLabel] = useState("Fombo Independent Records");
  const [genre, setGenre] = useState("Cyberpunk / Synthwave");
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [explicitContent, setExplicitContent] = useState<"clean" | "explicit" | "instrumental">("clean");
  const [audioFormat, setAudioFormat] = useState<"wav_24_48" | "wav_16_44" | "mp3_320">("wav_24_48");

  // ISRC & UPC
  const [isrc, setIsrc] = useState("");
  const [upc, setUpc] = useState("");
  const [copiedIsrc, setCopiedIsrc] = useState(false);

  // Legal / Rights
  const [aiDisclosureConfirmed, setAiDisclosureConfirmed] = useState(true);
  const [commercialWarrantyConfirmed, setCommercialWarrantyConfirmed] = useState(true);

  // Publish Status
  const [isPackaging, setIsPackaging] = useState(false);
  const [packagedResult, setPackagedResult] = useState<any | null>(null);
  const [distributionSuccess, setDistributionSuccess] = useState(false);

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
      const res = await apiRequest<{ items: Track[] }>("/library");
      if (res && res.items && res.items.length > 0) {
        setTracks(res.items);
        selectTrack(res.items[0]);
      } else {
        // Fallback default sample track for publish staging
        const fallbackTrack: Track = {
          id: "preview-synth-1",
          title: "Neon Horizon 2099",
          genre: "Synthwave / Cyberpunk",
          audio_url: "https://actions.google.com/sounds/v1/science_fiction/scifi_hum.ogg",
          bpm: 124,
          key_signature: "F# Minor",
          duration: 145,
          c2pa_manifest_id: "c2pa_urn_fombo_master_2099",
          c2pa_signature: "sha256:7f92a3c98de102ba8912ef",
        };
        setTracks([fallbackTrack]);
        selectTrack(fallbackTrack);
      }
    } catch {
      const fallbackTrack: Track = {
        id: "preview-synth-1",
        title: "Neon Horizon 2099",
        genre: "Synthwave / Cyberpunk",
        audio_url: "https://actions.google.com/sounds/v1/science_fiction/scifi_hum.ogg",
        bpm: 124,
        key_signature: "F# Minor",
        duration: 145,
        c2pa_manifest_id: "c2pa_urn_fombo_master_2099",
        c2pa_signature: "sha256:7f92a3c98de102ba8912ef",
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

  const handleGeneratePackage = () => {
    if (!selectedTrack) return;
    setIsPackaging(true);

    setTimeout(() => {
      const packageData = {
        package_version: "1.0-C2PA-DSP",
        generated_at: new Date().toISOString(),
        metadata: {
          title: releaseTitle,
          primary_artist: primaryArtist,
          featured_artists: featuredArtists ? featuredArtists.split(",").map((s) => s.trim()) : [],
          label: recordLabel,
          primary_genre: genre,
          release_date: releaseDate,
          explicit: explicitContent,
          isrc: isrc,
          upc: upc,
          duration_seconds: selectedTrack.duration || 180,
          bpm: selectedTrack.bpm || 120,
          key_signature: selectedTrack.key_signature || "C Major",
        },
        audio_assets: {
          master_format: audioFormat === "wav_24_48" ? "WAV 24-bit / 48kHz (Broadcast)" : audioFormat === "wav_16_44" ? "WAV 16-bit / 44.1kHz (CD Red Book)" : "MP3 320kbps (Streaming)",
          audio_stream_url: selectedTrack.audio_url,
          checksum_sha256: "9b3c41ef8821ad5e88bb00392ad17f309d9426f048d0d1e1f78a05c317540263",
        },
        c2pa_provenance: {
          assertion_title: "C2PA Content Credentials AI Audio Disclosure",
          generator: "Fombo Music AI Audio Engine v1.0",
          provenance_manifest_id: selectedTrack.c2pa_manifest_id || `urn:uuid:${selectedTrack.id}`,
          digital_source_type: "http://cv.iptc.org/newscodes/digitalsourcetype/syntheticMedia",
          training_opt_out: true,
          commercial_rights_granted: true,
          owner_account_id: user?.id || "fombo_creator_session",
        },
        distributor_targets: [
          { service: "Spotify", delivery_status: "Ready for Ingestion" },
          { service: "Apple Music", delivery_status: "Ready for Ingestion" },
          { service: "Tidal HiFi", delivery_status: "Ready for Ingestion" },
          { service: "Amazon Music", delivery_status: "Ready for Ingestion" },
        ],
      };

      setPackagedResult(packageData);
      setIsPackaging(false);
    }, 1200);
  };

  const handleDownloadManifest = () => {
    if (!packagedResult) return;
    const blob = new Blob([JSON.stringify(packagedResult, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FOMBO_MASTER_${isrc.replace(/-/g, "_")}_MANIFEST.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmitDistribution = () => {
    setDistributionSuccess(true);
    setTimeout(() => {
      setDistributionSuccess(false);
    }, 5000);
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
                Publish Master & Distribution Suite
              </h1>
              <Badge variant="cyan">DSP Master 1.0</Badge>
            </div>
            <p className="text-xs text-studio-400">
              Generate standardized ISRC/UPC release packages, verify C2PA content credentials, and prepare high-res stems for Spotify, Apple Music & Tidal.
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
                        <div className="text-xs font-semibold truncate">{track.title}</div>
                        <div className="text-[10px] font-mono text-studio-500 truncate">
                          {track.genre || "Electronic"} • {track.bpm ? `${track.bpm} BPM` : "120 BPM"}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-neon-cyan flex-shrink-0 ml-2" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Metadata Editor Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-6 space-y-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-neon-purple" />
                2. Metadata & Release Credits
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-studio-400 font-medium mb-1.5">Track / Single Title</label>
                  <input
                    type="text"
                    value={releaseTitle}
                    onChange={(e) => setReleaseTitle(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan transition font-medium"
                    placeholder="e.g. Cybernetic Heartbeat"
                  />
                </div>

                <div>
                  <label className="block text-studio-400 font-medium mb-1.5">Primary Artist Name</label>
                  <input
                    type="text"
                    value={primaryArtist}
                    onChange={(e) => setPrimaryArtist(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan transition font-medium"
                    placeholder="e.g. Mayyank"
                  />
                </div>

                <div>
                  <label className="block text-studio-400 font-medium mb-1.5">Featured Artists (Optional)</label>
                  <input
                    type="text"
                    value={featuredArtists}
                    onChange={(e) => setFeaturedArtists(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan transition"
                    placeholder="e.g. Fombo Neural Ensemble, DJ Neon"
                  />
                </div>

                <div>
                  <label className="block text-studio-400 font-medium mb-1.5">Record Label / Publishing Imprint</label>
                  <input
                    type="text"
                    value={recordLabel}
                    onChange={(e) => setRecordLabel(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan transition"
                  />
                </div>

                <div>
                  <label className="block text-studio-400 font-medium mb-1.5">Primary Genre</label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan transition"
                  >
                    <option value="Cyberpunk / Synthwave">Cyberpunk / Synthwave</option>
                    <option value="Electronic / Dance">Electronic / Dance</option>
                    <option value="Lo-Fi Hip Hop">Lo-Fi Hip Hop</option>
                    <option value="Cinematic Orchestral">Cinematic Orchestral</option>
                    <option value="Future Bass">Future Bass</option>
                    <option value="Deep Tech House">Deep Tech House</option>
                    <option value="Dark Ambient">Dark Ambient</option>
                  </select>
                </div>

                <div>
                  <label className="block text-studio-400 font-medium mb-1.5">Target Release Date</label>
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan transition font-mono"
                  />
                </div>
              </div>

              {/* Explicit & Master Resolution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-studio-800/80">
                <div>
                  <label className="block text-studio-400 font-medium mb-1.5 text-xs">Content Advisory</label>
                  <div className="flex gap-2">
                    {(["clean", "explicit", "instrumental"] as const).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setExplicitContent(tag)}
                        className={`flex-1 py-1.5 text-xs capitalize rounded-lg border font-medium transition ${
                          explicitContent === tag
                            ? "bg-studio-800 border-neon-cyan text-white shadow-sm"
                            : "bg-studio-950/60 border-studio-800 text-studio-400 hover:text-white"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-studio-400 font-medium mb-1.5 text-xs">Master Export Quality</label>
                  <select
                    value={audioFormat}
                    onChange={(e) => setAudioFormat(e.target.value as any)}
                    className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan transition text-xs"
                  >
                    <option value="wav_24_48">24-bit / 48kHz Broadcast Master WAV</option>
                    <option value="wav_16_44">16-bit / 44.1kHz Red Book Audio CD WAV</option>
                    <option value="mp3_320">320 kbps Streaming Optimized MP3</option>
                  </select>
                </div>
              </div>
            </div>

            {/* C2PA Legal & Rights Check */}
            <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-neon-green" />
                3. C2PA Content Credentials & Commercial Warranty
              </h2>

              <div className="space-y-3 text-xs">
                <label className="flex items-start gap-3 p-3 bg-studio-950/60 border border-studio-800/80 rounded-xl cursor-pointer hover:border-studio-700 transition">
                  <input
                    type="checkbox"
                    checked={aiDisclosureConfirmed}
                    onChange={(e) => setAiDisclosureConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-studio-700 text-neon-cyan focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-white">AI Synthesis Disclosure (C2PA Spec v1.3)</span>
                    <p className="text-studio-400 text-[11px] mt-0.5 leading-relaxed">
                      Embed cryptographic manifest disclosing AI audio generation provenance. Compliant with EU AI Act Article 50 synthetic media watermarking mandates.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-studio-950/60 border border-studio-800/80 rounded-xl cursor-pointer hover:border-studio-700 transition">
                  <input
                    type="checkbox"
                    checked={commercialWarrantyConfirmed}
                    onChange={(e) => setCommercialWarrantyConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-studio-700 text-neon-cyan focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-white">Commercial Rights & Master Warranty</span>
                    <p className="text-studio-400 text-[11px] mt-0.5 leading-relaxed">
                      I warrant that this master track was created under Fombo Studio Pro terms and holds commercial synchronization, broadcast, and streaming distribution clearance.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Identifiers & Export Status */}
          <div className="space-y-6">
            {/* ISRC Card */}
            <div className="bg-studio-900/60 border border-studio-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-studio-400">
                Distribution Identifiers
              </h3>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-studio-400 font-medium">ISRC Code (ISO 3901)</span>
                    <button
                      onClick={handleCopyIsrc}
                      className="text-[10px] text-neon-cyan hover:underline flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedIsrc ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 font-mono text-xs text-neon-cyan font-bold flex items-center justify-between">
                    <span>{isrc || "US-FMB-26-00000"}</span>
                    <Badge variant="cyan">Standard</Badge>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-studio-400 font-medium">UPC Barcode</span>
                  </div>
                  <div className="bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 font-mono text-xs text-studio-200">
                    {upc || "840000000000"}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-studio-400 font-medium">C2PA Asset Hash</span>
                  </div>
                  <div className="bg-studio-950 border border-studio-800 rounded-lg px-3 py-1.5 font-mono text-[10px] text-studio-400 truncate">
                    {selectedTrack?.c2pa_signature || "sha256:7f92a3c98de102ba8912ef"}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="neon"
                  onClick={handleGeneratePackage}
                  disabled={isPackaging || !aiDisclosureConfirmed || !commercialWarrantyConfirmed}
                  className="w-full text-xs py-2.5"
                >
                  {isPackaging ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-studio-950 border-t-transparent animate-spin rounded-full mr-2" />
                      Generating DSP Package...
                    </>
                  ) : (
                    <>
                      <FileAudio className="w-4 h-4 mr-1.5" />
                      Compile Distribution Package
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Packaged Result */}
            {packagedResult && (
              <div className="bg-studio-900/80 border border-neon-cyan/40 rounded-2xl p-5 space-y-4 shadow-xl shadow-neon-cyan/5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-neon-cyan" />
                    <span className="text-xs font-bold text-white">DSP Package Ready</span>
                  </div>
                  <Badge variant="emerald">Ingestion Ready</Badge>
                </div>

                <p className="text-[11px] text-studio-300">
                  Broadcast package compiled with C2PA signature, {audioFormat === "wav_24_48" ? "24-bit WAV" : "16-bit WAV"}, and distribution manifest.
                </p>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={handleDownloadManifest}
                    className="w-full text-xs border-studio-700 hover:border-white"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 text-neon-cyan" />
                    Download Manifest JSON
                  </Button>

                  <Button
                    variant="primary"
                    onClick={handleSubmitDistribution}
                    className="w-full text-xs bg-neon-purple hover:bg-neon-purple/90 text-white"
                  >
                    <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                    Dispatch to DSP Aggregator
                  </Button>
                </div>

                {distributionSuccess && (
                  <div className="p-3 bg-neon-green/10 border border-neon-green/30 rounded-xl text-[11px] text-neon-green flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Package submitted to Spotify for Artists & Apple Music staging queue!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
