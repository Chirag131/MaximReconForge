"""
Python-native scanner module for local CLI mode.

Performs real reconnaissance and vulnerability analysis using only Python
stdlib + dnspython — no external binaries (nmap, nuclei, etc.) required.

Scans performed:
  1. DNS enumeration (A, AAAA, MX, NS, TXT, CNAME, SOA records)
  2. Common subdomain brute-force via DNS
  3. TCP port scanning (top 30 ports)
  4. HTTP/HTTPS header analysis (security headers, server fingerprint)
  5. TLS/SSL certificate inspection
  6. Common web path probing (robots.txt, .env, .git, admin panels)
"""

from __future__ import annotations

import asyncio
import json
import logging
import socket
import ssl
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Common subdomain wordlist (compact — covers most real-world cases)
# ---------------------------------------------------------------------------
COMMON_SUBDOMAINS = [
    "www", "mail", "ftp", "webmail", "smtp", "pop", "ns1", "ns2",
    "blog", "shop", "store", "api", "dev", "staging", "test",
    "admin", "portal", "vpn", "remote", "cdn", "static", "assets",
    "app", "m", "mobile", "docs", "wiki", "git", "gitlab", "jenkins",
    "ci", "dashboard", "panel", "cpanel", "whm", "phpmyadmin",
]

# Top TCP ports to scan
TOP_PORTS = [
    21, 22, 25, 53, 80, 110, 111, 135, 139, 143,
    443, 445, 993, 995, 1433, 1521, 2082, 2083, 3306,
    3389, 5432, 5900, 6379, 8000, 8080, 8443, 8888, 9090, 9200, 27017,
]

# Security headers to check
SECURITY_HEADERS = [
    "Strict-Transport-Security",
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "X-XSS-Protection",
    "Referrer-Policy",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Resource-Policy",
    "Cross-Origin-Embedder-Policy",
]

# Sensitive paths to probe
SENSITIVE_PATHS = [
    "/robots.txt", "/.env", "/.git/HEAD", "/.git/config",
    "/admin", "/wp-admin", "/wp-login.php", "/phpmyadmin",
    "/server-status", "/server-info", "/.htaccess", "/.htpasswd",
    "/backup", "/backup.zip", "/backup.sql", "/db.sql",
    "/config.php", "/wp-config.php", "/configuration.php",
    "/.DS_Store", "/sitemap.xml", "/crossdomain.xml",
    "/.well-known/security.txt", "/api", "/swagger", "/graphql",
]

SERVICE_NAMES = {
    21: "FTP", 22: "SSH", 25: "SMTP", 53: "DNS", 80: "HTTP",
    110: "POP3", 111: "RPC", 135: "MSRPC", 139: "NetBIOS", 143: "IMAP",
    443: "HTTPS", 445: "SMB", 993: "IMAPS", 995: "POP3S", 1433: "MSSQL",
    1521: "Oracle", 2082: "cPanel", 2083: "cPanel-SSL", 3306: "MySQL",
    3389: "RDP", 5432: "PostgreSQL", 5900: "VNC", 6379: "Redis",
    8000: "HTTP-Alt", 8080: "HTTP-Proxy", 8443: "HTTPS-Alt",
    8888: "HTTP-Alt", 9090: "HTTP-Alt", 9200: "Elasticsearch", 27017: "MongoDB",
}


# ---------------------------------------------------------------------------
# DNS Enumeration
# ---------------------------------------------------------------------------

async def scan_dns(domain: str) -> list[dict[str, Any]]:
    """Enumerate DNS records for the target domain."""
    import dns.resolver

    findings: list[dict[str, Any]] = []
    record_types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"]

    for rtype in record_types:
        try:
            answers = dns.resolver.resolve(domain, rtype)
            records = [str(r) for r in answers]
            findings.append({
                "tool": "dns_enum",
                "type": "dns_record",
                "severity": "info",
                "record_type": rtype,
                "domain": domain,
                "records": records,
                "description": f"DNS {rtype} records found for {domain}",
            })
            logger.info("  DNS %s: %s", rtype, ", ".join(records[:5]))
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers):
            continue
        except Exception as exc:
            logger.debug("DNS %s query failed: %s", rtype, exc)

    return findings


# ---------------------------------------------------------------------------
# Subdomain Discovery
# ---------------------------------------------------------------------------

