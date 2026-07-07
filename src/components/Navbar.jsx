import React, { useState, useEffect } from "react";
import { ArrowLeft, Play, Pause, RefreshCw, Clock } from "lucide-react";

export default function Navbar({ 
  domain, 
  scanState, 
  progress, 
  onBack, 
  onPauseToggle, 
  onResetScan,
  isPaused 
}) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="navbar-container">
      {/* Back to search */}
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={14} />
        <span>Exit scope</span>
      </button>

      {/* Target & Status bar */}
      <div className="navbar-meta">
        <span className="navbar-title">
          scope: <span className="text-secondary font-mono">{domain}</span>
        </span>
        
        {scanState === "scanning" && (
          <span className="navbar-status text-cyber-amber">
            {isPaused ? "[paused]" : "[scanning...]"}
          </span>
        )}
        {scanState === "completed" && (
          <span className="navbar-status text-cyber-green">
            [completed]
          </span>
        )}
      </div>

      {/* Progress metrics and charger */}
      <div className="navbar-progress-wrapper">
        <div className="progress-labels text-mono">
          <span>COMPLETION:</span>
          <span className={scanState === "completed" ? "text-cyber-green" : "text-cyber-blue"}>
            {progress}%
          </span>
        </div>
        <div className="progress-bar-bg">
          <div 
            className={`progress-bar-fill ${scanState === "completed" ? "bg-cyber-green" : isPaused ? "bg-cyber-amber" : "bg-cyber-blue"}`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Action controls */}
      <div className="navbar-actions">
        {scanState === "scanning" && (
          <button 
            className="cyber-button"
            onClick={onPauseToggle}
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />}
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>
        )}
        
        <button 
          className="cyber-button"
          onClick={onResetScan}
        >
          <RefreshCw size={12} />
          <span>Restart</span>
        </button>

        {/* Live clock */}
        <div className="navbar-clock text-mono">
          <span>{time}</span>
        </div>
      </div>

      <style>{`
        .navbar-container {
          height: var(--navbar-height);
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.25rem;
          flex-shrink: 0;
          gap: 1.25rem;
        }

        .back-btn {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          padding: 0.4rem 0.75rem;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          transition: all 0.15s ease;
        }

        .back-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-hover);
          background-color: var(--bg-tertiary);
        }

        .navbar-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .navbar-title {
          font-size: 0.85rem;
          font-weight: 500;
        }

        .navbar-status {
          font-size: 0.75rem;
          font-weight: 500;
        }

        .navbar-progress-wrapper {
          flex-grow: 1;
          max-width: 260px;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .progress-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.65rem;
          color: var(--text-muted);
        }

        .progress-bar-bg {
          height: 4px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: 1px;
          transition: width 0.3s ease;
        }

        .progress-bar-fill.bg-cyber-blue {
          background: var(--cyber-blue);
        }

        .progress-bar-fill.bg-cyber-green {
          background: var(--cyber-green);
        }

        .progress-bar-fill.bg-cyber-amber {
          background: var(--cyber-amber);
        }

        .navbar-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .navbar-clock {
          font-size: 0.75rem;
          border-left: 1px solid var(--border-color);
          padding-left: 0.75rem;
          color: var(--text-muted);
        }

        @media (max-width: 1024px) {
          .navbar-progress-wrapper {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
