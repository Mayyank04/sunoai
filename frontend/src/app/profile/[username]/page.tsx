"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TrackItem } from "@/context/AudioPlayerContext";
import { SongCard } from "@/components/ui/song-card";
import { SongCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UserCheck,
  Disc,
  Sliders,
  Share2,
  Check,
  Sparkles,
  Music,
  Heart,
  Headphones,
} from "lucide-react";

export default function ArtistProfilePage() {
  const params = useParams();
  const username = (params.username as string) || "soundweaver";
  const { user } = useAuth();

  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tracks" | "projects" | "about">("tracks");
  const [isFollowing, setIsFollowing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiRequest<{ tracks: TrackItem[] }>("/library/tracks?public_only=true&limit=20")
      .then((res) => {
        setTracks(res.tracks || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="py-6 max-w-6xl mx-auto space-y-10">
      {/* Artist Profile Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-studio-900 via-studio-850 to-studio-900 border border-studio-800 p-8 md:p-10 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-neon-cyan to-neon-purple p-0.5 shadow-xl flex-shrink-0">
            <div className="w-full h-full bg-studio-950 rounded-[14px] flex items-center justify-center font-extrabold text-2xl text-neon-cyan uppercase">
              {username.substring(0, 2)}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white">@{username}</h1>
              <Badge variant="cyan">
                <UserCheck className="w-3 h-3" />
                Verified Producer
              </Badge>
              <Badge variant="purple">Pro Tier</Badge>
            </div>
            <p className="text-xs md:text-sm text-studio-300 max-w-xl leading-relaxed">
              Synthesizing analog atmospheres, polyphonic chord structures, and cinematic soundscapes using the Fombo DSP Engine.
            </p>

            {/* Stats Row */}
            <div className="flex items-center gap-6 pt-2 font-mono text-xs text-studio-400">
              <div>
                <span className="font-bold text-white block text-sm">{tracks.length}</span>
                <span>Recordings</span>
              </div>
              <div className="h-6 w-px bg-studio-800"></div>
              <div>
                <span className="font-bold text-white block text-sm">1.4k</span>
                <span>Followers</span>
              </div>
              <div className="h-6 w-px bg-studio-800"></div>
              <div>
                <span className="font-bold text-white block text-sm">28.9k</span>
                <span>Plays</span>
              </div>
            </div>
          </div>

          {/* Follow & Share Actions */}
          <div className="flex items-center gap-3 pt-2 md:pt-0">
            <Button
              variant={isFollowing ? "secondary" : "neon"}
              size="md"
              onClick={() => setIsFollowing(!isFollowing)}
            >
              {isFollowing ? "Following" : "Follow Artist"}
            </Button>
            <Button variant="secondary" size="icon" onClick={handleShare} aria-label="Share Artist Profile">
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-studio-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("tracks")}
          className={`pb-3 transition flex items-center gap-2 ${
            activeTab === "tracks"
              ? "text-neon-cyan border-b-2 border-neon-cyan"
              : "text-studio-400 hover:text-studio-200"
          }`}
        >
          <Disc className="w-4 h-4" />
          <span>Master Releases ({tracks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("projects")}
          className={`pb-3 transition flex items-center gap-2 ${
            activeTab === "projects"
              ? "text-neon-cyan border-b-2 border-neon-cyan"
              : "text-studio-400 hover:text-studio-200"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>DAW Sessions</span>
        </button>
        <button
          onClick={() => setActiveTab("about")}
          className={`pb-3 transition flex items-center gap-2 ${
            activeTab === "about"
              ? "text-neon-cyan border-b-2 border-neon-cyan"
              : "text-studio-400 hover:text-studio-200"
          }`}
        >
          <span>About & Gear</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "tracks" ? (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <SongCardSkeleton key={i} />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <EmptyState
            icon={Music}
            title="No Releases Yet"
            description="This artist hasn't published any public master recordings yet."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {tracks.map((track) => (
              <SongCard key={track.id} track={track} artistUsername={username} />
            ))}
          </div>
        )
      ) : activeTab === "projects" ? (
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-8 text-center space-y-3">
          <Sliders className="w-10 h-10 text-studio-600 mx-auto" />
          <h3 className="font-bold text-sm text-studio-200">Private Studio Sessions</h3>
          <p className="text-xs text-studio-400 max-w-sm mx-auto">
            Multitrack DAW arrangements are private to the artist until published to the public catalog.
          </p>
        </div>
      ) : (
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 space-y-4 max-w-2xl text-xs text-studio-300 leading-relaxed">
          <h4 className="font-bold text-sm text-white">Audio Synthesis Configuration</h4>
          <p>
            Primary modeling engines: <strong>Fombo Procedural DSP v1</strong>, <strong>Meta MusicGen Large</strong>, and <strong>Demucs v4</strong>.
          </p>
          <p>
            All generated stems and compositions carry certified <strong>C2PA metadata</strong> and are released under verified commercial developer grants.
          </p>
        </div>
      )}
    </div>
  );
}
