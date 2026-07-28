# MaximReconForge — Complete Architecture

**Scope:** full system structure — infra, data stores, sandboxing, and where the AI layer sits within it. For AI-internal detail (models, agent loop, RAG mechanics), see `MaximReconForge_Architecture_AI.md`.

---

## 1. Overview

MaximReconForge takes a target domain, autonomously maps its attack surface, chains automated attacks against discovered in-scope assets, and produces a CVSS-scored markdown report. The system is split into a stateless-ish API layer, a sandboxed tool-execution layer, three data stores with distinct roles, and an AI reasoning layer that only exists inside two of five engagement phases.

---

## 2. High-Level System Diagram

```
                        ┌─────────────────────┐
                        │   Frontend (Vercel)  │
                        └──────────┬───────────┘
                                   │ HTTPS (JWT)
                        ┌──────────▼───────────┐
                        │   Nginx (VPS, TLS)    │
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │  FastAPI Backend      │
                        │  (API, Auth, LangGraph│
                        │   Supervisor, WS)     │
                        └───┬───────┬───────┬───┘
                            │       │       │
                 ┌──────────▼─┐ ┌───▼────┐ ┌▼─────────────┐
                 │  Postgres  │ │ Redis  │ │   Qdrant      │
                 │ (engage-   │ │ (ARQ   │ │ (per-engagement│
                 │ ments,     │ │ queue) │ │  vector store)│
                 │ findings,  │ └───┬────┘ └───────────────┘
                 │ audit log, │     │
                 │ users)     │     │
                 └────────────┘     │
                                    ▼
                        ┌───────────────────────┐
                        │  Tool-Runner Worker    │
                        │  (separate container,  │
                        │  sandboxed, ARQ worker,│
                        │  runs whitelisted tools)│
                        └───────────────────────┘
```

All backend-side components run as Docker containers on a single VPS via `docker compose`. Frontend deploys independently on Vercel and only ever talks to Nginx over HTTPS.

---

## 3. Component Breakdown

### 3.1 Nginx
Reverse proxy, TLS termination (Let's Encrypt/certbot), HTTP→HTTPS redirect, WebSocket upgrade handling, basic rate limiting.

### 3.2 FastAPI Backend
REST API (auth, engagement CRUD, report retrieval, abort), WebSocket endpoint for live progress, hosts the LangGraph Supervisor graph (planning/routing only, no tool execution in-process).

### 3.3 Task Queue — Redis + ARQ
Async-native, fits FastAPI/LangGraph's async model directly, no separate beat/flower processes. Every long-running unit of work (a phase, a scan, an exploit attempt) is enqueued rather than run inline.

### 3.4 Postgres
- `users` (auth only, no roles)
- `engagements` (id, target domain, status, created_at, scope snapshot)
- `assets` (discovered subdomains/IPs/CIDRs/live URLs)
- `findings` (severity, CVSS score, description, evidence refs)
- `audit_log` (append-only, hash-chained)
- LangGraph checkpoint tables (crash/restart resumability)

### 3.5 Qdrant
One collection per engagement (`engagement_<id>`), fully isolated. Embeddings generated only from cleaned whiteboard entries, never raw tool output.

### 3.6 Tool-Runner (sandboxed executor)
Separate container from the backend. Holds the actual binaries (subfinder, amass, httpx, naabu, nmap, nuclei, ffuf, sqlmap-gated). Runs as an ARQ worker — non-root, read-only root filesystem except a per-engagement writable volume, CPU/memory limits. Never receives arbitrary shell text — only fixed, validated tool-registry calls.

---

## 4. Tool Registry & Sandbox

- All tools defined as Pydantic-validated function schemas (`registry.py`): `run_subfinder(domain)`, `run_nuclei(target, templates)`, etc.
- Every call carries a timeout, output size cap, ScopeGuard check, and a deterministic ResultParser converting raw output into typed fields.
- `risky: true` tools (currently only sqlmap) are gated behind an explicit per-engagement toggle, default off.

**Adopted tools:** subfinder, amass, httpx, naabu, nmap, nuclei, ffuf, sqlmap (gated).
**Evaluated and rejected:** masscan (duplicate of naabu, needs elevated capabilities), gobuster/dirbuster (duplicate of ffuf), nikto (duplicate of nuclei coverage), hydra/medusa (excluded outright — lockout/DoS risk not gateable), Metasploit (interactive/RPC model incompatible with the schema-only registry), Burp Suite (commercial, interactive), wpscan (narrow single-CMS overlap with nuclei), Shodan/Censys (third-party cached data, not live enumeration).

---

## 5. Security Controls

- **ScopeGuard:** deterministic, non-LLM node between every proposed tool call and its execution. Validates target against the locked scope (domain-suffix + resolved-IP/CIDR match). Scope locks at the end of Recon; nothing discovered later can expand it.
- **Audit Trail:** append-only, hash-chained log per engagement (timestamp, agent, tool, exact params, target, result hash), mirrored to Postgres.
- **Kill Switch:** `/engagements/{id}/abort` sets a flag checked before every phase transition and every tool dispatch. In-flight jobs complete; no new jobs enqueue.
- **Prompt-Injection Defense:** raw target-controlled content (HTTP bodies, banners, titles) never reaches an LLM prompt as instructions — the ResultParser extracts only typed fields; free text is stored as delimited, explicitly-untrusted evidence.

*(Full AI-side mechanics for the above — which agents, which models, loop structure — are in the AI architecture doc.)*

---

## 6. AI Layer — Where It Sits (see AI architecture doc for detail)

Only 3 of 5 phases contain an LLM: Vuln-Analysis, Exploitation, Reporting. Recon and Enumeration are deterministic pipelines with no decision point. This is a deliberate reduction from "LLM in every phase" — detailed rationale in `MaximReconForge_Architecture_AI.md` §2.

---

## 7. Tech Stack Summary

| Layer | Choice |
|---|---|
| API | FastAPI |
| Orchestration | LangGraph (Postgres checkpointer) |
| Task queue | Redis + ARQ |
| Relational DB | Postgres |
| Vector DB | Qdrant (per-engagement collections) |
| Tool sandbox | Separate Docker container, non-root, resource-limited |
| Reverse proxy / TLS | Nginx + certbot |
| Auth | JWT (access + refresh), no RBAC |
| Frontend | Vercel (out of backend scope) |
| Tracing | LangSmith (or equivalent) |
| Report format | Markdown, CVSS-scored findings |

---

## 8. Deployment

Single VPS, `docker compose` stack: `nginx`, `backend`, `worker`, `postgres`, `redis`, `qdrant`. Secrets via `.env` (not committed) or a secrets manager. Frontend deploys independently on Vercel.

---

## 9. Assumptions

1. Hosted LLM API (Anthropic) — nothing above is provider-specific by construction.
2. Single VPS is sufficient; no horizontal scaling planned.
3. No RBAC beyond authenticated/not.
4. sqlmap and future risky tools default off, gated behind an explicit toggle.
