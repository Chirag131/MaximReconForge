// Dummy JSON API Mock Data for Cybersecurity Reconnaissance Dashboard

export const getMockData = (domain = "tesla.com") => {
  const rootDomain = domain.toLowerCase().trim() || "tesla.com";
  
  return {
    target: rootDomain,
    scanDate: new Date().toISOString(),
    stats: {
      subdomainsCount: 18,
      aliveCount: 14,
      vulnerabilitiesCount: 7,
      scannedPortsCount: 84,
      criticalCount: 1,
      highCount: 2,
      mediumCount: 3,
      lowCount: 1,
    },
    
    // Pipeline logs that display in the terminal for each stage
    logsByStage: [
      // Stage 1: Domain Validation
      [
        `[INFO] [00:00:01] Initializing target validation for: ${rootDomain}`,
        `[INFO] [00:00:02] Resolving domain name records...`,
        `[SUCCESS] [00:00:03] Host matches IPv4 standard structure.`,
        `[INFO] [00:00:03] Whois database lookup: Owner Registry found.`,
        `[INFO] [00:00:04] Registrar: MarkMonitor Inc.`,
        `[INFO] [00:00:05] Domain status: clientDeleteProhibited, clientTransferProhibited`,
        `[SUCCESS] [00:00:06] Domain verification passed. Proceeding to DNS lookup.`
      ],
      // Stage 2: DNS Lookup
      [
        `[INFO] [00:00:07] querying DNS records (A, AAAA, MX, TXT, CNAME, NS)`,
        `[SUCCESS] [00:00:08] A Record: 199.66.11.4`,
        `[SUCCESS] [00:00:09] MX Record: mail.global.mx.mail.protection.outlook.com (Priority 10)`,
        `[SUCCESS] [00:00:10] NS Records: dns1.p01.nsone.net, dns2.p01.nsone.net`,
        `[SUCCESS] [00:00:11] TXT Record: v=spf1 include:spf.protection.outlook.com -all`,
        `[INFO] [00:00:12] Attempting DNS Zone Transfer (AXFR) on dns1.p01.nsone.net...`,
        `[WARNING] [00:00:13] Zone transfer REFUSED (Securely configured).`,
        `[SUCCESS] [00:00:14] DNS map compiled successfully.`
      ],
      // Stage 3: Subdomain Discovery
      [
        `[INFO] [00:00:15] Starting subdomain enumeration using passive search sources...`,
        `[INFO] [00:00:16] Querying CRT.sh Certificate Transparency logs...`,
        `[INFO] [00:00:17] Querying SecurityTrails, Shodan, and Censys APIs...`,
        `[SUCCESS] [00:00:18] Found 12 subdomains via passive sources.`,
        `[INFO] [00:00:19] Executing active brute-force via wordlist (common-5000.txt)...`,
        `[SUCCESS] [00:00:20] Discovered api.${rootDomain} (Active)`,
        `[SUCCESS] [00:00:21] Discovered auth.${rootDomain} (Active)`,
        `[SUCCESS] [00:00:22] Discovered dev.${rootDomain} (Active)`,
        `[SUCCESS] [00:00:23] Discovered staging.${rootDomain} (Active)`,
        `[SUCCESS] [00:00:24] Discovered vpn.${rootDomain} (Active - OpenVPN)`,
        `[SUCCESS] [00:00:25] Discovered shop.${rootDomain} (Active - Shopify)`,
        `[SUCCESS] [00:00:26] Discovered secure-gateway.${rootDomain} (Active)`,
        `[SUCCESS] [00:00:27] Total subdomains mapped: 18`
      ],
      // Stage 4: HTTP Probe
      [
        `[INFO] [00:00:28] Initializing HTTP/HTTPS protocol probe...`,
        `[INFO] [00:00:29] Testing port 80 and port 443 responses...`,
        `[SUCCESS] [00:00:30] https://api.${rootDomain} status: 200 OK (Server: nginx, SSL: Valid)`,
        `[SUCCESS] [00:00:31] https://auth.${rootDomain} status: 200 OK (Server: Cloudflare, SSL: Valid)`,
        `[SUCCESS] [00:00:32] https://dev.${rootDomain} status: 403 Forbidden (Server: nginx, SSL: Valid)`,
        `[SUCCESS] [00:00:33] https://staging.${rootDomain} status: 200 OK (Server: nginx, SSL: Expired-SelfSigned)`,
        `[WARNING] [00:00:34] http://vpn.${rootDomain} status: 400 Bad Request (SSL required)`,
        `[SUCCESS] [00:00:35] https://shop.${rootDomain} status: 301 Moved Permanently (To Shopify CDN)`,
        `[SUCCESS] [00:00:36] https://secure-gateway.${rootDomain} status: 200 OK`,
        `[INFO] [00:00:37] Alive hosts checklist: 14 / 18 targets active.`
      ],
      // Stage 5: Vulnerability Scan
      [
        `[INFO] [00:00:38] Starting vulnerability scanning engine...`,
        `[INFO] [00:00:39] Analyzing HTTP headers for missing security protections...`,
        `[WARNING] [00:00:40] Missing Content-Security-Policy (CSP) header on shop.${rootDomain}`,
        `[INFO] [00:00:41] Mapping network ports for open vulnerabilities...`,
        `[CRITICAL] [00:00:42] Found OpenSSH 7.2p1 on dev.${rootDomain}:22 (CVE-2016-3115 X11 forwarding hijacking)`,
        `[HIGH] [00:00:43] Found Outdated OpenSSL on staging.${rootDomain} (CVE-2023-0286 Vulnerable to Denial of Service)`,
        `[HIGH] [00:00:44] Exposed Git directory (.git/config) found on dev.${rootDomain}/.git/`,
        `[WARNING] [00:00:45] CORS wildcard policy "*" detected on api.${rootDomain}`,
        `[INFO] [00:00:46] SSL Certificate check: Expired certificate found on staging.${rootDomain}`,
        `[SUCCESS] [00:00:47] Scan completed. Vulnerability metrics compiled.`
      ],
      // Stage 6: Report Generation
      [
        `[INFO] [00:00:48] Formatting reconnaissance findings...`,
        `[INFO] [00:00:49] Calculating CVSS v3 Severity Metrics...`,
        `[INFO] [00:00:50] Building JSON structure and export packages...`,
        `[SUCCESS] [00:00:51] Report saved to disk: report_${rootDomain}_latest.json`,
        `[SUCCESS] [00:00:52] Export available in CSV, PDF, and JSON formats.`,
        `[SUCCESS] [00:00:53] --- SCAN TERMINATED SUCCESSFULLY ---`
      ]
    ],
    
    // Subdomain List
    subdomains: [
      { id: 1, host: `api.${rootDomain}`, ip: "104.22.45.109", status: 200, ports: [80, 443], title: "Application API Gateway", server: "nginx", ssl: "Valid (LetsEncrypt)" },
      { id: 2, host: `auth.${rootDomain}`, ip: "104.22.45.110", status: 200, ports: [443], title: "Identity Provider Login", server: "Cloudflare", ssl: "Valid (DigiCert)" },
      { id: 3, host: `dev.${rootDomain}`, ip: "172.56.22.12", status: 403, ports: [22, 80, 443, 8080], title: "403 Forbidden - Unauthorized Access", server: "nginx", ssl: "Valid (LetsEncrypt)" },
      { id: 4, host: `staging.${rootDomain}`, ip: "172.56.22.13", status: 200, ports: [80, 443, 8443], title: "Staging Portal", server: "nginx", ssl: "Expired (Self-Signed)" },
      { id: 5, host: `vpn.${rootDomain}`, ip: "192.168.10.15", status: 400, ports: [1194, 443], title: "Access Gateway Router", server: "OpenVPN", ssl: "Valid (Enterprise Root)" },
      { id: 6, host: `shop.${rootDomain}`, ip: "23.227.38.32", status: 301, ports: [80, 443], title: "Redirecting...", server: "Shopify", ssl: "Valid (Cloudflare)" },
      { id: 7, host: `secure-gateway.${rootDomain}`, ip: "104.22.45.111", status: 200, ports: [443], title: "Secure Terminal Tunnel", server: "AWS ELB", ssl: "Valid (Amazon)" },
      { id: 8, host: `static.${rootDomain}`, ip: "99.86.230.12", status: 200, ports: [80, 443], title: "Static Content Deliver System", server: "AmazonS3", ssl: "Valid (Amazon)" },
      { id: 9, host: `billing.${rootDomain}`, ip: "104.22.45.115", status: 200, ports: [443], title: "Payment Portal", server: "Cloudflare", ssl: "Valid (DigiCert)" },
      { id: 10, host: `partner.${rootDomain}`, ip: "198.51.100.40", status: 401, ports: [443], title: "Partner Gateway - authentication Required", server: "nginx", ssl: "Valid (LetsEncrypt)" },
      { id: 11, host: `mfa.${rootDomain}`, ip: "198.51.100.41", status: 200, ports: [443], title: "Multi-Factor Authentication", server: "nginx", ssl: "Valid (LetsEncrypt)" },
      { id: 12, host: `internal-wiki.${rootDomain}`, ip: "10.0.4.15", status: 404, ports: [80, 443], title: "Site not found", server: "Apache/2.4", ssl: "Valid (Internal)" },
      { id: 13, host: `mail.${rootDomain}`, ip: "40.100.54.12", status: 302, ports: [25, 465, 587, 993], title: "Microsoft Outlook Exchange Server", server: "Microsoft-IIS/10.0", ssl: "Valid (Microsoft)" },
      { id: 14, host: `k8s-ingress.${rootDomain}`, ip: "35.190.22.5", status: 403, ports: [443], title: "Kubernetes Ingress Default Backend", server: "nginx-ingress", ssl: "Valid (Google)" },
      { id: 15, host: `grafana.${rootDomain}`, ip: "172.56.22.25", status: 302, ports: [3000, 443], title: "Redirecting to /login", server: "Grafana", ssl: "Valid (LetsEncrypt)" },
      { id: 16, host: `kibana.${rootDomain}`, ip: "172.56.22.26", status: 403, ports: [5601], title: "Access Blocked", server: "Elastic", ssl: "N/A" },
      { id: 17, host: `registry.${rootDomain}`, ip: "172.56.22.27", status: 200, ports: [5000, 443], title: "Docker Registry API", server: "Docker-Registry", ssl: "Valid (LetsEncrypt)" },
      { id: 18, host: `jenkins.${rootDomain}`, ip: "172.56.22.28", status: 403, ports: [8080], title: "Jenkins Dashboard [Access Denied]", server: "Jetty", ssl: "N/A" }
    ],
    
    // Technologies Detected
    technologies: [
      { name: "Nginx Server", category: "Web Server", version: "1.20.1", count: 8, confidence: "High" },
      { name: "Cloudflare CDN", category: "Content Delivery Network", version: "WAF Active", count: 4, confidence: "High" },
      { name: "Amazon S3", category: "Cloud Storage", version: "AWS Buckets", count: 2, confidence: "Medium" },
      { name: "React", category: "Frontend Framework", version: "18.2.0", count: 3, confidence: "High" },
      { name: "OpenVPN", category: "VPN Gateways", version: "2.4.9", count: 1, confidence: "High" },
      { name: "Shopify Storefront", category: "E-Commerce", version: "SaaS", count: 1, confidence: "High" },
      { name: "Docker API", category: "Containerization", version: "Registry v2", count: 1, confidence: "High" },
      { name: "Kubernetes Ingress", category: "Orchestration", version: "1.22.4", count: 1, confidence: "Medium" },
      { name: "Grafana Server", category: "Metrics Dashboard", version: "9.3.2", count: 1, confidence: "High" }
    ],
    
    // Security Findings (Vulnerabilities)
    findings: [
      {
        id: "VULN-001",
        cve: "CVE-2016-3115",
        title: "Outdated SSH Remote Server Hijacking Vulnerability",
        severity: "Critical",
        cvss: 9.8,
        host: `dev.${rootDomain}:22`,
        summary: "The OpenSSH service on port 22 is running version 7.2p1. This version is vulnerable to X11 forwarding hijacking and potential remote session tampering under specific configurations.",
        impact: "Remote attackers can bypass access controls, hijack user console sessions, or potentially pivot inside the virtual environment.",
        remediation: "Upgrade OpenSSH to version 8.8p1 or newer. Disable X11 forwarding in sshd_config if it is not required by policy.",
        status: "Active",
        category: "Network Services"
      },
      {
        id: "VULN-002",
        cve: "CVE-2023-0286",
        title: "OpenSSL Denial of Service & Memory Disclosure Vulnerability",
        severity: "High",
        cvss: 8.2,
        host: `staging.${rootDomain}:443`,
        summary: "The target host uses an outdated version of OpenSSL (3.0.0-3.0.7) which is vulnerable to memory disclosure via X.509 general name verification. Can cause denial of service via custom certificates.",
        impact: "Allows remote attackers to crash the service (DoS) or retrieve sensitive chunks of process memory during SSL/TLS handshakes.",
        remediation: "Upgrade the library package to OpenSSL version 3.0.8 or newer. Re-compile Nginx linking against the secure version.",
        status: "Active",
        category: "SSL/TLS"
      },
      {
        id: "VULN-003",
        cve: "N/A",
        title: "Exposed Internal Git Repository Configuration Directory",
        severity: "High",
        cvss: 7.5,
        host: `dev.${rootDomain}/.git/config`,
        summary: "Active development folder contains an exposed Git repository config file. No authentication was required to read raw version control indexing documents.",
        impact: "Attackers can download source code history, inspect database credentials, read private API keys, and map deployment structures.",
        remediation: "Block HTTP access to the `.git` folder in server configurations (e.g. deny all rule in nginx) or remove the repository files from the production webroot immediately.",
        status: "Active",
        category: "Information Disclosure"
      },
      {
        id: "VULN-004",
        cve: "N/A",
        title: "Expired SSL/TLS Server Certificate",
        severity: "Medium",
        cvss: 5.4,
        host: `staging.${rootDomain}:443`,
        summary: "The SSL/TLS certificate presented by the server has expired. Additionally, it is self-signed, causing web browsers to trigger high-risk warning screens for users.",
        impact: "Breaks secure communication validation, leaving client browser traffic vulnerable to Man-in-the-Middle (MitM) attacks.",
        remediation: "Install a valid, non-expired SSL certificate signed by a recognized Certificate Authority (CA) such as Let's Encrypt.",
        status: "Active",
        category: "Cryptography"
      },
      {
        id: "VULN-005",
        cve: "N/A",
        title: "Permissive Cross-Origin Resource Sharing (CORS) Policy",
        severity: "Medium",
        cvss: 5.3,
        host: `api.${rootDomain}`,
        summary: "The API gateway implements a wildcard origin response policy: `Access-Control-Allow-Origin: *`. Credentials are not restricted from cross-site access.",
        impact: "Enables arbitrary external domains to make queries and access responses from user browsers, bypass cross-domain access controls, and extract data.",
        remediation: "Replace the wildcard policy with a strict whitelist of verified client origins. Do not reflect incoming Origin headers blindly.",
        status: "Active",
        category: "Access Control"
      },
      {
        id: "VULN-006",
        cve: "N/A",
        title: "Missing Content Security Policy (CSP) Security Headers",
        severity: "Low",
        cvss: 3.5,
        host: `shop.${rootDomain}`,
        summary: "The HTTP response header list lacks a `Content-Security-Policy` header. Cross-site script executions are not restricted by browser security policies.",
        impact: "Increases exposure to Cross-Site Scripting (XSS), script injection, Clickjacking, and packet tampering.",
        remediation: "Configure the server to respond with a robust CSP header (e.g. `default-src 'self'; script-src 'self' 'unsafe-inline';`).",
        status: "Active",
        category: "HTTP Headers"
      },
      {
        id: "VULN-007",
        cve: "N/A",
        title: "Exposed Non-Standard Ports and Administration Gateways",
        severity: "Medium",
        cvss: 5.0,
        host: `jenkins.${rootDomain}:8080`,
        summary: "Jenkins build administration and Docker registry ports are exposed to the public internet without proper IP restricting firewalls.",
        impact: "Increases attack footprint, exposing dashboard login screens to brute-force attacks and credential stuffing attempts.",
        remediation: "Restrict port 8080 and 5000 access to corporate VPN IP addresses or configure standard firewall policies.",
        status: "Active",
        category: "Network Security"
      }
    ]
  };
};
