"""Start the pinned native GPU worker from a normal macOS/Linux terminal."""
import os
from pathlib import Path
import sys


def main():
    root = Path(__file__).resolve().parents[2]
    os.chdir(root)
    from dotenv import load_dotenv
    load_dotenv(root / '.env')
    os.environ.setdefault('ACE_STEP_PROJECT_ROOT', str(root / '.runtime' / 'ace-step-source'))
    os.environ.setdefault('ACESTEP_CHECKPOINTS_DIR', str(root / '.runtime' / 'checkpoints'))
    os.environ.setdefault('HF_HOME', str(root / '.runtime' / 'hf-cache'))
    os.environ.setdefault('HF_XET_HIGH_PERFORMANCE', '1')
    os.environ.setdefault('ACE_STEP_JOB_DIR', str(root / 'storage_data' / 'ace_step_native_jobs'))
    os.environ.setdefault('ACE_STEP_DEVICE', 'mps' if sys.platform == 'darwin' else 'auto')
    os.environ.setdefault('ACE_STEP_MPS_DTYPE', 'float16')
    os.environ.setdefault('ACESTEP_SAVE_MEMORY', '1')
    os.environ.setdefault('ACESTEP_MLX_VAE_CHUNK', '256')
    os.environ.setdefault('ACESTEP_MLX_VAE_FP16', '1')
    # Set all caches under the installed runtime rather than the user's home.
    os.environ.setdefault('TRANSFORMERS_CACHE', str(root / '.runtime' / 'transformers-cache'))
    os.environ.setdefault('MPLCONFIGDIR', str(root / '.runtime' / 'matplotlib-cache'))
    os.environ.setdefault('NUMBA_CACHE_DIR', str(root / '.runtime' / 'numba-cache'))
    os.environ.setdefault('XDG_CACHE_HOME', str(root / '.runtime' / 'cache'))
    from workers.ace_step.runtime import select_gpu_device, prove_gpu_access, RuntimeUnavailable
    import torch
    try:
        device = select_gpu_device(torch, os.environ['ACE_STEP_DEVICE'])
        prove_gpu_access(torch, device)
    except RuntimeUnavailable as exc:
        print(f'GPU preflight failed: {exc}', flush=True)
        print('On this Mac, launch Start Fombo GPU Worker.command from Finder or Terminal. The Codex command runner cannot access Metal.', flush=True)
        raise SystemExit(2)
    print(f'GPU preflight passed on {device}.', flush=True)
    manifest = Path(os.environ['ACESTEP_CHECKPOINTS_DIR']) / 'fombo-checkpoint-manifest.json'
    if not manifest.is_file():
        print('Completing the pinned checkpoint download before starting inference.', flush=True)
        from workers.ace_step.prepare_checkpoints import main as prepare_checkpoints
        prepare_checkpoints()
    print('Loading the pinned ACE-Step checkpoint.', flush=True)
    if len(os.environ.get('ACE_STEP_API_TOKEN', '')) < 24:
        raise SystemExit('Missing ACE_STEP_API_TOKEN in the project .env; configure a service token before launch.')
    import uvicorn
    from workers.ace_step.worker import app
    uvicorn.run(app, host='127.0.0.1', port=int(os.environ.get('ACE_STEP_NATIVE_PORT', '8002')), workers=1)


if __name__ == '__main__':
    main()
