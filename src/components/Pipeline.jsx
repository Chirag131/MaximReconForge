import React from "react";
import { 
  ShieldCheck, 
  Binary, 
  Search, 
  Wifi, 
  Terminal, 
  FileCheck,
  CheckCircle2,
  Loader
} from "lucide-react";

export default function Pipeline({ currentStageIndex, scanState }) {
  const stages = [
    { name: "Domain Validation", icon: ShieldCheck },
    { name: "DNS Lookup", icon: Binary },
    { name: "Subdomain Discovery", icon: Search },
    { name: "HTTP Probe", icon: Wifi },
    { name: "Vulnerability Scan", icon: Terminal },
    { name: "Report Generation", icon: FileCheck }
  ];

  return (
    <div className="pipeline-container glass-panel">
      <div className="pipeline-header">
        <span className="pipeline-subtitle text-mono">DISCOVERY_PIPELINE</span>
      </div>

      <div className="pipeline-flow">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          let status = "pending"; // pending, running, completed
          let percent = 0;
          
          if (scanState === "completed") {
            status = "completed";
            percent = 100;
          } else if (scanState === "scanning") {
            if (index < currentStageIndex) {
              status = "completed";
              percent = 100;
            } else if (index === currentStageIndex) {
              status = "running";
              percent = 45; 
            }
          }

          return (
            <div key={index} className={`pipeline-step ${status}`}>
              {/* Connector line */}
              {index > 0 && (
                <div className={`pipeline-connector ${index <= currentStageIndex ? "active" : ""}`}></div>
              )}

              {/* Node */}
              <div className={`step-node ${status}`}>
                <Icon size={14} />
              </div>

              {/* Step Title */}
              <div className="step-details">
                <span className="step-title">{stage.name}</span>
                <span className="step-status text-mono">
                  {status === "completed" && "completed"}
                  {status === "running" && "running"}
                  {status === "pending" && "queued"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .pipeline-container {
          padding: 1rem 1.25rem;
          margin-bottom: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          border-color: var(--border-color);
        }

        .pipeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .pipeline-subtitle {
          font-size: 0.65rem;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.05em;
        }

        .pipeline-flow {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 1rem;
          position: relative;
        }

        .pipeline-step {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          position: relative;
        }

        /* Connector Line */
        .pipeline-connector {
          position: absolute;
          left: -40%;
          right: 90%;
          top: 50%;
          transform: translateY(-50%);
          height: 1px;
          background: var(--border-color);
          z-index: 1;
        }

        .pipeline-connector.active {
          background: var(--cyber-blue);
        }

        /* Node */
        .step-node {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          color: var(--text-muted);
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .step-node.completed {
          background: rgba(16, 185, 129, 0.08);
          border-color: var(--cyber-green);
          color: var(--cyber-green);
        }

        .step-node.running {
          background: rgba(59, 130, 246, 0.08);
          border-color: var(--cyber-blue);
          color: var(--cyber-blue);
          animation: pulse 1.5s infinite;
        }

        .step-details {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
          overflow: hidden;
        }

        .step-title {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pipeline-step.completed .step-title {
          color: var(--text-primary);
        }

        .pipeline-step.running .step-title {
          color: var(--cyber-blue);
        }

        .step-status {
          font-size: 0.6rem;
          color: var(--text-muted);
          text-transform: lowercase;
        }

        .pipeline-step.completed .step-status {
          color: var(--cyber-green);
        }

        .pipeline-step.running .step-status {
          color: var(--cyber-blue);
        }

        @media (max-width: 1200px) {
          .pipeline-flow {
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
          }
          .pipeline-connector {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .pipeline-flow {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
          .pipeline-step {
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
