"""Explicit GPU-host provisioning; never called by the web app or user jobs."""
import json
import os
from pathlib import Path
import sys

from .runtime import CHECKPOINT_REPO, CHECKPOINT_REVISION, CODE_REVISION, COMPONENTS, digest, verify_source, verify_checkpoints, validate_core_model_request


def download_patterns():
    # Keep the unneeded 1.7B LM out of the native direct-DiT installation.
    return [f"{component}/**" for component in COMPONENTS] + ["README.md", "LICENSE*", "NOTICE*", ".gitattributes"]


def main():
    root = Path(os.environ.get("ACE_STEP_PROJECT_ROOT", "/opt/ACE-Step-1.5")).resolve()
    checkpoints = Path(os.environ.get("ACESTEP_CHECKPOINTS_DIR", str(root / "checkpoints"))).resolve()
    verify_source(root)
    from huggingface_hub import snapshot_download
    snapshot_download(repo_id=CHECKPOINT_REPO, revision=CHECKPOINT_REVISION, local_dir=str(checkpoints), allow_patterns=download_patterns())
    # Upstream loads custom model code from the checkpoint. Sync from the reviewed
    # source revision before hashing so subsequent initialization cannot alter it.
    sys.path.insert(0, str(root))
    from acestep.model_downloader import _sync_model_code_files
    _sync_model_code_files("acestep-v15-turbo", checkpoints)
    files = {}
    for path in sorted(checkpoints.rglob("*")):
        relative = path.relative_to(checkpoints)
        if not path.is_file() or ".cache" in relative.parts or path.name == "fombo-checkpoint-manifest.json":
            continue
        if len(relative.parts) > 1 and relative.parts[0] not in COMPONENTS:
            continue
        files[str(relative)] = digest(path)
    manifest = {"repo_id": CHECKPOINT_REPO, "revision": CHECKPOINT_REVISION, "code_revision": CODE_REVISION,
                "pipeline": "lyrics-conditioned-dit-no-lm", "components": list(COMPONENTS), "files": files}
    (checkpoints / "fombo-checkpoint-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    verify_checkpoints(checkpoints)
    validate_core_model_request(checkpoints, "acestep-v15-turbo", "official")
    print(f"Prepared {len(files)} direct-DiT files from pinned {CHECKPOINT_REPO}@{CHECKPOINT_REVISION}; optional LM omitted.")


if __name__ == "__main__":
    main()
