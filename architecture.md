# Fombo Music AI — System Architecture Specification
**Document Version:** 1.0.0-PROD  
**Classification:** Core System Architecture  
**Architect:** Principal AI Audio Engineer & Systems Architect  

---

## 1. Executive Summary & Vision

**Fombo Music AI** is a production-grade, distributed AI audio creation, multitrack composition, sound engineering, and distribution platform. Built to rival the creative agility of Suno, the collaborative multitrack workflow of BandLab, and the surgical precision of modern browser-based DAWs (Digital Audio Workstations), Fombo Music AI bridges the gap between text-to-music generative AI and professional sound engineering.

### Architectural Core Tenets:
1. **Zero-Mock Truthfulness**: The system never simulates generated audio, fake completion status, synthetic billing success, or arbitrary copyright claims. Every provider interface strictly checks authentication, hardware capability, quota, and licensing parameters.
2. **Deterministic Provenance & C2PA-Standard Compliance**: Every generation logs seed provenance, model checkpoints, prompt lineage, and cryptographic hashes, generating clear provenance metadata.
3. **Dual-Tier Audio Engine**: High-performance Web Audio API DSP running on client hardware for zero-latency multitrack mixing, waveform scrubbing, trimming, and real-time panning/gain, backed by an asynchronous Python FastAPI + Celery audio worker cluster for stem separation, neural synthesis, and heavy mastering.
4. **Honest Commercial Rights Engine**: The platform calculates commercial eligibility dynamically based on the verified upstream license of the model used (e.g., CC-BY-NC vs. Apache 2.0 vs. Commercial Enterprise API), explicit training data disclaimers, and clear guidance stating that AI-generated audio is subject to evolving international copyright jurisdictions.

---

## 2. High-Level Architecture Diagram

```
+----------------------------------------------------------------------------------------------------+
|                                    CLIENT BROWSER (DESKTOP & MOBILE)                               |
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+  |
|  | Next.js App Router (React 18/19, TypeScript, Tailwind CSS, Lucide Icons)                      |  |
|  |                                                                                               |  |
|  | [Explore/Feed] [Create/Prompt Studio] [Multitrack DAW] [Lyric Lab] [Stems] [Publish] [Admin]  |  |
|  +-----------------------------------------------------------------------------------------------+  |
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+  |
|  | Web Audio API Core Engine:                                                                    |  |
|  |  * Persistent Player Graph (Gain, AnalyserNode, Convolver, Limiter)                           |  |
|  |  * Multitrack Timeline Scheduler (AudioBufferSourceNodes, ChannelSplitter, Panners)           |  |
|  |  * Real-Time Canvas Waveform Visualizer & Slicing/Fading Engine                               |  |
|  +-----------------------------------------------------------------------------------------------+  |
+--------------------------------------------------+-------------------------------------------------+
                                                   | HTTPS / WSS / SSE
                                                   v
+----------------------------------------------------------------------------------------------------+
|                               API GATEWAY & ORCHESTRATION TIER (FastAPI)                            |
|                                                                                                    |
|  * JWT Auth & RBAC (Free, Pro, Studio, Admin, Trust & Safety)                                      |
|  * Idempotency Guard (Redis-backed UUID / Hash deduplication)                                      |
|  * Token/Credit Quota Metering & Rate Limiting                                                     |
|  * Real-time SSE (Server-Sent Events) Job Streamer & WebSocket Broadcaster                         |
|  * S3/MinIO Signed URL Dispenser & Ingestion Validator                                             |
|  * Audit Trail & Moderation Scanner (Toxic text, trademark & artist imitation flags)               |
+-----------------------+----------------------------------+-----------------------------------------+
                        |                                  |
            SQLAlchemy  |                                  | Celery / Task Broker
            AsyncPool   |                                  | (Redis / Valkey)
                        v                                  v
+-----------------------------+     +---------------------------------------------------------------+
|      POSTGRESQL 15/16       |     |                 ASYNCHRONOUS WORKER CLUSTER                   |
|                             |     |                                                               |
|  * Users & Subscriptions    |     |  * Celery Audio Workers (CPU / DSP Tasks)                     |
|  * Tracks & Generations     |     |    - Waveform peak generator (JSON/Binary 8-bit zoom levels)  |
|  * Projects & Multitracks   |     |    - Normalization, LUFS metering, fade/slice rendering       |
|  * Stems & Vocal Isolations |     |    - C2PA Provenance & Watermark Injection                    |
|  * Voice Consent Records    |     +-------------------------------+-------------------------------+
|  * Playlists & Moderation   |                                     |
|  * Provenance & Audit Logs  |                                     | gRPC / REST API
+-----------------------------+                                     v
                                    +---------------------------------------------------------------+
                                    |                 SEPARATE GPU INFERENCE SERVICES               |
                                    |                                                               |
                                    |  [1] Audiocraft / MusicGen Service (Local or Remote Torch)    |
                                    |  [2] Demucs v4 / HTDemucs Stem Separation Worker              |
                                    |  [3] Text-to-Speech / Bark / ACE-Studio Voice Service         |
                                    |  [4] Provider API Adapters (Suno v3, Stability Audio)         |
                                    |  [5] Procedural Mathematical DSP Fallback (CC0 Offline Synth) |
                                    +---------------------------------------------------------------+
                                                                    |
                                                                    | Object Uploads (Signed URLs)
                                                                    v
                                    +---------------------------------------------------------------+
                                    |            OBJECT STORAGE (AWS S3 / Cloudflare R2 / MinIO)     |
                                    |                                                               |
                                    |  * Original Audio (FLAC/WAV 44.1kHz / 48kHz 24-bit)           |
                                    |  * Stream Optimized Audio (MP3 320kbps / AAC 256kbps)         |
                                    |  * Isolated Stems (/vocals.wav, /drums.wav, /bass.wav, etc.)  |
                                    |  * Artwork & Waveform Peak Binaries                           |
                                    +---------------------------------------------------------------+
```

