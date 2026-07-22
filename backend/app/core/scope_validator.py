import re
import socket
import ipaddress

DOMAIN_REGEX = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63}(?<!-))*\.[A-Za-z]{2,}$"
)

BLOCKLIST = {"localhost", "google.com", "example.com"}  # placeholder — expand as needed

class ScopeValidationError(Exception):
    pass

def is_valid_domain_syntax(domain: str) -> bool:
    return bool(DOMAIN_REGEX.match(domain))

def resolve_domain(domain: str) -> list[str]:
    try:
        return list({info[4][0] for info in socket.getaddrinfo(domain, None)})
    except socket.gaierror:
        raise ScopeValidationError(f"Domain '{domain}' does not resolve")

def is_private_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return addr.is_private or addr.is_loopback or addr.is_link_local

def validate_target_domain(domain: str) -> list[str]:
    """Raises ScopeValidationError on any failure. Returns resolved IPs on success."""
    domain = domain.strip().lower()

    if domain in BLOCKLIST:
        raise ScopeValidationError(f"'{domain}' is on the blocklist")

    if not is_valid_domain_syntax(domain):
        raise ScopeValidationError(f"'{domain}' is not a valid domain")

    resolved_ips = resolve_domain(domain)

    for ip in resolved_ips:
        if is_private_ip(ip):
            raise ScopeValidationError(f"Resolved IP {ip} is private/internal — not allowed")

    return resolved_ips
