# Fombo Music AI — Feature & Capability Matrix
**Document Version:** 1.0.0-PROD  

---

## 1. System Feature Matrix Across Subscription Tiers

| Module / Capability | Free Tier | Pro Tier ($19/mo) | Studio Tier ($49/mo) | Admin / Mod |
| :--- | :--- | :--- | :--- | :--- |
| **Monthly Generation Credits** | 50 credits (~10 songs) | 500 credits (~100 songs) | 2,500 credits (~500 songs) | Unlimited |
| **Generation Queue Priority** | Standard Batch Queue | Priority Worker Queue | Dedicated High-Priority GPU | Instant Execution |
| **Max Track Duration** | Up to 1:00 min | Up to 3:00 min | Up to 5:00 min (Full track) | No limit |
| **Audio Output Quality** | MP3 192kbps | MP3 320kbps + WAV 16-bit | WAV 24-bit 48kHz + FLAC | All formats |
| **Model Selection** | Procedural + MusicGen Small | MusicGen Medium + Suno Adapter | MusicGen Large + Suno + Custom | All Models |
| **Audio-to-Audio Conditioning** | ❌ Disabled | ✅ Enabled (1 reference track) | ✅ Enabled (Multi-stem ref) | ✅ Enabled |
| **Stem Separation (Demucs)** | 2 stems (Vocals + Music) | 4 stems (Vocals, Drums, Bass, Other) | 4 stems + Lossless Stems Export | Full Access |
| **Multitrack Browser DAW** | 4 Tracks Max | 16 Tracks Max | 32 Tracks + Unlimited Bus FX | Full Access |
| **AI Producer Copilot** | Basic Suggestions | Full Dynamic & Mix Analysis | Mastering & Harmonic Arrangement | Full Suite |
| **Voice Cloning / Conditioning**| ❌ Disabled | ✅ With Voice Consent Challenge | ✅ Custom Model Fine-tuning | Override / Audit |
| **Commercial Use Rights** | Non-Commercial / CC-BY-NC | Commercial (Eligible Models) | Commercial (Full Commercial) | Internal Review |
| **C2PA Provenance Manifest** | Read-Only Viewer | Exportable JSON Manifest | Cryptographically Signed Manifest| Cryptographic Audit |
| **Master Publishing & ISRC** | Public Community Feed | Direct Distribution Metadata | ISRC Auto-gen + Distribution Pkg | Catalog Oversight |
| **API / Webhook Access** | ❌ No | ❌ No | ✅ REST API & Webhooks | Full SuperAdmin |
| **Simultaneous Jobs** | 1 active job | 3 active jobs | 10 active jobs | No restriction |

---

## 2. AI Audio Provider Capability Matrix

| Provider / Adapter | Text-to-Audio | Audio-to-Audio | Stem Generation | Singing Lyrics | Commercial License | Local / Cloud | Required Credentials |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Fombo Procedural Synth** | ✅ Polyphonic DSP | ❌ No | ✅ Synthetic Stems | ❌ Chords/Melody only | ✅ CC0 / Free Public Domain | Local (Zero-Dependency) | None (Always Available) |
| **Audiocraft / MusicGen** | ✅ Full High-Fidelity | ✅ Melody Conditioning| ❌ Single Stereo Master | ❌ Instrumental Only | Model-dependent (NC vs MIT) | Local GPU / Remote Torch | `AUDIOCRAFT_SERVICE_URL` |
| **Suno API Adapter** | ✅ Full Vocal & Song | ✅ Audio Extension | ✅ Stems (v3.5) | ✅ High-Fidelity Singing | Provider Terms (Pro required) | Cloud API Proxy | `SUNO_API_KEY`, `SUNO_API_URL` |
| **Stability Audio Adapter** | ✅ Stereo Soundscapes | ✅ Audio Inpainting | ❌ Stereo Master | ❌ Instrumental | Commercial with API license | Cloud API Proxy | `STABILITY_API_KEY` |
| **Demucs v4 Stem Worker** | ❌ Inversion only | ❌ Inversion only | ✅ 4 Discrete Stems | ❌ Extraction Only | MIT License (Separation tool) | Local Worker / Remote GPU | `DEMUCS_SERVICE_URL` |
| **Bark / ACE-Studio Voice**| ❌ Speech/Vocal only | ✅ Pitch Conditioning | ✅ Monophonic Vocal Stem | ✅ Syllable Phoneme Singing| Apache 2.0 / Commercial | Local / Remote Worker | `VOICE_SERVICE_URL` |

> **Strict Truthfulness Policy**: If a user selects a cloud or GPU provider for which the backend lacks valid credentials or healthy network connectivity, the system **never** substitutes a placeholder or mocks success. It presents an explicit configuration error with details on missing environment variables or offline workers.

---

## 3. Commercial Rights & Provenance Matrix

| Tier & Source Asset | Declared License | Commercial Rights Eligibility | Legal Protection Disclaimer |
| :--- | :--- | :--- | :--- |
| **Free Tier + Any AI Model** | Creative Commons Attribution-NonCommercial (CC-BY-NC 4.0) | **NO** — Personal & Non-commercial testing only. | AI output does not convey copyright ownership. |
| **Pro/Studio + Open-Source Apache 2.0 Model** | Apache 2.0 Output Grant | **YES** — Permitted for streaming, commercial sync, and monetized videos subject to terms. | AI-generated audio lacks human authorship under USCO; ownership of raw latent is not guaranteed. |
| **Pro/Studio + Proprietary API** | Provider Commercial License | **YES** — Subject to upstream provider enterprise service agreement. | Platform verifies user subscription tier at generation time. |
| **Uploaded Sample / Stems** | User-Attested Ownership | Governed by user's original license. | User warrants rights to all uploaded references. |
| **Voice Cloned Vocal Track** | Explicit Consent Bound | Only with cryptographically signed consent token. | Voice imitation of third-party artists strictly prohibited. |
