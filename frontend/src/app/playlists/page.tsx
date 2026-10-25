"use client";

import React, { useState, useEffect } from "react";
import { useAudioPlayer, TrackItem } from "@/context/AudioPlayerContext";
import { apiRequest } from "@/lib/api";
import { ListMusic, Plus, Play, Disc, Clock, Lock, Globe, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PlaylistItem {
  id: string;
  name: string;
  description?: string;
  is_public: boolean;
  cover_image_url?: string;
  tracks?: TrackItem[];
  created_at?: string;
}

const DEFAULT_PLAYLISTS: PlaylistItem[] = [
  {
    id: "pl_synthwave",
    name: "Synthwave Nightfall",
    description: "Analog arpeggios, gated snares, and neon highways for night driving.",
    is_public: true,
    tracks: [
      {
        id: "demo_synthwave",
        title: "Midnight Chrome Drive",
        genre: "Synthwave",
        duration_seconds: 60.0,
        audio_url: "/api/v1/storage/file/tracks/demo_synthwave.wav",
        bpm: 124,
        musical_key: "F Minor",
      },
    ],
  },
  {
    id: "pl_lofi",
    name: "Lo-Fi Coffee Break",
    description: "Dusty vinyl crackle, gentle rhodes chords, and mellow study beats.",
    is_public: true,
    tracks: [
      {
        id: "demo_lofi",
        title: "Rainy Cafe Memories",
        genre: "Lo-Fi Hip Hop",
        duration_seconds: 45.0,
        audio_url: "/api/v1/storage/file/tracks/demo_lofi.wav",
        bpm: 84,
        musical_key: "Eb Major",
      },
    ],
  },
  {
    id: "pl_cyber",
    name: "Cyberpunk Overdrive",
    description: "Heavy industrial distortion, driving 808s, and dystopian soundscapes.",
    is_public: true,
    tracks: [
      {
        id: "demo_cyber",
        title: "Neon Overdrive Inversion",
        genre: "Cyberpunk Industrial",
        duration_seconds: 50.0,
        audio_url: "/api/v1/storage/file/tracks/demo_cyber.wav",
        bpm: 140,
        musical_key: "D Minor",
      },
    ],
  },
];

export default function PlaylistsPage() {
  const { playTrack } = useAudioPlayer();
  const [playlists, setPlaylists] = useState<PlaylistItem[]>(DEFAULT_PLAYLISTS);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchPlaylists = () => {
    setLoading(true);
    apiRequest<{ items?: PlaylistItem[]; playlists?: PlaylistItem[] }>("/playlists")
      .then((res) => {
        const fetched = res.items || res.playlists;
        if (fetched && fetched.length > 0) {
          setPlaylists(fetched);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      const created = await apiRequest<PlaylistItem>("/playlists", {
        method: "POST",
        body: JSON.stringify({
          name: newTitle.trim(),
          description: newDesc.trim() || undefined,
          is_public: isPublic,
        }),
      });
      setPlaylists([created, ...playlists]);
      setNewTitle("");
      setNewDesc("");
      setIsPublic(true);
      setShowCreateModal(false);
    } catch {
      // Fallback local playlist
      const localPl: PlaylistItem = {
        id: `pl_${Date.now()}`,
        name: newTitle.trim(),
        description: newDesc.trim() || "Custom playlist.",
        is_public: isPublic,
        tracks: [],
      };
      setPlaylists([localPl, ...playlists]);
      setShowCreateModal(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="py-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <ListMusic className="w-7 h-7 text-neon-purple" />
            Curated Playlists & Collections
          </h1>
          <p className="text-xs md:text-sm text-studio-400 mt-1">
            Organize your generated recordings, stems, and arrangements into public or private thematic sets.
          </p>
        </div>
        <Button variant="neon" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          <span>New Playlist</span>
        </Button>
      </div>

      {/* Playlist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {playlists.map((pl) => (
          <div
            key={pl.id}
            className="group bg-studio-900 border border-studio-800 hover:border-studio-700/80 rounded-2xl p-5 shadow-xl transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              {/* Cover Art Box */}
              <div className="relative aspect-square rounded-xl overflow-hidden flex items-center justify-center mb-4 transition border border-studio-700/60 bg-gradient-to-br from-studio-850 to-studio-950">
                {pl.cover_image_url ? (
                  <img
                    src={pl.cover_image_url}
                    alt={pl.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                ) : (
                  <Disc className="w-16 h-16 text-neon-cyan/70 group-hover:scale-105 transition" />
                )}

                {/* Privacy Badge */}
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-studio-950/80 backdrop-blur-md border border-studio-800 text-[10px] font-mono flex items-center gap-1 text-studio-300">
                  {pl.is_public ? (
                    <>
                      <Globe className="w-2.5 h-2.5 text-emerald-400" />
                      Public
                    </>
                  ) : (
                    <>
                      <Lock className="w-2.5 h-2.5 text-neon-amber" />
                      Private
                    </>
                  )}
                </span>

                {/* Quick Play First Track Button */}
                {pl.tracks && pl.tracks.length > 0 && (
                  <button
                    onClick={() => playTrack(pl.tracks![0])}
                    aria-label={`Play ${pl.name}`}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-neon-cyan text-studio-950 flex items-center justify-center shadow-lg transform group-hover:scale-105 transition">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </button>
                )}
              </div>

              <h3 className="font-bold text-sm text-studio-100 group-hover:text-neon-cyan transition truncate">
                {pl.name}
              </h3>
              <p className="text-xs text-studio-400 mt-1 line-clamp-2 leading-relaxed">
                {pl.description || "Collection of master audio recordings."}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-studio-800/80 flex items-center justify-between text-xs font-mono text-studio-400">
              <span>{pl.tracks?.length || 0} Tracks</span>
              <span className="flex items-center gap-1 text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                Curated Set
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-studio-900 border border-studio-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <h3 className="font-bold text-lg text-white">Create New Playlist</h3>
            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono font-medium text-studio-300 block">
                  Playlist Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Late Night Synthwave"
                  className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-studio-100 focus:outline-none focus:border-neon-cyan/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-medium text-studio-300 block">
                  Description
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  placeholder="Add optional notes or thematic narrative..."
                  className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs text-studio-100 focus:outline-none focus:border-neon-cyan/50 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-mono text-studio-300">Visibility</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition border ${
                      isPublic
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                        : "bg-studio-950 border-studio-800 text-studio-400"
                    }`}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition border ${
                      !isPublic
                        ? "bg-neon-amber/10 border-neon-amber/40 text-neon-amber"
                        : "bg-studio-950 border-studio-800 text-studio-400"
                    }`}
                  >
                    Private
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="neon" disabled={creating}>
                  {creating ? "Creating..." : "Create Playlist"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
