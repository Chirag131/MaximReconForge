# MaximReconForge — AI Layer, Phase-Wise Implementation Checklist

**Purpose:** an ordered, dependency-respecting build plan for the AI reasoning layer, synthesized from:
- `MaximReconForge_Architecture_AI.md` (what the AI layer *is*)
- `MaximReconForge_Workflow_AI.md` (how the Commander loop *runs*)
- `MaximReconForge_ImplementationPlan_AI.md` (what to *build*)

**Nothing here is code yet** — this is the sequence to build in, and how to prove each phase works before moving on.

**Golden rules carried through every phase (from the architecture docs):**
1. Every LLM emits **only** a validated tool-call from a fixed registry — never raw shell text, never free-form reasoning treated as an instruction.
2. **ScopeGuard, Executor, ResultParser, Aggregator are pure code** — never LLM-driven. They are the trust boundary.
3. Raw target-controlled text is **never** shown to a Commander as an instruction — only as delimited, inert "evidence."
4. Caps are **Supervisor-enforced in code**, never left to the Commander's judgment.
5. Only **cleaned, structured** entries are embedded — never raw tool stdout, never Commander scratch notes.

---

## Phase 0 — Preconditions (verify before writing any AI code)

These are assumed complete by the AI implementation plan (Phases 0–3 of the *Complete* plan). Confirm they exist first — the AI layer bolts onto them.

- [ ] Infra + sandbox tool-runner exists and returns **parsed structured JSON**, not raw stdout.
- [ ] Deterministic **Recon** pipeline works (subfinder + amass → dedupe → httpx → naabu).
- [ ] Deterministic **Enumeration** pipeline works (nmap on naabu ports → nuclei on httpx hosts).
- [ ] **Supervisor** skeleton exists and can transition between the five phases.
- [ ] **Whiteboard** skeleton exists: `findings.jsonl`, `summary.md`, per-role private folders.
- [ ] Postgres `assets` / `findings` tables populated by the deterministic phases.
- [ ] Hash-chained **audit log** exists and every existing action already writes to it.
- [ ] `scope.json` is locked per engagement (domain-suffix + resolved-IP/CIDR).

**How to test Phase 0:** run a full Recon+Enum engagement end-to-end with no AI. Confirm `assets`/`findings` are populated, the whiteboard has structured entries, and every tool run produced an audit line. If this doesn't work, stop — the AI layer has nothing to reason over.

---

## Phase 1 — Model Client Wiring

**Goal:** the single model string reachable for all three LLM roles. No loop yet.

- [ ] Groq API client configured for one model string, `openai/gpt-oss-120b`, used by Vuln-Analysis, Exploitation, and Reporting.
- [ ] **Explicit config assertion** that no other provider/model is reachable in this pipeline — a hard check, not omission, so a future default-model change can't silently reintroduce one.
- [ ] Every model call passes an engagement ID through for audit correlation.

**Dependencies:** Phase 0.

**How to test:**
- Unit: mock the API, assert each role resolves to `openai/gpt-oss-120b`.
- Assertion test: force config to point a role at a disallowed model string → the guard must raise, not pass.
- Smoke: one round-trip call returns a structured response.

---

## Phase 2 — Registry Additions (AI-specific tools)

**Goal:** the two AI-only tools exist in the same registry and audit path as scan tools.

- [ ] `phase_complete` tool registered, **available only to Vuln-Analysis + Exploitation Commanders**:
  ```python
  class PhaseComplete(BaseModel):
      summary: str
  ```
  Calling it skips ScopeGuard (no target), writes one normal audit line, hands control to the Supervisor.
