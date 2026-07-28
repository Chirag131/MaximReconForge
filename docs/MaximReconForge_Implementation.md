# MaximReconForge — Backend & AI Implementation Plan

**Scope of this document:** backend, AI orchestration, tool execution, and infra you own (frontend on Vercel is treated as a consumer of your API only).

**Project profile:** internal tool, single-VPS scale, fully autonomous execution, no RBAC (auth only), markdown reports.

---

## 1. Overview

MaximReconForge takes a target domain, autonomously maps its attack surface, chains automated attacks against discovered assets, and produces a markdown report with severity-scored findings. Multiple LLM-driven agents collaborate through a shared, per-engagement "workspace" (a hidden context folder + vector index), coordinated by LangGraph. All actual tool execution (nmap, subfinder, nuclei, etc.) happens in an isolated worker, never in the same process as the LLM planning logic.

---

## 2. High-Level Architecture

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

Backend, worker, Postgres, Redis, Qdrant, and Nginx all run as Docker containers on one VPS via `docker compose`. Frontend stays on Vercel and only talks to Nginx over HTTPS.

---

## 3. Component Breakdown

### 3.1 Nginx
- Reverse proxy in front of FastAPI, TLS termination via Let's Encrypt (certbot), HTTP→HTTPS redirect.
- Also handles WebSocket upgrade headers (for live progress streaming) and basic rate limiting on the API surface.

### 3.2 FastAPI Backend
- REST API: auth, create/list engagements, get findings, get report, abort engagement.
- WebSocket endpoint: streams live agent/tool progress to the frontend per engagement.
- Hosts the **LangGraph Supervisor graph** (planning/decision logic only — no tool execution in this process).
- Talks to Postgres (state), Redis (job queue), Qdrant (RAG).

### 3.3 Task Queue — Redis + ARQ
- **Decision:** ARQ over Celery. It's async-native (fits FastAPI/LangGraph's async model directly), far fewer moving parts than Celery (no separate beat/flower processes needed), and is plenty for single-VPS scale.
- Every long-running unit of work (a recon phase, a scan, an exploit attempt) is enqueued as a job rather than run inline in the API request.

