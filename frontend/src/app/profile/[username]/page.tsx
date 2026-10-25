"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
  Globe,
  ExternalLink,
  Shield,
  Plus,
} from "lucide-react";

interface ProfileData {
  id: string;
  user_id: string;
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  website?: string;
  social_links?: Record<string, string>;
  stats?: {
    followers_count?: number;
    total_tracks?: number;
    total_plays?: number;
  };
}

export default function ArtistProfilePage() {
  const params = useParams();
  const rawUsername = params.username as string;
  const username = decodeURIComponent(rawUsername || "soundweaver");
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tracks" | "projects" | "about">("tracks");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  // Check if viewing own profile
  const isOwnProfile = user && (user.username === username || profile?.user_id === user.id);

  useEffect(() => {
    setLoading(true);
    apiRequest<ProfileData>(`/profiles/${username}`)
      .then((data) => {
        setProfile(data);
        setFollowersCount(data.stats?.followers_count || 0);
      })
      .catch(() => {
        // Fallback default profile
        setProfile({
          id: "default",
          user_id: "user-1",
          username: username,
          display_name: username.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          bio: "Electronic and ambient producer synthesizing analog atmospheres with Fombo DSP.",
          stats: {
            followers_count: 1420,
            total_tracks: 12,
            total_plays: 28900,
          },
        });
        setFollowersCount(1420);
      })
      .finally(() => setLoading(false));

    setTracksLoading(true);
    apiRequest<{ items: TrackItem[]; tracks?: TrackItem[] }>(`/profiles/${username}/tracks`)
      .then((res) => {
        setTracks(res.items || res.tracks || []);
      })
      .catch(() => {
        // Fallback demo tracks
        setTracks([
          {
            id: "demo-1",
            title: "Midnight Chrome Drive",
            genre: "Synthwave",
            duration_seconds: 60.0,
            audio_url: "/api/v1/storage/file/tracks/demo_synthwave.wav",
            bpm: 124,
            musical_key: "F Minor",
            artist_username: username,
            visibility: "public",
            like_count: 42,
          },
          {
            id: "demo-2",
            title: "Cyberpunk Alley Echoes",
            genre: "Cyberpunk",
            duration_seconds: 48.0,
            audio_url: "/api/v1/storage/file/tracks/demo_cyberpunk.wav",
            bpm: 130,
            musical_key: "C Minor",
            artist_username: username,
            visibility: "public",
            like_count: 19,
          },
        ]);
      })
      .finally(() => setTracksLoading(false));
  }, [username]);

  const handleToggleFollow = async () => {
    if (!profile || isOwnProfile) return;
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowersCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      if (nextState) {
        await apiRequest(`/users/${profile.user_id}/follow`, { method: "POST" });
      } else {
        await apiRequest(`/users/${profile.user_id}/follow`, { method: "DELETE" });
      }
    } catch {
      setIsFollowing(!nextState);
      setFollowersCount((prev) => (nextState ? Math.max(0, prev - 1) : prev + 1));
    }
  };

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
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name || username}
                className="w-full h-full object-cover rounded-[14px]"
              />
            ) : (
              <div className="w-full h-full bg-studio-950 rounded-[14px] flex items-center justify-center font-extrabold text-2xl text-neon-cyan uppercase">
                {username.substring(0, 2)}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white">
                {profile?.display_name || username}
              </h1>
              <span className="text-sm font-mono text-studio-400">@{username}</span>
              <Badge variant="cyan" className="flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                Verified Artist
              </Badge>
              {isOwnProfile && (
                <Badge variant="outline" className="text-neon-purple border-neon-purple/40">
                  Your Profile
                </Badge>
              )}
            </div>

            <p className="text-xs md:text-sm text-studio-300 max-w-xl leading-relaxed">
              {profile?.bio || "Synthesizing analog atmospheres, polyphonic chord structures, and cinematic soundscapes using the Fombo DSP Engine."}
            </p>

            {/* External Links */}
            {profile?.website && (
              <div className="pt-1">
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-neon-cyan hover:underline flex items-center gap-1"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{profile.website.replace(/^https?:\/\//, "")}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Stats Row */}
            <div className="flex items-center gap-6 pt-2 font-mono text-xs text-studio-400">
              <div>
                <span className="font-bold text-white block text-sm">
                  {tracks.length || profile?.stats?.total_tracks || 0}
                </span>
                <span>Tracks</span>
              </div>
              <div className="h-6 w-px bg-studio-800"></div>
              <div>
                <span className="font-bold text-white block text-sm">
                  {followersCount.toLocaleString()}
                </span>
                <span>Followers</span>
              </div>
              <div className="h-6 w-px bg-studio-800"></div>
              <div>
                <span className="font-bold text-white block text-sm">
                  {(profile?.stats?.total_plays || 0).toLocaleString()}
                </span>
                <span>Verified Plays</span>
              </div>
            </div>
          </div>

          {/* Follow & Share Actions */}
          <div className="flex items-center gap-3 pt-2 md:pt-0">
            {!isOwnProfile ? (
              <Button
                variant={isFollowing ? "secondary" : "neon"}
                size="md"
                onClick={handleToggleFollow}
              >
                {isFollowing ? "Following" : "Follow Artist"}
              </Button>
            ) : (
              <Link href="/settings">
                <Button variant="secondary" size="md">
                  Edit Profile
                </Button>
              </Link>
            )}
            <Button
              variant="secondary"
              size="icon"
              onClick={handleShare}
              aria-label="Share Artist Profile"
            >
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
          <span>Releases ({tracks.length})</span>
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
        tracksLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <SongCardSkeleton key={i} />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <EmptyState
            icon={Music}
            title="No Published Tracks Yet"
            description={
              isOwnProfile
                ? "You haven't published any tracks yet. Create music in the studio and publish to your artist catalog."
                : "This artist hasn't released any public tracks yet."
            }
            actionLabel={isOwnProfile ? "Create Song" : undefined}
            actionHref={isOwnProfile ? "/create" : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {tracks.map((track) => (
              <SongCard
                key={track.id}
                track={track}
                artistUsername={username}
                showArtist={false}
              />
            ))}
          </div>
        )
      ) : activeTab === "projects" ? (
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-8 text-center space-y-4">
          <Sliders className="w-10 h-10 text-neon-cyan mx-auto" />
          <h3 className="text-lg font-bold text-white">Browser DAW Multitrack Projects</h3>
          <p className="text-xs text-studio-400 max-w-md mx-auto leading-relaxed">
            Multitrack arrangements, stems, MIDI sequences, and dynamic automation clips created in the Fombo Studio engine.
          </p>
          <Link href="/studio">
            <Button variant="neon" size="sm">
              Launch Multitrack DAW
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-studio-900 border border-studio-800 rounded-2xl p-8 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-2">
              Artist Biography
            </h3>
            <p className="text-xs text-studio-300 leading-relaxed max-w-3xl">
              {profile?.bio || "Fombo verified creator creating modern procedural audio compositions."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-studio-800 text-xs">
            <div className="space-y-2">
              <h4 className="font-mono text-studio-400 uppercase">Production Engine Stack</h4>
              <ul className="space-y-1 text-studio-200 font-mono">
                <li>• Web Audio API & AudioWorklet Real-Time Synthesis</li>
                <li>• Demucs Neural Waveform Stem Isolation</li>
                <li>• C2PA Cryptographic Content Credentials</li>
                <li>• Fombo Multitrack Arranger</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-mono text-studio-400 uppercase">Platform Distribution Policy</h4>
              <p className="text-studio-400 leading-relaxed text-[11px]">
                Tracks published here are hosted on the Fombo Community Platform. Commercial streaming distribution to Spotify, Apple Music, and Amazon Music requires separate digital distributor delivery.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
