# Fombo Music AI — Implementation Plan & Phase Roadmap
**Document Version:** 1.0.0-PROD  
**Status:** In Progress — Phase 1 Active  

---

## 1. Overview & Phased Strategy

Fombo Music AI is executed across 6 structured, verifiable phases. Each phase culminates in concrete, working code, automated test coverage, and verifiable UI workflows.

---

## 2. Phase Breakdown

### Phase 1: Core Foundation, Authentication, Schemas & Audio Infrastructure (CURRENT PHASE)
- **Goal**: Establish the repository foundation, Next.js frontend shell, FastAPI backend, PostgreSQL schemas, storage abstraction, authentication/authorization, and basic audio processing utilities.
- **Key Deliverables**:
  - Full project structure: `backend/` and `frontend/` workspaces.
  - Environment specification (`.env.example`) and configuration management.
  - Core database models: Users, Tracks, Stems, Jobs, Subscriptions, Audit Logs, Provenance records.
  - JWT Authentication, Argon2 password hashing, registration, login, and profile endpoints.
  - S3 / Local storage service with pre-signed PUT/GET URL generation.
  - Audio DSP utilities: WAV header parsing, 16-bit PCM conversion, peak waveform extraction.
  - Next.js 14/15 App Router shell with dark-themed UI design system (Tailwind + custom studio theme).
  - Global Audio Player Context with persistent playback bar and Web Audio API node graph.
  - Unit tests verifying auth, storage, database sessions, and audio utility functions.

### Phase 2: Generation Engine, Provider Integrations & Background Jobs
- **Goal**: Implement the AI music creation pipeline, provider adapters, Celery asynchronous queue, and real-time SSE progress streaming.
- **Key Deliverables**:
  - Model Provider Abstraction: `BaseMusicProvider` interface.
  - Providers:
    1. `AudiocraftProvider` (MusicGen local/remote inference adapter)
    2. `SunoProvider` (Suno API adapter with strict capability negotiation)
    3. `StabilityAudioProvider` (Stability Audio API adapter)
    4. `ProceduralAudioSynthesizer` (Deterministic mathematical DSP polyphonic synth for zero-dependency offline generation with real playable WAV audio)
  - Celery task pipeline: `generate_audio_task`, audio transcoding, peak generation, and S3 upload.
  - Real-time Server-Sent Events (SSE) `/api/v1/jobs/{job_id}/stream`.
  - Frontend Create Studio: Prompt builder, style tags, key/tempo selectors, duration sliders, model picker, and real-time generation progress monitor.
  - Comprehensive tests for provider selection, validation, error handling, and job progression.

### Phase 3: Lyrics Lab, Custom Composition & Audio-to-Audio Conditioning
- **Goal**: Implement structural lyric songwriting, rhyming analysis, voice consent, and audio reference conditioning.
- **Key Deliverables**:
  - Lyrics Generation & Rhyme Engine (`backend/app/api/v1/lyrics.py`): Syllable counter, rhyme scheme evaluator, structure tags (`[Verse]`, `[Chorus]`, `[Drop]`).
  - Voice Consent & Verification System: Identity verification, phoneme challenge recording, anti-deepfake disclaimer, and signed consent audit record.
  - Audio reference ingestion (Audio-to-Audio / Melody conditioning) with signed upload validation.
  - Frontend Lyrics Lab with synchronized karaoke playback markers.

### Phase 4: Stem Separation, Audio Editor & Waveform Manipulation
- **Goal**: Implement Demucs stem separation and client-side waveform editing tools.
- **Key Deliverables**:
  - Stem Separation pipeline: Demucs v4 worker integration (vocals, drums, bass, other stems).
  - Backend stem job runner with 4-track isolation packaging.
  - Interactive Web Audio Waveform Canvas: Trimming, slicing, region selection, volume envelope (fade in/out), normalization.
  - Frontend Stem Isolation Studio: Visual 4-stem mixer with individual stem downloads and DAW export.

### Phase 5: Multitrack Browser DAW & AI Producer Copilot
- **Goal**: Build the flagship browser-based multitrack Digital Audio Workstation and AI arrangement assistant.
- **Key Deliverables**:
  - Multitrack Web Audio Engine: Sample-accurate scheduling, multi-buffer playback, master limiter.
  - Channel Strip controls: Volume fader, Pan, Solo, Mute, Track Arming, FX bus.
  - Arrangement Timeline: Drag-and-drop audio clips, snap-to-grid (1/4, 1/8, 1/16 beat), loop points, metronome.
  - AI Producer Copilot: Spectral balance analysis, arrangement suggestions, genre translation, EQ tips.
  - Export to multi-track stem package or mixed master WAV.

### Phase 6: Provenance, Publishing, Subscriptions, Admin & Trust/Safety
- **Goal**: Finalize commercial rights engine, C2PA provenance, public release workflows, payment/quota metering, and moderation suite.
- **Key Deliverables**:
  - C2PA-compliant Provenance manifest builder with SHA-256 asset hashing and seed lineage.
  - Dynamic Commercial Rights Evaluator (Honest model license check + non-guarantee disclaimer).
  - Release publisher: Artwork upload, metadata packaging, ISRC generator, public streaming player.
  - Quota management & Idempotency: Atomic credit deduction, tier enforcement.
  - Trust & Safety Moderation Dashboard: Prompt scanning, DMCA takedown tools, banned keywords, audit logs.
  - End-to-end integration tests and user acceptance verification.

---

## 3. Immediate Milestone: Phase 1 Execution
1. Create `backend/` with FastAPI application, SQLAlchemy models, Pydantic v2 schemas, JWT security, and audio DSP engine.
2. Create SQLite / PostgreSQL compatible database configuration for effortless testing and production deployments.
3. Build S3 & local file storage provider with signed URL emulation for local dev.
4. Create `frontend/` with Next.js 14 App Router, modern dark studio theme, persistent Web Audio player, and responsive navigation.
5. Write and execute test suite covering authentication, database models, audio utilities, and API endpoints.
6. Verify local test run and report actual results.
