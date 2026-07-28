# MaximReconForge — Complete Implementation Plan

**Scope:** build order for the entire system, infra + AI, as a phased checklist. For the AI-specific build steps in isolation, see `MaximReconForge_ImplementationPlan_AI.md`.

---

## Phase 0 — Infra Scaffolding

- [ ] `docker-compose.yml`: `nginx`, `backend`, `worker`, `postgres`, `redis`, `qdrant`.
- [ ] Nginx: TLS via certbot, HTTP→HTTPS redirect, WebSocket upgrade headers, basic rate limiting.
- [ ] Postgres schema: `users`, `engagements`, `assets`, `findings`, `audit_log`, plus LangGraph checkpoint tables.
- [ ] Redis + ARQ worker skeleton (async, no Celery beat/flower needed).
- [ ] FastAPI skeleton: JWT auth (access + refresh), CORS locked to the Vercel origin.
- [ ] Endpoints: `POST /auth/login`, `POST /auth/refresh`, `POST /engagements`, `GET /engagements/{id}`, `GET /engagements/{id}/report`, `POST /engagements/{id}/abort`, `WS /engagements/{id}/live`.

## Phase 1 — Tool Registry & Sandbox

- [ ] Tool-Runner container: non-root, read-only root filesystem except per-engagement writable volume, CPU/memory limits.
- [ ] `registry.py`: Pydantic schemas for `run_subfinder`, `run_amass`, `run_httpx`, `run_naabu`, `run_nmap`, `run_nuclei`, `run_ffuf`, `run_sqlmap` (flagged `risky: true`).
- [ ] Per-tool: timeout, output size cap, ResultParser (raw → typed fields).
- [ ] `risky: true` gating: per-engagement toggle, default off, enforced before Executor dispatch.

## Phase 2 — Deterministic Recon & Enumeration Pipelines

- [ ] Recon node (no LLM): subfinder + amass (parallel) → dedupe → httpx → naabu → write `scope.json`.
- [ ] Scope lock: everything in `scope.json` becomes immutable boundary for later phases.
- [ ] Enumeration node (no LLM): nmap on naabu's open ports → nuclei on httpx's live hosts.
- [ ] Write structured findings to Postgres `assets`/`findings` as they're produced.

## Phase 3 — LangGraph Supervisor & Whiteboard

- [ ] Supervisor graph: routes between phase subgraphs, checks abort flag before every transition.
- [ ] Per-agent private context folders (read/write, self only).
- [ ] Aggregator (deterministic service): sole writer to `whiteboard/findings.jsonl` and `summary.md`.
- [ ] `ContextStore` API: enforces per-role read/write ACLs; read-only filesystem mounts as defense-in-depth.
- [ ] Qdrant: one collection per engagement, embeddings generated only from cleaned whiteboard entries.

## Phase 4 — Vuln-Analysis Commander

- [ ] Commander loop: propose tool call → ScopeGuard → Executor → ResultParser → loop.
- [ ] Model wiring: Sonnet 5.
- [ ] `search_whiteboard(query)` tool → Qdrant similarity search.
- [ ] `phase_complete` tool registered, typed termination.
- [ ] Iteration cap (~10) and token ceiling, enforced by Supervisor.

## Phase 5 — Exploitation Commander

- [ ] Same loop structure as Phase 4, scoped to confirmed findings.
- [ ] sqlmap only callable if `risky: true` toggle enabled for the engagement.
- [ ] Escalation logic: Sonnet 5 default, Opus 4.8 for multi-step sqlmap/chained-exploit reasoning.
- [ ] Iteration cap (~15–20) and token ceiling.
- [ ] `phase_cap_exceeded` audit event type on cap trip.

## Phase 6 — Reporting Agent

- [ ] Single call, Opus 4.8, reads whiteboard + RAG context only (never raw scratch files).
- [ ] CVSS v3.1 scoring per finding + plain-language severity label.
- [ ] Report structure: executive summary → scope/assets → findings by severity → evidence → recommendations.
- [ ] Surface any `phase_cap_exceeded` events as explicit caveats.

## Phase 7 — Security & Observability Hardening

- [ ] ScopeGuard: domain-suffix + resolved-IP/CIDR matching, enforced in code before every Executor call.
- [ ] Audit log: hash-chained lines, mirrored to Postgres `audit_log`.
- [ ] Kill switch: abort flag checked before every phase transition and tool dispatch.
- [ ] Prompt-injection defense: verify no raw target-controlled text ever reaches a Commander prompt unparsed.
- [ ] Structured JSON logging (backend + worker), correlated by `engagement_id` + `job_id`.
- [ ] LangSmith (or equivalent) tracing on Commander decisions.
- [ ] Metrics: queue depth, tool execution time, token usage/cost per engagement.

## Phase 8 — Deployment

- [ ] VPS provisioned, DNS pointed, TLS cert issued.
- [ ] `.env` for secrets (LLM API keys, JWT signing key, DB creds), not committed.
- [ ] Frontend deployed to Vercel, pointed at the VPS's public HTTPS endpoint.
- [ ] End-to-end smoke test: submit domain → confirm report generated → confirm audit log complete.

---

## Assumptions

1. Hosted Anthropic API for all LLM roles.
2. Single VPS, no horizontal scaling planned.
3. No RBAC beyond authenticated/not.
4. sqlmap default off.

## Open Items

- LLM provider API access already set up?
- Domain name + DNS pointed at the VPS?
- CI/CD for image builds, or manual deploy for now?
