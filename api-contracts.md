# Fombo Music AI — REST & Real-Time API Contracts
**API Version:** `v1`  
**Base URL:** `/api/v1`  
**Spec Format:** OpenAPI 3.1 compatible  

---

## 1. Authentication & Security Headers

All protected endpoints require either:
- Header: `Authorization: Bearer <jwt_access_token>`
- Or an HTTP-only secure session cookie `fombo_access_token`.

All mutating requests (generation, stem separation, billing, publishing) accept an optional or required:
- Header: `Idempotency-Key: <uuid-v4>`

---

## 2. API Endpoints Specification

### 2.1 Authentication Module (`/auth`)

#### `POST /auth/register`
Creates a new creator account with complimentary Free Tier credits (50 credits).
```json
// Request Body
{
  "email": "producer@example.com",
  "username": "soundweaver",
  "password": "SecurePassword123!",
  "full_name": "Sound Weaver"
}

// Response 201 Created
{
  "user": {
    "id": "c3b9b4f4-5264-4e9b-9c3f-c689d0e65f3a",
    "email": "producer@example.com",
    "username": "soundweaver",
    "role": "creator",
    "credits_balance": 50,
    "created_at": "2026-10-25T14:00:00Z"
  },
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer"
}
```

#### `POST /auth/login`
Authenticates credentials and returns JWT bearer tokens.

#### `GET /auth/me`
Retrieves current authenticated user profile, active subscription tier, and current credit balance.

---

### 2.2 AI Music Generation Module (`/generation`)

#### `POST /generation/create`
Submits an AI music generation job. Deducts credits atomically.
```json
// Headers
// Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d

// Request Body
{
  "prompt": "80s synthwave anthem with gated snare, warm analog arpeggio, neon city vibes",
  "negative_prompt": "acoustic guitar, lo-fi distortion, noise",
  "genre": "Synthwave",
  "style_tags": ["synthwave", "retrowave", "analog", "80s"],
  "bpm": 128,
  "musical_key": "F Minor",
  "duration_seconds": 60,
  "provider": "fombo_procedural", // "fombo_procedural", "audiocraft", "suno", "stability"
  "model_name": "procedural-dsp-v1",
  "seed": 420912,
  "reference_audio_url": null
}

// Response 202 Accepted
{
  "job_id": "job_gen_8b72e12a4f6d",
  "status": "queued",
  "provider": "fombo_procedural",
  "model_name": "procedural-dsp-v1",
  "credits_deducted": 5,
  "remaining_balance": 45,
  "stream_url": "/api/v1/jobs/job_gen_8b72e12a4f6d/stream",
  "created_at": "2026-10-25T14:05:00Z"
}

// Error 422 Unprocessable Entity (Missing Provider Key / Unsupported)
{
  "error_code": "CONFIGURATION_REQUIRED",
  "message": "The selected provider 'audiocraft' requires AUDIOCRAFT_SERVICE_URL which is currently offline or unconfigured. Please switch to 'fombo_procedural' or configure remote GPU credentials.",
  "provider": "audiocraft"
}
```

---

### 2.3 Real-Time Background Jobs Module (`/jobs`)

#### `GET /jobs/{job_id}/stream` (Server-Sent Events SSE)
Streams live generation progress:
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: progress
data: {"job_id":"job_gen_8b72e12a4f6d","phase":"synthesizing_audio","progress_percentage":40,"eta_seconds":3}

event: progress
data: {"job_id":"job_gen_8b72e12a4f6d","phase":"generating_waveform","progress_percentage":85,"eta_seconds":1}

event: complete
data: {"job_id":"job_gen_8b72e12a4f6d","status":"completed","track_id":"3f7a812e-1b42-498c-a110-44a698d28912","audio_url":"/storage/tracks/3f7a812e.wav","duration":60.0}
```

#### `GET /jobs/{job_id}`
Standard polling endpoint returning current job status and metadata.

---

### 2.4 Lyrics Assistant Module (`/lyrics`)

#### `POST /lyrics/generate`
Generates structured verses and choruses with syllable metrics and rhyming patterns.
```json
// Request Body
{
  "topic": "Midnight driving through a rain-soaked metropolis",
  "genre": "Synthwave",
  "mood": "Nostalgic and electric",
  "structure": ["verse_1", "pre_chorus", "chorus", "verse_2", "chorus", "outro"]
}

// Response 200 OK
{
  "title": "Midnight Reflections",
  "sections": [
    {
      "section_type": "Verse 1",
      "lines": [
        {"text": "Neon reflections dancing in the street", "syllables": 11, "rhyme_tag": "A"},
        {"text": "Engine humming softly to the steady beat", "syllables": 11, "rhyme_tag": "A"},
        {"text": "Headlights cutting through the velvet haze", "syllables": 10, "rhyme_tag": "B"},
        {"text": "Lost inside this endless electric maze", "syllables": 10, "rhyme_tag": "B"}
      ]
    }
  ]
}
```

---

### 2.5 Stem Separation Module (`/stems`)

#### `POST /stems/separate`
Separates an existing track into discrete stem tracks (Vocals, Drums, Bass, Other).
```json
// Request Body
{
  "track_id": "3f7a812e-1b42-498c-a110-44a698d28912",
  "stem_model": "htdemucs_v4"
}

// Response 202 Accepted
{
  "job_id": "job_stem_99a81c12d4",
  "status": "queued",
  "track_id": "3f7a812e-1b42-498c-a110-44a698d28912",
  "stems_requested": ["vocals", "drums", "bass", "other"]
}
```

---

### 2.6 Voice Consent & Identity Governance (`/voice-consent`)

#### `POST /voice-consent/challenge`
Generates a unique dynamic phoneme challenge sentence for liveness verification.

#### `POST /voice-consent/verify`
Submits recorded audio of the user reciting the challenge sentence. Validates speaker identity and saves cryptographically signed consent.

---

### 2.7 Provenance & Commercial Rights (`/provenance`)

#### `GET /provenance/{track_id}`
Returns complete C2PA manifest, seed lineage, and license eligibility breakdown.
```json
// Response 200 OK
{
  "track_id": "3f7a812e-1b42-498c-a110-44a698d28912",
  "model_provider": "fombo_procedural",
  "model_checkpoint": "procedural-dsp-v1.0.0",
  "generation_seed": 420912,
  "input_prompt_sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
  "output_audio_sha256": "9a01fbb89382f7c00e6e7d6c69788d613e5b32bb9a51221147a46e9b407b8bca",
  "commercial_eligibility": true,
  "license_name": "Creative Commons Zero (CC0) / Public Domain Algorithmic Synthesis",
  "disclaimer": "AI audio output does not guarantee exclusive copyright ownership. The user is responsible for clearance against third-party rights.",
  "c2pa_manifest_url": "/api/v1/provenance/3f7a812e/manifest.json"
}
```

---

### 2.8 Multitrack DAW Project Module (`/daw`)

#### `GET /daw/projects`
List all saved user DAW projects.

#### `POST /daw/projects`
Create or update a multitrack project timeline with track volumes, pan values, and clip offsets.

---

### 2.9 Object Storage Signed URLs (`/uploads`)

#### `POST /uploads/presign`
Generates secure signed PUT URLs for direct client uploads with MIME type and size enforcement.
