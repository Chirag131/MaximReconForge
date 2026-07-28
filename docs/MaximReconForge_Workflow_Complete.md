# MaximReconForge — Complete Workflow (End-to-End)

**Scope:** the full path a target takes through the system, infra + AI combined, from submission to report delivery. For the AI-loop mechanics in isolation, see `MaximReconForge_Workflow_AI.md`.

---

## 1. Submission

1. Operator authenticates (`POST /auth/login`, JWT access + refresh pair issued).
2. `POST /engagements` with target domain → FastAPI creates an `engagements` row (status: `pending`), returns engagement ID.
3. Frontend opens `WS /engagements/{id}/live` for streaming progress.
4. Supervisor (LangGraph, running inside FastAPI) starts the graph for this engagement.

---

## 2. Recon Phase (deterministic, no LLM)

1. Supervisor enqueues subfinder and amass jobs via Redis/ARQ, run in parallel by the Tool-Runner worker.
2. Results deduplicated into a candidate hostname list.
3. httpx probes the list, filtering to live web hosts (status, title, tech fingerprint).
4. naabu runs a fast port sweep against live hosts.
5. Combined output (subdomains, resolved IPs, CIDRs, live URLs) is written as `scope.json` — this **locks the scope** for every later phase. Nothing discovered after this point can expand it; out-of-scope discoveries are dropped and logged.
6. Progress streamed over WebSocket; abort flag checked before this phase and before every subsequent transition.

---

## 3. Enumeration Phase (deterministic, no LLM)

1. nmap runs service/version fingerprinting against the specific ports naabu found open (not a blind full sweep).
2. nuclei runs its template library against live assets from httpx, surfacing known CVEs and misconfigurations.
3. Structured findings (template ID, matched detail, port/service info) written to Postgres `findings` and `assets`.
4. Aggregator consolidates into the whiteboard (`findings.jsonl`, `summary.md`) and embeds cleaned entries into the engagement's Qdrant collection.

---

## 4. Vuln-Analysis Phase (AI loop — Sonnet 5)

1. Commander retrieves relevant context: direct Postgres queries for exact-match facts, `search_whiteboard` (Qdrant) for fuzzy pattern matches across accumulated findings.
2. Commander proposes a tool call (e.g. `run_ffuf` against a specific path) or calls `phase_complete`.
3. Every proposed tool call passes ScopeGuard before the Tool-Runner executes it.
4. ResultParser converts raw output to typed findings; loop returns to the Commander.
5. Loop ends on `phase_complete()` or when the iteration/token cap is hit (cap hit → `phase_cap_exceeded` audit event, forced transition).
6. Aggregator consolidates phase output into the whiteboard; Supervisor transitions to Exploitation.

*(Full mechanics of this loop: `MaximReconForge_Workflow_AI.md`.)*

---

## 5. Exploitation Phase (AI loop — Sonnet 5 / Opus 4.8 escalation)

1. Same Commander → ScopeGuard → Executor → ResultParser loop as Vuln-Analysis, scoped to confirmed findings only.
2. `sqlmap` is only callable if the engagement's `risky: true` toggle is explicitly enabled; otherwise the Commander cannot select it regardless of what it proposes.
3. Multi-step sqlmap/chained-exploit reasoning escalates the Commander's model from Sonnet 5 to Opus 4.8 for that decision.
4. Same termination logic: `phase_complete()` or cap hit.
5. Aggregator consolidates; Supervisor transitions to Reporting.

---

## 6. Reporting Phase (single AI call — Opus 4.8)

1. Reporting agent reads the whiteboard and RAG-retrieved context — never raw agent scratch files.
2. Each finding scored CVSS v3.1 (base score) plus a plain-language severity label (Critical/High/Medium/Low/Info).
3. Report assembled: executive summary → scope/assets tested → findings by severity → evidence per finding → recommendations.
4. If any phase hit its iteration/token cap, that's surfaced as an explicit caveat rather than silently omitted.
5. Written to `report/final_report.md`; `GET /engagements/{id}/report` serves it.

---

## 7. Cross-Cutting Flows (apply throughout, not just at the end)

**Abort:** `POST /engagements/{id}/abort` sets a flag in Postgres/Redis. Supervisor checks it before every phase transition and every individual tool dispatch. In-flight jobs finish; nothing new enqueues.

**Audit logging:** every tool call, every ScopeGuard rejection, every `phase_complete`, and every `phase_cap_exceeded` writes one hash-chained line to `audit.log`, mirrored to Postgres `audit_log`.

**Live progress:** every phase transition and tool result pushes an update over the engagement's WebSocket connection.

---

## 8. Full Sequence Summary

```
Submit domain → auth → engagement created
 → Recon (deterministic)      → scope locked
 → Enumeration (deterministic) → findings in whiteboard + Qdrant
 → Vuln-Analysis (Sonnet 5 loop)  → targeted findings, phase_complete or cap
 → Exploitation (Sonnet 5 / Opus 4.8 loop) → confirmed exploits, phase_complete or cap
 → Reporting (Opus 4.8, single call) → final_report.md
 → GET /engagements/{id}/report
```

Abort check + audit log write happen at every arrow above, not just at the named steps.
