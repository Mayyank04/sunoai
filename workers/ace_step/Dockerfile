# Build on a Linux NVIDIA GPU host with the NVIDIA container runtime.
FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu22.04
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git curl ffmpeg libsndfile1 libsndfile1-dev libffi-dev libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.8.15 /uv /uvx /bin/
ENV UV_PYTHON_INSTALL_DIR=/opt/python UV_PROJECT_ENVIRONMENT=/opt/ace-venv
RUN uv python install 3.12
RUN git clone https://github.com/ace-step/ACE-Step-1.5.git /opt/ACE-Step-1.5 && git -C /opt/ACE-Step-1.5 checkout ca1e85fe9430179831e6bc6be790c332190a3866
WORKDIR /opt/ACE-Step-1.5
RUN uv sync --frozen --no-dev --python 3.12
ENV PATH="/opt/ace-venv/bin:$PATH" ACE_STEP_PROJECT_ROOT=/opt/ACE-Step-1.5 ACESTEP_CHECKPOINTS_DIR=/models ACE_STEP_JOB_DIR=/jobs ACE_STEP_WORKER_HOST=0.0.0.0
WORKDIR /app
COPY workers /app/workers
EXPOSE 8001
CMD ["python", "-m", "workers.ace_step.worker"]
