import React, { useState } from "react";
import { ShieldAlert, Search, ChevronDown, ChevronUp, AlertOctagon, HelpCircle } from "lucide-react";

export default function FindingsTab({ findings, currentStageIndex, scanState }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const showFindings = currentStageIndex >= 4 || scanState === "completed";

  let activeFindings = [];
  if (showFindings) {
    if (scanState === "completed" || currentStageIndex > 4) {
      activeFindings = findings;
    } else {
      activeFindings = findings.slice(0, 3);
    }
  }

  // Filter listings
  const filteredFindings = activeFindings.filter((finding) => {
    const matchesSearch = 
      finding.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      finding.cve.toLowerCase().includes(searchTerm.toLowerCase()) ||
      finding.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
      finding.id.toLowerCase().includes(searchTerm.toLowerCase());
      
    if (severityFilter === "all") return matchesSearch;
    return matchesSearch && finding.severity.toLowerCase() === severityFilter.toLowerCase();
  });

  const getSeverityBadgeClass = (severity) => {
    const sev = severity.toLowerCase();
    if (sev === "critical") return "sev-critical";
    if (sev === "high") return "sev-high";
    if (sev === "medium") return "sev-medium";
    return "sev-low";
  };

  const toggleExpand = (id) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  return (
    <div className="findings-tab-container">
      {/* Controls */}
      <div className="tab-control-bar glass-panel">
        <div className="search-box cyber-input-wrapper">
          <Search size={14} className="search-icon text-muted" />
          <input
            type="text"
            className="cyber-input search-input"
            placeholder="Search vulnerabilities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!showFindings}
          />
        </div>

        {/* Filters */}
        <div className="filter-group">
          <button 
            className={`filter-btn ${severityFilter === "all" ? "active" : ""}`}
            onClick={() => setSeverityFilter("all")}
            disabled={!showFindings}
          >
            All ({activeFindings.length})
          </button>
          <button 
            className={`filter-btn ${severityFilter === "critical" ? "active" : ""}`}
            onClick={() => setSeverityFilter("critical")}
            disabled={!showFindings}
          >
            Critical ({activeFindings.filter(f => f.severity === "Critical").length})
          </button>
          <button 
            className={`filter-btn ${severityFilter === "high" ? "active" : ""}`}
            onClick={() => setSeverityFilter("high")}
            disabled={!showFindings}
          >
            High ({activeFindings.filter(f => f.severity === "High").length})
          </button>
          <button 
            className={`filter-btn ${severityFilter === "medium" ? "active" : ""}`}
            onClick={() => setSeverityFilter("medium")}
            disabled={!showFindings}
          >
            Medium ({activeFindings.filter(f => f.severity === "Medium").length})
          </button>
        </div>
      </div>

      {/* Findings List */}
      <div className="findings-list">
        {!showFindings ? (
          <div className="findings-empty glass-panel text-mono">
            <ShieldAlert size={32} className="empty-icon text-muted pulse" />
            <span>Awaiting Vulnerability Scan Stage</span>
            <p>Active scan must progress to stage 5 before vulnerabilities are analyzed.</p>
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="findings-empty glass-panel text-mono">
            <span>No findings match the current filters.</span>
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const isExpanded = expandedId === finding.id;
            return (
              <div 
                key={finding.id} 
                className={`finding-card glass-panel ${getSeverityBadgeClass(finding.severity)} ${isExpanded ? "expanded" : ""}`}
              >
                {/* Header */}
                <div 
                  className="finding-header"
                  onClick={() => toggleExpand(finding.id)}
                >
                  <div className="finding-header-left">
                    <span className={`severity-tag text-mono ${getSeverityBadgeClass(finding.severity)}`}>
                      {finding.severity.toLowerCase()}
                    </span>
                    <span className="finding-id text-mono">{finding.id}</span>
                    <span className="finding-title">{finding.title}</span>
                  </div>
                  <div className="finding-header-right">
                    <span className="finding-cve text-mono">{finding.cve}</span>
                    <span className="finding-host text-mono text-secondary">{finding.host}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-secondary" /> : <ChevronDown size={14} className="text-secondary" />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="finding-body">
                    <div className="details-grid">
                      {/* Description */}
                      <div className="detail-section">
                        <span className="section-label">Description</span>
                        <p>{finding.summary}</p>
                      </div>

                      {/* Impact */}
                      <div className="detail-section">
                        <span className="section-label">Impact Assessment</span>
                        <p className="impact-text">{finding.impact}</p>
                      </div>

                      {/* Remediation */}
                      <div className="detail-section full-width">
                        <span className="section-label">Remediation Advice</span>
                        <div className="remediation-block">
                          <code>{finding.remediation}</code>
                        </div>
                      </div>

                      {/* Status Meta */}
                      <div className="detail-section">
                        <span className="section-label">Scope Metadata</span>
                        <div className="meta-pills text-mono">
                          <span className="meta-pill text-cyber-red border-red">Active findings</span>
                          <span className="meta-pill">Category: {finding.category}</span>
                          <span className="meta-pill">CVSS score: {finding.cvss}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .findings-tab-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          height: 100%;
          overflow-y: auto;
          padding-right: 0.25rem;
        }

        .findings-tab-container .tab-control-bar::before {
          display: none;
        }

        .tab-control-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          gap: 1rem;
          border-color: var(--border-color);
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

        /* Findings List */
        .findings-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex-grow: 1;
        }

        .findings-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          color: var(--text-secondary);
          gap: 0.5rem;
          font-size: 0.8rem;
          text-align: center;
          border-color: var(--border-color);
        }

        .findings-empty::before {
          display: none;
        }

        .findings-empty p {
          font-size: 0.7rem;
          color: var(--text-muted);
          max-width: 280px;
        }

        /* Card */
        .finding-card {
          border-radius: 4px;
          border: 1px solid var(--border-color);
          transition: all 0.1s ease;
        }

        .finding-card::before {
          display: none;
        }

        .finding-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          cursor: pointer;
          font-size: 0.8rem;
          gap: 1rem;
        }

        .finding-header-left,
        .finding-header-right {
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }

        .finding-header-left {
          flex-grow: 1;
          overflow: hidden;
        }

        .severity-tag {
          font-size: 0.65rem;
          font-weight: 600;
          padding: 0.15rem 0.4rem;
          border-radius: 3px;
          border: 1px solid transparent;
        }

        .severity-tag.sev-critical { color: var(--cyber-red); background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }
        .severity-tag.sev-high { color: var(--cyber-red); background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.15); }
        .severity-tag.sev-medium { color: var(--cyber-amber); background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.15); }
        .severity-tag.sev-low { color: var(--cyber-blue); background: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.15); }

        .finding-id {
          color: var(--text-muted);
          font-weight: 500;
          font-size: 0.75rem;
        }

        .finding-title {
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .finding-cve {
          color: var(--text-muted);
          font-size: 0.7rem;
          padding: 0.1rem 0.3rem;
          background: var(--bg-tertiary);
          border-radius: 3px;
          border: 1px solid var(--border-color);
        }

        .finding-host {
          font-size: 0.75rem;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Body details */
        .finding-body {
          padding: 0 1rem 1rem;
          border-top: 1px solid var(--border-color);
          background: rgba(15, 18, 25, 0.4);
        }

        .details-grid {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding-top: 0.85rem;
        }

        .detail-section {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .section-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        .detail-section p {
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .impact-text {
          color: var(--cyber-amber) !important;
        }

        .remediation-block {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 0.6rem 0.75rem;
          font-size: 0.75rem;
          line-height: 1.4;
          color: var(--text-primary);
          overflow-x: auto;
          white-space: pre-wrap;
        }

        .meta-pills {
          display: flex;
          gap: 0.35rem;
          font-size: 0.65rem;
        }

        .meta-pill {
          padding: 0.1rem 0.35rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          border-radius: 3px;
        }

        .meta-pill.text-cyber-red {
          color: var(--cyber-red);
          border-color: rgba(239, 68, 68, 0.2);
          background: rgba(239, 68, 68, 0.04);
        }

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
          .finding-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.35rem;
          }
          .finding-header-right {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
}