async def scan_subdomains(domain: str) -> list[dict[str, Any]]:
    """Brute-force common subdomains via DNS resolution."""
    import dns.resolver

    findings: list[dict[str, Any]] = []
    discovered: list[str] = []

    async def check_subdomain(sub: str) -> str | None:
        fqdn = f"{sub}.{domain}"
        try:
            loop = asyncio.get_event_loop()
            answers = await loop.run_in_executor(
                None, lambda: dns.resolver.resolve(fqdn, "A")
            )
            ips = [str(r) for r in answers]
            return json.dumps({"subdomain": fqdn, "ips": ips})
        except Exception:
            return None

    # Run subdomain checks concurrently (batched)
    tasks = [check_subdomain(sub) for sub in COMMON_SUBDOMAINS]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, str) and result:
            data = json.loads(result)
            discovered.append(data["subdomain"])
            findings.append({
                "tool": "subdomain_enum",
                "type": "subdomain",
                "severity": "info",
                "subdomain": data["subdomain"],
                "ips": data["ips"],
                "description": f"Discovered subdomain: {data['subdomain']} -> {', '.join(data['ips'])}",
            })

    if discovered:
        logger.info("  Subdomains found: %s", ", ".join(discovered))
    else:
        logger.info("  No additional subdomains found")

    return findings


# ---------------------------------------------------------------------------
# TCP Port Scanning
# ---------------------------------------------------------------------------

async def scan_ports(target: str, ports: list[int] | None = None) -> list[dict[str, Any]]:
    """Scan top TCP ports on the target."""
    if ports is None:
        ports = TOP_PORTS

    findings: list[dict[str, Any]] = []
    open_ports: list[dict[str, Any]] = []

    async def check_port(port: int) -> dict[str, Any] | None:
        loop = asyncio.get_event_loop()
        try:
            def _connect():
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2.0)
                result = sock.connect_ex((target, port))
                sock.close()
                return result

            result = await loop.run_in_executor(None, _connect)
            if result == 0:
                svc = SERVICE_NAMES.get(port, "unknown")
                return {"port": port, "service": svc, "state": "open"}
        except Exception:
            pass
        return None

    tasks = [check_port(p) for p in ports]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, dict):
            open_ports.append(result)
            sev = "info"
            desc = f"Open port {result['port']}/{result['service']}"

            # Flag risky services
            if result["port"] in (21, 23, 135, 139, 445, 3389, 5900, 6379, 27017, 9200):
                sev = "medium"
                desc += " — potentially sensitive service exposed"
            if result["port"] in (3306, 5432, 1433, 1521):
                sev = "high"
                desc += " — database port exposed to internet"

            findings.append({
                "tool": "port_scan",
                "type": "open_port",
                "severity": sev,
                "port": result["port"],
                "service": result["service"],
                "target": target,
                "description": desc,
            })

    if open_ports:
        port_list = ", ".join(f"{p['port']}/{p['service']}" for p in sorted(open_ports, key=lambda x: x["port"]))
        logger.info("  Open ports: %s", port_list)
    else:
        logger.info("  No open ports detected (top %d)", len(ports))

    return findings


# ---------------------------------------------------------------------------
# HTTP Header & Security Analysis
# ---------------------------------------------------------------------------

async def scan_http_headers(domain: str) -> list[dict[str, Any]]:
    """Analyze HTTP response headers for security misconfigurations."""
    findings: list[dict[str, Any]] = []

    for scheme in ["https", "http"]:
        url = f"{scheme}://{domain}/"
        try:
            loop = asyncio.get_event_loop()

            def _fetch():
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                req = urllib.request.Request(url, method="HEAD")
                req.add_header("User-Agent", "MaximReconForge/1.0 Security-Scanner")
                return urllib.request.urlopen(req, timeout=10, context=ctx)

            resp = await loop.run_in_executor(None, _fetch)
            headers = dict(resp.headers)
            status = resp.status

            findings.append({
                "tool": "http_headers",
                "type": "http_response",
                "severity": "info",
                "url": url,
                "status_code": status,
                "server": headers.get("Server", "not disclosed"),
                "description": f"HTTP {status} response from {url}",
                "headers_snapshot": {k: v for k, v in headers.items()
                                     if k.lower() in [h.lower() for h in SECURITY_HEADERS + ["Server", "X-Powered-By"]]},
            })

            # Check for server version disclosure
            server = headers.get("Server", "")
            if server and ("/" in server or any(c.isdigit() for c in server)):
                findings.append({
                    "tool": "http_headers",
                    "type": "info_disclosure",
                    "severity": "low",
                    "url": url,
                    "header": "Server",
                    "value": server,
                    "description": f"Server version disclosed: {server}",
                })

            powered = headers.get("X-Powered-By", "")
            if powered:
                findings.append({
                    "tool": "http_headers",
                    "type": "info_disclosure",
                    "severity": "low",
                    "url": url,
                    "header": "X-Powered-By",
                    "value": powered,
                    "description": f"Technology disclosed via X-Powered-By: {powered}",
                })

            # Check missing security headers
            for hdr in SECURITY_HEADERS:
                if hdr not in headers:
                    sev = "medium" if hdr in ("Strict-Transport-Security", "Content-Security-Policy") else "low"
                    findings.append({
                        "tool": "http_headers",
                        "type": "missing_security_header",
                        "severity": sev,
                        "url": url,
                        "header": hdr,
                        "description": f"Missing security header: {hdr}",
                    })

            logger.info("  %s -> %d | Server: %s", url, status, headers.get("Server", "N/A"))

        except urllib.error.HTTPError as exc:
            findings.append({
                "tool": "http_headers",
                "type": "http_response",
                "severity": "info",
                "url": url,
                "status_code": exc.code,
                "description": f"HTTP {exc.code} from {url}",
            })
        except Exception as exc:
            logger.debug("HTTP probe %s failed: %s", url, exc)

    return findings


