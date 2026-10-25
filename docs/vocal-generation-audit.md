# Fombo vocal generation audit and handoff

25 October 2026. Project updated in `/Users/mayankgautam/Desktop/suno`. Existing interface, local/Supabase authentication, user database, and earlier lyrics edits were preserved. No Git commit or deployment to an external host was made.

## Outcome and remaining blocker

The previous ACE-Step worker did not run ACE-Step: it generated oscillator/formant DSP and declared nonexistent loaded weights. Its implementation has been replaced with a real lyrics-conditioned neural inference worker, separate from Next.js and API orchestration. There is no TTS, speech synthesis, procedural instrumental or synthetic-vowel fallback in the vocal path.

**Vocal generation is not operational on this Mac. Audible singing has not been verified.** The local authenticated replacement worker returns HTTP503 `GPU_RUNTIME_UNAVAILABLE` because PyTorch CUDA is absent. This is an ARM Mac; no separate NVIDIA CUDA host, ACE-Step installation, or pinned checkpoint is configured. Installing CPU-only dependencies would not resolve the GPU/checkpoint requirement. No GPU account or usable external vocal-provider credentials were found, and no GPU was purchased or rented.

The original lyrics acceptance request was submitted to `/jobs` with `make_instrumental=false`, model `acestep-v15-turbo`, seed 20261025, and a 30-second duration. It returned 503 with the precise runtime blocker. No audio was created or passed off as singing. See the companion JSON evidence and screenshot. Once a GPU host is available, run the supplied smoke test, then listen to verify melodic singing of the supplied words. An HTTP success, waveform, or `lyrics_conditioned` metadata alone is not acceptance.

## Implementation

- Official ACE-Step source pinned to `ca1e85fe9430179831e6bc6be790c332190a3866` and official checkpoint `ACE-Step/Ace-Step1.5` pinned to `19671f406d603126926c1b7e2adc169acbcade22`. Selected DiT: `acestep-v15-turbo`. The code calls the real `AceStepHandler`, `GenerationParams`, `GenerationConfig`, and `generate_music`. Lyrics reach direct DiT conditioning without LM rewriting. Model, VAE, text encoder/tokenizer, CUDA, clean source and full downloaded-file hashes are verified before readiness.
- Separate authenticated worker has a durable job store, stable client ids, bounded single-GPU queue, actual callback progress, cancellation and WAV download. Missing runtime, checkpoint, license/provenance mismatch, inference failure, restart and timeout remain errors. Model provisioning is explicit; user jobs never silently download weights.
- API persists complete generation inputs including lyrics and instrumental mode. Retries preserve them; no procedural provider substitution occurs. Job ownership applies to status and SSE. Both generation and generic job cancellation/retry routes share the same orchestration and credit logic. Background leases/heartbeats recover API restarts; remote idempotency prevents duplicate inference. Lease guards and unique asset filenames prevent a late/duplicate worker from deleting a successful track.
- Credit reservation uses an atomic conditional balance update. Only outstanding reservations can be consumed/refunded. Cancellation and completion compete for one status transition, preventing duplicate refunds or late successful tracks. Failed setup requests create no debit/job.
- Actual decodable PCM recordings, measured duration, waveform data, lyrics, model provenance and output hash are persisted for playback and library use. Remote storage URLs resolve against the API host. Library lists the signed-in creator's tracks; public feeds request public tracks. Library/media failures are visible. Generation records are unsigned application provenance, without fabricated C2PA-signature or singing-verification claims.
- Frontend retains the existing layout and authentication. Fixed provider-selection/lyrics-transfer race, stale model selection, real provider credit estimates, authenticated polling, zero-percent queued progress, active-job resume, persisted track playback and library links, and clear failures. ACE turbo does not support the existing negative-prompt control in this direct path, so that control is hidden according to capabilities rather than silently ignored.

## Earlier ChunkLoadError

The supplied 8:11 PM screenshot shows a timeout loading `/_next/static/chunks/app/layout.js`. The historical timeout could not be reproduced. Development and production previously shared `.next`; they now use `.next-dev` and `.next` respectively, preventing a production build from replacing files served by development. Added an explicit reload action to the route error screen. Production build passed, the creation page rendered in the app browser with lyrics/vocal mode intact and no error overlay, and its referenced chunk requests all returned 200. Full automated Playwright execution was blocked before test actions by macOS Chromium process permission (`bootstrap_check_in ... Permission denied`); the four browser tests are provided, but are not claimed as passed.

