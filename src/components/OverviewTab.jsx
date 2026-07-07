import React from "react";
import { 
  Globe, 
  Activity, 
  Cpu, 
  ShieldAlert, 
  Server, 
  ShieldAlert as AlertIcon, 
  ChevronRight 
} from "lucide-react";

export default function OverviewTab({ 
  stats, 
  technologies, 
  target, 
  currentStageIndex, 
  scanState,
  onTabChange
}) {
  const showSubdomains = currentStageIndex >= 2 || scanState === "completed";
  const showAlive = currentStageIndex >= 3 || scanState === "completed";
  const showTech = currentStageIndex >= 3 || scanState === "completed";
  const showFindings = currentStageIndex >= 4 || scanState === "completed";

  const displaySubdomains = showSubdomains 
    ? (currentStageIndex === 2 ? Math.min(stats.subdomainsCount, Math.floor(stats.subdomainsCount * 0.6)) : stats.subdomainsCount) 
    : 0;

  const displayAlive = showAlive 
    ? (currentStageIndex === 3 ? Math.min(stats.aliveCount, Math.floor(stats.aliveCount * 0.5)) : stats.aliveCount) 
    : 0;

  const displayTech = showTech ? technologies.slice(0, currentStageIndex >= 4 ? undefined : 4) : [];
  
  const displayFindings = showFindings 
    ? (currentStageIndex === 4 ? Math.min(stats.vulnerabilitiesCount, 3) : stats.vulnerabilitiesCount) 
    : 0;

  const displayCritical = showFindings ? (currentStageIndex === 4 ? 0 : stats.criticalCount) : 0;
  const displayHigh = showFindings ? (currentStageIndex === 4 ? 1 : stats.highCount) : 0;
  const displayMedium = showFindings ? (currentStageIndex === 4 ? 2 : stats.mediumCount) : 0;
  const displayLow = showFindings ? (currentStageIndex === 4 ? 0 : stats.lowCount) : 0;

  const ipInfo = "199.66.11.4";
  const location = "United States - Ashburn, VA";
  const registrar = "MarkMonitor Inc.";

  return (
    <div className="overview-tab-container">
      {/* 4 Stats Cards */}
      <div className="stats-grid">
        {/* Card 1: Subdomains */}
        <div className="stat-card glass-panel blue-tag" onClick={() => onTabChange("subdomains")}>
          <div className="stat-info">
            <span className="stat-label">Subdomains mapped</span>
            <div className="stat-value text-cyber-blue">
              {displaySubdomains}
              {currentStageIndex === 2 && <span className="stat-spinner">...</span>}
            </div>
            <span className="stat-subtext">Total assets discovered</span>
          </div>
          <ChevronRight className="card-chevron" size={14} />
        </div>

        {/* Card 2: Alive Hosts */}
        <div className="stat-card glass-panel green-tag" onClick={() => onTabChange("subdomains")}>
          <div className="stat-info">
            <span className="stat-label">Active targets</span>
            <div className="stat-value text-cyber-green">
              {displayAlive}
              {currentStageIndex === 3 && <span className="stat-spinner">...</span>}
            </div>
            <span className="stat-subtext">Responsive network hosts</span>
          </div>
          <ChevronRight className="card-chevron" size={14} />
        </div>

        {/* Card 3: Technologies */}
        <div className="stat-card glass-panel purple-tag" onClick={() => onTabChange("overview")}>
          <div className="stat-info">
            <span className="stat-label">Technologies mapped</span>
            <div className="stat-value text-cyber-purple">
              {showTech ? displayTech.length : 0}
              {currentStageIndex === 3 && <span className="stat-spinner">...</span>}
            </div>
            <span className="stat-subtext">Identified infrastructure specs</span>
          </div>
          <ChevronRight className="card-chevron" size={14} />
        </div>

        {/* Card 4: Security Findings */}
        <div className="stat-card glass-panel red-tag" onClick={() => onTabChange("findings")}>
          <div className="stat-info">
            <span className="stat-label">Security alerts</span>
            <div className={`stat-value ${displayFindings > 0 ? "text-cyber-red" : "text-secondary"}`}>
              {displayFindings}
              {currentStageIndex === 4 && <span className="stat-spinner">...</span>}
            </div>
            <span className="stat-subtext">Discovered vulnerabilities</span>
          </div>
          <ChevronRight className="card-chevron" size={14} />
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <div className="overview-layout">
        {/* Left Columns */}
        <div className="overview-left-column">
          {/* Target Profile */}
          <div className="glass-panel profile-panel">
            <div className="panel-title">Target Profile</div>
            <div className="profile-details">
              <div className="profile-row">
                <span className="profile-label">Domain scope:</span>
                <span className="profile-value text-cyber-blue text-mono">{target}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Resolved IP:</span>
                <span className="profile-value text-mono">{ipInfo}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Geographic server location:</span>
                <span className="profile-value">{location}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Owner DNS Registrar:</span>
                <span className="profile-value">{registrar}</span>
              </div>
            </div>
          </div>

          {/* Tech stack */}
          <div className="glass-panel tech-panel">
            <div className="panel-title">Infrastructure footprint</div>
            {!showTech ? (
              <div className="panel-empty">Awaiting network probe stage...</div>
            ) : (
              <div className="tech-list-wrapper">
                {displayTech.map((tech, index) => (
                  <div key={index} className="tech-tag glass-panel">
                    <Server size={12} className="text-cyber-purple" />
                    <span className="tech-name">{tech.name}</span>
                    <span className="tech-ver text-mono">{tech.version}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Columns */}
        <div className="overview-right-column">
          <div className="glass-panel vulnerability-breakdown-panel">
            <div className="panel-title">Security Severity Distribution</div>
            
            {!showFindings ? (
              <div className="panel-empty">Awaiting vulnerability analysis...</div>
            ) : (
              <div className="breakdown-body">
                <div className="severity-bar-list">
                  {/* Critical */}
                  <div className="severity-item">
                    <div className="severity-meta text-mono">
                      <span className="text-cyber-red font-medium">Critical severity (CVSS 9.0+)</span>
                      <span className="text-secondary">{displayCritical}</span>
                    </div>
                    <div className="bar-bg">
                      <div 
                        className="bar-fill bg-cyber-red" 
                        style={{ width: displayCritical > 0 ? "100%" : "0%" }}
                      ></div>
                    </div>
                  </div>

                  {/* High */}
                  <div className="severity-item">
                    <div className="severity-meta text-mono">
                      <span className="text-cyber-red">High severity (CVSS 7.0-8.9)</span>
                      <span className="text-secondary">{displayHigh}</span>
                    </div>
                    <div className="bar-bg">
                      <div 
                        className="bar-fill bg-cyber-red" 
                        style={{ width: `${(displayHigh / stats.vulnerabilitiesCount) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Medium */}
                  <div className="severity-item">
                    <div className="severity-meta text-mono">
                      <span className="text-cyber-amber">Medium severity (CVSS 4.0-6.9)</span>
                      <span className="text-secondary">{displayMedium}</span>
                    </div>
                    <div className="bar-bg">
                      <div 
                        className="bar-fill bg-cyber-amber" 
                        style={{ width: `${(displayMedium / stats.vulnerabilitiesCount) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Low */}
                  <div className="severity-item">
                    <div className="severity-meta text-mono">
                      <span className="text-cyber-blue">Low severity (CVSS 0.1-3.9)</span>
                      <span className="text-secondary">{displayLow}</span>
                    </div>
                    <div className="bar-bg">
                      <div 
                        className="bar-fill bg-cyber-blue" 
                        style={{ width: `${(displayLow / stats.vulnerabilitiesCount) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Threat assessment message card */}
                {displayCritical > 0 && (
                  <div className="threat-assessment glass-panel red-stripe">
                    <div className="assessment-title text-cyber-red">
                      <AlertIcon size={14} />
                      <span>Security Advisory</span>
                    </div>
                    <p className="assessment-desc">
                      Critical vulnerability (OpenSSH X11 forwarding session hijacking) discovered. Remediation required.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .overview-tab-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 100%;
          overflow-y: auto;
          padding-right: 0.25rem;
        }

        /* Stats Cards with Stripe-like side accents */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
        }

        .stat-card {
          padding: 0.85rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.15s ease;
          border-color: var(--border-color);
          position: relative;
        }

        .stat-card::after {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          border-radius: 4px 0 0 4px;
        }

        .stat-card.blue-tag::after { background-color: var(--cyber-blue); }
        .stat-card.green-tag::after { background-color: var(--cyber-green); }
        .stat-card.purple-tag::after { background-color: var(--cyber-purple); }
        .stat-card.red-tag::after { background-color: var(--cyber-red); }

        .stat-card:hover {
          border-color: var(--border-hover);
          background-color: var(--bg-tertiary);
        }

        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }

        .stat-label {
          font-size: 0.7rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .stat-value {
          font-size: 1.25rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.2rem;
          line-height: 1.2;
          margin: 0.15rem 0;
        }

        .stat-spinner {
          font-size: 0.8rem;
          animation: pulse 1s infinite alternate;
        }

        .stat-subtext {
          font-size: 0.65rem;
          color: var(--text-muted);
        }

        .card-chevron {
          color: var(--text-muted);
          transition: transform 0.15s ease;
        }

        .stat-card:hover .card-chevron {
          color: var(--text-secondary);
          transform: translateX(2px);
        }

        /* Layout Grid */
        .overview-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 1rem;
          align-items: start;
        }

        .overview-left-column,
        .overview-right-column {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .panel-title {
          padding: 0.6rem 0.85rem;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .panel-empty {
          padding: 2.5rem 1rem;
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Profile Details */
        .profile-panel .profile-details {
          padding: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.75rem;
        }

        .profile-row {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid rgba(30, 37, 53, 0.4);
          padding-bottom: 0.4rem;
        }

        .profile-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .profile-label {
          color: var(--text-muted);
        }

        .profile-value {
          color: var(--text-primary);
        }

        /* Tech footprint tag wrapper */
        .tech-list-wrapper {
          padding: 0.85rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tech-tag {
          padding: 0.35rem 0.6rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: var(--bg-tertiary);
          border-color: var(--border-color);
          border-radius: 4px;
        }

        .tech-tag:hover {
          border-color: var(--border-hover);
        }

        .tech-name {
          font-size: 0.7rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .tech-ver {
          font-size: 0.65rem;
          color: var(--text-muted);
        }

        /* Severity breakdown panel */
        .breakdown-body {
          padding: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .severity-bar-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .severity-item {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .severity-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
        }

        .bar-bg {
          height: 4px;
          background: var(--bg-tertiary);
          border-radius: 2px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.5s ease;
        }

        .threat-assessment {
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          border-color: var(--border-color);
          position: relative;
        }

        .threat-assessment.red-stripe::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background-color: var(--cyber-red);
        }

        .assessment-title {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .assessment-desc {
          font-size: 0.7rem;
          color: var(--text-secondary);
          line-height: 1.35;
        }

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .overview-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
