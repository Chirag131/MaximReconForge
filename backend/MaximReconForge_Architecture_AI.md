# MaximReconForge — AI Architecture (AI Layer Only)

**Scope:** everything AI-internal — which phases have a model, which model, how the reasoning loop is structured, how context/RAG works, and how the loop terminates. Infra, sandboxing, and non-AI security controls are covered in `MaximReconForge_Architecture_Complete.md`.

---

## 1. Overview

Of five engagement phases, three contain an LLM: Vuln-Analysis, Exploitation, Reporting. Two — Recon and Enumeration — are deterministic pipelines with no LLM at all. Every LLM in the system only ever emits a structured tool-call request from a fixed registry; none of them write raw shell text, and none of them talk to each other directly.

---

## 2. Which Phases Have AI, and Why Not All Five

| Phase | Has LLM? | Reason |
|---|---|---|
| Recon | No | Fixed sequence always: subfinder + amass → dedupe → httpx → naabu. No branching decision exists. |
| Enumeration | No | Fixed sequence always: nmap on naabu's open ports → nuclei on httpx's live hosts. Same — a pipeline, not a decision. |
| Vuln-Analysis | Yes | First real reasoning point — chaining findings into a hypothesis, deciding what to investigate further. |
| Exploitation | Yes | Chained decisions against confirmed findings; sqlmap gating applies. |
| Reporting | Yes | Consolidation and severity narrative — single call, not a loop. |

This is a deliberate departure from frameworks that run an LLM through every phase by default (the common pattern). The principle: an LLM sits only where a decision actually exists. Side benefit, not the primary reason: lower cost, lower latency, smaller prompt-injection surface on the two mechanical phases.

---

## 3. Agent Roles & Model Tier

| Role | Model | Notes |
|---|---|---|
| Vuln-Analysis Commander | Claude Sonnet 5 | Reasons over consolidated nmap/nuclei findings, proposes targeted ffuf/next-step actions. |
| Exploitation Commander | Claude Sonnet 5 (default), Claude Opus 4.8 (escalation) | Escalates only for multi-step sqlmap/chained-exploit reasoning; most decisions don't need frontier depth. |
| Reporting agent | Claude Opus 4.8 | One call per engagement — cost is a non-issue, it's the human-facing artifact. |
| Aggregator / ScopeGuard / ResultParser | None (pure code) | Never LLM-driven, by design — these are the deterministic controls the rest of the system trusts. |


---

## 4. Commander / Executor / ScopeGuard Structure

- **Commander** — LLM, decides *what* to do next and *why*. Emits only a tool name + validated argument schema. Never raw shell text.
- **ScopeGuard** — deterministic, non-LLM. Sits between every Commander proposal and execution; validates target against locked scope before anything runs.
- **Executor** (Tool-Runner) — runs the validated tool call in the sandbox, returns parsed structured JSON, never raw stdout.
- **ResultParser** — extracts typed fields (status codes, template IDs, ports) from raw output; this is also the prompt-injection boundary (§7).

This separation is what makes prompt-injection defense structural rather than instructional: a Commander is never shown raw target-controlled text framed as if it were a directive.

---

## 5. Context Model — Private Workspace + Whiteboard + RAG

- Each agent has a private, per-role folder — read/write for itself only.
- A deterministic **Aggregator** (not an LLM) is the sole writer to the shared **whiteboard** (`findings.jsonl`, `summary.md`), consolidating each agent's private notes and structured findings.
- All agents have read-only whiteboard access, enforced both via an internal `ContextStore` API with per-role ACLs and read-only filesystem mounts as defense-in-depth.
- **RAG contact pattern:** not auto-injected into every prompt. Two paths:
  - **Deterministic path (default):** direct Postgres queries against `assets`/`findings` for exact-match questions ("was this port already scanned").
  - **Semantic path (on-demand):** an explicit `search_whiteboard(query)` tool hitting the engagement's isolated Qdrant collection, used only for fuzzy cross-phase pattern matching.
- Only cleaned, structured whiteboard entries are embedded — never raw tool output.

---

## 6. Termination Mechanism

Termination uses the same schema-only channel as every other Commander action — no separate free-text-derived signal.

```python
class PhaseComplete(BaseModel):
    summary: str  # short rationale, written to the audit log verbatim
```

Registered in the same tool registry as `run_nuclei`, `run_ffuf`, etc., available only to Vuln-Analysis and Exploitation Commanders. Calling it skips ScopeGuard (no target to validate), logs to the hash-chained audit log like any other action, and hands control straight back to the Supervisor for the phase transition.

---

## 7. Iteration Caps & Token Ceilings

`phase_complete` alone isn't a sufficient breaker — a Commander can reason its way into "not done yet" indefinitely.

| Phase | Iteration cap | Rationale |
|---|---|---|
| Vuln-Analysis | ~10 | Mostly a single consolidated reasoning pass. |
| Exploitation | ~15–20 | Chained exploitation needs more room. |

Plus a per-phase token-spend ceiling, same bounded-execution principle already applied to every tool's timeout/output-size cap.

**On cap hit:** Supervisor force-transitions to the next phase, writes a `phase_cap_exceeded` audit event, and the Reporting agent is required to surface this as an explicit caveat rather than treating the phase as cleanly finished.

---

## 8. Prompt-Injection Defense

Raw target-controlled content (HTTP bodies, server banners, page titles) is never passed to a Commander as if it were an instruction. ResultParser extracts only specific typed fields; any free text is stored as inert, clearly delimited "evidence" data, and each Commander's system prompt explicitly instructs it to treat that block as untrusted data — never as directives. System prompts also state the engagement is authorized, scoped, and logged (by engagement ID), which independently reduces false-refusal triggers on legitimate security tooling.

---

## 9. AI-Only Graph Shape

```
Supervisor
 ├─ Vuln-Analysis subgraph : Commander(Sonnet 5) → ScopeGuard → Executor → ResultParser
 │                            → loop back, until phase_complete() OR iteration/token cap
 │                            → Aggregator → Supervisor
 ├─ Exploitation subgraph  : Commander(Sonnet 5 / Opus 4.8 escalation) → ScopeGuard
 │                            → Executor → ResultParser → loop back,
 │                            until phase_complete() OR iteration/token cap → Aggregator → Supervisor
 └─ Reporting subgraph     : single call, Opus 4.8, reads whiteboard + RAG context → final_report.md
```

Abort-flag and ScopeGuard checks apply identically to every dispatch, same as the deterministic phases.

---

## 10. Open Items

- Exact escalation trigger for Sonnet → Opus inside Exploitation (currently: sqlmap-involved chains only).
- Whether `phase_cap_exceeded` should trip the abort flag automatically or just annotate the report.