# ---------------------------------------------------------------------------
# TLS/SSL Certificate Inspection
# ---------------------------------------------------------------------------

async def scan_tls(domain: str) -> list[dict[str, Any]]:
    """Inspect TLS certificate for the target domain."""
    findings: list[dict[str, Any]] = []

    try:
        loop = asyncio.get_event_loop()

        def _check_tls():
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(socket.socket(), server_hostname=domain) as s:
                s.settimeout(10)
                s.connect((domain, 443))
                cert = s.getpeercert()
                cipher = s.cipher()
                version = s.version()
                return cert, cipher, version

        cert, cipher, tls_version = await loop.run_in_executor(None, _check_tls)

        # Certificate details
        subject = dict(x[0] for x in cert.get("subject", []))
        issuer = dict(x[0] for x in cert.get("issuer", []))
        not_after = cert.get("notAfter", "")
        san_list = []
        for san_type, san_value in cert.get("subjectAltName", []):
            san_list.append(san_value)

        findings.append({
            "tool": "tls_scan",
            "type": "tls_certificate",
            "severity": "info",
            "domain": domain,
            "subject_cn": subject.get("commonName", ""),
            "issuer_cn": issuer.get("commonName", ""),
            "issuer_org": issuer.get("organizationName", ""),
            "expires": not_after,
            "tls_version": tls_version,
            "cipher_suite": cipher[0] if cipher else "",
            "san_count": len(san_list),
            "description": f"TLS cert: CN={subject.get('commonName', 'N/A')}, "
                           f"Issuer={issuer.get('organizationName', 'N/A')}, "
                           f"Expires={not_after}, {tls_version}",
        })

        # Check TLS version
        if tls_version and tls_version in ("TLSv1", "TLSv1.1", "SSLv3"):
            findings.append({
                "tool": "tls_scan",
                "type": "weak_tls",
                "severity": "high",
                "domain": domain,
                "tls_version": tls_version,
                "description": f"Weak TLS version in use: {tls_version} — upgrade to TLS 1.2+",
            })

        # Check certificate expiry
        if not_after:
            from email.utils import parsedate_to_datetime
            try:
                expiry = parsedate_to_datetime(not_after)
                now = datetime.now(timezone.utc)
                days_left = (expiry - now).days
                if days_left < 0:
                    findings.append({
                        "tool": "tls_scan",
                        "type": "expired_cert",
                        "severity": "critical",
                        "domain": domain,
                        "expires": not_after,
                        "days_expired": abs(days_left),
                        "description": f"TLS certificate EXPIRED {abs(days_left)} days ago",
                    })
                elif days_left < 30:
                    findings.append({
                        "tool": "tls_scan",
                        "type": "expiring_cert",
                        "severity": "medium",
                        "domain": domain,
                        "expires": not_after,
                        "days_remaining": days_left,
                        "description": f"TLS certificate expires in {days_left} days",
                    })
            except Exception:
                pass

        logger.info("  TLS: %s, Cipher: %s, Expires: %s",
                     tls_version, cipher[0] if cipher else "N/A", not_after)

    except Exception as exc:
        findings.append({
            "tool": "tls_scan",
            "type": "tls_error",
            "severity": "medium",
            "domain": domain,
            "description": f"TLS connection failed: {exc}",
        })
        logger.info("  TLS: connection failed — %s", exc)

    return findings


