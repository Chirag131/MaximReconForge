*Cyber Report*

# Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Tool Selection Methodology](#2-tool-selection-methodology)
3. [Adopted Reconnaissance & Testing Tools — Detailed Analysis](#3-adopted-reconnaissance--testing-tools--detailed-analysis)
   - 3.1 [Summary Table](#31-summary-table)
   - 3.2 [subfinder](#32-subfinder)
   - 3.3 [amass](#33-amass)
   - 3.4 [httpx](#34-httpx)
   - 3.5 [naabu](#35-naabu)
   - 3.6 [nmap](#36-nmap)
   - 3.7 [nuclei](#37-nuclei)
   - 3.8 [ffuf](#38-ffuf)
   - 3.9 [sqlmap (gated, risky: true)](#39-sqlmap-gated-risky-true)
4. [Tools Evaluated and Rejected](#4-tools-evaluated-and-rejected)
   - 4.1 [masscan](#41-masscan)
   - 4.2 [gobuster / dirbuster](#42-gobuster--dirbuster)
   - 4.3 [nikto](#43-nikto)
   - 4.4 [hydra / medusa (credential brute-forcing tools)](#44-hydra--medusa-credential-brute-forcing-tools)
   - 4.5 [Metasploit Framework](#45-metasploit-framework)
   - 4.6 [Burp Suite (Professional / active scanner)](#46-burp-suite-professional--active-scanner)
   - 4.7 [wpscan](#47-wpscan)
   - 4.8 [Shodan / Censys (external OSINT data APIs)](#48-shodan--censys-external-osint-data-apis)
5. [Detailed Pipeline & Workflow Explanation](#5-detailed-pipeline--workflow-explanation)
   - 5.1 [System Architecture Overview](#51-system-architecture-overview)
   - 5.2 [Engagement Lifecycle — Five Phases](#52-engagement-lifecycle--five-phases)
   - 5.3 [Agent Architecture — Commander, Executor, and the ScopeGuard Control](#53-agent-architecture--commander-executor-and-the-scopeguard-control)
   - 5.4 [Context Model — Private Workspaces and the Shared Whiteboard](#54-context-model--private-workspaces-and-the-shared-whiteboard)
   - 5.5 [Prompt-Injection Defence](#55-prompt-injection-defence)
   - 5.6 [Kill Switch and Abort Handling](#56-kill-switch-and-abort-handling)
   - 5.7 [Audit Trail](#57-audit-trail)
   - 5.8 [Reporting and Severity Scoring](#58-reporting-and-severity-scoring)
   - 5.9 [End-to-End Walkthrough](#59-end-to-end-walkthrough)
6. [Conclusion](#6-conclusion)

---

## 1. Executive Summary

This report provides a formal analysis of the reconnaissance and penetration-testing tooling selected for the MaximReconForge platform, as defined in the implementation plan (`MaximReconForge_Implementation.md`). It documents, for each adopted tool, its function, output characteristics, and the specific role it plays within the automated pipeline. It further documents a set of commonly used offensive-security tools that were evaluated but not included in the current tool registry, together with the technical and risk-based rationale for their exclusion. Finally, it provides a detailed, end-to-end explanation of the platform's pipeline and workflow — from initial domain submission through to the generation of the final markdown report — describing how the Commander/Executor agent architecture, the ScopeGuard control, the whiteboard/aggregation model, and the audit trail operate together across an engagement's lifecycle.

The intent of this document is to give the analyst a single reference that answers three questions: which tools are in the system and why; which tools were deliberately left out and why; and precisely how a target moves through the system from submission to report.

## 2. Tool Selection Methodology

Every tool considered for inclusion in the platform's whitelisted tool registry (§8 of the implementation plan) was evaluated against a consistent set of criteria, reflecting the platform's core design constraint: an LLM Commander may only select a tool name and populate a validated argument schema — it never constructs or executes raw commands. This constraint shapes which tools are practically usable in the pipeline.

- **Structured or reliably parseable output** — the tool's results must be convertible into typed fields (status codes, template IDs, open ports, etc.) by a deterministic ResultParser, without exposing free-form target-controlled text to an LLM prompt.
- **Non-interactive, headless CLI operation** — compatible with dispatch as a background ARQ job with a timeout, rather than requiring an interactive console, session, or manual confirmation step.
- **Bounded execution model** — a predictable start/stop lifecycle with an enforceable timeout and output size cap, so a single job cannot run indefinitely or flood the pipeline.
- **Open-source / freely redistributable licensing** — the tool-runner is a single sandboxed container image; commercial or seat-licensed tools introduce distribution and compliance complications that a non-commercial internal tool should avoid.
- **Single, non-overlapping responsibility** — each pipeline stage should be served by one clear tool, keeping the registry small, auditable, and easy to reason about.
- **Passive or low-impact behaviour by default** — particularly for the Recon phase, where the goal is discovery, not disruption of live services.
- **Deterministic risk classification** — any tool capable of causing service disruption, data modification, or data loss must be identifiable as such and handled through an explicit control (a config gate or outright exclusion), never left to LLM judgment.

## 3. Adopted Reconnaissance & Testing Tools — Detailed Analysis

The following tools form the platform's fixed, whitelisted tool registry. Each is wrapped by a Pydantic-validated function schema (e.g. `run_subfinder(domain)`), and every invocation passes through the ScopeGuard check before execution and a ResultParser step after execution.

### 3.1 Summary Table

| Tool | Category | Pipeline Stage | Risk Level |
|---|---|---|---|
| **subfinder** | Passive subdomain discovery | Recon | Passive / Low |
| **amass** | Passive + active subdomain discovery | Recon | Low |
| **httpx** | HTTP/HTTPS probing & fingerprinting | Recon | Passive / Low |
| **naabu** | Fast TCP port scanning | Recon | Low |
| **nmap** | Service/version & OS fingerprinting | Enumeration | Low–Medium |
| **nuclei** | Template-driven vulnerability scanning | Enumeration / Vuln Analysis | Medium |
| **ffuf** | Content, directory & parameter fuzzing | Enumeration / Vuln Analysis | Medium |
| **sqlmap** | Automated SQL-injection testing & extraction | Exploitation (gated, off by default) | High |

### 3.2 subfinder

**Function:** Performs passive subdomain enumeration by querying public data sources (certificate transparency logs, DNS aggregation services, search-engine indexes) without sending traffic directly to the target infrastructure.

**Why adopted:** Provides a fast, safe, zero-touch starting point for asset discovery. Its output is a clean list of hostnames, trivially parsed and merged with other discovery sources.

**Pipeline role:** First step of the Recon phase; output feeds directly into the scope-lock candidate list.

### 3.3 amass

**Function:** Combines passive OSINT collection with optional active DNS resolution and brute-force subdomain guessing to build a broader subdomain map than passive-only tools achieve alone.

**Why adopted:** Increases discovery coverage; run in parallel with subfinder and deduplicated, it reduces the chance of missing assets that only one data source indexes.

**Pipeline role:** Recon phase, run alongside subfinder before the httpx liveness pass.

### 3.4 httpx

**Function:** Probes a list of hosts to determine which are serving HTTP/HTTPS, capturing status code, page title, technology fingerprints, and response headers.

**Why adopted:** Converts a raw hostname list into a prioritized list of live web assets, and its structured field output (status, title, tech stack) is exactly the kind of typed data the ResultParser is designed to extract.

**Pipeline role:** Recon phase; filters the subfinder/amass output down to assets worth further scanning.

### 3.5 naabu

**Function:** A fast SYN-based TCP port scanner used for a first-pass sweep of open ports across many hosts simultaneously.

**Why adopted:** Considerably cheaper and faster than a full nmap sweep across a large host list, making it suitable as a pre-filter before the heavier nmap scan is invoked only on hosts/ports already known to be open.

**Pipeline role:** Recon phase, immediately after httpx.

### 3.6 nmap

**Function:** Performs deeper service and version detection, OS fingerprinting, and optional NSE script checks against the specific ports naabu identified as open.

**Why adopted:** Provides the depth of service identification that naabu intentionally trades away for speed; running it only against pre-filtered ports keeps overall scan time manageable.

**Pipeline role:** Enumeration phase, first step.

### 3.7 nuclei

**Function:** Runs a large library of community and curated YAML templates against live assets to detect known CVEs, common misconfigurations, exposed administrative panels, and default credentials.

**Why adopted:** Its template-match output includes a specific template ID and matched detail as discrete, typed fields — ideal input for a deterministic ResultParser, and directly usable as evidence in CVSS-scored findings.

**Pipeline role:** Enumeration and Vuln-Analysis phases; the primary detection engine for known-vulnerability classes.

### 3.8 ffuf

**Function:** A fast web fuzzer that brute-forces directories, files, subdomains, or parameter names using wordlists, surfacing endpoints not linked from any visible page (hidden admin panels, backup files, staging paths).

**Why adopted:** Covers content-discovery in a single flexible tool with structured JSON output, rather than requiring separate directory-brute-force and parameter-fuzzing tools.

**Pipeline role:** Enumeration and Vuln-Analysis phases, typically triggered against specific hosts flagged as interesting by nuclei or httpx fingerprinting.

### 3.9 sqlmap (gated, risky: true)

**Function:** Automated detection and, if enabled, exploitation of SQL-injection vulnerabilities, capable of fingerprinting a database and extracting data.

**Why adopted, with restriction:** Included in the registry because SQL injection remains one of the highest-severity, most common web vulnerability classes, and an automated confirmation capability has real value. However, because unsupervised exploitation of a live target carries genuine risk of data loss or service impact, it is flagged `risky: true` and disabled by default, requiring an explicit per-engagement toggle before the Exploitation Commander may invoke it.

**Pipeline role:** Exploitation phase, opt-in only.

## 4. Tools Evaluated and Rejected

The following tools are commonly found in manual penetration-testing toolkits and were evaluated for inclusion in the automated registry. Each was rejected — either permanently or pending future reconsideration — for specific technical or risk-based reasons consistent with the selection methodology in Section 2.

### 4.1 masscan

**Considered role:** Ultra-fast full-range port scanner, as an alternative or companion to naabu.

**Reason for rejection:** naabu already fulfils the fast first-pass port-discovery role for this platform's scale; adding masscan would duplicate capability without meaningful benefit. In addition, masscan's high-speed raw-packet scanning mode typically requires elevated network capabilities (e.g. `CAP_NET_RAW`), which conflicts with the tool-runner's non-root, capability-restricted sandbox design.

### 4.2 gobuster / dirbuster

**Considered role:** Directory and file brute-forcing against discovered web hosts.

**Reason for rejection:** ffuf already covers directory, file, subdomain, and parameter fuzzing in a single tool with more flexible wordlist/mutation handling and structured JSON output. Including a second, overlapping fuzzer would increase registry surface area without adding coverage.

### 4.3 nikto

**Considered role:** General-purpose web server vulnerability scanner (outdated software, default files, common misconfigurations).

**Reason for rejection:** nuclei's actively maintained, versioned template library already covers this same category of checks, with materially better output structure (a discrete template ID and matched-detail per result) than nikto's plain-text report format. Running both would produce redundant findings requiring extra de-duplication logic.

### 4.4 hydra / medusa (credential brute-forcing tools)

**Considered role:** Automated brute-force or password-spraying against login services identified during enumeration.

**Reason for rejection:** Rejected outright rather than gated. Unsupervised credential brute-forcing carries a materially different risk profile from the other registry tools: it can trigger account lockouts, alerting, or denial-of-service-like load against authentication services, and the boundary between an acceptable testing rate and a disruptive one depends heavily on context the platform cannot reliably assess automatically. Consistent with the plan's principle of keeping the highest-risk decisions as deterministic rules rather than open-ended LLM judgment, this class of action is excluded from the current automated scope entirely rather than left to a per-engagement toggle.

### 4.5 Metasploit Framework

**Considered role:** General exploitation framework, for a broader library of exploit modules than a single wrapped tool like sqlmap provides.

**Reason for rejection:** Metasploit is built around an interactive console or RPC session model, not a simple typed-argument CLI invocation, making it a poor fit for the registry's "tool name + validated schema" pattern. More importantly, exposing generic Metasploit access would reintroduce exactly the open-ended "choose an exploit module and payload" decision that the Commander/Executor separation (§9 of the implementation plan) is specifically designed to prevent. A curated set of individually wrapped, narrowly scoped Metasploit modules could be considered in a future iteration, but generic framework access is not recommended.

### 4.6 Burp Suite (Professional / active scanner)

**Considered role:** Web application proxy and active vulnerability scanner.

**Reason for rejection:** Commercial, seat-licensed software conflicts with the requirement for a freely redistributable, self-contained sandbox image. It is also fundamentally designed around an interactive proxy/UI workflow, whereas the platform requires a scriptable, headless, timeout-bound CLI call for every registry tool.

### 4.7 wpscan

**Considered role:** Dedicated WordPress vulnerability and configuration scanner.

**Reason for rejection:** Narrow, single-CMS scope with substantial overlap with relevant nuclei templates. Adding a dedicated single-CMS tool increases registry maintenance overhead for limited incremental coverage; this may be revisited if a significant share of future engagement targets are WordPress-based.

### 4.8 Shodan / Censys (external OSINT data APIs)

**Considered role:** Third-party internet-wide scanning databases, queried for pre-existing exposure data on a target.

**Reason for rejection:** Not rejected on safety grounds, but excluded from the core pipeline because these are third-party services requiring their own API keys and billing, and they return historical or cached data rather than results current as of the engagement. They remain a plausible supplementary signal for a future iteration, but are not a substitute for direct, live enumeration via subfinder, amass, and httpx.

## 5. Detailed Pipeline & Workflow Explanation

This section describes, in full, how a target domain moves through MaximReconForge from initial submission to final report — the system architecture that hosts this flow, the phase-by-phase lifecycle, the internal agent graph structure, and the controls that constrain autonomous execution at every step.

### 5.1 System Architecture Overview

The frontend (hosted on Vercel) communicates only with an Nginx reverse proxy over HTTPS, which terminates TLS and forwards requests to a FastAPI backend. The backend hosts the REST API, the authentication layer, a WebSocket endpoint for live progress streaming, and the LangGraph Supervisor graph that contains all planning and decision logic. The backend does not execute any offensive tooling itself. Long-running work is enqueued via Redis using the ARQ task queue and picked up by a separate Tool-Runner container — a sandboxed, non-root, resource-limited worker that holds the actual pentest binaries and is the only component permitted to execute them. State is split three ways: Postgres holds engagement records, findings, the audit log, and LangGraph's own checkpoint tables; Redis holds the job queue; and Qdrant holds one isolated vector collection per engagement for retrieval-augmented context.

### 5.2 Engagement Lifecycle — Five Phases

Every engagement proceeds through five sequential phases, each implemented as its own LangGraph subgraph:

- **Recon** — subfinder and amass discover candidate subdomains; httpx filters to live web hosts; naabu identifies open ports. The combined output becomes the engagement's locked scope.
- **Enumeration** — nmap performs service/version fingerprinting on open ports; nuclei runs template-based scanning across live assets to surface known vulnerability classes.
- **Vuln Analysis** — an LLM Commander reasons over the consolidated enumeration findings (retrieved via similarity search, not loaded in full) and proposes a targeted attack chain, including any further ffuf-based content discovery needed to investigate specific leads.
- **Exploitation** — chained, whitelisted tool calls are executed strictly against in-scope assets; higher-risk actions (currently only sqlmap) execute only if explicitly enabled for that engagement.
- **Reporting** — a dedicated Reporting agent consolidates the whiteboard and RAG-retrieved context into the final markdown report, with CVSS v3.1 scoring per finding.

Scope is locked at the end of the Recon phase: the discovered subdomains, resolved IPs, CIDRs, and live URLs become the fixed boundary for every later phase. Nothing discovered after Recon can expand this boundary — any asset encountered later that falls outside it is dropped and logged, never pursued.

### 5.3 Agent Architecture — Commander, Executor, and the ScopeGuard Control

Each phase has a dedicated Commander agent — an LLM that decides what to do next and why, but which may only emit a structured tool-call request (a tool name plus a validated argument schema). It never produces raw shell text. The Tool-Runner acts as the Executor: it receives a validated request, runs the corresponding whitelisted tool inside the sandbox, and returns parsed, structured JSON output rather than raw stdout.

Between every Commander and Executor sits the ScopeGuard node — a deterministic, non-LLM check that validates the proposed tool target against the engagement's locked scope (via domain-suffix matching and resolved-IP/CIDR matching) before the Executor is permitted to run anything. This check is implemented purely in code specifically so that scope enforcement never depends on the LLM correctly self-policing its own targeting.

The full phase subgraph therefore runs as a repeating loop: Commander proposes an action, ScopeGuard validates the target, Executor runs the tool, ResultParser converts the output into typed fields, and the loop returns to the Commander until that phase's goal is met — at which point the Aggregator consolidates the phase's results and control returns to the Supervisor for the next phase transition.

### 5.4 Context Model — Private Workspaces and the Shared Whiteboard

Each agent works inside its own private folder within the engagement's hidden context directory, with read/write access limited to itself. A separate, deterministic Aggregator service — not an LLM — is the only component permitted to write to the shared whiteboard; it reads each agent's private notes and structured findings and consolidates them into the whiteboard's `findings.jsonl` and `summary.md`. All agents have read-only access to the whiteboard, enforced both through an internal ContextStore API that applies per-role access rules and, as defence-in-depth, through read-only filesystem mounts.

As the whiteboard grows, the Aggregator embeds only structured, cleaned entries — never raw tool output — into that engagement's dedicated Qdrant collection. Commanders retrieve relevant prior context through similarity search rather than loading the entire growing whiteboard into every prompt, keeping context usage bounded as an engagement progresses.

### 5.5 Prompt-Injection Defence

Raw target-controlled content — HTTP response bodies, server banners, page titles, and similar — is never passed directly into a Commander's prompt as if it were an instruction. The ResultParser extracts only specific typed fields (status code, server header, matched template ID, and so on); any free text from the target is stored as inert evidence data, clearly delimited, with the Commander's system prompt explicitly instructed to treat that block as untrusted data rather than as directives. This is the same architectural separation that keeps the Commander from ever needing to interpret attacker-influenced or target-influenced free text as if it came from the operator.

### 5.6 Kill Switch and Abort Handling

An abort endpoint sets a flag in Postgres and Redis for a given engagement. The Supervisor checks this flag before every phase transition and before every individual tool-call dispatch, allowing an operator to halt a runaway engagement at any point despite execution otherwise proceeding fully autonomously. In-flight jobs are permitted to complete so that partially written tool output is not left in an inconsistent state; no new jobs are enqueued once the flag is set.

### 5.7 Audit Trail

Every action is written to a per-engagement, append-only audit log — one line per action, recording timestamp, agent, tool, exact validated parameters, target, and a hash of the result — with each line additionally hash-chained to the previous line so that tampering is detectable. The same records are mirrored into a Postgres `audit_log` table for querying. This log constitutes the platform's authoritative record of exactly what was executed against a target and when.

### 5.8 Reporting and Severity Scoring

The Reporting agent generates the final markdown report exclusively from the whiteboard and its RAG-retrieved context — never from raw agent scratch files — ensuring the report reflects consolidated, verified findings rather than intermediate reasoning. Each finding receives a CVSS v3.1 base score together with a plain-language severity label (Critical, High, Medium, Low, or Info), and the report is structured as: executive summary, scope and assets tested, findings sorted by severity, evidence per finding, and recommendations.

### 5.9 End-to-End Walkthrough

Bringing the above together: a domain is submitted through the API and an engagement record is created. The Supervisor starts the Recon subgraph, dispatching subfinder, amass, httpx, and naabu jobs through the queue; their combined, deduplicated output becomes the locked `scope.json`. The Supervisor transitions to Enumeration, where nmap and nuclei run against the locked scope, each call passing through ScopeGuard first and returning parsed findings through the ResultParser. The Aggregator consolidates these into the whiteboard, and its embeddings become queryable in the engagement's Qdrant collection. The Vuln-Analysis Commander retrieves relevant whiteboard context, reasons over confirmed matches, and proposes further targeted action such as ffuf-based content discovery. The Supervisor transitions to Exploitation, where any proposed high-risk action is additionally checked against the engagement's risky-tool toggle before execution is permitted. Throughout, every tool call and every ScopeGuard or risky-tool rejection is written to the hash-chained audit log, and the abort flag is checked before each phase transition and tool dispatch. Once the Exploitation phase concludes, the Supervisor transitions to Reporting, where the Reporting agent produces the final CVSS-scored markdown report from the consolidated whiteboard content.

## 6. Conclusion

The tool set adopted for MaximReconForge reflects a deliberate preference for structured, headless, freely licensed, single-purpose tools that fit cleanly into a validated-schema tool registry, over broader or more powerful tools whose interactive, open-ended, or high-risk nature would undermine the platform's core safety architecture. Tools were rejected either because their capability was already adequately covered by an adopted tool (masscan, gobuster/dirbuster, nikto, wpscan), because their operating model is fundamentally incompatible with a validated-schema, non-interactive registry (Metasploit Framework, Burp Suite), or because the risk of unsupervised automated execution was judged too high to gate rather than exclude (hydra/medusa). The resulting pipeline — Recon, Enumeration, Vuln Analysis, Exploitation, and Reporting, each governed by the Commander/ScopeGuard/Executor/ResultParser loop and the deterministic controls described in Section 5 — is designed so that autonomy is bounded by code-level checks at every step, rather than by trusting LLM judgment alone.
