# MaximReconForge — Progress & Remaining Work

_Last updated: 2026-07-28_

## What's working right now

### 1. Worker Execution Engine (`worker/`)
- **Sandboxed Subprocess Executor (`worker/runner/executor.py`)**:
  - Secure CLI command builder (never uses `shell=True` — argv array based).
  - Handles `run_subfinder`, `run_amass`, `run_httpx`, `run_naabu`, `run_nmap`, `run_nuclei`, `run_ffuf`, and `run_sqlmap`.
  - Enforces process timeouts (`timeout_seconds`) and stdout/stderr output caps (`output_size_cap_bytes`).
  - Computes SHA256 `result_hash` for hash-chained audit trails.
- **ARQ Task Worker (`worker/runner/main.py`)**:
  - `run_tool_job` async task pulling queued tool executions and returning structured output.

### 2. Backend & Security Controls (`backend/`)
- **FastAPI Core**: REST API, CORS middleware, JWT auth via httpOnly cookies (`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/me`).
- **Scope Validation & ScopeGuard**:
  - `validate_target_domain()` validates initial target at POST `/engagements`.
  - `ScopeGuard` (`backend/app/core/scope_guard.py`) deterministically checks every proposed tool target against locked `scope_entries` (domain-suffix, IP/CIDR, URL host, DNS fallback) before execution.
- **LLM Abstraction Layer (`backend/app/llm/`)**:
  - Provider-agnostic `LLMClient` backed by Groq (`https://api.groq.com/openai/v1`) using model `openai/gpt-oss-120b`.
  - Configured for zero-code-change migration to Anthropic Claude (Sonnet 5 / Opus 4.8) in the future.
  - Role-to-model mapping and session token usage tracking.
- **Tool Registry (`backend/app/tools/registry.py`)**:
  - 10 Pydantic v2 validated tool schemas (`run_subfinder`, `run_amass`, `run_httpx`, `run_naabu`, `run_nmap`, `run_nuclei`, `run_ffuf`, `run_sqlmap`, `phase_complete`, `search_whiteboard`).
  - Phase-based tool filtering via `get_tools_for_phase()`.
  - Risky tool gating (`run_sqlmap`) excluding high-impact tools unless `risky_tools_enabled=True`.
- **Result Parsers & Prompt-Injection Defense (`backend/app/tools/parsers.py`)**:
  - Parsers extract typed fields only.
  - Free text (HTTP titles, server headers, bodies) is wrapped in `--- BEGIN UNTRUSTED TARGET EVIDENCE ---` delimiters so LLMs treat it strictly as inert data.
- **Audit Logging (`backend/app/core/audit.py`)**:
  - Hash-chained logging to Supabase `audit_log` table.
  - Omits `prev_hash`/`entry_hash` on insert so DB trigger `trg_audit_log_chain` computes tamper-evident chain.
- **ContextStore & Aggregator (`backend/app/context_store/store.py`)**:
  - Isolated private scratchpads per Commander role (`.context/<role>/`).
  - Read-only whiteboard access for Commanders; deterministic `Aggregator` is sole writer (`findings.jsonl`, `summary.md`).
- **pgvector RAG (`backend/app/vector/embeddings.py`)**:
  - Embeds cleaned whiteboard entries into `whiteboard_embeddings` (1024-dim schema matching Voyage AI).
  - Cosine similarity search (`<=>` operator) for `search_whiteboard` tool.
- **LangGraph Supervisor Graph (`backend/app/graph/`)**:
  - State schema `EngagementState` tracking phase routing, scope, abort, circuit breakers, and findings.
  - Graph routing: `check_abort -> recon -> enumeration -> vuln_analysis -> exploitation -> reporting -> END`.
- **Unit Testing (`backend/tests/`)**:
  - **20/20 tests passing cleanly** across `test_ai_layer.py`, `test_executor.py`, `test_parsers.py`, and `test_scope_validator.py`.

### 3. Frontend (`frontend/`)
- React + Vite + Tailwind dark "recon" theme.
- httpOnly cookie auth flow (`authService.js`, `AuthContext.jsx`, `LoginPage.jsx`, `ProtectedRoute.jsx`).

### 4. Infra & Docker Stack (`docker-compose.yml`)
- `nginx` reverse proxy + certbot scaffolding.
- `backend` (FastAPI) and `worker` (ARQ non-root sandbox).
- `redis` task queue.
- Database & Vector Store consolidated into Supabase Postgres.

---

## Tested and Verified (2026-07-28)

- Ran `python -m pytest tests/` inside `backend/`: **20/20 tests passed (100% clean, 0 errors, 0 warnings)**.

---

## What's Next (Roadmap)

1. **Populate Live `.env` Credentials**:
   - Add `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL`.
2. **WebSocket & Realtime Progress**:
   - Connect FastAPI `WS /engagements/{id}/live` to broadcast phase transitions and findings in real time.
3. **Report & Abort Endpoints**:
   - Implement `GET /engagements/{id}/report` and `POST /engagements/{id}/abort`.
