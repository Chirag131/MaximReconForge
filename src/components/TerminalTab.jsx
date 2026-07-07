import React, { useEffect, useRef } from "react";

export default function TerminalTab({ logs }) {
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const getLogStyleClass = (line) => {
    if (line.includes("[SUCCESS]")) return "log-success";
    if (line.includes("[WARNING]")) return "log-warning";
    if (line.includes("[CRITICAL]")) return "log-critical";
    return "log-info";
  };

  return (
    <div className="terminal-tab-container terminal-window glass-panel">
      {/* OS window top header */}
      <div className="terminal-header">
        <div className="terminal-dots">
          <span className="terminal-dot"></span>
          <span className="terminal-dot"></span>
          <span className="terminal-dot"></span>
        </div>
        <span className="terminal-title text-mono">recon_discovery_log.txt</span>
        <span className="terminal-stats text-mono">Lines: {logs.length}</span>
      </div>

      {/* Terminal logs list */}
      <div className="terminal-body text-mono">
        {logs.length === 0 ? (
          <div className="log-line log-info">System ready. Awaiting scan...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`log-line ${getLogStyleClass(log)}`}>
              {log}
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>

      <style>{`
        .terminal-tab-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 400px;
          border-color: var(--border-color);
        }

        .terminal-tab-container::before {
          display: none;
        }

        .terminal-body {
          background-color: #07090e;
          padding: 1rem;
          font-size: 0.75rem;
          line-height: 1.5;
          overflow-y: auto;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .log-line {
          white-space: pre-wrap;
          word-break: break-all;
        }

        .log-info {
          color: var(--text-secondary);
        }

        .log-success {
          color: var(--cyber-green);
        }

        .log-warning {
          color: var(--cyber-amber);
        }

        .log-critical {
          color: var(--cyber-red);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
