"""Device-selection tests do not establish model output or singing quality."""
from types import SimpleNamespace

import pytest

from workers.ace_step.runtime import RuntimeUnavailable, select_gpu_device, prove_gpu_access


def torch_devices(cuda=False, mps=False):
    return SimpleNamespace(cuda=SimpleNamespace(is_available=lambda: cuda), backends=SimpleNamespace(mps=SimpleNamespace(is_available=lambda: mps)))


@pytest.mark.parametrize("cuda,mps,requested,expected", [
    (True, False, "auto", "cuda"),
    (False, True, "auto", "mps"),
    (True, True, "mps", "mps"),
    (True, True, "cuda", "cuda"),
])
def test_selects_requested_real_accelerator(cuda, mps, requested, expected):
    assert select_gpu_device(torch_devices(cuda, mps), requested) == expected


@pytest.mark.parametrize("cuda,mps,requested", [
    (False, False, "auto"), (False, True, "cuda"), (True, False, "mps"),
])
def test_never_substitutes_cpu_or_another_explicit_device(cuda, mps, requested):
    with pytest.raises(RuntimeUnavailable) as exc:
        select_gpu_device(torch_devices(cuda, mps), requested)
    assert exc.value.code == "GPU_UNAVAILABLE"


def test_rejects_invalid_device():
    with pytest.raises(RuntimeUnavailable) as exc:
        select_gpu_device(torch_devices(True, True), "cpu")
    assert exc.value.code == "INVALID_GPU_DEVICE"


def test_gpu_access_must_actually_execute():
    def blocked(*args, **kwargs):
        raise RuntimeError("Metal device access denied")
    with pytest.raises(RuntimeUnavailable) as exc:
        prove_gpu_access(SimpleNamespace(ones=blocked), "mps")
    assert exc.value.code == "GPU_ACCESS_UNAVAILABLE"
    assert "Metal device access denied" in str(exc.value)
