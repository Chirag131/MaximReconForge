import React from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import Pipeline from "../components/Pipeline";
import OverviewTab from "../components/OverviewTab";
import SubdomainsTab from "../components/SubdomainsTab";
import FindingsTab from "../components/FindingsTab";
import TerminalTab from "../components/TerminalTab";
import ReconToolsTab from "../components/ReconToolsTab";

export default function DashboardPage({
  domain,
  scanState,
  progress,
  currentStageIndex,
  logs,
  stats,
  subdomains,
  findings,
  technologies,
  activeTab,
  setActiveTab,
  onBack,
  onPauseToggle,
  onResetScan,
  isPaused
}) {
  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        scanState={scanState} 
        domain={domain} 
      />

      {/* Main panel containing header and tabs */}
      <div className="main-content">
        {/* Top Navbar */}
        <Navbar
          domain={domain}
          scanState={scanState}
          progress={progress}
          onBack={onBack}
          onPauseToggle={onPauseToggle}
          onResetScan={onResetScan}
          isPaused={isPaused}
        />

        {/* Core content wrapper */}
        <main className="dashboard-body-container">
          {/* Horizontal Scan pipeline stages */}
          <Pipeline 
            currentStageIndex={currentStageIndex} 
            scanState={scanState} 
          />

          {/* Active Tab rendering */}
          <div className="tab-viewport">
            {activeTab === "overview" && (
              <OverviewTab
                stats={stats}
                technologies={technologies}
                target={domain}
                currentStageIndex={currentStageIndex}
                scanState={scanState}
                onTabChange={setActiveTab}
              />
            )}

            {activeTab === "subdomains" && (
              <SubdomainsTab
                subdomains={subdomains}
                currentStageIndex={currentStageIndex}
                scanState={scanState}
              />
            )}

            {activeTab === "findings" && (
              <FindingsTab
                findings={findings}
                currentStageIndex={currentStageIndex}
                scanState={scanState}
              />
            )}

            {activeTab === "tools" && (
              <ReconToolsTab 
                domain={domain} 
              />
            )}

            {activeTab === "terminal" && (
              <TerminalTab 
                logs={logs} 
              />
            )}
          </div>
        </main>
      </div>

      <style>{`
        .dashboard-body-container {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          overflow: hidden;
          background-color: var(--bg-primary);
        }

        .tab-viewport {
          flex-grow: 1;
          overflow: hidden;
          position: relative;
        }

        @media (max-width: 768px) {
          .dashboard-body-container {
            padding: 1rem;
            overflow-y: auto;
          }
          .tab-viewport {
            overflow-y: visible;
          }
        }
      `}</style>
    </div>
  );
}
