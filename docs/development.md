# Fombo Music AI — Developer Guide & Setup Runbook

---

## 1. Local Development Prerequisites

Ensure your development workstation has the following tools installed:
- **macOS** (Apple Silicon or Intel)
- **Python 3.12** (`brew install python@3.12`)
- **Node.js 20.x** (`brew install node@20`)
- **FFmpeg 6.x / 7.x** (`brew install ffmpeg`)
- **Git** (`brew install git`)

---

## 2. Setting Up the Environment

### 2.1 Backend Setup:
```bash
# Clone the repository
git clone https://github.com/Mayyank04/sunoai.git fombo-music
cd fombo-music

# Create and activate Python virtual environment
python3 -m venv backend/venv
source backend/venv/bin/activate

# Install backend dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt

# Initialize environment configuration
cp env.example .env

# Verify and stamp database schema
python3 -c "import asyncio; from backend.app.core.database import init_db; asyncio.run(init_db())"
PYTHONPATH=. alembic -c backend/alembic.ini stamp head

# Run backend server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2.2 Frontend Setup:
```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Initialize local environment
cp .env.local.example .env.local

# Run Next.js App Router in development mode
npm run dev
```
Visit `http://localhost:3000` to interact with Fombo Studio.

---

## 3. Running Automated Tests

### 3.1 Backend Pytest (All 110+ Tests):
```bash
# From repository root:
PYTHONPATH=. ./backend/venv/bin/pytest backend/tests/ -v
```

### 3.2 Frontend TypeScript & Lint Checks:
```bash
cd frontend
# TypeScript compiler check
npx tsc --noEmit

# ESLint audit
npm run lint

# Production bundle compilation
npm run build
```

### 3.3 Playwright Browser E2E Tests:
```bash
cd frontend
# Install Playwright browser binaries (one-time)
npx playwright install chromium

# Run all E2E browser tests
npm run test:e2e
```

---

## 4. Coding Standards & Git Conventions

- **Branching Strategy**: Branch from `main` using `feature/<phase-name>` or `fix/<bug-description>`.
- **Commit Messages**: Conventional commits format (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- **Zero Mockery**: Never stub or simulate audio bytes when validating real DSP pipelines.
- **Strict Typing**: All TypeScript components must be explicitly typed. Avoid using `any` wherever possible.
- **Security First**: Do not bypass authentication guards, and always validate user inputs against SSRF, XSS, and SQL injection.
