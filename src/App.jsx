import React, { useState, useEffect } from "react";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import { getMockData } from "./mockData";

export default function App() {
  const [page, setPage] = useState("landing"); // 'landing' | 'dashboard'
  const [domain, setDomain] = useState("");
  const [scanState, setScanState] = useState("idle"); // 'idle' | 'scanning' | 'completed'
  const [progress, setProgress] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Simulated Log Streams
  const [logs, setLogs] = useState([]);
  const [logQueue, setLogQueue] = useState([]);

  // Active navigation tab on the Dashboard
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch target details from mock data
  const mockData = domain ? getMockData(domain) : null;

  // Initialize and run the reconnaissance scan
  const startScan = (targetDomain) => {
    setDomain(targetDomain);
    setProgress(0);
    setCurrentStageIndex(0);
    setLogs([]);
    setLogQueue([]);
    setIsPaused(false);
    setScanState("scanning");
    setActiveTab("overview");
    setPage("dashboard");
  };

  // Toggle pause/play
  const handlePauseToggle = () => {
    setIsPaused((prev) => !prev);
  };

  // Reset and restart the current scan
  const handleResetScan = () => {
    if (domain) {
      startScan(domain);
    }
  };

  // Go back to landing page
  const handleBackToLanding = () => {
    setPage("landing");
    setScanState("idle");
    setDomain("");
    setProgress(0);
    setCurrentStageIndex(0);
    setLogs([]);
    setLogQueue([]);
    setIsPaused(false);
  };

  // Effect 1: Handles incrementing scanning progress and mapping active stages
  useEffect(() => {
    if (scanState !== "scanning" || isPaused) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setScanState("completed");
          clearInterval(interval);
          return 100;
        }

        const nextProgress = prev + 1;

        // Map percentage range directly to pipeline stage indexes (0 - 5)
        let nextStage = 0;
        if (nextProgress >= 95) nextStage = 5;      // Report Generation
        else if (nextProgress >= 75) nextStage = 4; // Vulnerability Scan
        else if (nextProgress >= 55) nextStage = 3; // HTTP Probe
        else if (nextProgress >= 30) nextStage = 2; // Subdomain Discovery
        else if (nextProgress >= 15) nextStage = 1; // DNS Lookup
        else nextStage = 0;                         // Domain Validation

        if (nextStage !== currentStageIndex) {
          setCurrentStageIndex(nextStage);
        }

        return nextProgress;
      });
    }, 150); // Increment 1% every 150ms -> ~15 seconds total scan time

    return () => clearInterval(interval);
  }, [scanState, isPaused, currentStageIndex]);

  // Effect 2: Load new logs into the logQueue once a stage completes or starts
  useEffect(() => {
    if (!mockData || scanState !== "scanning") return;

    const currentStageLogs = mockData.logsByStage[currentStageIndex];
    if (currentStageLogs) {
      setLogQueue((prev) => {
        // Prevent appending duplicate logs for the same stage (e.g. if paused/unpaused)
        const alreadyAdded = currentStageLogs.every(line => prev.includes(line) || logs.includes(line));
        if (alreadyAdded) return prev;
        return [...prev, ...currentStageLogs];
      });
    }
  }, [currentStageIndex, scanState, mockData]);

  // Effect 3: Stream logs from logQueue to output terminal line-by-line
  useEffect(() => {
    if (isPaused || logQueue.length === 0) return;

    const timer = setTimeout(() => {
      setLogs((prev) => [...prev, logQueue[0]]);
      setLogQueue((prev) => prev.slice(1));
    }, 200); // Output a console line every 200ms for active visual scrolling

    return () => clearTimeout(timer);
  }, [logQueue, isPaused]);

  // Handle final logs stream at scan completion
  useEffect(() => {
    if (scanState === "completed" && logQueue.length > 0) {
      // Dump remaining queued logs to console at end of scan
      setLogs((prev) => [...prev, ...logQueue]);
      setLogQueue([]);
    }
  }, [scanState, logQueue]);

  return (
    <>
      {page === "landing" ? (
        <LandingPage onStartScan={startScan} />
      ) : (
        <DashboardPage
          domain={domain}
          scanState={scanState}
          progress={progress}
          currentStageIndex={currentStageIndex}
          logs={logs}
          stats={mockData?.stats || {}}
          subdomains={mockData?.subdomains || []}
          findings={mockData?.findings || []}
          technologies={mockData?.technologies || []}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onBack={handleBackToLanding}
          onPauseToggle={handlePauseToggle}
          onResetScan={handleResetScan}
          isPaused={isPaused}
        />
      )}
    </>
  );
}
