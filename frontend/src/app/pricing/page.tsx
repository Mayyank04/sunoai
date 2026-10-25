"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Check, Crown, ShieldAlert, Sparkles, Zap, Scale } from "lucide-react";

export default function PricingPage() {
  const { user } = useAuth();

  const tiers = [
    {
      name: "Free Creator",
      price: "$0",
      period: "forever",
      description: "Ideal for exploring AI music synthesis, learning prompt engineering, and casual playback.",
      credits: "50 Credits / mo (~10 tracks)",
      duration: "Up to 60s track length",
      queue: "Standard batch queue",
      rights: "Personal / Non-Commercial (CC-BY-NC 4.0)",
      features: [
        "Fombo Procedural DSP Synthesizer",
        "2-Stem Isolation (Vocals + Instrumental)",
        "4-Track Browser DAW Access",
        "Standard MP3 192kbps streaming",
        "Community Feed Publishing",
      ],
      current: user?.role === "creator" || !user?.role,
      highlight: false,
    },
    {
      name: "Pro Producer",
      price: "$19",
      period: "per month",
      description: "For active producers, beatmakers, and indie musicians creating streaming-ready masters.",
      credits: "500 Credits / mo (~100 tracks)",
      duration: "Up to 180s track length",
      queue: "Priority GPU worker queue",
      rights: "Commercial Rights Granted (Eligible Models)",
      features: [
        "MusicGen Medium & Suno API Adapters",
        "4-Stem Demucs v4 Separation (Vocals, Drums, Bass, Other)",
        "16-Track DAW with Bus Automation",
        "Lossless 16-bit 44.1kHz WAV Downloads",
        "C2PA Provenance Export Manifest",
        "Voice Consent Verification Access",
      ],
      current: user?.role === "pro_producer",
      highlight: true,
    },
    {
      name: "Studio Master",
      price: "$49",
      period: "per month",
      description: "For professional sound designers, commercial game studios, and high-volume media houses.",
      credits: "2,500 Credits / mo (~500 tracks)",
      duration: "Up to 300s track length (Full Song)",
      queue: "Dedicated High-Priority GPU Cluster",
      rights: "Full Commercial Sync & Streaming Grant",
      features: [
        "All Models (Large, Fine-Tuned, Stability, Suno)",
        "Full Lossless 24-bit 48kHz WAV & FLAC Master",
        "32-Track DAW with AI Producer Copilot",
        "Unlimited Stem Isolation & Slicing",
        "Automated ISRC Registry Metadata",
        "Direct REST API & Webhook Dispatch",
      ],
      current: user?.role === "studio",
      highlight: false,
    },
  ];

  return (
    <div className="py-6 max-w-6xl mx-auto space-y-12">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h1 className="text-3xl md:text-5xl font-extrabold text-white">
          Transparent Creator Plans
        </h1>
        <p className="text-sm text-studio-400 leading-relaxed">
          Predictable credit quotas, verified commercial licenses, and zero artificial tier restrictions on audio fidelity.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-3xl p-7 flex flex-col justify-between transition-all duration-200 relative shadow-2xl ${
              tier.highlight
                ? "bg-gradient-to-b from-studio-850 to-studio-900 border-2 border-neon-cyan/50 shadow-neon-cyan/10"
                : "bg-studio-900/90 border border-studio-800"
            }`}
          >
            {tier.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple text-studio-950 text-[10px] font-mono font-bold uppercase tracking-wider shadow">
                Most Popular
              </span>
            )}

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                {tier.highlight && <Crown className="w-5 h-5 text-neon-cyan" />}
              </div>
              <p className="text-xs text-studio-400 mt-2 min-h-[36px]">{tier.description}</p>

              <div className="mt-5 pb-5 border-b border-studio-800 flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-white font-mono">{tier.price}</span>
                <span className="text-xs text-studio-400 font-medium">/{tier.period}</span>
              </div>

              {/* Quota Highlights */}
              <div className="py-4 space-y-2 text-xs font-mono">
                <div className="text-neon-cyan font-bold">{tier.credits}</div>
                <div className="text-studio-300">{tier.duration}</div>
                <div className="text-studio-400">{tier.queue}</div>
              </div>

              {/* Feature Checklist */}
              <div className="pt-2 space-y-2.5 text-xs text-studio-300">
                {tier.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-neon-cyan flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              disabled={tier.current}
              className={`mt-8 w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                tier.current
                  ? "bg-studio-800 text-studio-400 cursor-default"
                  : tier.highlight
                  ? "bg-gradient-to-r from-neon-cyan to-neon-purple text-studio-950 hover:opacity-95 shadow-lg shadow-neon-cyan/20"
                  : "bg-studio-800 hover:bg-studio-750 text-white"
              }`}
            >
              {tier.current ? "Current Plan" : `Upgrade to ${tier.name.split(" ")[0]}`}
            </button>
          </div>
        ))}
      </div>

      {/* Honest Rights Explanation Box */}
      <div className="bg-studio-900 border border-studio-800 rounded-3xl p-8 space-y-4 shadow-xl">
        <div className="flex items-center gap-3 text-neon-cyan font-bold text-sm">
          <Scale className="w-5 h-5" />
          <span>Fombo Music AI Commercial Rights Transparency Disclosure</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-studio-400 leading-relaxed">
          <p>
            <strong>What Commercial Rights Mean:</strong> Paid subscribers (Pro & Studio) receive commercial distribution clearance allowing monetized YouTube videos, Spotify streaming, podcasts, and commercial sync under verified upstream provider grants.
          </p>
          <p>
            <strong>No Guarantee of Copyright Exclusivity:</strong> In accordance with United States Copyright Office (USCO) regulations and international intellectual property treaties, unguided AI output lacks human authorship and cannot be guaranteed exclusive copyright registration. You remain responsible for ensuring prompts do not intentionally reproduce protected melodic hooks.
          </p>
        </div>
      </div>
    </div>
  );
}