---

## 3. Module Architecture & Responsibility Breakdown

### 3.1 Authentication & RBAC (`backend/app/api/v1/auth.py`)
- Standard JWT tokens (access token 15 min, refresh token 7 days) with HTTP-only secure cookies and Bearer header support.
- User roles: `listener`, `creator`, `pro_producer`, `studio`, `moderator`, `superadmin`.
- Session revocation via Redis denylist.
- Cryptographic password hashing using Argon2id / Bcrypt with configurable cost factors.

### 3.2 AI Music Generation Engine (`backend/app/api/v1/generation.py`)
- **Dual-Model Support**: Direct local GPU workers (Audiocraft/MusicGen Large/Melody) and Cloud Provider Adapters (Suno API proxy / Stability Audio).
- **Prompt Translation & Audio Conditioning**: Maps genre, BPM, key, mood, instrument weights, and optional reference audio embeddings into conditional latents.
- **Strict Real-world Validation**: Validates whether the chosen model supports audio-to-audio continuation, stem generation, or lyric singing. If a chosen provider lacks credentials or capabilities, the API returns a structured HTTP 422 with `UNSUPPORTED_CAPABILITY` or `CONFIGURATION_REQUIRED`.

### 3.3 Lyrics Intelligence System (`backend/app/api/v1/lyrics.py`)
- Structural generation: Generates verse, pre-chorus, chorus, bridge, and outro with metered syllable pacing and rhyming schemes (AABB, ABAB, AAAA).
- Lyric-to-audio alignment timestamping format (JSON payload compatible with karaoke visualizers and multitrack vocal clips).

### 3.4 Custom Composition Engine (`backend/app/api/v1/generation.py`)
- Fine-grained controls: Tempo (40–240 BPM), Musical Key (C Major through B Minor), Time Signature (3/4, 4/4, 6/8), Instrument Soloing/Exclusion tags (`[No Drums]`, `[Heavy 808]`, `[Acoustic Grand Piano]`).
- Seed management: Deterministic PRNG seeds allowing exact reproduction of generation attempts.

### 3.5 Audio Ingestion & Uploads (`backend/app/api/v1/uploads.py`)
- Secure signed PUT URLs for direct client-to-S3 upload (bypassing backend web worker bottlenecks).
- Strict mime-type and magic-number validation (audio/wav, audio/mpeg, audio/flac, audio/ogg, audio/mp4). Max upload limits enforced by user tier (50MB Free, 500MB Studio).

### 3.6 Background Job Processing & Real-time Telemetry (`backend/app/api/v1/jobs.py`)
- Asynchronous Celery workers backed by Redis.
- SSE (`/api/v1/jobs/{job_id}/stream`) emitting progression percentage, phase (`queued`, `analyzing`, `generating_latent`, `decoding_audio`, `generating_waveform`, `uploading_stems`, `completed`), and estimated time remaining.
- Polling fallback endpoint (`GET /api/v1/jobs/{job_id}`) with ETag caching.

### 3.7 Audio Library & Project Store (`backend/app/api/v1/library.py`)
- Hierarchical project structure: Workspace -> Project -> Version -> Multitrack Clips -> Rendered Masters.
- Search indexing across tags, lyrics, BPM, keys, and creator credits.

### 3.8 Persistent Audio Player & DSP Graph (`frontend/src/context/AudioPlayerContext.tsx`)
- Uninterrupted global audio playback persisting across page navigations.
- Audio graph: `AudioSource -> GainNode -> DynamicsCompressorNode -> AnalyserNode -> Destination`.
- Waveform scrubber with fast binary peak cache and real-time FFT visualizer (Frequency bar graph & Oscilloscope).