### 3.4 Postgres
Tables (minimum):
- `users` (auth only, no roles)
- `engagements` (id, target domain, status, created_at, scope snapshot)
- `assets` (discovered subdomains/IPs/CIDRs/live URLs, linked to engagement)
- `findings` (severity, CVSS score, description, evidence refs, affected asset)
- `audit_log` (append-only, see §11)
- LangGraph **checkpoint tables** (LangGraph's Postgres checkpointer persists graph state, so an engagement can resume after a crash/restart)

### 3.5 Qdrant (vector store)
- One **collection per engagement** (`engagement_<id>`), so context from one engagement never leaks into another.
- Embeddings are generated from whiteboard entries (§7) as they're written, not from raw tool output — keeps the index clean and small.

### 3.6 Tool-Runner (sandboxed executor)
- A **separate container/image** from the backend, containing the actual pentest binaries (subfinder, amass, httpx, naabu, nmap, nuclei, ffuf, and optionally sqlmap behind an extra flag — see §9).
- Runs as an ARQ worker: pulls jobs, executes a whitelisted tool with validated parameters, writes structured output back.
- Runs as a **non-root user**, read-only root filesystem except a per-engagement writable workspace volume, CPU/memory limits set in `docker-compose.yml`.
- **Never** receives arbitrary shell commands from the LLM — only calls into a fixed tool registry (§8). This is also your main defense against LLM-generated command injection.

---

## 4. Engagement Lifecycle

```
[Domain submitted] 
   → Recon phase   (subfinder/amass/httpx/naabu → asset list + scope lock)
   → Enumeration   (nuclei/service fingerprinting on discovered assets)
   → Vuln analysis (LLM reasons over enumeration output, proposes attack chain)
   → Exploitation  (chained, whitelisted tool calls against in-scope assets only)
   → Reporting     (aggregate whiteboard → markdown report with CVSS scoring)
```

Each phase is a LangGraph subgraph. The Supervisor decides phase transitions; it does not itself call tools.

---

## 5. Agent Architecture

### 5.1 Commander / Executor separation (as you specified)
- **Commander agents** (one per phase: Recon, Enumeration, Vuln-Analysis, Exploitation) — LLM-driven, decide *what* to do next and *why*. They only ever emit a structured tool-call request (tool name + validated params), never raw shell text.
- **Executor** — the Tool-Runner worker (§3.6). Takes a validated tool-call request, runs it in the sandbox, and returns **parsed, structured output** (JSON), not raw stdout.
- This separation is also your main prompt-injection defense (see §9) — raw target-controlled text (HTTP bodies, banners, etc.) never reaches a Commander's prompt directly; it's parsed into typed fields first.

### 5.2 Whiteboard model (as you specified)
- Each agent works in its **own private folder** inside the engagement's context directory — read/write for itself only.
- A dedicated **Aggregator** (deterministic Python service, not an LLM) is the *only* writer to the shared **whiteboard**. It reads each agent's private notes + structured findings and consolidates them.
- All agents have **read-only** access to the whiteboard. This is enforced two ways, not just file permissions (multiple containers may share a network volume, so OS `chmod` alone isn't reliable):
  1. Agents never touch the filesystem directly — they go through an internal `ContextStore` API in the backend that enforces per-role ACLs.
  2. The underlying files are also mounted read-only into any container that shouldn't write them, as defense-in-depth.

### 5.3 LangGraph graph shape
- **Supervisor node** — routes between phase subgraphs, checks the abort flag (§6) before every transition.
- **Phase subgraph** (repeated per phase): `Commander → ScopeGuard → Executor → ResultParser → (loop back to Commander until phase goal met) → Aggregator → back to Supervisor`.
- **Checkpointer:** Postgres-backed, so any crashed/restarted engagement resumes from its last checkpoint instead of restarting from scratch.

---

## 6. Scope Guardrails & Kill Switch

- **Scope definition:** the Recon phase's output (subdomains, resolved IPs, CIDRs, live URLs) *becomes* the locked scope for all later phases — nothing discovered after recon can expand it. If a later phase encounters a link/asset outside this locked set, it's dropped and logged, not followed.
- **ScopeGuard node:** a deterministic (non-LLM) check placed between every Commander and Executor in the graph. It validates the proposed tool target against the locked scope (domain-suffix match + resolved-IP/CIDR match) before the Executor is allowed to run anything. This is enforced in code — the LLM is never trusted to self-police scope.
- **Kill switch:** an `/engagements/{id}/abort` endpoint sets a flag Postgres/Redis; the Supervisor checks this flag before every phase transition and every tool call, so you can stop a runaway engagement at any point even though execution is otherwise fully autonomous.

---

## 7. Context Folder + RAG

Per-engagement hidden folder structure (mounted as a Docker volume, so it survives restarts):

```
/engagements/{engagement_id}/
├── scope.json                # locked assets: domains, IPs, CIDRs, live URLs
├── .context/
│   ├── recon/                # Recon Commander's private working notes
│   ├── enum/                 # Enumeration Commander's private notes
│   ├── vuln/                 # Vuln-Analysis Commander's private notes
│   ├── exploit/              # Exploitation Commander's private notes
│   └── whiteboard/           # Aggregator-written, read-only for all agents
│       ├── findings.jsonl
│       └── summary.md
├── audit.log                 # append-only, see §11
└── report/
    └── final_report.md
```

- **RAG:** as `whiteboard/findings.jsonl` and `summary.md` grow, the Aggregator embeds new entries (only structured, cleaned text — never raw tool output) into that engagement's Qdrant collection. Commanders query this via similarity search instead of loading the whole growing whiteboard into their prompt every time — this is exactly the "stop context overload" behavior you described.
- Each engagement's context folder and vector collection are fully isolated from every other engagement.

---

## 8. Tool Registry & Sandbox

- All tools are defined once as **Pydantic-validated function schemas** (`registry.py`): `run_subfinder(domain)`, `run_httpx(urls)`, `run_nuclei(target, templates)`, `run_nmap(target, flags)`, etc.
- The Commander LLM only ever picks a tool name + fills in an argument schema — it never writes shell strings. This closes off command-injection entirely, since the Executor builds the actual command from validated, typed arguments.
- Every tool call in the registry has: a timeout, an output size cap, a scope check (via ScopeGuard, §6), and a result parser that converts raw output into a typed finding.
- Higher-risk tools (e.g. sqlmap, active exploit modules) are flagged in the registry with a `risky: true` marker — I'd suggest gating these behind an explicit engagement-level toggle for now (default off), since an autonomous exploit chain running SQLi payloads unsupervised against a live target has real potential for damage/data loss. This is the one place I'd push back on "fully autonomous by default" — happy to make it a config flag rather than a hard requirement.

---

## 9. Prompt-Injection Defense & Avoiding LLM Over-Refusal

- **Injection defense:** raw target-controlled content (HTTP response bodies, banners, page titles, etc.) is *never* passed straight into a Commander's prompt as if it were instructions. The Executor's `ResultParser` step extracts only specific typed fields (status code, server header, matched nuclei template ID, etc.) — free text from the target is stored as inert "evidence" data, wrapped in clear delimiters, and the Commander's system prompt explicitly instructs it to treat that block as untrusted data, never as instructions.
- **Avoiding refusals:** because Commanders only ever select from a fixed, pre-approved tool registry (rather than being asked to "write an exploit for X"), most models refuse far less — the LLM's actual output is closer to "call `run_nuclei` with these params" than to attack code. Each Commander's system prompt should also state the engagement is authorized, scoped, and logged (referencing the engagement ID), which further reduces false-refusal triggers on legitimate security tooling. If you're calling a hosted API (Claude/GPT), keep the riskiest tool-selection decisions (e.g. whether to fire an actual exploit) as simple deterministic rules rather than open-ended LLM judgment, to avoid both refusals and unpredictable behavior.

---

## 10. Auth & API

- JWT **access + refresh token** pair issued by the backend on login; no RBAC, just authenticated-or-not (per your answer).
- CORS configured on FastAPI to allow only your Vercel frontend origin.
- Key endpoints: `POST /auth/login`, `POST /auth/refresh`, `POST /engagements`, `GET /engagements/{id}`, `GET /engagements/{id}/report`, `POST /engagements/{id}/abort`, `WS /engagements/{id}/live`.

---

## 11. Audit Trail

- `audit.log` per engagement: **append-only**, one line per action (timestamp, agent, tool, exact validated params, target, result hash). Also mirrored into a Postgres `audit_log` table for querying.
- Recommend hash-chaining each line (include the previous line's hash) so tampering is at least detectable — cheap to add, meaningful for a pentest tool since this log is your legal record of "what actually ran against the target and when."

---

## 12. Reporting & Severity Scoring

- Final output: `report/final_report.md`, generated by a Reporting agent that reads the whiteboard + RAG-retrieved context (not raw agent scratch files).
- **CVSS v3.1** scoring per finding (base score at minimum), plus a plain-language severity label (Critical/High/Medium/Low/Info) since the audience may not all be reading raw CVSS vectors.
- Report structure: executive summary → scope/assets tested → findings (sorted by severity) → evidence per finding → recommendations.

---

## 13. Observability

- **Structured JSON logging** everywhere (backend, worker), correlated by `engagement_id` + `job_id`.
- **LangGraph/agent tracing:** recommend LangSmith (or a self-hosted equivalent) so you can see the actual decision trace of each Commander — very useful for debugging why an agent chose a given tool/target.
- Basic metrics: job queue depth, tool execution time, LLM token usage/cost per engagement (worth tracking early, autonomous chains can burn tokens fast).

---

## 14. Deployment (VPS)

- Single VPS, `docker compose` stack: `nginx`, `backend`, `worker` (tool-runner), `postgres`, `redis`, `qdrant`.
- Nginx handles TLS (certbot/Let's Encrypt), reverse-proxies to `backend`.
- Secrets (LLM API keys, JWT signing key, DB creds) via a `.env` file **not committed to git**, or a secrets manager if you want to go slightly further.
- Frontend deploys independently on Vercel and only ever calls the VPS's public HTTPS endpoint.

---

## 15. Tech Stack Summary

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

## 16. Assumptions Made (flag if any of these are wrong)

1. LLM provider: assumed a hosted API (e.g. Anthropic/OpenAI) for Commander/Reporting agents — swap freely, nothing above is provider-specific.
2. Risky/active-exploit tools (sqlmap etc.) are gated behind a config flag rather than on by default — flag this if you actually want them live from day one.
3. Single VPS is enough for now — this doc doesn't plan for horizontal scaling, since you said scale isn't a concern.
4. No RBAC beyond "authenticated user" per your answer.

---

## 17. Still Open (small list, your call)

- Which LLM/provider and do you already have API access set up?
- Do you have a domain name + DNS pointed at the VPS for the TLS cert, or is that still pending?
- Should `risky: true` tools (sqlmap, exploit modules) be **on or off by default** for now?
- Any CI/CD preference for building/pushing the Docker images, or is deploy going to be manual for now?
