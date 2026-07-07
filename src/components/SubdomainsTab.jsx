import React, { useState } from "react";
import { Search, Globe, Filter, ExternalLink } from "lucide-react";

export default function SubdomainsTab({ subdomains, currentStageIndex, scanState }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const showSubdomains = currentStageIndex >= 2 || scanState === "completed";
  
  let activeSubdomains = [];
  if (showSubdomains) {
    if (scanState === "completed" || currentStageIndex > 2) {
      activeSubdomains = subdomains;
    } else {
      activeSubdomains = subdomains.slice(0, Math.floor(subdomains.length * 0.6));
    }
  }

  const filteredSubdomains = activeSubdomains.filter((sub) => {
    const matchesSearch = sub.host.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          sub.ip.includes(searchTerm);
    
    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "200") return matchesSearch && sub.status === 200;
    if (statusFilter === "redirect") return matchesSearch && (sub.status === 301 || sub.status === 302);
    if (statusFilter === "blocked") return matchesSearch && (sub.status === 403 || sub.status === 401 || sub.status === 404);
    return matchesSearch;
  });

  const getStatusClass = (code) => {
    if (code >= 200 && code < 300) return "text-cyber-green bg-green-dim";
    if (code >= 300 && code < 400) return "text-cyber-blue bg-blue-dim";
    if (code >= 400 && code < 500) return "text-cyber-amber bg-amber-dim";
    return "text-cyber-red bg-red-dim";
  };

  const getSslClass = (ssl) => {
    if (ssl.startsWith("Valid")) return "ssl-valid";
    if (ssl.startsWith("Expired")) return "ssl-invalid";
    return "ssl-none";
  };

  return (
    <div className="subdomains-tab-container glass-panel">
      {/* Tab Controls */}
      <div className="tab-control-bar">
        <div className="search-box cyber-input-wrapper">
          <Search size={14} className="search-icon text-muted" />
          <input
            type="text"
            className="cyber-input search-input"
            placeholder="Search host or IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!showSubdomains}
          />
        </div>

        {/* Filter pills */}
        <div className="filter-group">
          <button 
            className={`filter-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
            disabled={!showSubdomains}
          >
            All ({activeSubdomains.length})
          </button>
          <button 
            className={`filter-btn ${statusFilter === "200" ? "active" : ""}`}
            onClick={() => setStatusFilter("200")}
            disabled={!showSubdomains}
          >
            200 OK ({activeSubdomains.filter(s => s.status === 200).length})
          </button>
          <button 
            className={`filter-btn ${statusFilter === "redirect" ? "active" : ""}`}
            onClick={() => setStatusFilter("redirect")}
            disabled={!showSubdomains}
          >
            Redirect ({activeSubdomains.filter(s => s.status === 301 || s.status === 302).length})
          </button>
          <button 
            className={`filter-btn ${statusFilter === "blocked" ? "active" : ""}`}
            onClick={() => setStatusFilter("blocked")}
            disabled={!showSubdomains}
          >
            Blocked ({activeSubdomains.filter(s => s.status === 403 || s.status === 401 || s.status === 404).length})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-wrapper">
        {!showSubdomains ? (
          <div className="table-empty">
            <Globe size={32} className="empty-icon text-muted pulse" />
            <span>Awaiting Discovery Scan Stages</span>
            <p>Active scan must progress to stage 3 before network assets are listed.</p>
          </div>
        ) : filteredSubdomains.length === 0 ? (
          <div className="table-empty">
            <span>No assets match the current filters.</span>
          </div>
        ) : (
          <table className="subdomain-table">
            <thead>
              <tr>
                <th>HOSTNAME</th>
                <th>IP ADDRESS</th>
                <th>PORTS</th>
                <th>SERVER</th>
                <th>SSL STATUS</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubdomains.map((sub) => (
                <tr key={sub.id}>
                  {/* Hostname */}
                  <td className="cell-host text-mono">
                    <a href={`https://${sub.host}`} target="_blank" rel="noopener noreferrer" className="host-link">
                      <span>{sub.host}</span>
                      <ExternalLink size={10} />
                    </a>
                  </td>
                  
                  {/* IP Address */}
                  <td className="cell-ip text-mono">{sub.ip}</td>
                  
                  {/* Open Ports */}
                  <td>
                    <div className="port-badges">
                      {sub.ports.map((port) => (
                        <span key={port} className={`port-badge text-mono ${port === 443 ? "secure" : port === 22 || port === 8080 ? "critical" : ""}`}>
                          {port}
                        </span>
                      ))}
                    </div>
                  </td>
                  
                  {/* Server */}
                  <td className="text-mono text-secondary">{sub.server}</td>
                  
                  {/* SSL Status */}
                  <td>
                    <span className={`ssl-badge text-mono ${getSslClass(sub.ssl)}`}>
                      {sub.ssl}
                    </span>
                  </td>
                  
                  {/* Response Code */}
                  <td>
                    <span className={`status-badge text-mono ${getStatusClass(sub.status)}`}>
                      {sub.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .subdomains-tab-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          border-color: var(--border-color);
        }

        .subdomains-tab-container::before {
          display: none;
        }

        /* Controls */
        .tab-control-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border-color);
          gap: 1rem;
          flex-shrink: 0;
        }

        .search-box {
          max-width: 260px;
        }

        .search-icon {
          position: absolute;
          left: 0.65rem;
        }

        .search-input {
          padding-left: 2rem !important;
          font-size: 0.8rem !important;
          height: 32px;
        }

        .filter-group {
          display: flex;
          gap: 0.35rem;
        }

        .filter-btn {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          padding: 0.3rem 0.6rem;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-btn:hover:not(:disabled) {
          border-color: var(--border-hover);
          color: var(--text-primary);
        }

        .filter-btn.active {
          background: var(--border-color);
          color: var(--text-primary);
          border-color: var(--border-hover);
          font-weight: 500;
        }

        .filter-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Table view */
        .table-wrapper {
          flex-grow: 1;
          overflow-y: auto;
        }

        .table-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
          gap: 0.5rem;
          font-size: 0.8rem;
          padding: 2.5rem 1rem;
          text-align: center;
        }

        .empty-icon {
          margin-bottom: 0.25rem;
        }

        .table-empty p {
          font-size: 0.7rem;
          color: var(--text-muted);
          max-width: 280px;
        }

        .subdomain-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.8rem;
        }

        .subdomain-table th {
          background: var(--bg-tertiary);
          padding: 0.6rem 0.85rem;
          color: var(--text-secondary);
          font-weight: 600;
          border-bottom: 1px solid var(--border-color);
          font-size: 0.65rem;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .subdomain-table td {
          padding: 0.6rem 0.85rem;
          border-bottom: 1px solid var(--border-color);
        }

        .subdomain-table tbody tr {
          transition: background-color 0.1s ease;
        }

        .subdomain-table tbody tr:hover {
          background: rgba(30, 37, 53, 0.25);
        }

        /* Badges */
        .cell-host {
          color: var(--text-primary);
        }

        .host-link {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          text-decoration: none;
          color: inherit;
        }

        .host-link:hover {
          color: var(--cyber-blue);
        }

        .cell-ip {
          color: var(--text-secondary);
        }

        .port-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .port-badge {
          font-size: 0.65rem;
          padding: 0.1rem 0.35rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          border-radius: 3px;
        }

        .port-badge.secure {
          border-color: rgba(16, 185, 129, 0.25);
          color: var(--cyber-green);
        }

        .port-badge.critical {
          border-color: rgba(239, 68, 68, 0.25);
          color: var(--cyber-red);
        }

        .ssl-badge {
          font-size: 0.65rem;
          padding: 0.1rem 0.35rem;
          border-radius: 3px;
          border: 1px solid transparent;
        }

        .ssl-badge.ssl-valid {
          color: var(--cyber-green);
          border-color: rgba(16, 185, 129, 0.2);
          background: rgba(16, 185, 129, 0.04);
        }

        .ssl-badge.ssl-invalid {
          color: var(--cyber-red);
          border-color: rgba(239, 68, 68, 0.2);
          background: rgba(239, 68, 68, 0.04);
        }

        .ssl-badge.ssl-none {
          color: var(--text-muted);
          border-color: var(--border-color);
          background: var(--bg-tertiary);
        }

        .status-badge {
          font-size: 0.65rem;
          font-weight: 500;
          padding: 0.15rem 0.4rem;
          border-radius: 3px;
          display: inline-block;
        }

        .text-cyber-green.bg-green-dim { background: rgba(34, 197, 94, 0.1); }
        .text-cyber-blue.bg-blue-dim { background: rgba(37, 99, 235, 0.1); }
        .text-cyber-amber.bg-amber-dim { background: rgba(245, 158, 11, 0.1); }
        .text-cyber-red.bg-red-dim { background: rgba(239, 68, 68, 0.1); }

        @media (max-width: 768px) {
          .tab-control-bar {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }
          .search-box {
            width: 100%;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}
