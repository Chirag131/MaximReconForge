import React, { useState, useEffect, useRef } from "react";
import { Play, Loader, CheckCircle, Sliders, Server, ExternalLink } from "lucide-react";

// Tool card subcomponent to isolate terminal auto-scroll refs and UI logic
function ToolCard({ 
  name, 
  purpose, 
  initialInput, 
  mockLogs, 
  status, 
  input, 
  logs, 
  onRun, 
  onInputChange 
}) {
  const consoleEndRef = useRef(null);

  // Auto-scroll the terminal inside this specific card
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const handleRunSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || status === "running") return;
    onRun(input.trim());
  };

  const getStatusBadge = () => {
    if (status === "running") {
      return (
        <span className="status-badge running-badge text-mono">
          <Loader size={10} className="animate-spin" />
          <span>running</span>
        </span>
      );
    }
    if (status === "completed") {
      return (
        <span className="status-badge completed-badge text-mono">
          <CheckCircle size={10} />
          <span>completed</span>
        </span>
      );
    }
    return (
      <span className="status-badge text-mono">
        <span className="idle-dot"></span>
        <span>idle</span>
      </span>
    );
  };

  return (
    <div className={`tool-card glass-panel ${status}`}>
      {/* Header */}
      <div className="tool-card-header">
        <div className="tool-title-info">
          <h4 className="tool-name text-mono">{name}</h4>
          <span className="tool-purpose">{purpose}</span>
        </div>
        {getStatusBadge()}
      </div>

      {/* Target input Form */}
      <form onSubmit={handleRunSubmit} className="tool-run-form">
        <div className="tool-input-row">
          <input
            type="text"
            className="cyber-input tool-scope-input text-mono"
            placeholder="enter scope target"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={status === "running"}
          />
          <button 
            type="submit" 
            className={`cyber-button tool-run-btn ${status === "running" ? "disabled" : ""}`}
            disabled={status === "running" || !input.trim()}
          >
            {status === "running" ? <Loader size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
            <span>Run</span>
          </button>
        </div>
      </form>

      {/* Terminal logs Output */}
      <div className="tool-terminal text-mono">
        {logs.length === 0 ? (
          <div className="console-placeholder text-muted">Awaiting run execution...</div>
        ) : (
          <div className="console-lines-list">
            {logs.map((line, idx) => (
              <div 
                key={idx} 
                className={`console-line ${
                  line.includes("[+]") ? "text-cyber-green" : 
                  line.includes("[!]") ? "text-cyber-red" : 
                  line.includes("[~]") ? "text-cyber-blue" : "text-secondary"
                }`}
              >
                {line}
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReconToolsTab({ domain }) {
  const targetScope = domain || "example.com";

  // Configuration of available tools
  const toolsConfig = {
    // Primary Recon
    assetfinder: {
      name: "Assetfinder",
      purpose: "Locate related subdomains and assets",
      getMockLogs: (target) => [
        `[~] Starting assetfinder on target: ${target}`,
        `[~] Fetching Certspotter API archives...`,
        `[~] Querying crt.sh certificate transparent records...`,
        `[~] Parsing subdomain registries...`,
        `[+] Found assets for ${target}:`,
        `    api.${target}`,
        `    dev.${target}`,
        `    staging.${target}`,
        `    vpn.${target}`,
        `    shop.${target}`,
        `[+] Assetfinder scan resolved. 5 domains mapped.`
      ]
    },
    amass: {
      name: "Amass",
      purpose: "In-depth DNS active and passive mapping",
      getMockLogs: (target) => [
        `[~] Initializing Amass v3.19.2 engine on target: ${target}`,
        `[~] querying Censys, Shodan, and SecurityTrails...`,
        `[~] Resolving IP networks & routing paths...`,
        `[~] Performing reverse lookup queries...`,
        `[+] Active DNS resolvers resolved:`,
        `    [A] mail.${target} (104.22.45.109)`,
        `    [A] secure-gateway.${target} (104.22.45.111)`,
        `    [A] vpn.${target} (192.168.10.15)`,
        `[+] DNS network map compiled successfully.`
      ]
    },
    subfinder: {
      name: "Subfinder",
      purpose: "Fast passive subdomain discovery utility",
      getMockLogs: (target) => [
        `[~] Running subfinder scanner on target: ${target}`,
        `[~] Querying passive feeds (Virustotal, DNSDumpster, Threatbook)...`,
        `[+] Discovered passive domains:`,
        `    api.${target}`,
        `    admin.${target}`,
        `    dev.${target}`,
        `    billing.${target}`,
        `    partner.${target}`,
        `    jenkins.${target}`,
        `[+] Subfinder scans completed.`
      ]
    },
    github_dorking: {
      name: "GitHub Dorking",
      purpose: "Locate leaked secrets in open sources",
      getMockLogs: (target) => [
        `[~] Initiating GitHub API search filters for: ${target}`,
        `[~] Scanning for exposed dork configurations...`,
        `[~] Dork: "db_password" OR "client_secret" OR "id_rsa"`,
        `[!] Threat alert in repos: dev-team/${target}-secrets/`,
        `    -> exposed: "aws_access_key": "AKIAIOSFODNN7EXAMPLE"`,
        `[+] GitHub dork query finished. 1 leak detected.`
      ]
    },
    // Secondary Recon
    httpx: {
      name: "HTTPX",
      purpose: "Fast multi-purpose HTTP protocol prober",
      getMockLogs: (target) => [
        `[~] Launching HTTPX prober on scope: ${target}`,
        `[~] Testing http/https web statuses & response codes...`,
        `[+] https://${target} [200 OK] [Server: nginx] [IP: 199.66.11.4]`,
        `[+] https://api.${target} [200 OK] [Server: nginx] [Title: API Gateway]`,
        `[+] https://dev.${target} [403 Forbidden] [Server: nginx]`,
        `[+] https://staging.${target} [200 OK] [Server: nginx] [SSL Expired]`,
        `[+] HTTPX check complete. 4 responsive web services probed.`
      ]
    },
    nmap: {
      name: "Nmap",
      purpose: "Network port mapping and vulnerability probe",
      getMockLogs: (target) => [
        `[~] Starting Nmap v7.93 scan on host: ${target}`,
        `[~] Scanning top 1000 ports for service versions...`,
        `[+] Host is responsive (0.009s latency).`,
        `[+] Open ports parsed:`,
        `    22/tcp   open   ssh (OpenSSH 8.2p1)`,
        `    80/tcp   open   http (Nginx 1.20.1)`,
        `    443/tcp  open   https (Nginx 1.20.1)`,
        `    8080/tcp open   http-proxy (Jenkins console)`,
        `[+] Nmap done: 1 IP scanned.`
      ]
    },
    katana: {
      name: "Katana",
      purpose: "Web crawler and endpoint crawler spider",
      getMockLogs: (target) => [
        `[~] Launching Katana crawler on https://${target}`,
        `[~] Crawling web tree recursively...`,
        `[+] Endpoint: https://${target}/`,
        `[+] Endpoint: https://${target}/login`,
        `[+] Endpoint: https://${target}/api/v1/auth`,
        `[+] Endpoint: https://${target}/assets/main.js`,
        `[+] Endpoint: https://${target}/robots.txt`,
        `[+] Crawl resolved. Mapped 5 endpoints.`
      ]
    },
    waybackurls: {
      name: "Waybackurls",
      purpose: "Extract public historical URLs from internet archives",
      getMockLogs: (target) => [
        `[~] Querying Wayback Machine archive registry for ${target}`,
        `[~] Fetching historical index arrays...`,
        `[+] Retrieved archived endpoints:`,
        `    https://${target}/old-login.php`,
        `    https://${target}/wp-content/uploads/`,
        `    https://${target}/api/test/v2`,
        `    https://${target}/backup.zip`,
        `[+] Wayback archives search complete.`
      ]
    },
    gau: {
      name: "GAU (GetAllURLs)",
      purpose: "Fetch historical URL paths from open archives",
      getMockLogs: (target) => [
        `[~] Executing GetAllURLs crawler for domain: ${target}`,
        `[~] Querying CommonCrawl, OTX, and archive.org...`,
        `[+] Extracted endpoints:`,
        `    https://shop.${target}/cart?checkout=true`,
        `    https://api.${target}/v1/status`,
        `    https://static.${target}/images/logo.png`,
        `[+] GAU finished successfully. 3 links mapped.`
      ]
    }
  };

  // State holding tool runs
  const [toolsState, setToolsState] = useState({
    assetfinder: { status: "idle", input: targetScope, logs: [] },
    amass: { status: "idle", input: targetScope, logs: [] },
    subfinder: { status: "idle", input: targetScope, logs: [] },
    github_dorking: { status: "idle", input: targetScope, logs: [] },
    httpx: { status: "idle", input: targetScope, logs: [] },
    nmap: { status: "idle", input: targetScope, logs: [] },
    katana: { status: "idle", input: targetScope, logs: [] },
    waybackurls: { status: "idle", input: targetScope, logs: [] },
    gau: { status: "idle", input: targetScope, logs: [] }
  });

  const handleInputChange = (toolKey, value) => {
    setToolsState((prev) => ({
      ...prev,
      [toolKey]: {
        ...prev[toolKey],
        input: value
      }
    }));
  };

  const handleRunTool = (toolKey) => {
    const config = toolsConfig[toolKey];
    const target = toolsState[toolKey].input;
    const finalLogs = config.getMockLogs(target);

    // Reset tool state to running and clear logs
    setToolsState((prev) => ({
      ...prev,
      [toolKey]: {
        ...prev[toolKey],
        status: "running",
        logs: []
      }
    }));

    // Stream logs line-by-line
    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < finalLogs.length) {
        setToolsState((prev) => ({
          ...prev,
          [toolKey]: {
            ...prev[toolKey],
            logs: [...prev[toolKey].logs, finalLogs[currentLine]]
          }
        }));
        currentLine++;
      } else {
        clearInterval(interval);
        setToolsState((prev) => ({
          ...prev,
          [toolKey]: {
            ...prev[toolKey],
            status: "completed"
          }
        }));
      }
    }, 250); // Append log line every 250ms
  };

  return (
    <div className="recon-tools-container">
      {/* Section 1: Primary Recon */}
      <div className="tools-section">
        <h3 className="section-title text-mono">// PRIMARY_RECONNAISSANCE_TOOLS</h3>
        <div className="tools-grid">
          {["assetfinder", "amass", "subfinder", "github_dorking"].map((key) => {
            const tool = toolsConfig[key];
            const state = toolsState[key];
            return (
              <ToolCard
                key={key}
                name={tool.name}
                purpose={tool.purpose}
                status={state.status}
                input={state.input}
                logs={state.logs}
                onInputChange={(val) => handleInputChange(key, val)}
                onRun={() => handleRunTool(key)}
              />
            );
          })}
        </div>
      </div>

      {/* Section 2: Secondary Recon */}
      <div className="tools-section">
        <h3 className="section-title text-mono">// SECONDARY_RECONNAISSANCE_TOOLS</h3>
        <div className="tools-grid">
          {["httpx", "nmap", "katana", "waybackurls", "gau"].map((key) => {
            const tool = toolsConfig[key];
            const state = toolsState[key];
            return (
              <ToolCard
                key={key}
                name={tool.name}
                purpose={tool.purpose}
                status={state.status}
                input={state.input}
                logs={state.logs}
                onInputChange={(val) => handleInputChange(key, val)}
                onRun={() => handleRunTool(key)}
              />
            );
          })}
        </div>
      </div>

      <style>{`
        .recon-tools-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          height: 100%;
          overflow-y: auto;
          padding-right: 0.25rem;
        }

        .tools-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .section-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: 0.05em;
        }

        .tools-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        @media (max-width: 1024px) {
          .tools-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Tool Card layout */
        .tool-card {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          border-color: var(--border-color);
          background-color: var(--bg-secondary);
        }

        .tool-card:hover {
          border-color: var(--border-hover);
        }

        .tool-card.running {
          border-color: rgba(59, 130, 246, 0.3);
        }

        .tool-card.completed {
          border-color: rgba(16, 185, 129, 0.3);
        }

        .tool-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .tool-title-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .tool-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .tool-purpose {
          font-size: 0.7rem;
          color: var(--text-secondary);
        }

        /* Status badges */
        .status-badge {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.65rem;
          text-transform: lowercase;
          color: var(--text-muted);
          padding: 0.1rem 0.4rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 3px;
        }

        .status-badge.text-cyber-blue {
          color: var(--cyber-blue);
          border-color: rgba(59, 130, 246, 0.2);
          background: rgba(59, 130, 246, 0.04);
        }

        .status-badge.text-cyber-green {
          color: var(--cyber-green);
          border-color: rgba(16, 185, 129, 0.2);
          background: rgba(16, 185, 129, 0.04);
        }

        .idle-dot {
          width: 5px;
          height: 5px;
          background: var(--text-muted);
          border-radius: 50%;
        }

        .animate-spin {
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Input row */
        .tool-run-form {
          width: 100%;
        }

        .tool-input-row {
          display: flex;
          gap: 0.5rem;
        }

        .tool-scope-input {
          height: 32px !important;
          font-size: 0.75rem !important;
          padding: 0 0.5rem !important;
        }

        .tool-run-btn {
          height: 32px;
          padding: 0 0.85rem;
          flex-shrink: 0;
          font-size: 0.75rem;
          border-color: var(--border-color);
        }

        .tool-run-btn:hover:not(:disabled) {
          border-color: var(--cyber-blue);
          background-color: rgba(59, 130, 246, 0.05);
          color: var(--cyber-blue);
        }

        .tool-run-btn.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Card Terminal View */
        .tool-terminal {
          height: 140px;
          background-color: #040508;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 0.6rem;
          font-size: 0.7rem;
          line-height: 1.45;
          overflow-y: auto;
          box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.8);
        }

        .console-placeholder {
          color: var(--text-muted);
          font-style: italic;
          display: flex;
          align-items: center;
          height: 100%;
          justify-content: center;
        }

        .console-lines-list {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .console-line {
          white-space: pre-wrap;
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}
