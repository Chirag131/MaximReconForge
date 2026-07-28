"""
ScopeGuard — deterministic, non-LLM enforcement of scope boundaries.

Sits between every Commander tool-call proposal and its execution.
Validates the proposed target against the locked scope_entries for the
engagement. Never trust the LLM to self-police scope.

This is distinct from scope_validator.py, which validates the initial
target domain at engagement creation. ScopeGuard runs on every single
tool call during execution.
"""

from __future__ import annotations

import ipaddress
import logging
import socket
from typing import Any

logger = logging.getLogger(__name__)


class ScopeGuardRejection(Exception):
    """Raised when a tool call targets something outside the locked scope."""

    def __init__(self, target: str, reason: str) -> None:
        self.target = target
        self.reason = reason
        super().__init__(f"ScopeGuard rejected target '{target}': {reason}")


class ScopeGuard:
    """Validates tool-call targets against the engagement's locked scope.

    The scope is a list of entries from the ``scope_entries`` table,
    each with an ``asset_type`` (subdomain, ip, cidr, url) and ``value``.
    Scope is locked at the end of Recon and never expanded after.
    """

    def __init__(self, scope_entries: list[dict[str, str]]) -> None:
        self._domains: set[str] = set()
        self._ips: set[str] = set()
        self._cidrs: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
        self._urls: set[str] = set()

        for entry in scope_entries:
            asset_type = entry.get("asset_type", "")
            value = entry.get("value", "").strip().lower()
            if not value:
                continue

            if asset_type == "subdomain":
                self._domains.add(value)
            elif asset_type == "ip":
                self._ips.add(value)
            elif asset_type == "cidr":
                try:
                    self._cidrs.append(ipaddress.ip_network(value, strict=False))
                except ValueError:
                    logger.warning("Invalid CIDR in scope: %s", value)
            elif asset_type == "url":
                self._urls.add(value)

    def check(self, target: str) -> None:
        """Validate a target string against the locked scope.

        Raises ScopeGuardRejection if the target is out of scope.
        A target is in scope if it matches any of:
        - Domain-suffix match against a scoped subdomain
        - Exact IP match or containment in a scoped CIDR
        - Exact URL match or URL with a scoped domain as its host
        """
        if not target:
            return  # no target to validate (e.g. phase_complete)

        target_lower = target.strip().lower()

        # Check domain-suffix match
        if self._is_domain_in_scope(target_lower):
            return

        # Check IP match
        if self._is_ip_in_scope(target_lower):
            return

        # Check URL match
        if self._is_url_in_scope(target_lower):
            return

        # Try DNS resolution as fallback
        if self._resolves_to_scoped_ip(target_lower):
            return

        raise ScopeGuardRejection(
            target=target,
            reason="target does not match any locked scope entry (domain-suffix, IP/CIDR, or URL)",
        )

    def _is_domain_in_scope(self, target: str) -> bool:
        """Check if target is a subdomain of any scoped domain."""
        for domain in self._domains:
            if target == domain or target.endswith(f".{domain}"):
                return True
        return False

    def _is_ip_in_scope(self, target: str) -> bool:
        """Check exact IP or CIDR containment."""
        try:
            addr = ipaddress.ip_address(target)
        except ValueError:
            return False

        if str(addr) in self._ips:
            return True

        for cidr in self._cidrs:
            if addr in cidr:
                return True

        return False

    def _is_url_in_scope(self, target: str) -> bool:
        """Check URL against scoped URLs and domains."""
        if target in self._urls:
            return True

        # Extract host from URL
        host = target
        if "://" in host:
            host = host.split("://", 1)[1]
        host = host.split("/", 1)[0]
        host = host.split(":", 1)[0]  # remove port

        return self._is_domain_in_scope(host) or self._is_ip_in_scope(host)

    def _resolves_to_scoped_ip(self, target: str) -> bool:
        """DNS-resolve the target and check if any IP is in scope."""
        # Extract hostname if it's a URL
        host = target
        if "://" in host:
            host = host.split("://", 1)[1]
        host = host.split("/", 1)[0]
        host = host.split(":", 1)[0]

        try:
            resolved = {info[4][0] for info in socket.getaddrinfo(host, None)}
        except (socket.gaierror, OSError):
            return False

        for ip_str in resolved:
            if self._is_ip_in_scope(ip_str):
                return True

        return False


def extract_target_from_tool_call(
    tool_name: str, arguments: dict[str, Any]
) -> str | None:
    """Extract the target value from a tool call's arguments.

    Returns None for tools that don't have a target to validate
    (e.g. phase_complete, search_whiteboard).
    """
    # Tools with no external target
    if tool_name in ("phase_complete", "search_whiteboard"):
        return None

    # Map tool name to the argument that contains the target
    target_fields = {
        "run_subfinder": "domain",
        "run_amass": "domain",
        "run_httpx": None,  # list of targets, handled separately
        "run_naabu": "target",
        "run_nmap": "target",
        "run_nuclei": "target",
        "run_ffuf": "target_url",
        "run_sqlmap": "target_url",
    }

    field = target_fields.get(tool_name)
    if field is None:
        # httpx: check each target in the list
        if tool_name == "run_httpx":
            targets = arguments.get("targets", [])
            return targets[0] if targets else None
        return None

    return arguments.get(field)
