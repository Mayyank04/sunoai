# ACE-Step singing inference worker

This service runs **real neural music generation** in a separate GPU worker, using NVIDIA CUDA or native Apple Metal/MPS. It has no oscillator, formant, speech synthesis or procedural fallback. Supplied lyrics are passed to ACE-Step's diffusion transformer with `instrumental=False`; the transformer generates singing and accompaniment together. No voice clone is involved. Lyrics fidelity and audible singing require a listening check of generated audio; metadata records `lyrics_conditioned`, never claims singing has been verified.

## Reviewed model and source

- Official source: [ACE-Step-1.5](https://github.com/ace-step/ACE-Step-1.5/tree/ca1e85fe9430179831e6bc6be790c332190a3866), pinned to `ca1e85fe9430179831e6bc6be790c332190a3866`.
- Official checkpoint: [ACE-Step/Ace-Step1.5](https://huggingface.co/ACE-Step/Ace-Step1.5/tree/19671f406d603126926c1b7e2adc169acbcade22), pinned to `19671f406d603126926c1b7e2adc169acbcade22`. The selected DiT is `acestep-v15-turbo`, with the bundled VAE and Qwen3 embedding model. The direct-lyrics installation downloads only the DiT, VAE and text embedding components (about 6.34 GB). The unused optional language-model weights are omitted; the Fombo adapter replaces upstream’s unconditional download precheck with strict verification of the components this pipeline actually loads.
- [Official model card](https://huggingface.co/ACE-Step/Ace-Step1.5/blob/19671f406d603126926c1b7e2adc169acbcade22/README.md) declares MIT. [Code license](https://github.com/ace-step/ACE-Step-1.5/blob/ca1e85fe9430179831e6bc6be790c332190a3866/LICENSE) is MIT. Commercial use is permitted with license-notice retention; this is not a guarantee of copyrightability or source-asset clearance. Keep upstream notices in redistributions. The bundled [Qwen3 embedding model](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) uses Apache-2.0; retain its notices as well. The app's old Apache-2.0 ACE-Step claim was incorrect.
- [Official inference API](https://github.com/ace-step/ACE-Step-1.5/blob/ca1e85fe9430179831e6bc6be790c332190a3866/docs/en/INFERENCE.md) documents `GenerationParams`, `GenerationConfig`, `generate_music`, and lyrics conditioning. The worker disables optional LM rewriting so supplied lyrics remain the conditioning text.

## Native Apple Silicon installation

This project now has a native environment in `.runtime/ace-step-venv` and the exact source checkout in `.runtime/ace-step-source`. On this M4 Mac, start the separate worker from a normal Terminal:

```sh
/bin/zsh "/Users/mayankgautam/Desktop/suno/workers/ace_step/Start Fombo GPU Worker.command"
```

The launcher tests a real MPS tensor operation, finishes or resumes the pinned checkpoint download, then starts the authenticated worker on `127.0.0.1:8002`. Keep that Terminal open. Its log is `.runtime/logs/native-worker.log`. Fombo's local `.env` selects port 8002 through `ACE_STEP_NATIVE_PORT`; this explicit local setting takes precedence over an inherited legacy service URL. Remove that native-port setting when connecting a remote worker.

The command runner used in this chat cannot access Metal: PyTorch reports MPS built but unavailable, and MLX sees no Metal devices. Native Terminal launch is required on this host. Merely starting a web server does not establish GPU readiness. No CPU-only or procedural inference is substituted.

For 16 GB unified memory, the adapter loads the reviewed diffusion weights in FP16 on MPS and avoids a duplicate MLX diffusion allocation. MLX VAE uses small chunks; the optional LM is neither downloaded nor loaded. Device and precision are recorded in output metadata. Start acceptance with one 15–30 second variant; performance and stability still need a real GPU run. Use `ACE_STEP_MPS_DTYPE=float32` only if needed and sufficient memory is available.

## Provision a separate NVIDIA GPU host

Use Linux, NVIDIA container runtime and a CUDA 12.8-compatible driver. A 24 GB GPU is a practical initial target for 30-second single-variant acceptance testing with CPU offload. Actual capacity depends on duration and variant count; GPU execution remains unverified until tested. Budget disk for the snapshot, image, caches and job WAV files.

From this repository's root on the GPU host:

```sh
# Save a strong random token in a GPU-host .env; set the same secret in the backend.
# Do not expose this service directly to browsers.
export ACE_STEP_API_TOKEN="$(openssl rand -hex 32)"
docker compose -f workers/ace_step/compose.gpu.yml build
# Explicit provisioning downloads the pinned checkpoint and writes SHA256 manifest.
docker compose -f workers/ace_step/compose.gpu.yml run --rm ace_step_gpu python -m workers.ace_step.prepare_checkpoints
docker compose -f workers/ace_step/compose.gpu.yml up -d
```

The service binds to the GPU host's loopback interface by default. Use a private network or SSH tunnel from the backend host, then set `ACE_STEP_SERVICE_URL` to that reachable endpoint and `ACE_STEP_API_TOKEN` to the same token. Source commit, clean checkout, full checkpoint SHA256 manifest, CUDA availability, and loaded DiT/VAE/text encoder are checked before readiness. A live HTTP server alone is never sufficient. Initialization has no automatic weight download; missing weights or dependencies return a precise unavailable state. API authentication is mandatory, including health probes.

The image follows the pinned upstream `uv.lock` using `uv sync --frozen`. The CUDA image requires a NVIDIA host; the native Mac path uses MPS instead. Run only one uvicorn worker per GPU and persist both volumes. Do not run multiple service replicas against the same jobs database/GPU. There is one inference thread and a bounded queue (default eight active jobs). Job records and audio persist in `/jobs`; on restart, incomplete jobs become `failed` with `WORKER_RESTARTED`, and completed jobs remain downloadable. Establish job/audio retention appropriate to deployment storage.

## Backend contract

All requests need `Authorization: Bearer ...` or `X-Service-Token`. `GET /health` is liveness plus readiness details; `GET /ready` returns HTTP 503 until model loading succeeds. `GET /capabilities` declares only exposed features. Only `acestep-v15-turbo` is accepted. Audio-to-audio, stems and guaranteed instrument selection are not exposed.

`POST /jobs` returns HTTP 202 and `{id,status,progress_percentage,current_stage,error_code,error_message,metadata}`. Include a stable `client_job_id` to deduplicate retries; a conflicting request reusing it gets 409. Send prompt, lyrics, make_instrumental, duration, optional bpm/musical_key/genre/mood/instruments/style_tags/vocal_language/seed, model, generate_two_variants. Vocal jobs require actual lyrics, not only section tags. ACE limits are 512 combined caption characters and 4096 lyric characters.

Poll `GET /jobs/{id}` for `queued`, `running`, `succeeded`, `failed`, `cancelled`. Progress advances only on real inference callbacks. Successful responses add measured duration_seconds/sample_rate/channels/bit_depth and model/checkpoint/code/seed metadata. Download authenticated WAV bytes with `GET /jobs/{id}/audio?variant=0` (or 1 for a second variation). `POST /jobs/{id}/cancel` cancels queued jobs immediately or requests cooperative cancellation; running CUDA work may finish before noticing, but its result is discarded and cannot become succeeded.

## Real lyrics acceptance check

Run `python -m workers.ace_step.smoke_test` from the repository root with `ACE_STEP_SERVICE_URL` and `ACE_STEP_API_TOKEN`. This uses original supplied lyrics, polls the real GPU job, downloads WAV, and writes evidence in `work/ace-step-vocal-check`. It fails on unavailable GPU/checkpoints and never generates a substitute. Listen to the WAV and confirm that the words are sung with melody and accompaniment before recording audible singing as verified. A successful HTTP result or nonempty waveform is insufficient proof of singing.

Contract tests run without model weights and use an explicitly injected test runtime; they cannot establish audio quality or GPU correctness:

```sh
PYTHONPATH=. ./backend/venv/bin/pytest workers/ace_step/tests -q
```
