# MaximReconForge — AI Workflow (AI Loop Only)

**Scope:** the mechanics of the Commander reasoning loop, isolated from surrounding infra. This is the workflow inside Vuln-Analysis and Exploitation only — Recon/Enumeration have no AI workflow (they're deterministic pipelines), and Reporting is a single call, not a loop. For where this sits in the full engagement, see `MaximReconForge_Workflow_Complete.md`.

---

## 1. Loop Entry

Triggered by the Supervisor when it transitions into Vuln-Analysis or Exploitation. Commander receives:
- Its own private-folder scratch notes (read/write, itself only).
- The engagement's system prompt context: authorized/scoped/logged framing, engagement ID.
- No automatic whiteboard dump — context is pulled, not pushed (§2).

---

## 2. Context Retrieval (per iteration, on demand)

Two paths, Commander chooses which it needs — RAG is not force-injected every turn:

| Path | Mechanism | Used for |
|---|---|---|
| Deterministic | Direct Postgres query (`assets`, `findings`) | Exact-match lookups: "was this port already scanned," "what's live on this asset" |
| Semantic | `search_whiteboard(query)` tool → Qdrant similarity search, scoped to this engagement's collection | Fuzzy cross-finding pattern matching, "what have we learned that's relevant to X" |

---

## 3. Decision Step

Commander emits exactly one of:
- A tool-call request: tool name + validated argument schema (e.g. `run_ffuf(target, wordlist)`). Never raw shell text, never free-form reasoning treated as an instruction to any downstream system.
- `phase_complete(summary)` — the typed termination signal (§5).

Model used for this decision:
- Vuln-Analysis: Sonnet 5, always.
- Exploitation: Sonnet 5 by default; escalates to Opus 4.8 specifically for multi-step sqlmap/chained-exploit reasoning steps.

---

## 4. Validation → Execution → Parse

```
Commander proposes tool call
   → ScopeGuard checks target against locked scope.json (domain-suffix + resolved-IP/CIDR)
       → fail: rejected, logged, loop continues without executing
       → pass: Executor (Tool-Runner) runs the tool in the sandbox
   → ResultParser converts raw output into typed fields
       (free-text target content, if any, stored as delimited "untrusted evidence," never
        re-injected into the Commander's prompt as an instruction)
   → loop back to step 2 (context retrieval) for the next iteration
```

---

## 5. Termination

Same tool-call channel as every other Commander decision — not a separate free-text signal:

```python
class PhaseComplete(BaseModel):
    summary: str
```

Calling `phase_complete` instead of a scan/exploit tool: skips ScopeGuard (nothing to validate), writes one audit-log line like any other action, hands control to the Supervisor for the phase transition.

---

## 6. Circuit Breakers (checked every iteration, by the Supervisor — not the LLM)

| Check | Vuln-Analysis | Exploitation | On trip |
|---|---|---|---|
| Iteration count | ~10 | ~15–20 | Force phase transition |
| Token spend | phase-level ceiling | phase-level ceiling | Force phase transition |

Both write a `phase_cap_exceeded` audit event distinct from a normal `phase_complete`, and both are surfaced later as an explicit caveat by the Reporting agent — never silently absorbed.

---

## 7. Model Escalation Workflow (Exploitation only)

```
Commander (Sonnet 5) evaluates next action
   → is this a multi-step sqlmap / chained-exploit reasoning decision?
       → no  : proceed on Sonnet 5
       → yes : re-issue this decision on Opus 4.8, proceed with its output
```

Escalation is per-decision, not per-phase — most of an Exploitation phase still runs on Sonnet 5.

---

## 8. Loop Exit → Handoff

On `phase_complete()` or cap trip:
1. Aggregator (deterministic, not an LLM) reads the Commander's private notes + structured findings for that phase.
2. Consolidates into `whiteboard/findings.jsonl` and `summary.md`.
3. Embeds only the cleaned, structured entries into Qdrant — never raw tool output, never the Commander's raw scratch notes.
4. Control returns to the Supervisor for the next phase transition (or Reporting, if this was Exploitation).