## Provider and credential audit

| Provider | Findings |
| --- | --- |
| ACE-Step | Real replacement integrated; official MIT checkpoint. No checkpoint/CUDA runtime available here. A private local service token was generated in ignored `.env` and connected to `127.0.0.1:8001`; no secret was exposed in this report. |
| HeartMuLa | Existing adapter never generated audio; now explicitly unavailable. No deployed checkpoint/license verified. |
| Procedural DSP | Available for instrumentals only, never used to satisfy a vocal request. |
| AudioCraft/MusicGen | No endpoint/Replicate token. No vocals. Official MusicGen weights are noncommercial; incorrect blanket commercial flag removed. |
| Suno | No key/URL. Generic proxy schema is unverified and not used by the new pipeline. A Fombo paid tier does not establish upstream rights. |
| Stability | No key. Instrumental adapter, not a singing route. Commercial account entitlements not verified. |

ACE-Step source and official model card are MIT, not the old Apache claim. The bundled Qwen embedding model is Apache-2.0. Retain both component notices for redistribution. Commercial use of the model is permitted; ownership/clearance of lyrics and resulting recordings is a separate question. Old DSP-generated tracks have not been retroactively certified as real ACE-Step outputs.

## Validation

- Backend and worker suites: **136 passed, 2 skipped**. This includes authentication and existing backend regressions, 12 worker contract/runtime tests, and 13 new tests covering credit races/rollback, idempotency, ownership, lyric-preserving retries, cancellation and late results. Test audio fixtures are isolated contract tests, not evidence of model singing.
- TypeScript: passed. ESLint: passed with pre-existing warnings. Next.js production build: passed. Python compilation: passed.
- Real original-lyrics request: blocked 503 `GPU_RUNTIME_UNAVAILABLE`; no audio created. No audible-singing claim.
- App-browser inspection: creation page loads, original lyrics retained, vocal mode enabled, actual runtime blocker visible, submit unavailable.
- Playwright suite: could not launch Chromium due macOS process permissions; four targeted tests remain unexecuted in this session.
- GPU Docker build and real checkpoint load/inference: unverified without a CUDA host.

## Provisioning and final acceptance

Follow `workers/ace_step/README.md` on a separate Linux NVIDIA host. The GPU image pins source and frozen upstream dependencies; `prepare_checkpoints` explicitly downloads the official approximately 10.1GB snapshot and writes an integrity manifest. Connect the API using a private endpoint/tunnel and the same random service token on both sides. Never expose that token to the frontend. The compose files pass the service configuration to API/orchestration containers.

Run `python -m workers.ace_step.smoke_test` with the endpoint and token set. It uses original lyrics, requests neural music, downloads a WAV only upon real success and leaves audibility unverified until listening. Confirm intelligible melodic singing and accompaniment; then validate completed job, playback, library record, credit consumption and failure refunds against that deployed GPU worker. This last acceptance step is currently blocked by hardware/checkpoint availability.

Operational note: the earlier wildcard-bound legacy worker process (observed PID 96236) could not be stopped from this session because the OS denied the signal. The app is explicitly connected to the new loopback-bound authenticated worker, whose identity/readiness was verified. Stop the stale legacy process from its original terminal before any broader network deployment; it cannot pass the new adapter's runtime/checkpoint/token readiness requirements.

## Primary sources

- [Official pinned checkpoint/model card](https://huggingface.co/ACE-Step/Ace-Step1.5/blob/19671f406d603126926c1b7e2adc169acbcade22/README.md)
- [Pinned source and license](https://github.com/ace-step/ACE-Step-1.5/blob/ca1e85fe9430179831e6bc6be790c332190a3866/LICENSE)
- [Pinned inference API](https://github.com/ace-step/ACE-Step-1.5/blob/ca1e85fe9430179831e6bc6be790c332190a3866/docs/en/INFERENCE.md)
- [Qwen embedding component](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)
- [MusicGen weights license](https://github.com/facebookresearch/audiocraft/blob/main/LICENSE_weights)
