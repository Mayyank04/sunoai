# Fombo Music AI — Production Deployment & Operations Manual
**Document Version:** 2.0.0-PROD  
**Classification:** Infrastructure & Operations Runbook  
**Target Environments:** Cloudflare R2, Vercel, Render/Railway/ECS, RunPod/Modal, Neon/AWS RDS  

---

## 1. High-Level Production Architecture & Topology

```
                                    +-------------------------------------------------------------+
                                    |                      CLIENT BROWSERS                        |
                                    |              (Desktop Chrome/Safari, Mobile iOS/Android)    |
                                    +------------------------------+------------------------------+
                                                                   |
                                          +------------------------+------------------------+
                                          | HTTPS / DNS (Cloudflare / Custom Domain)        |
                                          v                                                 v
                      +---------------------------------------+         +---------------------------------------+
                      |          VERCEL EDGE NETWORK          |         |       FASTAPI API GATEWAY (ECS/Render)|
                      |                                       |         |                                       |
                      |  * Next.js 14 App Router (React 18)   |         |  * Python 3.12 / FastAPI Async Core   |
                      |  * Static SSR & Edge Route Bundles    |         |  * JWT Auth & Role Access Guard       |
                      |  * Web Audio DAW Client DSP Engine    |         |  * Rate Limiter (Redis Token Bucket)  |
                      |  * Persistent Player Canvas Engine    |         |  * Stripe & Razorpay Webhooks (HMAC)  |
                      |  * C2PA Provenance Inspector          |         |  * SSE Real-time Job Streamer         |
                      +---------------------------------------+         +-------------------+-------------------+
                                                                                            |
                                            +-----------------------------------------------+-----------------------------------------------+
                                            |                                               |                                               |
                                            v                                               v                                               v
                          +-----------------------------------+           +-----------------------------------+           +-----------------------------------+
                          |      MANAGED POSTGRESQL 16        |           |       REDIS 7 BROKER & CACHE      |           |     CLOUDFLARE R2 / AWS S3        |
                          |     (Neon / AWS RDS Aurora)       |           |   (Upstash / AWS ElastiCache)     |           |                                   |
                          |                                   |           |                                   |           |  * Lossless Master Audio (FLAC)   |
                          |  * Relational Schema & Indices    |           |  * Celery Message Broker & Backend|           |  * Streaming Master Audio (MP3)   |
                          |  * Transactional Credit Ledgers   |           |  * Idempotency Cache (24h TTL)    |           |  * Isolated Stems (/vocals.wav)   |
                          |  * Provenance & Audit Logs        |           |  * Distributed Rate Limiting      |           |  * Cover Artwork & Waveform Peaks |
                          |  * Automated Daily Backups + PITR |           |  * Session Revocation Denylist    |           |  * Pre-signed Direct Upload URLs  |
                          +-----------------------------------+           +-----------------+-----------------+           +-----------------------------------+
                                                                                            |
                                                                                            | Task Dispatch
                                                                                            v
                                                                          +-----------------------------------+
                                                                          |    CELERY WORKER CLUSTER (CPU)    |
                                                                          |                                   |
                                                                          |  * Queue: generation              |
                                                                          |  * Queue: stems                   |
                                                                          |  * Queue: audio_processing        |
                                                                          |  * Queue: cleanup (Celery Beat)   |
                                                                          +-----------------+-----------------+
                                                                                            |
                                                                                            | gRPC / REST API
                                                                                            v
                                                                          +-----------------------------------+
                                                                          |    GPU INFERENCE WORKERS (CLOUD)  |
                                                                          |     (RunPod Serverless / Modal)   |
                                                                          |                                   |
                                                                          |  [1] Audiocraft / MusicGen Large  |
                                                                          |  [2] Demucs v4 4-Stem Separation  |
                                                                          |  [3] Text-to-Speech / ACE-Studio  |
                                                                          |  [4] Cloud Proxies (Suno v3, Stab)|
                                                                          +-----------------------------------+
```

---

## 2. Infrastructure Component Mapping

| Tier | Recommended Platform | Primary Role | High Availability / SLA |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | Vercel Pro | Next.js 14 App Router, Web Audio DAW, Edge CDN caching | 99.99% Global Edge |
| **API Gateway** | Render / Railway / AWS ECS Fargate | FastAPI asynchronous REST endpoints, SSE streams, Webhook ingestion | Multi-AZ Auto-Scaling |
| **Task Broker & Cache** | Upstash Redis / AWS ElastiCache | Celery task queues, Idempotency keys, Token bucket rate limiting | AOF persistence, 99.99% |
| **Worker Cluster** | Render Private Services / AWS ECS | FFmpeg audio normalization, peak extraction, C2PA manifest hashing | Auto-restart on failure |
| **GPU Inference** | RunPod Serverless / Modal / AWS EC2 G5 | Audiocraft MusicGen, Demucs v4 separation, neural voice models | Cold-start < 4s, On-demand GPU |
| **Database** | Neon Postgres / AWS Aurora Serverless | User accounts, transactions, tracks, provenance, subscriptions | Point-In-Time-Recovery (PITR) |
| **Object Storage** | Cloudflare R2 / AWS S3 | Audio masters, stems, waveform cache, album covers | 99.999999999% durability, $0 egress |

