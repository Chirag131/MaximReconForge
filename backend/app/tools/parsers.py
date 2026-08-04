"""
Result parsers for each tool in the registry.

Each parser converts raw tool output (stdout/JSON) into typed fields.
Free text from target-controlled content (HTTP bodies, banners, titles)
is stored as delimited "untrusted evidence" — never re-injected into
a Commander's prompt as if it were an instruction.

This is the prompt-injection boundary: raw target content stops here.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Parsed result models — typed fields only
# ---------------------------------------------------------------------------

class SubdomainResult(BaseModel):
    """Parsed output from subfinder/amass."""
    subdomains: list[str] = Field(default_factory=list)
    source: str = ""  # "subfinder" or "amass"


class HttpxResult(BaseModel):
    """Parsed output from httpx probing."""
    live_hosts: list[dict[str, Any]] = Field(default_factory=list)
    # Each entry: {url, status_code, title, tech, content_length}


class NaabuResult(BaseModel):
    """Parsed output from naabu port scan."""
    open_ports: list[dict[str, Any]] = Field(default_factory=list)
    # Each entry: {host, port, protocol}


class NmapResult(BaseModel):
    """Parsed output from nmap service fingerprinting."""
    services: list[dict[str, Any]] = Field(default_factory=list)
    # Each entry: {host, port, protocol, service, version, scripts}


class NucleiResult(BaseModel):
    """Parsed output from nuclei vulnerability scan."""
    findings: list[dict[str, Any]] = Field(default_factory=list)
    # Each entry: {template_id, severity, matched_at, description, extracted}


class FfufResult(BaseModel):
    """Parsed output from ffuf directory fuzzing."""
    discovered_paths: list[dict[str, Any]] = Field(default_factory=list)
    # Each entry: {url, status, length, words, lines}


class SqlmapResult(BaseModel):
    """Parsed output from sqlmap injection testing."""
    vulnerable: bool = False
    injection_type: str = ""
    parameter: str = ""
    dbms: str = ""
    evidence: str = ""  # delimited as untrusted


class SearchWhiteboardResult(BaseModel):
    """Parsed output from whiteboard semantic search."""
    results: list[dict[str, Any]] = Field(default_factory=list)
    # Each entry: {content, score, finding_id}


# ---------------------------------------------------------------------------
# Evidence wrapper — all target-controlled free text goes through this
# ---------------------------------------------------------------------------

EVIDENCE_DELIMITER = "--- BEGIN UNTRUSTED TARGET EVIDENCE ---"
EVIDENCE_END = "--- END UNTRUSTED TARGET EVIDENCE ---"


def wrap_untrusted_evidence(raw_text: str, max_len: int = 4096) -> str:
    """Wrap raw target-controlled text in explicit delimiters.

    This is the structural prompt-injection defense: any free text from
    the target (HTTP bodies, banners, page titles) is wrapped so the
    Commander's system prompt can instruct it to treat this block as
    inert data, never as directives.

    ``max_len`` caps the wrapped payload to prevent context overflow; pass a
    larger value when wrapping an aggregated findings dump that must stay whole.
    """
    if len(raw_text) > max_len:
        raw_text = raw_text[:max_len] + f"\n[TRUNCATED — {len(raw_text)} chars total]"
    return f"{EVIDENCE_DELIMITER}\n{raw_text}\n{EVIDENCE_END}"


# ---------------------------------------------------------------------------
# Per-tool parsers
# ---------------------------------------------------------------------------

def parse_subfinder_output(raw: str) -> SubdomainResult:
    """Parse subfinder output (newline-separated subdomains)."""
    subdomains = [line.strip() for line in raw.strip().splitlines() if line.strip()]
    return SubdomainResult(subdomains=subdomains, source="subfinder")


def parse_amass_output(raw: str) -> SubdomainResult:
    """Parse amass output (newline-separated subdomains)."""
    subdomains = [line.strip() for line in raw.strip().splitlines() if line.strip()]
    return SubdomainResult(subdomains=subdomains, source="amass")


def parse_httpx_output(raw: str) -> HttpxResult:
    """Parse httpx JSON-lines output."""
    hosts = []
    for line in raw.strip().splitlines():
        try:
            data = json.loads(line)
            # The page title is target-controlled free text. Wrap it as
            # untrusted evidence so it can never be surfaced to a Commander
            # prompt as an instruction (prompt-injection boundary).
            title = data.get("title", "")
            hosts.append({
                "url": data.get("url", ""),
                "status_code": data.get("status_code", 0),
                "title": wrap_untrusted_evidence(title) if title else "",
                "tech": data.get("tech", []),
                "content_length": data.get("content_length", 0),
            })
        except json.JSONDecodeError:
            continue
    return HttpxResult(live_hosts=hosts)


def parse_naabu_output(raw: str) -> NaabuResult:
    """Parse naabu output (host:port lines)."""
    ports = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if ":" in line:
            parts = line.rsplit(":", 1)
            ports.append({
                "host": parts[0],
                "port": int(parts[1]) if parts[1].isdigit() else 0,
                "protocol": "tcp",
            })
    return NaabuResult(open_ports=ports)


def parse_nmap_output(raw: str) -> NmapResult:
    """Parse nmap output.

    For structured parsing, nmap should be run with -oX (XML) or -oJ (JSON)
    output. This parser handles the common JSON-ish format; the actual
    XML parsing will be implemented in the executor.
    """
    # Stub — real implementation parses nmap XML output
    services: list[dict[str, Any]] = []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            services = data
        elif isinstance(data, dict) and "services" in data:
            services = data["services"]
    except json.JSONDecodeError:
        logger.warning("nmap output is not JSON — raw parsing not yet implemented")
    return NmapResult(services=services)


def parse_nuclei_output(raw: str) -> NucleiResult:
    """Parse nuclei JSON-lines output."""
    findings = []
    for line in raw.strip().splitlines():
        try:
            data = json.loads(line)
            findings.append({
                "template_id": data.get("template-id", data.get("templateID", "")),
                "severity": data.get("info", {}).get("severity", "info"),
                "matched_at": data.get("matched-at", data.get("matched", "")),
                "description": data.get("info", {}).get("description", ""),
                "extracted": data.get("extracted-results", []),
            })
        except json.JSONDecodeError:
            continue
    return NucleiResult(findings=findings)


def parse_ffuf_output(raw: str) -> FfufResult:
    """Parse ffuf JSON output."""
    paths = []
    try:
        data = json.loads(raw)
        results = data.get("results", [])
        for r in results:
            paths.append({
                "url": r.get("url", ""),
                "status": r.get("status", 0),
                "length": r.get("length", 0),
                "words": r.get("words", 0),
                "lines": r.get("lines", 0),
            })
    except json.JSONDecodeError:
        logger.warning("ffuf output is not valid JSON")
    return FfufResult(discovered_paths=paths)


def parse_sqlmap_output(raw: str) -> SqlmapResult:
    """Parse sqlmap output.

    sqlmap's output is mostly free text — extract only the typed fields
    and wrap any evidence as untrusted.
    """
    result = SqlmapResult()
    lower = raw.lower()
    if "parameter" in lower and "is vulnerable" in lower:
        result.vulnerable = True
    if "type:" in lower:
        for line in raw.splitlines():
            if "type:" in line.lower():
                val = line.split("Type:", 1)[-1].split("type:", 1)[-1].strip()
                # Split at period or next label if on single line
                val = val.split(".")[0].strip()
                result.injection_type = val
                break
    if "back-end dbms:" in lower:
        for line in raw.splitlines():
            if "back-end dbms:" in line.lower():
                val = line.split("DBMS:", 1)[-1].split("dbms:", 1)[-1].strip()
                val = val.split(".")[0].strip()
                result.dbms = val
                break
    # All raw output is untrusted evidence
    result.evidence = wrap_untrusted_evidence(raw)
    return result


# ---------------------------------------------------------------------------
# Parser dispatch
# ---------------------------------------------------------------------------

RESULT_PARSERS: dict[str, Any] = {
    "run_subfinder": parse_subfinder_output,
    "run_amass": parse_amass_output,
    "run_httpx": parse_httpx_output,
    "run_naabu": parse_naabu_output,
    "run_nmap": parse_nmap_output,
    "run_nuclei": parse_nuclei_output,
    "run_ffuf": parse_ffuf_output,
    "run_sqlmap": parse_sqlmap_output,
}


def parse_tool_result(tool_name: str, raw_output: str) -> BaseModel | None:
    """Parse raw tool output into typed fields using the registered parser.

    Returns None if no parser is registered (e.g. phase_complete, search_whiteboard).
    """
    parser = RESULT_PARSERS.get(tool_name)
    if parser is None:
        return None
    return parser(raw_output)
