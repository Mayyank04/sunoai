# Fombo Music AI — Professional AI Music Creation Platform

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python: 3.12](https://img.shields.io/badge/Python-3.12-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js: 14](https://img.shields.io/badge/Next.js-14_App_Router-black.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript: 5](https://img.shields.io/badge/TypeScript-5.4-3178C6.svg?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tests: 110 passed](https://img.shields.io/badge/Tests-110_passed-success.svg)](https://github.com/Mayyank04/sunoai)

---

## 1. Overview & Architectural Vision

**Fombo Music AI** is a professional, original AI music creation and multitrack sound-engineering platform. Designed from first principles to decouple browser-based creative workflows from high-performance audio inference, Fombo Music AI bridges the gap between text-to-music generation and professional digital audio workstations.

### Core Tenets:
1. **Zero-Mock Truthfulness**: The platform never simulates audio playback, fake completion states, synthetic billing success, or arbitrary copyright exclusivity. If a chosen model inference worker is offline or unconfigured, the UI clearly displays **"Generation engine not configured"**.
2. **Open-Weight Architecture**:
   - **Default Provider**: **ACE-Step 1.5** with pinned MIT-licensed checkpoints on a separate CUDA worker.
   - **HeartMuLa**: adapter placeholder, unavailable until implemented and verified.
   - **Offline Procedural DSP**: Instrumental-only mathematical synthesizer, never a vocal fallback.
   - **External Proxies**: Suno API and Stability Audio adapters.
   - **Hardware Boundary**: Never runs GPU inference inside Next.js. GPU inference runs on dedicated worker clusters (RunPod, Modal, EC2 G5).
3. **Dual-Tier Audio Engine**:
   - **Client**: Web Audio API DSP graph for real-time waveform scrubbing, multitrack mixing, channel gain, panning, metronome, and offline WAV rendering.
   - **Server**: FastAPI async orchestration + Celery/Redis worker cluster for Demucs v4 4-stem separation, FFmpeg audio transcoding, and C2PA manifest provenance hashing.
4. **Honest Commercial Rights Engine**: Dynamic commercial-use eligibility calculated based on model licensing and source asset rights declarations. Prominently displays statutory non-infringement disclaimers.

---

## 2. Directory Structure

```
├── .github/workflows/          # CI/CD Workflows (Lint, Pytest, Playwright, Deploy)
├── backend/                    # FastAPI Backend Service
│   ├── alembic/                # Database Migrations & Version Tracking
│   ├── app/
│   │   ├── api/v1/             # REST & SSE API Endpoints (Auth, Create, Library, DAW, etc.)
│   │   ├── core/               # Database, Redis, Celery, Security, Rate Limiter
│   │   ├── models/             # SQLAlchemy ORM Models (User, Track, Asset, Job, etc.)
│   │   ├── schemas/            # Pydantic Request/Response Schemas
│   │   └── services/           # Business Logic (Providers, Credit Ledger, Provenance, DSP)
│   ├── tests/                  # Pytest Unit, Integration & Security Test Suites (110+ tests)
│   ├── Dockerfile              # Multi-stage production container
│   └── requirements.txt        # Backend dependencies
├── docs/                       # Technical Documentation
│   ├── architecture.md         # System Architecture & Topology
│   ├── development.md          # Developer Guide & Setup
│   ├── model-licensing.md      # Open-Weight AI Model Licensing & Rights
│   └── phase1-acceptance.md    # Phase 1 Acceptance Verification Report
├── frontend/                   # Next.js 14 App Router Frontend
│   ├── e2e/                    # Playwright E2E Browser Test Suite (10 scenarios)
│   ├── src/
│   │   ├── app/                # App Router Routes (/, /create, /studio, /login, /signup, etc.)
│   │   ├── components/         # UI Design System, Studio DAW, Waveform Visualizer
│   │   ├── context/            # AudioPlayerContext, AuthContext
│   │   └── lib/                # API client, Audio Engine DSP, Utilities
│   ├── package.json
│   ├── playwright.config.ts
│   └── vercel.json             # Vercel Production Configuration
├── docker-compose.yml          # Local Development Services
├── docker-compose.prod.yml     # Production Multi-Container Orchestration
├── deployment.md               # Production Deployment Manual
├── feature-matrix.md           # Evidence-Based Feature & Release Matrix
└── env.example                 # Environment Variable Template
```

---

## Vocal generation setup and verification

The former `workers/ace_step/worker.py` produced procedural DSP, despite claiming ACE-Step. It has been replaced with real lyrics-conditioned neural inference, authenticated durable jobs, and readiness checks that require the actual CUDA model and pinned checkpoint. No speech or procedural substitute is used.

Follow [GPU worker setup](workers/ace_step/README.md) and the [audit and validation report](docs/vocal-generation-audit.md). This Mac currently has no configured CUDA runtime or model checkpoint; vocal generation correctly remains unavailable and does not charge credits. Audible singing has not been verified. The frontend and authentication remain in place. Development chunks use `.next-dev`, production builds use `.next`.

## 3. Quickstart Guide (Local Development on macOS)

### Prerequisites:
- macOS with Python 3.12 (`brew install python@3.12`)
- Node.js 20+ (`brew install node@20`)
- FFmpeg (`brew install ffmpeg`)
- Redis (optional for background workers, `brew install redis`)

### 3.1 Backend Setup:
```bash
# 1. Navigate to repository root
cd /Users/mayankgautam/Desktop/suno

# 2. Activate Python virtual environment
source backend/venv/bin/activate

# 3. Install dependencies
pip install -r backend/requirements.txt

# 4. Copy environment variables
cp env.example .env

# 5. Initialize Database & Run Migrations
python3 -c "import asyncio; from backend.app.core.database import init_db; asyncio.run(init_db())"
PYTHONPATH=. alembic -c backend/alembic.ini stamp head

# 6. Start FastAPI Development Server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
*API Documentation will be available at:* `http://localhost:8000/docs`

### 3.2 Frontend Setup:
```bash
# 1. In a new terminal tab, navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.local.example .env.local

# 4. Start Next.js Development Server
npm run dev
```
*Fombo Studio Web App will be available at:* `http://localhost:3000`

---

## 4. Testing & Verification Commands

### 4.1 Backend Pytest Suite (Unit, Integration & Security):
```bash
# Run all 110+ automated tests across phases 1–10
PYTHONPATH=. ./backend/venv/bin/pytest backend/tests/ -v
```

### 4.2 Frontend Typecheck & Linter:
```bash
cd frontend
# TypeScript compiler validation
npx tsc --noEmit

# ESLint audit
npm run lint

# Production Next.js build
npm run build
```

### 4.3 Playwright Browser E2E Test Suite:
```bash
cd frontend
# Execute headless browser tests across all critical user journeys
npm run test:e2e
```

---

## 5. Frontend Route Sitemap

| Route | View Description |
| :--- | :--- |
| `/` | Landing page, featured releases, studio feed |
| `/create` | AI prompt composer, instrumental toggle, model provider selector |
| `/studio` | Browser multitrack DAW timeline, channel strips, AI Copilot, Piano Roll |
| `/library` | Saved user tracks, project drafts, search filtering, track deletion |
| `/explore` | Community music catalog, trending genres, tag discovery |
| `/search` | Global search across titles, lyrics, BPM, and musical keys |
| `/playlists` | Curated public and private collaborative playlists |
| `/song/[id]` | High-resolution track master view, waveform visualizer, C2PA manifest |
| `/profile/[username]` | Public artist profile, bio, follower count, released tracks |
| `/publish` | Master publishing suite, ISRC generation, content visibility tier |
| `/pricing` | Subscription tiers (Free, Pro, Studio), dual gateway (Stripe/Razorpay) |
| `/settings` | Profile editor, avatar upload, API credentials, account privacy |
| `/login` | Dedicated sign-in page with Supabase and local JWT authentication |
| `/signup` | Dedicated creator onboarding with 50 complimentary studio credits |

---

## 6. Model Licensing & Commercial Disclaimers

- **ACE-Step 1.5**: official MIT checkpoint; bundled Qwen embedding component Apache-2.0. See [model audit](docs/vocal-generation-audit.md).
- **HeartMuLa**: Open-weight multimodal music model.
- **Demucs v4**: MIT License for 4-stem separation.
- **Statutory Non-Infringement Disclaimer**:
  > *"Commercial-use eligibility is evaluated based on model provider terms and user source asset rights declarations. Fombo Music AI does NOT guarantee copyright registration, patent validity, or immunity from third-party infringement claims under U.S. Copyright Office and global IP regulations."*

---

## 7. License

Licensed under the **Apache License, Version 2.0**.
See [LICENSE](LICENSE) for details.