---

## 3. Environment Variable & Secrets Dictionary

### 3.1 Core API & App Runtime
| Variable | Required | Default | Scope | Description |
| :--- | :--- | :--- | :--- | :--- |
| `APP_ENV` | Yes | `production` | Backend | Runtime profile (`development`, `staging`, `production`). |
| `DEBUG` | Yes | `false` | Backend | Enable/disable interactive traceback debugger (Must be `false` in prod). |
| `SECRET_KEY` | Yes | — | Backend | Cryptographic 256-bit secret used for HMAC-SHA256 JWT access token signatures. |
| `ALGORITHM` | No | `HS256` | Backend | JWT signature algorithm. |
| `ALLOWED_ORIGINS` | Yes | `["https://fombomusic.ai"]` | Backend | CORS origins allowed to access the API. |

### 3.2 Database & Storage
| Variable | Required | Default | Scope | Description |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Yes | — | Backend | PostgreSQL async connection string (`postgresql+asyncpg://...`). |
| `SYNC_DATABASE_URL` | Yes | — | Backend | PostgreSQL sync connection string for Alembic migrations. |
| `REDIS_URL` | Yes | — | Backend | Redis URI for caching, token bucket rate limits, and Celery broker. |
| `STORAGE_BACKEND` | Yes | `r2` | Backend | Object storage provider (`r2`, `s3`, `local`). |
| `S3_ENDPOINT_URL` | Yes | — | Backend | S3/R2 Endpoint URL (`https://<account_id>.r2.cloudflarestorage.com`). |
| `S3_BUCKET_NAME` | Yes | `fombo-music-prod`| Backend | Target bucket name. |
| `S3_ACCESS_KEY_ID` | Yes | — | Backend | Storage Access Key ID. |
| `S3_SECRET_ACCESS_KEY`| Yes | — | Backend | Storage Secret Access Key. |

### 3.3 Payments & Gateways
| Variable | Required | Default | Scope | Description |
| :--- | :--- | :--- | :--- | :--- |
| `STRIPE_SECRET_KEY` | Yes | — | Backend | Stripe API Secret Key (`sk_live_...`). |
| `STRIPE_WEBHOOK_SECRET`| Yes | — | Backend | Stripe Webhook HMAC Signing Secret (`whsec_...`). |
| `RAZORPAY_KEY_ID` | Yes | — | Backend | Razorpay Public Key Identifier (`rzp_live_...`). |
| `RAZORPAY_KEY_SECRET` | Yes | — | Backend | Razorpay API Secret Key. |
| `RAZORPAY_WEBHOOK_SECRET`| Yes | — | Backend | Razorpay Webhook HMAC secret for signature verification. |

### 3.4 AI Inference Services (Separate GPU Platform)
| Variable | Required | Default | Scope | Description |
| :--- | :--- | :--- | :--- | :--- |
| `ENABLE_PROCEDURAL_SYNTH` | Yes | `true` | Backend | Always available CC0 polyphonic mathematical synth fallback. |
| `AUDIOCRAFT_SERVICE_URL` | Optional | — | Backend | URL of dedicated MusicGen GPU endpoint (RunPod/Modal). |
| `DEMUCS_SERVICE_URL` | Optional | — | Backend | URL of Demucs v4 4-stem separation worker. |
| `SUNO_API_URL` | Optional | — | Backend | Upstream Suno API proxy endpoint. |
| `SUNO_API_KEY` | Optional | — | Backend | Upstream Suno API Bearer authentication token. |
| `STABILITY_API_KEY` | Optional | — | Backend | Stability Audio API Key. |

### 3.5 Frontend Web App (Next.js)
| Variable | Required | Default | Scope | Description |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Yes | `https://api.fombomusic.ai/api/v1` | Frontend | Base URL for FastAPI backend endpoints. |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | — | Frontend | Supabase project URL for authentication. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | — | Frontend | Supabase public anonymous client key. |

---

## 4. Step-by-Step Deployment Guide

### Phase 1: Database Provisioning & Migrations
1. Provision a PostgreSQL 16 database instance on Neon or AWS RDS.
2. Ensure connection pooling is configured (PgBouncer with transaction-mode pooling or Neon pooler).
3. Run Alembic database migrations from the deployment pipeline or bastion:
   ```bash
   cd backend
   alembic upgrade head
   ```

