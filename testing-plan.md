# Fombo Music AI — Comprehensive Testing & Quality Assurance Plan
**Document Version:** 1.0.0-PROD  

---

## 1. Testing Philosophy & Verification Tenets

In accordance with production sound engineering standards:
1. **Zero Mockery of Audio Files**: Audio testing must verify actual byte streams, valid RIFF/WAVE header headers, correct sample rates (44100Hz/48000Hz), non-zero peak amplitudes, and proper bit depths (16-bit / 24-bit PCM).
2. **Deterministic Idempotency**: Submitting duplicate generation requests with identical `Idempotency-Key` headers must return the original job without creating duplicate credit deductions.
3. **Provider Fail-Safe Testing**: Tests must confirm that when credentials for external services (Suno, Audiocraft, Stability) are omitted, the API responds with structured `CONFIGURATION_REQUIRED` rather than crashing or faking output.
4. **License & Rights Integrity**: Tests must ensure free-tier generations are tagged non-commercial and that C2PA manifests strictly match calculated SHA-256 audio digests.

---

## 2. Test Pyramid & Directory Structure

```
backend/tests/
├── conftest.py               # Shared async fixtures, test database, auth tokens, sample WAVs
├── test_auth.py              # User registration, Argon2/JWT, role permissions, rate limits
├── test_audio_processor.py   # WAV generation, header parsing, peak extraction, normalization
├── test_storage.py           # Pre-signed URL generation, upload validation, local fallback
├── test_generation.py        # Model provider interface, procedural synth, capability errors
├── test_lyrics.py            # Rhyme scheme validation, syllable counting, structure parsing
├── test_stems.py             # Stem separation job dispatching, Demucs adapter contract
├── test_provenance.py        # C2PA manifest calculation, SHA-256 verification, rights engine
├── test_daw.py               # Multitrack project serialization, clip offset validation
└── test_subscriptions.py     # Atomic credit deductions, ledger balance tracking
```

---

## 3. Automated Test Suites & Commands

### 3.1 Backend Test Execution
```bash
# In backend/ directory:
pytest -v -s --durations=10
```

### 3.2 Frontend Test Execution
```bash
# In frontend/ directory:
npm run lint
npm run build
```

---

## 4. Key Acceptance Criteria by Module

| Module | Verification Step | Expected Result |
| :--- | :--- | :--- |
| **Auth** | Register with invalid email or short password | Returns HTTP 422 with validation details |
| **Auth** | Register and Login with valid credentials | Returns HTTP 200, JWT token, 50 free credits |
| **Audio DSP** | Generate procedural audio track | Valid RIFF WAV file, >0 bytes, playable PCM, valid peaks array |
| **Storage** | Request presigned upload URL for audio file | Returns signed URL and expiration timestamp |
| **Generation**| Submit job with missing cloud provider credentials | Returns HTTP 422 `CONFIGURATION_REQUIRED` with clear remediation |
| **Generation**| Submit job with `fombo_procedural` provider | Returns HTTP 202, job completes, real WAV audio rendered |
| **Credits** | Call generation twice with identical `Idempotency-Key` | Only 1 credit deduction occurs in `credit_ledgers` |
| **Provenance**| Inspect generated track provenance | Exact SHA-256 match of audio file, CC0 / Commercial license tags |
| **DAW** | Web Audio multitrack scheduler | Audio buffer playback, gain control, pan control, metronome beat |
