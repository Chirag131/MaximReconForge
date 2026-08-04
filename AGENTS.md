# AGENTS.md — MaximReconForge

Standing context for any agent working in this repo. Read this before planning or writing anything.

---

## 1. What this project is

An autonomous cybersecurity recon and penetration-testing platform. A target domain goes in; the system maps its attack surface, chains automated attacks against in-scope assets, and produces a CVSS-scored markdown report — with minimal LLM involvement, not maximal. Full design detail lives in `/docs` (see §6). This file is standing rules, not a spec — don't duplicate the docs here, reference them.

---

## 2. Tech stack (current — Supabase-consolidated)

- **Backend:** FastAPI (async), Python 3.12+
- **Orchestration:** LangGraph, `PostgresSaver` checkpointer against Supabase's Postgres
- **Database + Auth + Realtime + Vector store:** Supabase (Postgres, `auth.users`, Realtime on `engagements`/`findings`, `pgvector` for RAG — see `/supabase`)
- **Task queue:** Redis + ARQ (Supabase doesn't do background jobs — this stays separate)
- **Tool sandbox:** separate Docker container (`worker/`), non-root, resource-limited, holds the actual scan/exploit binaries
- **LLM:** Groq API (active — free tier `openai/gpt-oss-120b` via OpenAI-compatible SDK); Anthropic SDK configured for future provider switch (Sonnet 5 / Opus 4.8). **Never Fable/Mythos** — its safety layer stalls on legitimate security-tool selection.
- **Embeddings:** `whiteboard_embeddings` table (pgvector, 1024-dim, Voyage AI `voyage-3` compatible — stubbed when key omitted)
- **Reverse proxy:** Nginx + certbot

---

## 3. Repo structure (expected)

```
backend/          # FastAPI app, LangGraph Supervisor + subgraphs, registry.py
worker/           # Tool-Runner container — sandboxed, executes whitelisted tools only
supabase/         # migrations + RLS policies (already applied — see supabase/README.md)
docs/             # architecture / workflow / implementation-plan MDs (source of truth for design)
```

If a task requires touching how a phase makes decisions, read the matching doc in `docs/` first — don't infer the design from code alone, several of these decisions (caps, model tiers, termination) were deliberate and non-obvious.

---

## 4. Non-negotiable architectural constraints

These are load-bearing design decisions, not style preferences. Don't "improve" around them without flagging it first.

- **Recon and Enumeration phases have no LLM.** They're fixed deterministic pipelines (`subfinder+amass → httpx → naabu` / `nmap → nuclei`). Do not add a Commander to these phases — there's no decision point to justify one.
- **A Commander only ever emits a tool name + a validated Pydantic argument schema.** Never raw shell text, never a freeform string interpreted as a command. If you're writing code that lets an LLM output influence a shell call directly, stop — that's the exact pattern this architecture exists to prevent.
- **ScopeGuard runs before every single tool execution, no exceptions.** It's deterministic, non-LLM, checks the proposed target against the locked `scope_entries` table. Never skip it "for a quick test" in a code path that could ship.
- **`sqlmap` (and any future `risky: true` tool) is off by default**, gated behind `engagements.risky_tools_enabled`. Never make a risky tool selectable without that check.
- **Termination is a typed tool call (`phase_complete`), not parsed free text.** Plus a hard iteration cap (~10 Vuln-Analysis, ~15–20 Exploitation) and a token-spend ceiling, enforced by the Supervisor — never trust the LLM's own judgment about whether it's done.
- **Raw target-controlled text (HTTP bodies, banners, titles) never reaches a Commander prompt as an instruction.** ResultParser extracts typed fields only; free text gets stored as explicitly delimited "untrusted evidence."
- **`audit_log.prev_hash` / `entry_hash` are computed by a DB trigger** (`supabase/migrations/0003_audit_hash_chain.sql`). Never set these from application code — pass neither field on insert.
- **`findings` dedup is a DB constraint** (`unique (engagement_id, tool, template_id, asset_id)`), not application-side dedup logic. Insert with `on conflict do nothing`.
- **No agent-to-agent chat.** Commanders never message each other directly — all cross-phase communication goes through the deterministic Aggregator + whiteboard.

---

## 5. Coding standards

- Python: type hints everywhere, Pydantic v2 for every schema (tool args, tool-call requests, API request/response bodies).
- Async throughout the backend — no blocking calls inside FastAPI routes or LangGraph nodes.
- Every registry tool function needs: a Pydantic input schema, a timeout, an output size cap, and a `ResultParser` that returns typed fields — not raw stdout.
- Tests: pytest. Any change touching ScopeGuard, the tool registry, or the termination/cap logic needs a test — these are the platform's actual safety boundary, not incidental code.
- Naming: `run_<tool>` for registry tool functions, `<Phase>Commander` for agent classes, matches the pattern already set by `run_nuclei`, `run_ffuf`, etc.

---

## 6. Reference docs (read before touching design, not just code)

- `docs/MaximReconForge_Architecture_Complete.md` — full system architecture
- `docs/MaximReconForge_Architecture_AI.md` — AI layer only
- `docs/MaximReconForge_Workflow_Complete.md` — end-to-end engagement flow
- `docs/MaximReconForge_Workflow_AI.md` — Commander loop mechanics
- `docs/MaximReconForge_ImplementationPlan_Complete.md` — phased build checklist
- `docs/MaximReconForge_ImplementationPlan_AI.md` — AI-specific build steps + test checklist
- `supabase/README.md` — schema notes, required env vars, gotchas

---

## 7. What not to do

- Don't add an LLM to Recon or Enumeration "for flexibility." That decision was deliberate (see §4).
- Don't let a Commander pick from a growing catalog of Metasploit modules generically — this was evaluated and rejected specifically because it reintroduces open-ended exploit-selection the architecture is designed to avoid. Individually-wrapped, narrowly-scoped modules are fine; generic access is not.
- Don't disable RLS on any Supabase table to "make testing easier" — use the `service_role` key locally instead.
- Don't hardcode API keys, Supabase keys, or DB credentials — `.env`, never committed.
- Don't let `search_whiteboard` calls go unlogged — they should hit the audit log the same as any tool call.