### 3.9 Interactive Waveform Editor (`frontend/src/components/waveforms/`)
- Canvas-based non-destructive waveform editor.
- Non-destructive trimming, slicing, punch-in, exponential fade-in/fade-out, and EBU R128 peak normalization.

### 3.10 Browser Multitrack DAW (`frontend/src/components/daw/`)
- 8-to-32 track multitrack timeline with sample-accurate Web Audio clock scheduling.
- Track channel strips: Volume fader (-inf to +6dB), Pan (-1.0 to +1.0), Mute, Solo, Record Armed.
- Real-time metronome with selectable sound fonts, tempo tap, and loop boundary constraints.

### 3.11 AI Producer Copilot (`backend/app/api/v1/ai_producer.py`)
- Harmonic and arrangement analysis: Evaluates frequency masking, dynamic range, and tonal balance.
- Recommends actionable adjustments (e.g. "Low-end clash between 808 and Kick at 65Hz", "Add 4-bar Pre-Chorus build").

### 3.12 Neural Stem Separation (`backend/app/api/v1/stems.py`)
- Integration with Demucs v4 (Hybrid Transformer): Vocals, Drums, Bass, Other.
- Generates 4 discrete synchronized multitrack audio channels ready for instant DAW import.

### 3.13 Voice Consent & Identity Governance (`backend/app/api/v1/voice_consent.py`)
- Mandatory verification workflow for custom voice cloning or conditioning.
- Audio liveness challenge (reading randomly generated phoneme sentences).
- Explicit anti-impersonation terms and cryptographic consent timestamping.

### 3.14 Artist Profiles & Social Graph (`backend/app/api/v1/profiles.py`)
- Customizable public artist handle, banner, verified badges, bio, featured release showcase, and follower relations.

### 3.15 Playlists & Curation (`backend/app/api/v1/playlists.py`)
- Public, unlisted, and collaborative playlists with drag-and-drop sequencing.

### 3.16 Publishing & Master Distribution (`backend/app/api/v1/publishing.py`)
- Master release pipeline: Metadata packaging (ISRC generation, Songwriter credits, Genre tags, Explicit flag).
- Export formats: High-Resolution WAV (24-bit 48kHz), MP3 320kbps, and Stem ZIP archive.

### 3.17 Provenance, Watermarking & Rights Registry (`backend/app/api/v1/provenance.py`)
- C2PA-compliant JSON manifest generator linking original user, model version, generation timestamp, prompt hash, and parent stem IDs.
- Deterministic Commercial Rights Assessment:
  - Free Tier + Open/NC model: "Personal / Non-Commercial Use Only"
  - Pro Tier + Apache 2.0 / Commercial API: "Commercial Rights Granted under Provider License"
  - Mandatory Disclaimer: *"AI-generated output does not guarantee exclusive copyright ownership under USCO and international copyright doctrines. Users are responsible for verifying non-infringement against third-party protected melodies."*

### 3.18 Subscriptions, Quota Accounting & Idempotency (`backend/app/api/v1/subscriptions.py`)
- Credit balance ledger with atomic transactions (`SELECT FOR UPDATE` or Redis transactional decr).
- Tier configurations: Free (50 credits/mo), Pro (500 credits/mo), Studio (2,500 credits/mo + priority GPU queues).
- Idempotency-Key header on all generation requests to prevent double-spending on network retries.

### 3.19 Trust, Safety & Content Moderation (`backend/app/api/v1/admin.py`)
- Automated regex & LLM moderation filters for hate speech, child safety, non-consensual deepfakes, and known celebrity artist names.
- Moderator dashboard with manual override, quarantine, DMCA takedown notice logging, and audit logs.

---

## 4. Scalability, Latency & Storage Topology

1. **Storage Optimization**:
   - Audio is ingested via direct pre-signed S3 URLs.
   - Raw masters stored as lossless FLAC or WAV; streaming masters transcoded to optimized VBR MP3 and HLS audio segments with CDN caching (Cloudflare / CloudFront).
2. **GPU Scheduling**:
   - Long-running inference tasks are decoupled from API HTTP threads via Celery task queues.
   - Priority queues: `celery_high` (Studio tier), `celery_default` (Pro tier), `celery_batch` (Free tier).
3. **Audio Streaming Latency**:
   - Persistent player uses partial range requests (`Range: bytes=0-`) to start streaming within <150ms.
4. **Data Isolation**:
   - Multi-tenant architecture with Row-Level Security (RLS) patterns in PostgreSQL ensuring users only access their unreleased assets.
