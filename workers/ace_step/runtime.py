"""Pinned ACE-Step inference. Heavy dependencies stay outside the web backend."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import wave

CODE_REVISION = "ca1e85fe9430179831e6bc6be790c332190a3866"
CHECKPOINT_REPO = "ACE-Step/Ace-Step1.5"
CHECKPOINT_REVISION = "19671f406d603126926c1b7e2adc169acbcade22"
MODEL_NAME = "acestep-v15-turbo"
MODEL_LICENSE = "MIT"
# Direct lyrics-to-DiT generation never loads or calls the optional 5 Hz LM.
COMPONENTS = (MODEL_NAME, "vae", "Qwen3-Embedding-0.6B")
CORE_METADATA_FILES = (
    f"{MODEL_NAME}/config.json", f"{MODEL_NAME}/silence_latent.pt",
    "vae/config.json", "Qwen3-Embedding-0.6B/config.json",
    "Qwen3-Embedding-0.6B/tokenizer.json", "Qwen3-Embedding-0.6B/tokenizer_config.json",
)


class RuntimeUnavailable(RuntimeError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def verify_source(project_root):
    try:
        revision = subprocess.check_output(["git", "-C", str(project_root), "rev-parse", "HEAD"], text=True).strip()
        clean = subprocess.run(["git", "-C", str(project_root), "diff", "--quiet", "HEAD", "--"], check=False).returncode == 0
    except (OSError, subprocess.CalledProcessError) as exc:
        raise RuntimeUnavailable("SOURCE_UNAVAILABLE", "Set ACE_STEP_PROJECT_ROOT to the pinned ACE-Step source checkout.") from exc
    if revision != CODE_REVISION or not clean:
        raise RuntimeUnavailable("SOURCE_REVISION_MISMATCH", f"ACE-Step source must be clean at {CODE_REVISION}.")


def verify_checkpoints(checkpoints):
    try:
        manifest = json.loads((checkpoints / "fombo-checkpoint-manifest.json").read_text())
    except (OSError, ValueError) as exc:
        raise RuntimeUnavailable("CHECKPOINT_UNAVAILABLE", "Pinned checkpoints are missing. Run workers.ace_step.prepare_checkpoints on the GPU host.") from exc
    if (manifest.get("repo_id"), manifest.get("revision"), manifest.get("code_revision")) != (CHECKPOINT_REPO, CHECKPOINT_REVISION, CODE_REVISION):
        raise RuntimeUnavailable("CHECKPOINT_REVISION_MISMATCH", "Checkpoint provenance does not match the reviewed model and code revisions.")
    files = manifest.get("files", {})
    for component in COMPONENTS:
        if not any(name.startswith(component + "/") and name.endswith((".safetensors", ".bin")) for name in files):
            raise RuntimeUnavailable("CHECKPOINT_UNAVAILABLE", f"Missing checkpoint weights for {component}.")
    for name, expected in files.items():
        target = (checkpoints / name).resolve()
        if not target.is_relative_to(checkpoints.resolve()) or not target.is_file() or digest(target) != expected:
            raise RuntimeUnavailable("CHECKPOINT_INTEGRITY_FAILED", f"Checkpoint file failed verification: {name}.")


def validate_core_model_request(checkpoints, config_path, vae_variant=None):
    """Offline-only loader precheck for the reviewed direct-DiT pipeline.

    The upstream precheck unconditionally requests its unused LM. This adapter
    validates only the already hash-verified components consumed by our API.
    It never invokes an upstream download function or changes source files.
    """
    if config_path != MODEL_NAME or vae_variant not in (None, "official"):
        raise RuntimeUnavailable("UNSUPPORTED_CHECKPOINT", "Only the pinned turbo DiT and bundled official VAE are allowed.")
    for relative in CORE_METADATA_FILES:
        if not (Path(checkpoints) / relative).is_file():
            raise RuntimeUnavailable("CHECKPOINT_UNAVAILABLE", f"Missing required checkpoint metadata: {relative}.")
    return None


def select_gpu_device(torch, requested="auto"):
    """Select an available accelerator, never silently substitute CPU inference."""
    if requested not in {"auto", "cuda", "mps"}:
        raise RuntimeUnavailable("INVALID_GPU_DEVICE", "ACE_STEP_DEVICE must be auto, cuda, or mps.")
    cuda = bool(torch.cuda.is_available())
    mps_backend = getattr(getattr(torch, "backends", None), "mps", None)
    mps = bool(mps_backend and mps_backend.is_available())
    if requested in {"auto", "cuda"} and cuda:
        return "cuda"
    if requested in {"auto", "mps"} and mps:
        return "mps"
    raise RuntimeUnavailable("GPU_UNAVAILABLE", f"Requested GPU device '{requested}' is unavailable. This worker requires NVIDIA CUDA or Apple Metal/MPS.")


def prove_gpu_access(torch, device):
    """Perform a real accelerator operation before advertising GPU readiness."""
    try:
        tensor = torch.ones((16, 16), device=device)
        result = (tensor @ tensor).sum()
        if device == "mps":
            torch.mps.synchronize()
        else:
            torch.cuda.synchronize()
        if result.item() != 4096.0:
            raise ValueError("GPU operation returned an unexpected result.")
        del tensor, result
    except Exception as exc:
        raise RuntimeUnavailable("GPU_ACCESS_UNAVAILABLE", f"The {device} GPU could not execute a tensor operation: {exc}") from exc


class ACEStepRuntime:
    def __init__(self):
        self.ready = False
        self.error_code = "INITIALIZING"
        self.error_message = "ACE-Step model has not loaded."
        self.device = "unavailable"
        self.handler = None
        self.gpu_backend = None
        self.precision = None

    def initialize(self):
        try:
            try:
                import torch
            except ImportError as exc:
                raise RuntimeUnavailable("GPU_RUNTIME_UNAVAILABLE", "The PyTorch GPU runtime is not installed on this worker host.") from exc
            device = select_gpu_device(torch, os.environ.get("ACE_STEP_DEVICE", "auto").strip().lower())
            prove_gpu_access(torch, device)
            self.gpu_backend = device
            self.device = f"cuda:0 ({torch.cuda.get_device_name(0)})" if device == "cuda" else "mps (Apple Metal GPU)"
            root = Path(os.environ.get("ACE_STEP_PROJECT_ROOT", "/opt/ACE-Step-1.5")).resolve()
            checkpoints = Path(os.environ.get("ACESTEP_CHECKPOINTS_DIR", str(root / "checkpoints"))).resolve()
            verify_source(root)
            verify_checkpoints(checkpoints)
            os.environ["ACESTEP_CHECKPOINTS_DIR"] = str(checkpoints)
            # All downloads happen explicitly in prepare_checkpoints, never on a user job.
            os.environ["HF_HUB_OFFLINE"] = "1"
            os.environ["TRANSFORMERS_OFFLINE"] = "1"
            sys.path.insert(0, str(root))
            from acestep.handler import AceStepHandler
            from acestep.inference import GenerationParams, GenerationConfig, generate_music
            self.params_type = GenerationParams
            self.config_type = GenerationConfig
            self.generate_music = generate_music
            # The pinned upstream defaults MPS DiT to float32. Loading the
            # same official weights in float16 avoids doubling memory on a
            # 16 GB unified-memory Mac. This adapter override leaves source
            # files and checkpoint contents unchanged and records precision.
            class NativeGPUHandler(AceStepHandler):
                def _ensure_models_present(inner, *, checkpoint_path, config_path, prefer_source=None, vae_variant=None):
                    # verify_checkpoints above already hashed every prepared
                    # core file. Avoid upstream's unconditional unused-LM
                    # download while retaining all actual loading checks.
                    return validate_core_model_request(checkpoint_path, config_path, vae_variant)

                def _load_main_model_from_checkpoint(inner, **kwargs):
                    if kwargs.get("device") == "mps":
                        dtype_name = os.environ.get("ACE_STEP_MPS_DTYPE", "float16")
                        if dtype_name not in {"float16", "float32"}:
                            raise ValueError("ACE_STEP_MPS_DTYPE must be float16 or float32.")
                        inner.dtype = getattr(torch, dtype_name)
                    return super()._load_main_model_from_checkpoint(**kwargs)

            self.handler = NativeGPUHandler()
            if device == "mps":
                os.environ.setdefault("ACESTEP_SAVE_MEMORY", "1")
                os.environ.setdefault("ACESTEP_MLX_VAE_CHUNK", "256")
                os.environ.setdefault("ACESTEP_MLX_VAE_FP16", "1")
            message, loaded = self.handler.initialize_service(
                project_root=str(root), config_path=MODEL_NAME, device=device,
                use_flash_attention=False, compile_model=False,
                # Plain PyTorch MPS DiT avoids an additional complete MLX
                # decoder copy. MPS still runs neural diffusion on the GPU.
                use_mlx_dit=device == "mps" and os.environ.get("ACE_STEP_MLX_DIT", "false").lower() == "true",
                offload_to_cpu=False if device == "mps" else os.environ.get("ACE_STEP_OFFLOAD_CPU", "true").lower() == "true",
                offload_dit_to_cpu=False, quantization=None,
            )
            if not loaded or any(getattr(self.handler, attr, None) is None for attr in ("model", "vae", "text_encoder", "text_tokenizer")):
                raise RuntimeUnavailable("MODEL_LOAD_FAILED", str(message))
            if self.handler.device != device:
                raise RuntimeUnavailable("GPU_DEVICE_MISMATCH", f"ACE-Step loaded on {self.handler.device}, expected {device}; refusing CPU fallback.")
            parameter = next(self.handler.model.parameters())
            allow_cpu_offload = device == "cuda" and self.handler.offload_to_cpu and self.handler.offload_dit_to_cpu
            if parameter.device.type != device and not allow_cpu_offload:
                raise RuntimeUnavailable("GPU_DEVICE_MISMATCH", "ACE-Step diffusion weights are not resident on the selected GPU.")
            self.precision = str(parameter.dtype)
            self.ready = True
            self.error_code = None
            self.error_message = None
        except RuntimeUnavailable as exc:
            self.error_code, self.error_message = exc.code, str(exc)
        except Exception as exc:
            self.error_code, self.error_message = "MODEL_LOAD_FAILED", str(exc)

    def generate(self, request, output_dir, progress):
        if not self.ready:
            raise RuntimeUnavailable(self.error_code, self.error_message)
        caption = "; ".join(str(value) for value in [request.prompt, request.genre, request.mood, ", ".join(request.instruments), ", ".join(request.style_tags)] if value)
        if len(caption) > 512:
            raise RuntimeUnavailable("PROMPT_TOO_LONG", "Combined prompt, style and instruments must be at most 512 characters for ACE-Step.")
        params = self.params_type(
            task_type="text2music", caption=caption,
            lyrics="[Instrumental]" if request.make_instrumental else request.lyrics,
            instrumental=request.make_instrumental, vocal_language=request.vocal_language,
            bpm=request.bpm, keyscale=request.musical_key or "", duration=request.duration,
            inference_steps=8, guidance_scale=1.0, shift=3.0, seed=request.seed if request.seed is not None else -1,
            # Direct DiT conditioning preserves the supplied lyrics verbatim.
            thinking=False, use_cot_metas=False, use_cot_caption=False, use_cot_language=False,
        )
        config = self.config_type(batch_size=2 if request.generate_two_variants else 1, audio_format="wav", use_random_seed=request.seed is None,
                                  seeds=None if request.seed is None else [request.seed, request.seed + 1][:2 if request.generate_two_variants else 1])
        result = self.generate_music(self.handler, None, params, config, save_dir=str(output_dir), progress=progress)
        if not result.success:
            raise RuntimeUnavailable("INFERENCE_FAILED", result.error or result.status_message or "ACE-Step failed without audio.")
        expected = 2 if request.generate_two_variants else 1
        if len(result.audios) != expected:
            raise RuntimeUnavailable("INVALID_AUDIO_RESULT", f"ACE-Step produced {len(result.audios)} variants; expected {expected}.")
        paths = []
        measurements = []
        for audio in result.audios:
            path = Path(audio["path"]).resolve()
            if not path.is_relative_to(output_dir.resolve()):
                raise RuntimeUnavailable("INVALID_AUDIO_RESULT", "ACE-Step returned audio outside its job directory.")
            try:
                with wave.open(str(path), "rb"):
                    pass
            except wave.Error:
                # Upstream/torchaudio versions can emit IEEE float WAV. Convert
                # the neural output to PCM16 for browser and backend compatibility.
                import soundfile as sf
                samples, rate = sf.read(str(path), dtype="float32", always_2d=True)
                pcm_path = output_dir / f"fombo-{len(paths)}.wav"
                sf.write(str(pcm_path), samples, rate, subtype="PCM_16", format="WAV")
                path = pcm_path.resolve()
            with wave.open(str(path), "rb") as wav:
                if not wav.getnframes() or not wav.getframerate():
                    raise RuntimeUnavailable("INVALID_AUDIO_RESULT", "ACE-Step returned empty audio.")
                measurements.append({"duration_seconds": wav.getnframes() / wav.getframerate(), "sample_rate": wav.getframerate(),
                                     "channels": wav.getnchannels(), "bit_depth": wav.getsampwidth() * 8})
            paths.append(str(path))
        return paths, {**measurements[0], "variants": measurements, "metadata": {
            "runtime": "ace_step_1_5", "model_name": MODEL_NAME, "model_revision": CHECKPOINT_REVISION,
            "code_revision": CODE_REVISION, "checkpoint_repo": CHECKPOINT_REPO, "license": MODEL_LICENSE,
            "device": self.device, "gpu_backend": self.gpu_backend, "precision": self.precision,
            "mlx_dit": bool(getattr(self.handler, "use_mlx_dit", False)),
            "mlx_vae": bool(getattr(self.handler, "use_mlx_vae", False)),
            "lyrics_conditioned": not request.make_instrumental,
            "singing_verified": False, "seed_used": result.audios[0].get("params", {}).get("seed", request.seed),
        }}
