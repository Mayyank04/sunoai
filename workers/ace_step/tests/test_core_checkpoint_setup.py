"""The direct-DiT integration can provision without an unused language model."""
import json
from pathlib import Path

import pytest

from workers.ace_step.runtime import (
    CHECKPOINT_REPO, CHECKPOINT_REVISION, CODE_REVISION, COMPONENTS,
    CORE_METADATA_FILES, MODEL_NAME, RuntimeUnavailable, digest,
    validate_core_model_request, verify_checkpoints,
)
from workers.ace_step.prepare_checkpoints import download_patterns


def core_fixture(root):
    for relative in CORE_METADATA_FILES:
        target = root / relative
        target.parent.mkdir(exist_ok=True, parents=True)
        target.write_bytes(b"contract metadata fixture")
    for component in COMPONENTS:
        target = root / component / "model.safetensors"
        target.write_bytes(b"contract fixture, not weights")
    files = {str(path.relative_to(root)): digest(path) for path in root.rglob("*") if path.is_file()}
    (root / "fombo-checkpoint-manifest.json").write_text(json.dumps({
        "repo_id": CHECKPOINT_REPO, "revision": CHECKPOINT_REVISION,
        "code_revision": CODE_REVISION, "files": files,
    }))


def test_three_component_setup_excludes_unused_lm(tmp_path):
    core_fixture(tmp_path)
    assert len(COMPONENTS) == 3
    assert not any("5Hz-lm" in pattern for pattern in download_patterns())
    verify_checkpoints(tmp_path)
    assert validate_core_model_request(tmp_path, MODEL_NAME, "official") is None
    assert not (tmp_path / "acestep-5Hz-lm-1.7B").exists()


def test_missing_metadata_fails_without_downloading(tmp_path):
    core_fixture(tmp_path)
    (tmp_path / MODEL_NAME / "silence_latent.pt").unlink()
    with pytest.raises(RuntimeUnavailable) as exc:
        validate_core_model_request(tmp_path, MODEL_NAME)
    assert exc.value.code == "CHECKPOINT_UNAVAILABLE"


@pytest.mark.parametrize("model,vae", [("unreviewed-model", "official"), (MODEL_NAME, "community-vae")])
def test_unreviewed_checkpoint_selection_fails_closed(tmp_path, model, vae):
    with pytest.raises(RuntimeUnavailable) as exc:
        validate_core_model_request(tmp_path, model, vae)
    assert exc.value.code == "UNSUPPORTED_CHECKPOINT"