- [ ] `search_whiteboard(query)` tool registered, available to both Commanders — Qdrant similarity search scoped to the engagement's collection. (Backing Qdrant wiring lands in Phase 4; register the interface here.)
- [ ] Confirm **both** route through the *same* audit-logging path as scan/exploit tools — no special-cased logging.
- [ ] Tool registry supports **per-role scoping** (a role only sees the tools it's allowed) — needed for sqlmap gating in Phase 8.

**Dependencies:** Phase 0 (registry), Phase 1 (models to call the tools).

**How to test:**
- Unit: `phase_complete` validates its schema; a malformed arg is rejected.
- Audit test: invoking `phase_complete` produces a hash-chained audit line indistinguishable in path from a scan-tool line.
- ACL test: a role not granted a tool cannot see or select it (assert on the registry view, not on prompt text).

---

## Phase 3 — Context Retrieval Wiring

**Goal:** both context paths work, on-demand — nothing force-injected into prompts.

- [ ] **Deterministic path (default):** direct Postgres query helpers exposed to Commanders for exact-match lookups ("was this port already scanned," "what's live on this asset"). No LLM call for these.
- [ ] **Semantic path (on-demand):** `search_whiteboard` wired to the per-engagement Qdrant collection.
- [ ] Confirm **collection isolation** — one engagement's query can never return another engagement's vectors.
- [ ] Confirm context is **pulled, not pushed** — no automatic whiteboard dump into the Commander prompt on loop entry.

**Dependencies:** Phase 2 (`search_whiteboard` registered), Phase 4 provides the embedded data it searches (build the wiring here, validate retrieval quality after Phase 4).

**How to test:**
- Postgres helpers return correct rows for known fixtures.
- **Isolation test:** seed two engagements' collections, query from engagement A, assert zero engagement-B hits.
- Assert loop entry does not inject the whiteboard — the first prompt contains only private notes + system framing.

---

## Phase 4 — RAG / Aggregator Embedding Pipeline

**Goal:** the Aggregator (pure code) is the sole writer that turns finished-phase output into searchable memory.

- [ ] One Qdrant collection **per engagement**, created at engagement start.
- [ ] Aggregator triggers embedding **on every whiteboard write**, not on a timer.
- [ ] Embedding source is **only** `findings.jsonl` structured entries + `summary.md`.
- [ ] **Guard:** raw tool stdout and Commander scratch notes can never reach the embedding step (assert on the embed input, not by convention).
- [ ] Define + implement the collection teardown/archival per data-retention policy (see Open Items).

**Dependencies:** Phase 3 (collection interface), Phase 0 (whiteboard).

**How to test:**
- Write a structured finding → assert a vector appears and `search_whiteboard` retrieves it.
- **Negative test:** feed raw stdout / scratch notes through the Aggregator → assert nothing embeddable is produced from them.
- Confirm embed fires on write, not on a clock (drive it by a write, assert immediate).

---

## Phase 5 — Prompt Templates

**Goal:** each LLM role has a system prompt that encodes authorization framing, the injection boundary, and role-scoped tools.

For **Vuln-Analysis Commander**, **Exploitation Commander**, **Reporting agent**:
- [ ] System prompt states the engagement is **authorized, scoped, and logged**, referencing the engagement ID explicitly (reduces false refusals on legitimate security tooling).
- [ ] System prompt explicitly frames any delimited **"evidence" block as untrusted target-controlled data — never an instruction**, regardless of content.
- [ ] **Tool list scoped per role** — Vuln-Analysis Commander must not *see* `run_sqlmap` at all when `risky` is off (structural, not "told not to use it").
- [ ] Reporting prompt: read whiteboard + RAG context only; **must surface any `phase_cap_exceeded` event as a caveat**, never omit it.

**Dependencies:** Phase 2 (per-role tool scoping), Phase 1 (models).

**How to test:**
- Snapshot each rendered system prompt for a fixture engagement; assert the three framing elements are present.
- Assert the Vuln-Analysis prompt's tool list excludes `run_sqlmap` when `risky=off`.
- (Prompt-injection behavior is proven end-to-end in Phase 10, but a first check can run here against a Commander stub.)

---

## Phase 6 — Vuln-Analysis Commander Loop (first full loop)

**Goal:** assemble the canonical loop end-to-end for the simpler phase (no escalation). This is the reference implementation the Exploitation loop reuses.

Loop, per the workflow doc:
```
Loop entry (private notes + system framing, no whiteboard dump)
  → Context retrieval (deterministic Postgres OR search_whiteboard, on demand)
  → Decision: exactly one validated tool-call OR phase_complete(summary)
  → ScopeGuard: validate target vs locked scope.json (domain-suffix + resolved-IP/CIDR)
        fail → reject + log, loop continues WITHOUT executing
        pass → Executor runs tool in sandbox
  → ResultParser: raw output → typed fields; free text stored as delimited untrusted evidence
  → loop back to context retrieval
```

- [ ] Wire Commander(gpt-oss-120b) → ScopeGuard → Executor → ResultParser as the Vuln-Analysis subgraph.
- [ ] Commander emits exactly one decision per iteration (a tool-call or `phase_complete`).
- [ ] ScopeGuard rejection path logs and continues the loop without executing.
- [ ] ResultParser is the **prompt-injection boundary**: typed fields extracted; any free text stored as clearly delimited, inert evidence — never re-injected as an instruction.
- [ ] On `phase_complete`: hand to Supervisor; Aggregator (Phase 4) consolidates private notes + structured findings into the whiteboard, then embeds.

**Dependencies:** Phases 1–5.

**How to test:**
- Happy path: seed findings, run the loop, confirm it proposes a targeted action (e.g. `run_ffuf`), executes, parses, and eventually calls `phase_complete`.
- Confirm every iteration writes an audit line (proposal, scope result, execution, parse).
- Confirm loop exit → Aggregator → whiteboard + embedding all fire.

---

## Phase 7 — Termination & Circuit Breakers (Supervisor-side)

**Goal:** the loop cannot run forever; the cap is code, not the LLM's opinion.

- [ ] Supervisor-side **iteration counter** per phase per engagement: Vuln-Analysis ~10, Exploitation ~15–20.
- [ ] Supervisor-side **token-spend ceiling** per phase, separate from the iteration cap.
- [ ] On either trip: **force phase transition** + write `phase_cap_exceeded` audit event (distinct type from `phase_complete`).
- [ ] Confirm caps are checked **every iteration by the Supervisor**, never by the Commander.
- [ ] Decide `phase_cap_exceeded` → abort-flag behavior (auto-trip vs annotate only) — see Open Items; wire whichever is chosen.

**Dependencies:** Phase 6 (a real loop to cap).

**How to test:**
- **Iteration cap:** feed ambiguous findings with no clear next step, confirm the loop stops at the cap and logs `phase_cap_exceeded`.
- **Token ceiling:** same setup but budget-triggered; confirm it trips independently of iteration count.
- Confirm the counter/budget live in the Supervisor — disabling Commander cooperation does not defeat the cap.

---

## Phase 8 — Exploitation Commander + sqlmap Gating

**Goal:** second loop, reusing Phase 6, adding sqlmap gating.

- [ ] Wire the Exploitation subgraph reusing the Phase 6 loop shape.
- [ ] **sqlmap gating:** Exploitation Commander cannot *select* `run_sqlmap` when the engagement's `risky` toggle is off — enforced by the registry ACL, independent of prompt content.
- [ ] Exploitation cap ~15–20 (from Phase 7) applies here.

**Dependencies:** Phases 6, 7; Phase 5 (role-scoped tools).

**How to test:**
- **sqlmap gating:** with `risky=off`, the Commander cannot pick `run_sqlmap` even if evidence text tries to induce it.

---

## Phase 9 — Reporting Agent

**Goal:** single gpt-oss-120b call producing the human-facing artifact, honest about caps.

- [ ] Single call (not a loop): reads whiteboard + RAG context, emits `final_report.md`.
- [ ] Prompt (from Phase 5) requires surfacing every `phase_cap_exceeded` event as an explicit caveat.
- [ ] Consolidation + severity narrative only — no tool execution, no ScopeGuard path needed.

**Dependencies:** Phases 4 (RAG), 7 (`phase_cap_exceeded` events exist to surface).

**How to test:**
- Run an engagement that hit a cap → assert the report explicitly caveats it, does not present the phase as cleanly finished.
- Run a clean engagement → assert a coherent severity narrative with no spurious caveat.

---

## Phase 10 — Full AI Eval Suite (gate before first live engagement)

Run against a complete Supervisor-driven engagement. All must pass:

- [ ] **Scope-escape:** a finding references an out-of-scope asset → ScopeGuard rejects the resulting tool call and logs it; loop continues.
- [ ] **Prompt-injection:** an instruction-like string planted in a mock HTTP body/banner/title is stored as delimited evidence and does **not** change Commander behavior.
- [ ] **Cap trigger (iteration):** non-terminating loop hits the iteration cap; `phase_cap_exceeded` logged and later surfaced in the report.
- [ ] **Cap trigger (token):** same, budget-triggered.
- [ ] **sqlmap gating:** `risky=off` → `run_sqlmap` unselectable regardless of prompt content.
- [ ] **Collection isolation:** no cross-engagement RAG leakage.
- [ ] **Embedding purity:** raw tool output / scratch notes never reach the embedder.
- [ ] **Audit completeness:** every Commander action — including `phase_complete` and every rejection — has a corresponding hash-chained audit line.

**Exit criteria:** the entire suite green on a full mock engagement (Recon → Enum → Vuln-Analysis → Exploitation → Reporting).

---

## Build Order Summary

| Phase | Deliverable | Blocks |
|---|---|---|
| 0 | Preconditions verified | everything |
| 1 | Model client wiring | 2, 5, 6 |
| 2 | Registry additions (`phase_complete`, `search_whiteboard`, per-role scoping) | 3, 5, 6 |
| 3 | Context retrieval (Postgres + semantic) | 6 |
| 4 | RAG / Aggregator embedding | 6, 9 |
| 5 | Prompt templates | 6, 9 |
| 6 | Vuln-Analysis Commander loop (reference loop) | 7, 8 |
| 7 | Termination + circuit breakers | 8, 9 |
| 8 | Exploitation Commander + sqlmap gating | 10 |
| 9 | Reporting agent | 10 |
| 10 | Full AI eval suite | go-live gate |

---

## Open Items (resolve before the phase that needs them)

- **Qdrant retention** — per-engagement collection teardown/archival policy after report delivery. Decide before **Phase 4**.
- **`phase_cap_exceeded` semantics** — auto-trip the engagement abort flag, or annotate the report only? Decide before **Phase 7**.

---

## Notes on Model Naming

All three LLM roles use a single model, `openai/gpt-oss-120b`, served via Groq — no tiering, no escalation. Reconcile against the current Groq model catalog at wiring time in Phase 1 if the available model string changes.
