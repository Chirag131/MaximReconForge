"""
PLACEHOLDER — out of scope for this build pass.

Tools will be defined here as Pydantic-validated function schemas, e.g.:
    run_subfinder(domain: str)
    run_httpx(urls: list[str])
    run_nuclei(target: str, templates: list[str])
    run_nmap(target: str, flags: str)

Each entry needs: timeout, output size cap, scope check hook, result parser.
"""

TOOL_REGISTRY: dict = {}
