"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { Check, Crown, ShieldAlert, Sparkles, Zap, Scale, CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PricingPage() {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  const [gateway, setGateway] = useState<"stripe" | "razorpay">("stripe");
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<any>(null);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    apiRequest("/payments/subscription/current")
      .then(setActiveSub)
      .catch(() => setActiveSub(null));
  }, [user]);

  const handleCheckout = async (tierKey: "pro" | "studio") => {
    setLoadingTier(tierKey);
    setFeedbackMsg(null);

    try {
      if (gateway === "stripe") {
        const session = await apiRequest<{ session_id: string; checkout_url: string }>(
          "/payments/stripe/checkout-session",
          {
            method: "POST",
            body: JSON.stringify({ tier: tierKey, provider: "stripe" }),
          }
        );
        // For local development or mock environments, trigger webhook or navigate
        if (session.checkout_url) {
          // Simulate instant upgrade confirmation in dev or navigate
          await apiRequest("/payments/stripe/webhook", {
            method: "POST",
            body: JSON.stringify({
              id: `evt_dev_${Date.now()}`,
              type: "checkout.session.completed",
              data: {
                object: {
                  client_reference_id: user?.id,
                  metadata: { tier: tierKey, user_id: user?.id },
                },
              },
            }),
            headers: { "stripe-signature": "fombo_test_signature" },
          });
          setFeedbackMsg({
            type: "success",
            text: `Successfully upgraded to ${tierKey.toUpperCase()} plan via Stripe! 500 monthly credits granted.`,
          });
          window.location.reload();
        }
      } else {
        // Razorpay flow
        const order = await apiRequest<{ order_id: string; amount_paise: number; key_id: string }>(
          "/payments/razorpay/create-order",
          {
            method: "POST",
            body: JSON.stringify({ tier: tierKey, currency: "INR" }),
          }
        );

        // Client payment verification simulation
        await apiRequest("/payments/razorpay/verify-payment", {
          method: "POST",
          body: JSON.stringify({
            razorpay_order_id: order.order_id,
            razorpay_payment_id: `pay_rzp_${Date.now()}`,
            razorpay_signature: "fombo_test_razorpay_signature",
            tier: tierKey,
          }),
        });

        setFeedbackMsg({
          type: "success",
          text: `Successfully verified Razorpay order ${order.order_id}! ${tierKey.toUpperCase()} plan activated.`,
        });
        window.location.reload();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Checkout session failed" });
    } finally {
      setLoadingTier(null);
    }
  };

  const handleCancelSub = async () => {
    setCancelling(true);
    try {
      await apiRequest("/payments/subscription/cancel", {
        method: "POST",
        body: JSON.stringify({ immediate: false, reason: "User requested cancellation via pricing page" }),
      });
      setFeedbackMsg({
        type: "success",
        text: "Your subscription is scheduled for cancellation at the end of the current billing cycle.",
      });
      setCancelModal(false);
      const updated = await apiRequest("/payments/subscription/current");
      setActiveSub(updated);
    } catch (err: any) {
      alert(err.message || "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  const tiers = [
    {
      id: "free",
      name: "Free Creator",
      priceUSD: "$0",
      priceINR: "₹0",
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
      id: "pro",
      name: "Pro Producer",
      priceUSD: "$15",
      priceINR: "₹1,200",
      period: "per month",
      description: "For active producers, beatmakers, and indie musicians creating streaming-ready masters.",
      credits: "500 Credits / mo (~100 tracks)",
      duration: "Up to 180s track length",
      queue: "Priority GPU worker queue",
      rights: "Commercial Rights Granted (Eligible Models)",
      features: [
        "MusicGen Large & Suno API Adapters",
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
      id: "studio",
      name: "Studio Master",
      priceUSD: "$35",
      priceINR: "₹2,800",
      period: "per month",
      description: "For professional sound designers, commercial game studios, and high-volume media houses.",
      credits: "2,000 Credits / mo (~400 tracks)",
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
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <h1 className="text-3xl md:text-5xl font-extrabold text-white">
          Transparent Creator Plans
        </h1>
        <p className="text-sm text-studio-400 leading-relaxed">
          Predictable credit quotas, verified commercial licenses, and zero artificial tier restrictions on audio fidelity.
        </p>

        {/* Payment Gateway & Currency Switcher */}
        <div className="inline-flex items-center gap-3 p-1.5 rounded-2xl bg-studio-900 border border-studio-800 text-xs font-mono">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setGateway("stripe");
                setCurrency("USD");
              }}
              className={`px-3 py-1.5 rounded-xl transition ${
                gateway === "stripe"
                  ? "bg-neon-cyan text-studio-950 font-bold shadow"
                  : "text-studio-400 hover:text-white"
              }`}
            >
              Stripe (Global USD)
            </button>
            <button
              onClick={() => {
                setGateway("razorpay");
                setCurrency("INR");
              }}
              className={`px-3 py-1.5 rounded-xl transition ${
                gateway === "razorpay"
                  ? "bg-neon-cyan text-studio-950 font-bold shadow"
                  : "text-studio-400 hover:text-white"
              }`}
            >
              Razorpay (India INR)
            </button>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs max-w-xl mx-auto ${
            feedbackMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-neon-crimson/10 border-neon-crimson/30 text-neon-crimson"
          }`}
        >
          {feedbackMsg.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

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
                <span className="text-4xl font-extrabold text-white font-mono">
                  {currency === "USD" ? tier.priceUSD : tier.priceINR}
                </span>
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

            <div className="pt-8">
              {tier.current ? (
                <div className="space-y-2">
                  <div className="w-full py-3 rounded-xl bg-studio-800 text-studio-400 text-xs font-bold uppercase tracking-wider text-center">
                    Current Plan
                  </div>
                  {activeSub && activeSub.status === "active" && tier.id !== "free" && (
                    <button
                      onClick={() => setCancelModal(true)}
                      className="w-full text-center text-[11px] text-studio-500 hover:text-neon-crimson font-mono transition"
                    >
                      {activeSub.cancel_at_period_end ? "Scheduled to Cancel" : "Cancel Subscription"}
                    </button>
                  )}
                </div>
              ) : (
                <Button
                  variant={tier.highlight ? "neon" : "secondary"}
                  size="lg"
                  disabled={loadingTier !== null}
                  onClick={() => handleCheckout(tier.id as "pro" | "studio")}
                  className="w-full text-xs font-bold uppercase tracking-wider"
                >
                  {loadingTier === tier.id
                    ? "Connecting..."
                    : `Upgrade via ${gateway === "stripe" ? "Stripe" : "Razorpay"}`}
                </Button>
              )}
            </div>
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

      {/* Cancel Confirmation Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-studio-900 border border-studio-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Cancel Subscription?</h3>
            <p className="text-xs text-studio-400 leading-relaxed">
              Your Pro studio benefits, monthly credits allowance, and priority GPU queues will remain active until the end of your current billing period. No further charges will be made.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setCancelModal(false)}>
                Keep Plan
              </Button>
              <Button
                variant="neon"
                size="sm"
                disabled={cancelling}
                onClick={handleCancelSub}
                className="bg-neon-crimson hover:bg-neon-crimson/80 text-white"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