# ---------------------------------------------------------------------------
# Sensitive Path Probing
# ---------------------------------------------------------------------------

async def scan_paths(domain: str) -> list[dict[str, Any]]:
    """Probe for sensitive/exposed paths on the target web server."""
    findings: list[dict[str, Any]] = []

    base_url = f"https://{domain}"

    async def probe_path(path: str) -> dict[str, Any] | None:
        url = f"{base_url}{path}"
        loop = asyncio.get_event_loop()
        try:
            def _probe():
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                req = urllib.request.Request(url, method="GET")
                req.add_header("User-Agent", "MaximReconForge/1.0 Security-Scanner")
                resp = urllib.request.urlopen(req, timeout=8, context=ctx)
                body = resp.read(2048).decode("utf-8", errors="replace")
                return resp.status, len(body), body[:512]

            status, length, snippet = await loop.run_in_executor(None, _probe)

            if status in (200, 301, 302, 403):
                sev = "info"
                if path in ("/.env", "/.git/HEAD", "/.git/config", "/.htpasswd",
                             "/backup.zip", "/backup.sql", "/db.sql",
                             "/wp-config.php", "/config.php", "/configuration.php"):
                    sev = "critical" if status == 200 else "medium"
                elif path in ("/phpmyadmin", "/admin", "/wp-admin", "/server-status", "/server-info"):
                    sev = "high" if status == 200 else "low"
                elif path in ("/.DS_Store", "/.htaccess"):
                    sev = "medium" if status == 200 else "info"

                return {
                    "tool": "path_probe",
                    "type": "exposed_path",
                    "severity": sev,
                    "url": url,
                    "path": path,
                    "status_code": status,
                    "content_length": length,
                    "description": f"Path {path} returned HTTP {status}",
                    "snippet": snippet[:256] if sev != "info" else "",
                }
            return None

        except urllib.error.HTTPError as exc:
            if exc.code == 403:
                return {
                    "tool": "path_probe",
                    "type": "forbidden_path",
                    "severity": "low",
                    "url": url,
                    "path": path,
                    "status_code": 403,
                    "description": f"Path {path} returned 403 Forbidden (exists but restricted)",
                }
            return None
        except Exception:
            return None

    # Run path probes concurrently (batched to avoid flooding)
    batch_size = 10
    for i in range(0, len(SENSITIVE_PATHS), batch_size):
        batch = SENSITIVE_PATHS[i:i + batch_size]
        tasks = [probe_path(p) for p in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in results:
            if isinstance(result, dict):
                findings.append(result)
                logger.info("  Found: %s -> %d (%s)",
                             result["path"], result["status_code"], result["severity"])

    return findings


# ---------------------------------------------------------------------------
# Master Scanner Orchestrator
# ---------------------------------------------------------------------------

async def run_full_scan(domain: str) -> list[dict[str, Any]]:
    """Run all scan modules and return aggregated findings."""
    all_findings: list[dict[str, Any]] = []

    # Resolve target IP for port scanning
    try:
        target_ip = socket.gethostbyname(domain)
    except socket.gaierror:
        target_ip = domain

    logger.info("[SCAN] Phase 1/5: DNS Enumeration")
    all_findings.extend(await scan_dns(domain))

    logger.info("[SCAN] Phase 2/5: Subdomain Discovery")
    all_findings.extend(await scan_subdomains(domain))

    logger.info("[SCAN] Phase 3/5: Port Scanning (%s -> %s)", domain, target_ip)
    all_findings.extend(await scan_ports(target_ip))

    logger.info("[SCAN] Phase 4/5: HTTP Security Headers")
    all_findings.extend(await scan_http_headers(domain))

    logger.info("[SCAN] Phase 5/5: TLS Certificate & Sensitive Path Probing")
    tls_findings = await scan_tls(domain)
    path_findings = await scan_paths(domain)
    all_findings.extend(tls_findings)
    all_findings.extend(path_findings)

    # Add timestamp to all findings
    ts = datetime.now(timezone.utc).isoformat()
    for f in all_findings:
        f["timestamp"] = ts
        f["target_domain"] = domain

    # Summary stats
    by_severity = {}
    for f in all_findings:
        sev = f.get("severity", "info")
        by_severity[sev] = by_severity.get(sev, 0) + 1

    logger.info(
        "[SCAN] Complete — %d findings: %s",
        len(all_findings),
        ", ".join(f"{s}={c}" for s, c in sorted(by_severity.items())),
    )

    return all_findings
