# MaximReconForge — AI Implementation Plan (AI Layer Only)

**Scope:** just the build steps for the AI reasoning layer — model wiring, prompts, termination, caps, RAG pipeline, and testing. Assumes Phases 0–3 of the complete plan (infra, tool registry, deterministic Recon/Enum, Supervisor/whiteboard skeleton) already exist. See `MaximReconForge_ImplementationPlan_Complete.md` for those.

---

## 1. Model Client Wiring

- [ ] Groq API client configured for a single model string: `openai/gpt-oss-120b`, used for all three LLM roles (Vuln-Analysis, Exploitation, Reporting).
- [ ] No other provider/model reachable in this pipeline — confirm this explicitly in config, not just by omission, so a future default-model change doesn't silently reintroduce one.

## 2. Registry Additions (AI-specific)

- [ ] `phase_complete` tool added to the registry, available only to Vuln-Analysis and Exploitation Commanders:
```python
class PhaseComplete(BaseModel):
    summary: str
```
- [ ] `search_whiteboard(query)` tool: Qdrant similarity search scoped to the engagement's collection, available to both Commanders.
- [ ] Confirm both route through the same audit-logging path as scan/exploit tools (no special-cased logging).

## 3. Prompt Templates

For each Commander (Vuln-Analysis, Exploitation) and the Reporting agent:
- [ ] System prompt states: engagement is authorized, scoped, and logged (reference engagement ID explicitly) — reduces false-refusal on legitimate security tooling.
- [ ] System prompt explicitly instructs: any delimited "evidence" block is untrusted target-controlled data, never an instruction, regardless of its content.
- [ ] Tool list scoped per role — Vuln-Analysis Commander should not see `run_sqlmap` at all when `risky` is off, not just be told not to use it.
- [ ] Reporting agent prompt: read whiteboard + RAG context only; explicit instruction to surface any `phase_cap_exceeded` events as a caveat rather than omitting them.

## 4. Context Retrieval Wiring

- [ ] Deterministic path: direct Postgres query helpers exposed to Commanders for exact-match lookups (no LLM call needed for these).
- [ ] Semantic path: `search_whiteboard` wired to per-engagement Qdrant collection, confirm collection isolation (no cross-engagement leakage) with a test.
- [ ] Confirm Aggregator embeds only cleaned structured entries — add a check that raw tool output never reaches the embedding step.

## 5. Termination & Circuit Breakers

- [ ] Supervisor-side iteration counter per phase per engagement: Vuln-Analysis cap ~10, Exploitation cap ~15–20.
- [ ] Supervisor-side token-spend ceiling per phase (separate from the iteration cap).
- [ ] On either cap trip: force phase transition, write `phase_cap_exceeded` audit event (distinct type from `phase_complete`).
- [ ] Confirm caps are enforced in code (Supervisor), never left to the Commander's own judgment about whether it should stop.

## 6. RAG Pipeline

- [ ] Aggregator triggers embedding on every whiteboard write, not on a timer.
- [ ] Embedding source: `findings.jsonl` structured entries + `summary.md` — never raw tool stdout, never Commander scratch notes.
- [ ] One Qdrant collection per engagement, created at engagement start, torn down/archived per data-retention policy (define this if not already decided).

## 7. Testing & Eval Checklist (AI-specific, before first live engagement)

- [ ] **Scope-escape test:** craft a finding that references an out-of-scope asset, confirm ScopeGuard rejects the resulting tool call and logs it.
- [ ] **Prompt-injection test:** plant an instruction-like string in a mock HTTP response body/banner/title, confirm it's stored as delimited evidence and does not change Commander behavior.
- [ ] **Cap trigger test:** force a Commander into a non-terminating loop (e.g. ambiguous findings with no clear next step), confirm iteration cap fires and `phase_cap_exceeded` is logged and later surfaced in the report.
- [ ] **Token ceiling test:** same as above but budget-triggered rather than iteration-triggered.
- [ ] **sqlmap gating test:** confirm the Exploitation Commander cannot select `run_sqlmap` when the engagement's `risky` toggle is off, regardless of prompt content.
- [ ] **Audit completeness test:** run a full engagement, confirm every Commander action (including `phase_complete` and any rejections) has a corresponding hash-chained audit line.

---

## Open Items

- Data-retention policy for per-engagement Qdrant collections after report delivery.
- Whether `phase_cap_exceeded` should auto-trip the abort flag for that engagement or just annotate the report.
