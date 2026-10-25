# Fombo Music AI — Relational Database Schema Specification
**Document Version:** 1.0.0-PROD  
**Target RDBMS:** PostgreSQL 15+ (SQLite compatible for rapid local test suites)  

---

## 1. Entity-Relationship Overview

```
+---------------+        1:N        +------------------+        1:N        +------------------+
|     users     |------------------>|      tracks      |------------------>|      stems       |
+---------------+                   +------------------+                   +------------------+
        |                                    |                                      |
        | 1:N                                | 1:N                                  | 1:N
        v                                    v                                      v
+---------------+                   +------------------+                   +------------------+
| subscriptions |                   |   generations    |                   |   track_stems    |
+---------------+                   +------------------+                   +------------------+
        |                                    |
        | 1:N                                | 1:1
        v                                    v
+---------------+                   +------------------+
|  credit_ledgers|                  |   provenances    |
+---------------+                   +------------------+
        |
        | 1:N
        v
+---------------+        1:N        +------------------+
|  audit_logs   |<------------------|   voice_consents |
+---------------+                   +------------------+
        |
        | 1:N
        v
+---------------+        N:M        +------------------+
|  moderations  |                   |    playlists     |
+---------------+                   +------------------+
        |                                    |
        | 1:N                                | 1:N
        v                                    v
+---------------+                   +------------------+
| daw_projects  |                   |  playlist_tracks |
+---------------+                   +------------------+
```

---

## 2. DDL Table Definitions

### 2.1 `users` Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(64) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(128),
    avatar_url TEXT,
    bio TEXT,
    role VARCHAR(32) NOT NULL DEFAULT 'creator', -- 'listener', 'creator', 'pro_producer', 'studio', 'moderator', 'admin'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    credits_balance INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
```

### 2.2 `subscriptions` Table
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(32) NOT NULL DEFAULT 'free', -- 'free', 'pro', 'studio'
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'past_due', 'canceled', 'trialing'
    monthly_credit_allowance INTEGER NOT NULL DEFAULT 50,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    stripe_customer_id VARCHAR(128),
    stripe_subscription_id VARCHAR(128) UNIQUE,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
```

### 2.3 `credit_ledgers` (Atomic Quota Accounting) Table
```sql
CREATE TABLE credit_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- negative for deduction, positive for top-up
    balance_after INTEGER NOT NULL,
    transaction_type VARCHAR(64) NOT NULL, -- 'generation', 'stem_separation', 'monthly_renewal', 'refund', 'topup'
    reference_id VARCHAR(128), -- job_id, stripe_invoice_id, or track_id
    idempotency_key VARCHAR(128) UNIQUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledgers_user ON credit_ledgers(user_id);
CREATE INDEX idx_credit_ledgers_idempotency ON credit_ledgers(idempotency_key);
```

### 2.4 `tracks` Table
```sql
CREATE TABLE tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    genre VARCHAR(64),
    style_tags TEXT[], -- array of tags: ['synthwave', '80s', 'neon', 'analog drums']
    mood VARCHAR(64),
    bpm INTEGER,
    musical_key VARCHAR(16),
    time_signature VARCHAR(8) DEFAULT '4/4',
    duration_seconds FLOAT NOT NULL DEFAULT 0.0,
    audio_url TEXT NOT NULL,
    lossless_url TEXT,
    waveform_data JSONB, -- Array of normalized peak values [0..100] for waveform rendering
    cover_image_url TEXT,
    lyrics TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    play_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMP WITH TIME ZONE,
    isrc VARCHAR(32) UNIQUE,
    commercial_rights_status VARCHAR(64) NOT NULL DEFAULT 'non_commercial_personal', -- 'commercial_granted', 'non_commercial_personal', 'restricted'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracks_user ON tracks(user_id);
CREATE INDEX idx_tracks_public ON tracks(is_public);
CREATE INDEX idx_tracks_genre ON tracks(genre);
CREATE INDEX idx_tracks_created ON tracks(created_at DESC);
```

