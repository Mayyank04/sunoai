"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAudioPlayer, TrackItem } from "@/context/AudioPlayerContext";
import { CanvasVisualizer } from "@/components/player/CanvasVisualizer";
import { ProvenanceModal } from "@/components/provenance/ProvenanceModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Disc,
  ShieldCheck,
  Download,
  Sliders,
  Layers,
  Radio,
  Share2,
  Check,
  Heart,
  MessageSquare,
  AlertTriangle,
  Send,
  Lock,
  EyeOff,
  Globe,
  Info,
  Clock,
  ExternalLink,
} from "lucide-react";

interface CommentItem {
  id: string;
  user_id: string;
  content: string;
  timestamp_seconds?: number;
  created_at: string;
}

export default function SongDetailPage() {
  const params = useParams();
  const router = useRouter();
  const trackId = params.id as string;
  const { user } = useAuth();

  const { playTrack, currentTrack, isPlaying, togglePlay, currentTime, duration, seek } =
    useAudioPlayer();

  const [track, setTrack] = useState<TrackItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [showProvenance, setShowProvenance] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Social & Engagement State
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);

  // Comments State
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [anchorTimestamp, setAnchorTimestamp] = useState<number | null>(null);

  // DMCA / Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [claimantName, setClaimantName] = useState("");
  const [claimantEmail, setClaimantEmail] = useState("");
  const [workTitle, setWorkTitle] = useState("");
  const [signature, setSignature] = useState("");
  const [attestation, setAttestation] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorDetail(null);
    apiRequest<TrackItem>(`/tracks/${trackId}`)
      .then((data) => {
        setTrack(data);
        setLikeCount(data.like_count || 0);
        setShareCount(data.share_count || 0);
      })
      .catch((err) => {
        if (err?.message?.includes("private") || err?.message?.includes("taken down")) {
          setErrorDetail(err.message);
        } else {
          // Fallback demo for resilience
          setTrack({
            id: trackId,
            title: "Midnight Chrome Drive",
            genre: "Synthwave",
            bpm: 124,
            musical_key: "F Minor",
            duration_seconds: 60.0,
            audio_url: "/api/v1/storage/file/tracks/demo_synthwave.wav",
            commercial_rights_status: "commercial_granted",
            visibility: "public",
            moderation_status: "approved",
            hashtags: ["#synthwave", "#cyberpunk", "#analog"],
            lyrics: "[Verse 1]\nNeon signs refract on asphalt black\nEngine purrs on the midnight track\nDigital compass pointing west\nEchoes humming inside my chest\n\n[Chorus]\nMidnight chrome drive, tearing the seam\nBetween the nightmare and the lucid dream\nAnalog pulse in a silicon wire\nSetting this midnight city on fire",
          });
        }
      })
      .finally(() => setLoading(false));

    // Fetch comments
    apiRequest<{ items: CommentItem[] }>(`/tracks/${trackId}/comments`)
      .then((res) => setComments(res.items || []))
      .catch(() => setComments([]));
  }, [trackId]);

  const isThisPlaying = isPlaying && currentTrack?.id === track?.id;

  const handleToggleLike = async () => {
    if (!track) return;
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikeCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    try {
      if (nextState) {
        await apiRequest(`/tracks/${track.id}/like`, { method: "POST" });
      } else {
        await apiRequest(`/tracks/${track.id}/like`, { method: "DELETE" });
      }
    } catch {
      setIsLiked(!nextState);
      setLikeCount((prev) => (nextState ? Math.max(0, prev - 1) : prev + 1));
    }
  };

  const handleShare = async () => {
    if (!track) return;
    try {
      const res = await apiRequest<{ share_url: string; share_count: number }>(
        `/tracks/${track.id}/share`,
        { method: "POST" }
      );
      setShareCount(res.share_count);
    } catch {
      // Ignore network failure on share count
    }
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !track) return;
    setCommentSubmitting(true);
    try {
      const created = await apiRequest<CommentItem>(`/tracks/${track.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          content: newComment.trim(),
          timestamp_seconds: anchorTimestamp !== null ? anchorTimestamp : undefined,
        }),
      });
      setComments([created, ...comments]);
      setNewComment("");
      setAnchorTimestamp(null);
    } catch (err: any) {
      alert(err.message || "Failed to post comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleSubmitDMCA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!track) return;
    if (!attestation) {
      setReportError("You must attest under penalty of perjury to submit a formal DMCA claim.");
      return;
    }
    setReportSubmitting(true);
    setReportError(null);
    try {
      await apiRequest("/reports/copyright-claim", {
        method: "POST",
        body: JSON.stringify({
          claimant_name: claimantName,
          claimant_email: claimantEmail,
          work_infringed_title: workTitle,
          infringing_track_id: track.id,
          good_faith_attestation: true,
          accuracy_attestation: true,
          signature: signature,
        }),
      });
      setReportSuccess("Copyright claim submitted successfully. The Trust & Safety moderation team has queued the track for review.");
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(null);
      }, 3000);
    } catch (err: any) {
      setReportError(err.message || "Failed to submit claim.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? "0" : ""}${rem}`;
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin mx-auto"></div>
        <p className="text-xs text-studio-400 font-mono">Loading audio asset and waveform...</p>
      </div>
    );
  }

  if (errorDetail) {
    return (
      <div className="py-24 max-w-md mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-neon-crimson/10 border border-neon-crimson/30 flex items-center justify-center mx-auto text-neon-crimson">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Access Restricted</h2>
        <p className="text-xs text-studio-400 leading-relaxed">{errorDetail}</p>
        <Button variant="secondary" size="sm" onClick={() => router.push("/explore")}>
          Return to Explore
        </Button>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="py-24 text-center text-studio-400">
        Recording not found.
      </div>
    );
  }

  const artistHandle = track.artist_username || "soundweaver";

  return (
    <div className="py-6 max-w-5xl mx-auto space-y-8">
      {/* Song Header & Playback Station */}
      <div className="bg-gradient-to-r from-studio-900 via-studio-850 to-studio-900 border border-studio-800 rounded-3xl p-6 md:p-10 shadow-2xl space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Album Artwork Container */}
          <div className="w-36 h-36 rounded-2xl bg-studio-950 border border-studio-700/60 overflow-hidden flex items-center justify-center relative flex-shrink-0 shadow-2xl group">
            {track.cover_image_url ? (
              <img
                src={track.cover_image_url}
                alt={track.title}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              />
            ) : (
              <Disc
                className={`w-16 h-16 text-neon-cyan transition-all duration-300 ${
                  isThisPlaying ? "animate-spin scale-110" : ""
                }`}
              />
            )}
            <button
              onClick={() => (isThisPlaying ? togglePlay() : playTrack(track))}
              aria-label={isThisPlaying ? "Pause" : "Play"}
              className="absolute inset-0 bg-black/40 flex items-center justify-center transition cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-neon-cyan text-studio-950 flex items-center justify-center shadow-xl">
                {isThisPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </div>
            </button>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant="cyan">{track.genre || "Electronic"}</Badge>
              {track.bpm && <Badge variant="outline">{track.bpm} BPM</Badge>}
              {track.musical_key && <Badge variant="outline">{track.musical_key}</Badge>}

              {/* Visibility Badge */}
              {track.visibility === "public" ? (
                <Badge variant="default" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Public Release
                </Badge>
              ) : track.visibility === "unlisted" ? (
                <Badge variant="outline" className="text-neon-cyan border-neon-cyan/40 flex items-center gap-1">
                  <EyeOff className="w-3 h-3" />
                  Unlisted
                </Badge>
              ) : (
                <Badge variant="outline" className="text-neon-amber border-neon-amber/40 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Private Master
                </Badge>
              )}

              <Badge
                variant={
                  track.commercial_rights_status === "commercial_granted"
                    ? "emerald"
                    : "default"
                }
              >
                {track.commercial_rights_status === "commercial_granted"
                  ? "COMMERCIAL GRANT"
                  : "NON-COMMERCIAL (CC)"}
              </Badge>
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
              {track.title}
            </h1>

            {/* Artist Creator Credit */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs text-studio-400">Created by</span>
              <Link
                href={`/profile/${artistHandle}`}
                className="text-xs font-bold text-neon-cyan hover:underline flex items-center gap-1.5"
              >
                <span className="w-5 h-5 rounded-full bg-studio-800 border border-studio-700 flex items-center justify-center text-[10px] text-white uppercase">
                  {artistHandle.substring(0, 1)}
                </span>
                @{artistHandle}
              </Link>
            </div>

            {/* Description & Hashtags */}
            {track.description && (
              <p className="text-xs text-studio-300 max-w-xl leading-relaxed pt-1">
                {track.description}
              </p>
            )}

            {track.hashtags && track.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {track.hashtags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-mono text-studio-400 bg-studio-950 px-2 py-0.5 rounded border border-studio-800/80"
                  >
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}

            {/* Actions Row */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Button
                variant={isLiked ? "neon" : "secondary"}
                size="sm"
                onClick={handleToggleLike}
                className="flex items-center gap-1.5"
              >
                <Heart className={`w-4 h-4 ${isLiked ? "fill-current text-neon-pink" : ""}`} />
                <span>{likeCount} Likes</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleShare}
                className="flex items-center gap-1.5"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                <span>{shareCount} Shares</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowProvenance(true)}
              >
                <ShieldCheck className="w-4 h-4 text-neon-cyan" />
                <span>C2PA Provenance</span>
              </Button>

              <a href={`/stems?track_id=${track.id}`}>
                <Button variant="secondary" size="sm">
                  <Layers className="w-4 h-4 text-neon-purple" />
                  <span>Isolate Stems</span>
                </Button>
              </a>

              <a href="/studio">
                <Button variant="secondary" size="sm">
                  <Sliders className="w-4 h-4 text-neon-cyan" />
                  <span>Open in DAW</span>
                </Button>
              </a>

              <a href={track.audio_url} download={`${track.title}.wav`}>
                <Button variant="secondary" size="sm">
                  <Download className="w-4 h-4" />
                  <span>Download WAV</span>
                </Button>
              </a>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReportModal(true)}
                className="text-studio-500 hover:text-neon-crimson transition flex items-center gap-1 text-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Report DMCA</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Big Waveform & Scrubber Station */}
        <div className="bg-studio-950 p-6 rounded-2xl border border-studio-800 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-studio-400">
            <span>
              {isThisPlaying ? formatTime(currentTime) : "0:00"}
            </span>
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-neon-cyan animate-pulse" />
              <span>Interactive Waveform Scrubber</span>
            </div>
            <span>
              {formatTime(isThisPlaying && duration > 0 ? duration : track.duration_seconds)}
            </span>
          </div>

          {/* Waveform Bar Canvas / Representation */}
          <div
            className="h-20 flex items-end gap-1 cursor-pointer group relative"
            onClick={(e) => {
              if (isThisPlaying && duration > 0) {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                seek(pos * duration);
              } else {
                playTrack(track);
              }
            }}
          >
            {(track.waveform_data || [
              20, 35, 55, 75, 90, 85, 60, 40, 65, 80, 95, 100, 75, 50, 70, 85, 90, 65, 45, 60, 80, 95,
              70, 50, 65, 85, 90, 75, 55, 40, 60, 80, 95, 70, 45, 30,
            ]).map((h, i) => (
              <span
                key={i}
                className={`flex-1 rounded-full transition-all group-hover:brightness-125 ${
                  isThisPlaying ? "bg-neon-cyan" : "bg-studio-700"
                }`}
                style={{ height: `${Math.max(12, h)}%` }}
              ></span>
            ))}
          </div>

          <div className="flex justify-center pt-2">
            <CanvasVisualizer width={240} height={32} />
          </div>
        </div>

        {/* Platform Distribution Notice */}
        <div className="bg-studio-950/70 border border-studio-800/80 rounded-xl p-4 flex items-start gap-3 text-xs text-studio-400">
          <Info className="w-4 h-4 text-neon-cyan flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-studio-200 block">Fombo Community Platform Release</span>
            <p className="leading-relaxed">
              This master is hosted securely on Fombo. Publishing to Fombo does not automatically ingest or distribute music to external commercial streaming platforms (Spotify, Apple Music). To distribute commercially, export your signed C2PA master bundle and ingest via a certified DSP distributor.
            </p>
          </div>
        </div>
      </div>

      {/* Lyrics & Metadata Dual Column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Lyrics Display */}
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-cyan"></span>
            Song Arrangement & Lyrics
          </h2>
          {track.lyrics ? (
            <div className="bg-studio-950 p-5 rounded-xl border border-studio-800/80 max-h-96 overflow-y-auto space-y-4 font-mono text-xs text-studio-300 leading-relaxed whitespace-pre-line">
              {track.lyrics}
            </div>
          ) : (
            <div className="bg-studio-950 p-8 rounded-xl border border-studio-800/80 text-center text-xs text-studio-500">
              Instrumental recording — no vocal lyric transcript attached.
            </div>
          )}
        </div>

        {/* Comments & Discussion */}
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-neon-purple" />
              Community Discussion ({comments.length})
            </h2>
            {isThisPlaying && (
              <button
                onClick={() => setAnchorTimestamp(Math.round(currentTime))}
                className="text-[11px] font-mono text-neon-cyan hover:underline flex items-center gap-1"
              >
                <Clock className="w-3 h-3" />
                Pin at {formatTime(currentTime)}
              </button>
            )}
          </div>

          {/* New Comment Input */}
          <form onSubmit={handlePostComment} className="space-y-2">
            {anchorTimestamp !== null && (
              <div className="flex items-center justify-between text-[11px] font-mono bg-studio-950 px-3 py-1 rounded border border-studio-800 text-neon-cyan">
                <span>Pinned to timestamp {formatTime(anchorTimestamp)}</span>
                <button
                  type="button"
                  onClick={() => setAnchorTimestamp(null)}
                  className="text-studio-500 hover:text-studio-300"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share musical feedback or production thoughts..."
                className="flex-1 bg-studio-950 border border-studio-800 rounded-xl px-3.5 py-2.5 text-xs text-studio-100 placeholder-studio-500 focus:outline-none focus:border-neon-cyan/50"
              />
              <Button
                type="submit"
                variant="neon"
                size="sm"
                disabled={commentSubmitting || !newComment.trim()}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </form>

          {/* Comments List */}
          <div className="space-y-3 max-h-80 overflow-y-auto pt-2">
            {comments.length === 0 ? (
              <p className="text-xs text-studio-500 text-center py-6 font-mono">
                No comments yet. Be the first to share feedback!
              </p>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className="bg-studio-950 p-3 rounded-xl border border-studio-800/80 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] text-studio-500 font-mono">
                    <span className="font-semibold text-studio-300">User #{c.user_id.substring(0, 6)}</span>
                    <div className="flex items-center gap-2">
                      {c.timestamp_seconds !== undefined && c.timestamp_seconds !== null && (
                        <button
                          onClick={() => seek(c.timestamp_seconds!)}
                          className="text-neon-cyan hover:underline"
                        >
                          @{formatTime(c.timestamp_seconds)}
                        </button>
                      )}
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <p className="text-studio-200 leading-relaxed">{c.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* DMCA Copyright Takedown Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-studio-900 border border-studio-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-neon-crimson" />
                Submit Copyright / DMCA Complaint
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-studio-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-studio-400 leading-relaxed">
              If you hold rights to an original musical work and believe this track infringes your copyright, submit a formal takedown request under the Digital Millennium Copyright Act.
            </p>

            {reportError && (
              <div className="p-3 rounded-lg bg-neon-crimson/10 border border-neon-crimson/30 text-xs text-neon-crimson">
                {reportError}
              </div>
            )}

            {reportSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
                {reportSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitDMCA} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-studio-300 font-mono">Claimant Full Name</label>
                <input
                  type="text"
                  required
                  value={claimantName}
                  onChange={(e) => setClaimantName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-crimson/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-studio-300 font-mono">Contact Email</label>
                <input
                  type="email"
                  required
                  value={claimantEmail}
                  onChange={(e) => setClaimantEmail(e.target.value)}
                  placeholder="rights-holder@domain.com"
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-crimson/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-studio-300 font-mono">Original Work Title & Description</label>
                <input
                  type="text"
                  required
                  value={workTitle}
                  onChange={(e) => setWorkTitle(e.target.value)}
                  placeholder="Original song title, registration or release info"
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-crimson/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-studio-300 font-mono">Electronic Signature</label>
                <input
                  type="text"
                  required
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="/s/ Full Legal Name"
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-crimson/60"
                />
              </div>

              <label className="flex items-start gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attestation}
                  onChange={(e) => setAttestation(e.target.checked)}
                  className="mt-0.5 rounded border-studio-700 bg-studio-950 text-neon-crimson focus:ring-neon-crimson"
                />
                <span className="text-[11px] text-studio-400 leading-normal">
                  I state under penalty of perjury that I am authorized to act on behalf of the copyright owner, and that the use of the material is not authorized.
                </span>
              </label>

              <div className="flex justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowReportModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="neon"
                  size="sm"
                  disabled={reportSubmitting || !attestation}
                  className="bg-neon-crimson hover:bg-neon-crimson/80 text-white"
                >
                  {reportSubmitting ? "Submitting..." : "Submit DMCA Notice"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProvenance && (
        <ProvenanceModal trackId={track.id} onClose={() => setShowProvenance(false)} />
      )}
    </div>
  );
}
