"""
Worker Executor — Executes whitelisted tool binaries in a sandboxed subprocess.

Security & Architectural Constraints:
- NEVER uses shell=True — arguments are passed as explicit argv lists.
- Enforces execution timeouts and stdout/stderr output size caps.
- Computes SHA256 result_hash for audit logging.
- Returns structured execution results.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ExecutionResult:
    tool_name: str
    success: bool
    exit_code: int
    stdout: str
    stderr: str
    result_hash: str
    error: str | None = None


def build_cli_command(tool_name: str, params: dict[str, Any]) -> list[str]:
    """Map tool_name and validated Pydantic params to a safe argv command list."""
    if tool_name == "run_subfinder":
        return ["subfinder", "-d", str(params["domain"]), "-silent", "-json"]

    elif tool_name == "run_amass":
        return ["amass", "enum", "-passive", "-d", str(params["domain"])]

    elif tool_name == "run_httpx":
        targets = params.get("targets", [])
        # Pass targets via stdin or direct CLI flags
        cmd = ["httpx", "-silent", "-json", "-status-code", "-title", "-tech-detect"]
        for t in targets:
            cmd.extend(["-u", str(t)])
        return cmd

    elif tool_name == "run_naabu":
        cmd = ["naabu", "-host", str(params["target"]), "-silent", "-json"]
        ports = params.get("ports")
        if ports and ports != "top-1000":
            cmd.extend(["-p", str(ports)])
        return cmd

    elif tool_name == "run_nmap":
        cmd = ["nmap", "-sV", "-sC", "-oX", "-"]
        ports = params.get("ports")
        if ports:
            cmd.extend(["-p", str(ports)])
        cmd.append(str(params["target"]))
        return cmd

    elif tool_name == "run_nuclei":
        cmd = ["nuclei", "-target", str(params["target"]), "-json-export", "-"]
        templates = params.get("templates", [])
        for t in templates:
            cmd.extend(["-t", str(t)])
        severity = params.get("severity")
        if severity:
            cmd.extend(["-severity", str(severity)])
        return cmd

    elif tool_name == "run_ffuf":
        cmd = [
            "ffuf",
            "-u",
            str(params["target_url"]),
            "-w",
            f"/app/wordlists/{params.get('wordlist', 'common.txt')}",
            "-o",
            "-",
            "-of",
            "json",
            "-s",
        ]
        exts = params.get("extensions")
        if exts:
            cmd.extend(["-e", str(exts)])
        return cmd

    elif tool_name == "run_sqlmap":
        cmd = [
            "sqlmap",
            "-u",
            str(params["target_url"]),
            "--batch",
            "--random-agent",
            f"--level={params.get('level', 1)}",
            f"--risk={params.get('risk', 1)}",
        ]
        if params.get("method") == "POST" and params.get("data"):
            cmd.extend(["--data", str(params["data"])])
        return cmd

    else:
        raise ValueError(f"Unsupported tool binary: {tool_name}")


async def execute_tool_call(
    tool_name: str,
    params: dict[str, Any],
    timeout_seconds: int = 300,
    output_cap_bytes: int = 1_000_000,
) -> ExecutionResult:
    """Execute a whitelisted security tool in an isolated subprocess.

    Args:
        tool_name: Name of tool (e.g. 'run_subfinder').
        params: Validated dictionary of arguments.
        timeout_seconds: Hard execution timeout in seconds.
        output_cap_bytes: Maximum allowed bytes for stdout/stderr output.

    Returns:
        ExecutionResult containing exit code, stdout, stderr, and SHA256 hash.
    """
    try:
        cmd = build_cli_command(tool_name, params)
    except Exception as exc:
        return ExecutionResult(
            tool_name=tool_name,
            success=False,
            exit_code=-1,
            stdout="",
            stderr="",
            result_hash="",
            error=f"Command build error: {exc}",
        )

    logger.info("Executing tool command: %s", " ".join(cmd))

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            process.communicate(), timeout=float(timeout_seconds)
        )
    except asyncio.TimeoutError:
        try:
            process.kill()
        except OSError:
            pass
        return ExecutionResult(
            tool_name=tool_name,
            success=False,
            exit_code=-1,
            stdout="",
            stderr="",
            result_hash="",
            error=f"Tool execution timed out after {timeout_seconds}s",
        )
    except FileNotFoundError:
        return ExecutionResult(
            tool_name=tool_name,
            success=False,
            exit_code=-1,
            stdout="",
            stderr="",
            result_hash="",
            error=f"Binary for tool '{tool_name}' not found in PATH",
        )
    except Exception as exc:
        return ExecutionResult(
            tool_name=tool_name,
            success=False,
            exit_code=-1,
            stdout="",
            stderr="",
            result_hash="",
            error=f"Subprocess error: {exc}",
        )

    # Truncate if output exceeds size cap
    if len(stdout_bytes) > output_cap_bytes:
        stdout_bytes = stdout_bytes[:output_cap_bytes] + b"\n[STDOUT TRUNCATED]"
    if len(stderr_bytes) > output_cap_bytes:
        stderr_bytes = stderr_bytes[:output_cap_bytes] + b"\n[STDERR TRUNCATED]"

    stdout_str = stdout_bytes.decode("utf-8", errors="replace")
    stderr_str = stderr_bytes.decode("utf-8", errors="replace")

    # Compute result SHA256 hash for audit chain
    result_hash = hashlib.sha256(stdout_bytes).hexdigest()

    return ExecutionResult(
        tool_name=tool_name,
        success=(process.returncode == 0),
        exit_code=process.returncode or 0,
        stdout=stdout_str,
        stderr=stderr_str,
        result_hash=result_hash,
    )
