import React from "react";
import { 
  LayoutDashboard, 
  Globe, 
  ShieldAlert, 
  Terminal, 
  Sliders,
  Shield, 
  Activity,
  Cpu
} from "lucide-react";

export default function Sidebar({ activeTab, setActiveTab, scanState, domain }) {
  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "subdomains", label: "Subdomains", icon: Globe },
    { id: "findings", label: "Security Findings", icon: ShieldAlert },
    { id: "tools", label: "Recon Tools", icon: Sliders },
    { id: "terminal", label: "Live Console", icon: Terminal },
  ];

  return (
    <aside className="sidebar-container">
      {/* Brand Header */}
      <div className="sidebar-logo">
        <Shield size={20} className="text-cyber-blue" />
        <span className="logo-text">
          MaximRecon<span className="text-secondary font-light"> Forge</span>
        </span>
      </div>

      {/* Target status indicator */}
      {scanState !== "idle" && (
        <div className="target-indicator glass-panel">
          <div className="target-meta">
            <span className="meta-label">TARGET IN SCOPE:</span>
            <span className="meta-value text-mono text-cyber-blue">{domain}</span>
          </div>
          <div className="target-status">
            <span className={`status-dot ${scanState === "scanning" ? "scanning bg-cyber-amber" : "bg-cyber-green"}`}></span>
            <span className="status-text text-mono">
              {scanState === "scanning" ? "scanning..." : "completed"}
            </span>
          </div>
        </div>
      )}

      {/* Navigation items */}
      <nav className="sidebar-nav">
        <span className="nav-section-title">Monitoring Controls</span>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {activeTab === tab.id && <span className="active-indicator"></span>}
            </button>
          );
        })}
      </nav>

      {/* Connection Indicator Footer */}
      <div className="sidebar-footer">
        <div className="connection-status">
          <Activity size={12} className="text-cyber-green" />
          <span className="text-cyber-green text-mono font-medium">Link: Secure</span>
        </div>
      </div>

      <style>{`
        .sidebar-container {
          width: var(--sidebar-width);
          background-color: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          padding: 1.25rem 1rem;
          height: 100%;
          flex-shrink: 0;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 1.25rem;
        }

        .logo-text {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .font-light {
          font-weight: 300;
        }

        .target-indicator {
          padding: 0.65rem 0.75rem;
          margin-bottom: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: 0.75rem;
          border-color: var(--border-color);
        }

        .target-meta {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }

        .meta-label {
          color: var(--text-muted);
          font-size: 0.65rem;
        }

        .meta-value {
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.75rem;
        }

        .target-status {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-top: 0.15rem;
          font-size: 0.7rem;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-dot.scanning {
          animation: pulse 1.5s infinite;
        }

        .status-text {
          font-weight: 500;
          color: var(--text-secondary);
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex-grow: 1;
        }

        .nav-section-title {
          font-size: 0.65rem;
          color: var(--text-muted);
          margin-bottom: 0.4rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .nav-item {
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-secondary);
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          width: 100%;
          text-align: left;
          font-size: 0.8rem;
          transition: all 0.15s ease;
          position: relative;
        }

        .nav-item:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .nav-item.active {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(59, 130, 246, 0.15);
          color: var(--cyber-blue);
          font-weight: 500;
        }

        .active-indicator {
          position: absolute;
          left: 0;
          top: 25%;
          height: 50%;
          width: 2px;
          background-color: var(--cyber-blue);
          border-radius: 0 2px 2px 0;
        }

        .sidebar-footer {
          border-top: 1px solid var(--border-color);
          padding-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.7rem;
        }

        .font-medium {
          font-weight: 500;
        }
      `}</style>
    </aside>
  );
}