### 2.5 `generations` Table
```sql
CREATE TABLE generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
    job_id VARCHAR(128) UNIQUE NOT NULL,
    provider VARCHAR(64) NOT NULL, -- 'audiocraft', 'suno', 'stability', 'fombo_procedural'
    model_name VARCHAR(128) NOT NULL, -- 'musicgen-large', 'suno-v3.5', 'procedural-dsp-v1'
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    seed BIGINT NOT NULL,
    temperature FLOAT NOT NULL DEFAULT 1.0,
    top_k INTEGER DEFAULT 250,
    top_p FLOAT DEFAULT 0.0,
    duration_requested INTEGER NOT NULL,
    reference_audio_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed', 'canceled'
    progress_percentage INTEGER NOT NULL DEFAULT 0,
    error_code VARCHAR(64),
    error_message TEXT,
    credits_deducted INTEGER NOT NULL DEFAULT 5,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generations_user ON generations(user_id);
CREATE INDEX idx_generations_job ON generations(job_id);
CREATE INDEX idx_generations_status ON generations(status);
```

### 2.6 `stems` Table
```sql
CREATE TABLE stems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stem_type VARCHAR(32) NOT NULL, -- 'vocals', 'drums', 'bass', 'other', 'guitar', 'piano'
    audio_url TEXT NOT NULL,
    duration_seconds FLOAT NOT NULL,
    waveform_data JSONB,
    model_used VARCHAR(64) NOT NULL DEFAULT 'htdemucs_v4',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stems_track ON stems(track_id);
```

### 2.7 `provenances` (C2PA & Rights Integrity) Table
```sql
CREATE TABLE provenances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID UNIQUE NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    generation_id UUID REFERENCES generations(id) ON DELETE SET NULL,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_provider VARCHAR(64) NOT NULL,
    model_checkpoint_hash VARCHAR(128),
    generation_seed BIGINT NOT NULL,
    input_prompt_hash VARCHAR(64) NOT NULL, -- SHA-256 of prompt
    output_audio_sha256 VARCHAR(64) NOT NULL,
    c2pa_manifest JSONB NOT NULL,
    license_type VARCHAR(64) NOT NULL,
    commercial_eligibility BOOLEAN NOT NULL,
    disclaimer TEXT NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provenance_track ON provenances(track_id);
CREATE INDEX idx_provenance_audio_hash ON provenances(output_audio_sha256);
```

### 2.8 `voice_consents` (Anti-Deepfake Governance) Table
```sql
CREATE TABLE voice_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    voice_label VARCHAR(128) NOT NULL,
    consent_statement TEXT NOT NULL,
    liveness_phrase_read TEXT NOT NULL,
    liveness_audio_url TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'verified', -- 'pending', 'verified', 'revoked', 'rejected'
    signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_voice_consents_user ON voice_consents(user_id);
```

### 2.9 `daw_projects` & `daw_tracks` Table
```sql
CREATE TABLE daw_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Studio Project',
    bpm INTEGER NOT NULL DEFAULT 120,
    time_signature VARCHAR(8) NOT NULL DEFAULT '4/4',
    master_volume FLOAT NOT NULL DEFAULT 1.0,
    project_state JSONB NOT NULL, -- Complete timeline clips, automations, FX chains
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daw_projects_user ON daw_projects(user_id);
```

### 2.10 `moderations` & `audit_logs` Tables
```sql
CREATE TABLE moderations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(32) NOT NULL, -- 'track', 'prompt', 'voice_consent', 'comment'
    target_id VARCHAR(128) NOT NULL,
    flagged_reason VARCHAR(64) NOT NULL, -- 'celebrity_name', 'hate_speech', 'copyright_claim', 'violence'
    flagged_text TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'quarantined', 'approved', 'rejected'
    moderator_id UUID REFERENCES users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128),
    ip_address VARCHAR(45),
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```