### Phase 2: Cloudflare R2 Object Storage Configuration
1. Create a Cloudflare R2 bucket: `fombo-music-prod`.
2. Configure bucket CORS policy:
   ```json
   [
     {
       "AllowedOrigins": ["https://fombomusic.ai", "https://*.vercel.app"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag", "Content-Range", "Accept-Ranges", "Content-Length"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. Issue an R2 API Token with **Object Read & Write** permissions scoped to `fombo-music-prod`.

### Phase 3: Redis & Worker Cluster Deployment
1. Deploy Redis 7 on Upstash or AWS ElastiCache. Ensure `appendonly yes` persistence is enabled.
2. Deploy the backend API container (`backend/Dockerfile`):
   ```bash
   docker build -t fombo-backend:prod -f backend/Dockerfile .
   docker run -d -p 8000:8000 --env-file .env.production fombo-backend:prod
   ```
3. Deploy Celery Workers with partitioned queues:
   ```bash
   # Generation Worker:
   celery -A backend.app.core.celery_app.celery_app worker -l info -Q generation -c 4

   # Stems & Audio Processing Worker:
   celery -A backend.app.core.celery_app.celery_app worker -l info -Q stems,audio_processing -c 2

   # Periodic Beat Scheduler:
   celery -A backend.app.core.celery_app.celery_app beat -l info
   ```

### Phase 4: GPU Inference Deployment (RunPod Serverless / Modal)
1. Deploy Audiocraft MusicGen container to RunPod Serverless with an NVIDIA A10G / A100 template.
2. Set `AUDIOCRAFT_SERVICE_URL=https://api.runpod.ai/v2/<endpoint_id>/runsync` in backend environment.
3. Deploy Demucs v4 HTDemucs container to RunPod Serverless.
4. Set `DEMUCS_SERVICE_URL=https://api.runpod.ai/v2/<demucs_id>/runsync` in backend environment.

### Phase 5: Next.js Frontend Deployment to Vercel
1. Link GitHub repository to Vercel.
2. Framework preset: **Next.js**.
3. Root directory: `frontend`.
4. Build command: `npm run build`.
5. Output directory: `.next`.
6. Inject Environment Variables:
   - `NEXT_PUBLIC_API_URL=https://api.fombomusic.ai/api/v1`
7. Enable Vercel Web Analytics and Speed Insights.

---

## 5. Security & Defense-in-Depth Verification

- **CORS Protection**: Restricted to verified domain `https://fombomusic.ai`. Credentials permitted only for secure origins.
- **SSRF Mitigation**: Outbound reference audio fetches validate that target hostnames do not resolve to loopback (`127.0.0.1`), link-local metadata services (`169.254.169.254`), or private subnet blocks.
- **Stored XSS Sanitization**: User comments, track titles, lyrics, and bios are stripped of dangerous HTML `<script>` and `<iframe>` tags via `sanitize_user_input()`.
- **SQL Injection Prevention**: All database interactions use SQLAlchemy 2.0 parameterized queries with async transactions. No raw string interpolation is permitted.
- **Upload Constraints**: Enforces 50MB audio limit, 5MB image limit, MIME sniffing, magic byte verification, and threat scanning for disguised binaries.
- **Webhook Replay Protection**: Stripe and Razorpay webhook events verify cryptographic HMAC-SHA256 signatures and register event IDs in the `webhook_events` table to reject duplicate replays.

---

## 6. Observability, Telemetry & Cost Alerts

1. **Health Diagnostic Gate**:
   - `GET /api/v1/health` checks:
     - PostgreSQL database query latency (`SELECT 1`)
     - Redis cluster ping response
     - Object storage directory/bucket accessibility
     - Configured AI model providers availability count
2. **GPU Cost & Quota Monitoring**:
   - Admin telemetry endpoint `GET /api/v1/admin/gpu-costs` computes real-time GPU runtime seconds, hardware profile tier (A10G, T4, A100), and dollar burn rates.
   - Automated alerts fire if hourly GPU spend exceeds the $25/hr budget threshold.
3. **Error Tracking with Sentry**:
   - Sentry DSN configured in backend (`SENTRY_DSN`) and frontend (`NEXT_PUBLIC_SENTRY_DSN`).
   - Breadcrumbs trace user audio actions, DSP operations, and inference job state changes.

---

## 7. Operational Runbooks & Disaster Recovery

### Runbook A: Automated Backups & Point-In-Time-Recovery (PITR)
- **Continuous Archiving**: Neon/AWS Aurora maintains WAL archives continuously, providing point-in-time restore within a 14-day retention window.
- **Automated Daily Dump**: Celery Beat schedules an encrypted database export to Cloudflare R2 cold storage at `03:00 UTC` daily.
- **Restore Procedure**:
  ```bash
  # Restore database from snapshot dump
  pg_restore -h <db_host> -U <db_user> -d fombo_music -c --if-exists /backups/fombo_daily_backup.dump
  ```

### Runbook B: Queue Congestion & Retry Storm Mitigation
- If inference queue exceeds 500 queued jobs:
  1. Inspect Celery worker count: `celery -A backend.app.core.celery_app inspect active`
  2. Increase worker concurrency or trigger auto-scaling on ECS/Render.
  3. Purge dead-letter queues if downstream third-party provider is experiencing upstream outage:
     `celery -A backend.app.core.celery_app purge -Q generation`

### Runbook C: Secret & Credential Rotation
1. Generate new 256-bit secret: `openssl rand -hex 32`.
2. Update `SECRET_KEY` in environment management (Doppler / Vercel / Render).
3. Trigger rolling restart of FastAPI backend services. Active JWT tokens will prompt users to re-authenticate seamlessly upon refresh.
