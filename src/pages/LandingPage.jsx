import React, { useState } from "react";
import { Shield, Play, Globe, Cpu, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function LandingPage({ onStartScan }) {
  const [domainInput, setDomainInput] = useState("");
  const [error, setError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const handleScanSubmit = (e) => {
    e.preventDefault();
    setError("");
    const formatted = domainInput.trim().toLowerCase();

    if (!formatted) {
      setError("Target scope domain cannot be empty.");
      return;
    }

    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/;
    if (!domainRegex.test(formatted)) {
      setError("Please specify a valid root domain name (e.g. tesla.com).");
      return;
    }

    setIsValidating(true);
    setTimeout(() => {
      setIsValidating(false);
      onStartScan(formatted);
    }, 800);
  };

  return (
    <div className="landing-container">
      {/* Background Radial mesh glow */}
      <div className="landing-glow"></div>

      <div className="landing-card-wrapper glass-panel">
        {/* Brand Shield Icon */}
        <div className="brand-logo">
          <Shield size={24} className="text-cyber-blue" />
        </div>

        {/* Title */}
        <h1 className="brand-title">
          MaximRecon<span className="brand-title-bold"> Forge</span>
        </h1>
        <p className="brand-subtitle">
          Automated threat intelligence and asset discovery platform
        </p>

        {/* Domain Search form */}
        <form onSubmit={handleScanSubmit} className="search-form">
          <div className="input-box cyber-input-wrapper">
            <Globe size={14} className="input-icon" />
            <input
              type="text"
              className="cyber-input domain-input"
              placeholder="target domain (e.g. tesla.com)"
              value={domainInput}
              onChange={(e) => {
                setDomainInput(e.target.value);
                if (error) setError("");
              }}
              disabled={isValidating}
            />
          </div>

          {error && (
            <div className="validation-error text-mono">
              <AlertTriangle size={12} />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            className="cyber-button scan-submit-btn"
            disabled={isValidating}
          >
            {isValidating ? (
              <>
                <span className="btn-spinner animate-spin"></span>
                <span>Resolving target...</span>
              </>
            ) : (
              <>
                <Play size={12} fill="currentColor" />
                <span>Start Discovery Scan</span>
              </>
            )}
          </button>
        </form>

        <div className="landing-warning">
          <CheckCircle2 size={12} className="text-cyber-green" />
          <span>Active port scans restricted to standard networks</span>
        </div>
      </div>

      {/* Global Activity Ticker */}
      <div className="stats-ticker glass-panel">
        <div className="ticker-item">
          <span className="label">Scan threads:</span>
          <span className="value text-cyber-green">14,802 active</span>
        </div>
        <div className="ticker-divider"></div>
        <div className="ticker-item">
          <span className="label">CVE definitions:</span>
          <span className="value text-cyber-blue">214,892 indexed</span>
        </div>
        <div className="ticker-divider"></div>
        <div className="ticker-item">
          <span className="label">Assets mapped:</span>
          <span className="value text-cyber-purple">3.2M records</span>
        </div>
      </div>

      <style>{`
        .landing-container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 1.5rem;
          background-color: var(--bg-primary);
          overflow: hidden;
        }

        .landing-glow {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%);
          pointer-events: none;
          z-index: 1;
        }

        .landing-card-wrapper {
          max-width: 440px;
          width: 100%;
          padding: 3rem 2.25rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 3.5rem;
          z-index: 2;
          background-color: var(--bg-secondary);
          border-color: var(--border-color);
        }

        .landing-card-wrapper:hover {
          border-color: var(--border-hover);
        }

        .brand-logo {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          margin-bottom: 1.25rem;
        }

        .brand-title {
          font-size: 1.65rem;
          font-weight: 400;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
        }

        .brand-title-bold {
          font-weight: 600;
        }

        .brand-subtitle {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 1.75rem;
          line-height: 1.45;
        }

        .search-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .input-box {
          position: relative;
          width: 100%;
        }

        .input-icon {
          position: absolute;
          left: 0.85rem;
          color: var(--text-muted);
        }

        .domain-input {
          padding-left: 2.25rem !important;
          font-size: 0.85rem !important;
          height: 42px;
          border-color: var(--border-color);
        }

        .validation-error {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          color: var(--cyber-red);
          font-size: 0.75rem;
          background: rgba(239, 68, 68, 0.04);
          border: 1px solid rgba(239, 68, 68, 0.15);
          padding: 0.4rem;
          border-radius: 4px;
        }

        .scan-submit-btn {
          width: 100%;
          justify-content: center;
          height: 40px;
          font-size: 0.85rem;
          background: var(--cyber-blue);
          border-color: var(--cyber-blue);
          color: #fff;
          font-weight: 500;
        }

        .scan-submit-btn:hover {
          background: #2563eb;
          border-color: #2563eb;
        }

        .btn-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          margin-right: 0.4rem;
        }

        .animate-spin {
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .landing-warning {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin-top: 1.5rem;
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        /* Ticker footer */
        .stats-ticker {
          display: flex;
          justify-content: space-around;
          align-items: center;
          max-width: 680px;
          width: calc(100% - 3rem);
          padding: 0.85rem 1.25rem;
          font-size: 0.75rem;
          border-color: var(--border-color);
          z-index: 2;
        }

        .ticker-divider {
          width: 1px;
          height: 12px;
          background-color: var(--border-color);
        }

        .ticker-item {
          display: flex;
          gap: 0.4rem;
        }

        .ticker-item .label {
          color: var(--text-muted);
        }

        .ticker-item .value {
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .stats-ticker {
            flex-direction: column;
            gap: 0.5rem;
            align-items: center;
          }
          .ticker-divider {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
