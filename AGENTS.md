# AGENTS.md — BP Pilot (Soul File / AI Context)

This file is the single source of truth for humans + AI assistants (ChatGPT / Claude / Codex) to understand, run, and modify this app safely.

If you are an AI agent: read this file first, then follow the “Workflow Rules” and “Run/Deploy” sections. Ask for missing info only if absolutely necessary.

---

## 1) What this app does (Product Overview)

**BP Pilot** helps ingest Excel/CSV files, extract relevant fields, clean/transform data, preview the result, and then sync the final records to the accounting system **Bexio** via API.

Typical flow:
1. User uploads files (Excel/CSV)
2. Backend parses and normalizes data
3. User previews parsed content (and mapping)
4. User adjusts mapping / cleans data
5. Data is exported to a spreadsheet-like view
6. Backend calls Bexio API to create/update accounting objects

---

## 2) Architecture (High Level)

This repo is a multi-service app:
- **frontend/**: Next.js application (UI)
- **backend/**: Python API/service (parsing, mapping, Bexio sync)
- **infra/**: Docker / compose and environment configuration

The app is typically run with Docker (compose). The live instance is deployed on an Ubuntu server.

---

## 3) Repo Layout

Top-level folders (expected):
- `frontend/` — Next.js UI (App Router)
- `backend/` — Python service (main entry: `backend/main.py`)
- `infra/` — compose files + env (e.g. `.env`, docker-compose*.yml)
- Other files: READMEs, scripts, etc.

Key files (expected / observed):
- `frontend/package.json`
- `frontend/Dockerfile`
- `backend/requirements.txt`
- `backend/Dockerfile`
- `backend/main.py`
- `infra/.env` (server-only; should NOT be committed)
- `infra/docker-compose*.yml` (some may be dev-only)

---

## 4) Environments

### Production (Server)
- Server path: `/opt/bp-pilot/app`
- Git branch target: **main**
- Deploy is performed by pulling `origin/main` and restarting the runtime (usually Docker)

### Development
- Can run locally via Docker Compose, or by running frontend/backend separately.
- Prefer a staging environment when changing anything that affects Bexio syncing.

---

## 5) Workflow Rules (Important)

1. **Main is the “known-good” branch.** Production should run `main`.
2. **Do not edit production directly** unless it’s an emergency fix.
   - Prefer: create a branch, commit, push, merge to main, then deploy.
3. **Never commit secrets**:
   - `.env` files, Bexio tokens, credentials must remain out of git.
4. **When modifying data transformation or API syncing**, include a “dry-run” / safe guard when possible.
5. Keep build artifacts out of git:
   - `frontend/node_modules`, `frontend/.next`, `backend/.venv`, etc.

---

## 6) Configuration / Secrets (Do NOT commit)

All secrets are provided via environment variables (commonly via `infra/.env` in production).

Typical variables (names only — values live in `.env` / server config):
- `BEXIO_TOKEN` (or similar)
- `BEXIO_BASE_URL` (e.g. `https://api.bexio.com/2.0`)
- `APP_ENV` (`dev`/`staging`/`prod`)
- Any DB or storage variables (if used)
- Any frontend public variables prefixed with `NEXT_PUBLIC_...`

**Production `.env` location:** `infra/.env` (server-only)

---

## 7) Running the App

### Docker Compose (Recommended)
From repo root:
- Compose files live under `infra/` (adjust if different)

Common patterns (adjust filenames if needed):
```bash
cd infra
docker compose up -d --build
