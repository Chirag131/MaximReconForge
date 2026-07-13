import { useEffect, useRef, useState } from "react";
import { startDummyScan } from "../services/dummyScanApi";

const spinnerFrames = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
];

const previewSteps = [
  {
    text: "❯ reconforge scan example.com --full",
    className: "command",
  },
  {
    text: "",
    className: "dim",
  },
  {
    text: "⠹ Validating target...",
    className: "info",
  },
  {
    text: "[SUCCESS] Target is valid",
    className: "success",
  },
  {
    text: "$ subfinder -d example.com -silent",
    className: "command",
  },
  {
    text: "api.example.com",
    className: "dim",
  },
  {
    text: "cdn.example.com",
    className: "dim",
  },
  {
    text: "mail.example.com",
    className: "dim",
  },
  {
    text: "[SUCCESS] 128 unique subdomains collected",
    className: "success",
  },
];

function createProgressBar(progress, length = 18) {
  const safeProgress = Math.min(100, Math.max(0, progress));
  const filled = Math.round((safeProgress / 100) * length);
  const empty = length - filled;

  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

function Terminal({
  mode = "preview",
  target = "example.com",
  onComplete,
  onProgress,
  onStageChange,
}) {
  const [lines, setLines] = useState([]);
  const [activeCommandId, setActiveCommandId] = useState(null);

  const terminalBodyRef = useRef(null);
  const lineRefs = useRef({});

  useEffect(() => {
    const abortController = new AbortController();

    let cancelled = false;
    let timeoutId;
    let spinnerId;

    setLines([]);
    setActiveCommandId(null);
    lineRefs.current = {};

    const wait = (delay) =>
      new Promise((resolve) => {
        timeoutId = setTimeout(resolve, delay);
      });

    const addLine = (text, className = "dim") => {
      if (cancelled) return null;

      const id = crypto.randomUUID();

      setLines((currentLines) => [
        ...currentLines,
        {
          id,
          text,
          className,
        },
      ]);

      return id;
    };

    const updateLine = (id, text, className) => {
      if (cancelled || !id) return;

      setLines((currentLines) =>
        currentLines.map((line) =>
          line.id === id
            ? {
                ...line,
                text,
                className,
              }
            : line,
        ),
      );
    };

    const getLineClassName = (outputLine) => {
      if (outputLine.startsWith("[SUCCESS]")) {
        return "success";
      }

      if (outputLine.startsWith("[INFO]")) {
        return "info";
      }

      if (outputLine.startsWith("[WARNING]")) {
        return "warning";
      }

      if (outputLine.startsWith("[ERROR]")) {
        return "error";
      }

      return "dim";
    };

    const addLinesSequentially = async (
      outputLines,
      delay = 240,
    ) => {
      for (const outputLine of outputLines) {
        if (cancelled) return;

        addLine(
          outputLine,
          getLineClassName(outputLine),
        );

        await wait(delay);
      }
    };

    const runPreview = () => {
      let currentIndex = 0;

      const showNextLine = () => {
        if (cancelled) return;

        if (currentIndex >= previewSteps.length) {
          timeoutId = setTimeout(() => {
            if (cancelled) return;

            setLines([]);
            setActiveCommandId(null);
            lineRefs.current = {};

            currentIndex = 0;
            showNextLine();
          }, 1800);

          return;
        }

        const step = previewSteps[currentIndex];
        const lineId = addLine(step.text, step.className);

        if (step.className === "command") {
          setActiveCommandId(lineId);
        }

        currentIndex += 1;
        timeoutId = setTimeout(showNextLine, 450);
      };

      showNextLine();
    };

    const runScan = async () => {
      const initialCommandId = addLine(
        `❯ reconforge scan ${target} --full`,
        "command",
      );

      setActiveCommandId(initialCommandId);

      addLine("", "dim");

      let activeSpinnerLineId = null;
      let spinnerFrame = 0;

      try {
        await startDummyScan(
          target,
          {
            onStart: ({ scanId }) => {
              if (cancelled) return;

              addLine(`[INFO] Scan ID: ${scanId}`, "dim");

              addLine(
                "[INFO] Initializing reconnaissance pipeline",
                "info",
              );

              addLine("", "dim");
            },

            onStageStart: (stage) => {
              if (cancelled) return;

              onStageChange?.({
                id: stage.id,
                label: stage.label,
                index: stage.index,
                status: "running",
              });

              const commandLineId = addLine(
                `$ ${stage.command}`,
                "command",
              );

              /*
               * Only a new command changes the scroll position.
               * Output lines will continue appearing underneath it.
               */
              setActiveCommandId(commandLineId);

              spinnerFrame = 0;

              activeSpinnerLineId = addLine(
                `${spinnerFrames[0]} ${stage.runningMessage}...`,
                "info",
              );

              clearInterval(spinnerId);

              spinnerId = setInterval(() => {
                if (cancelled) return;

                spinnerFrame =
                  (spinnerFrame + 1) %
                  spinnerFrames.length;
              }, 80);
            },

            onStageProgress: (stage) => {
              if (cancelled) return;

              onProgress?.({
                progress: stage.progress,
                stageId: stage.id,
                stageLabel: stage.label,
                processed: stage.processed,
                total: stage.total,
                elapsedSeconds: stage.elapsedSeconds,
              });

              const progressBar = createProgressBar(
                stage.stageProgress,
              );

              updateLine(
                activeSpinnerLineId,
                `${spinnerFrames[spinnerFrame]} ${
                  stage.runningMessage
                } ${progressBar} ${
                  stage.stageProgress
                }% · ${stage.processed}/${
                  stage.total
                } · ${stage.elapsedSeconds}s`,
                "info",
              );
            },

            onStageComplete: async (stage) => {
              if (cancelled) return;

              clearInterval(spinnerId);

              updateLine(
                activeSpinnerLineId,
                `[SUCCESS] ${stage.label} completed`,
                "success",
              );

              await addLinesSequentially(
                stage.output,
                240,
              );

              if (cancelled) return;

              addLine("", "dim");

              onStageChange?.({
                id: stage.id,
                label: stage.label,
                index: stage.index,
                status: "completed",
              });
            },

            onComplete: (result) => {
              if (cancelled) return;

              addLine(
                `[SUCCESS] Scan completed in ${result.durationSeconds}s`,
                "success",
              );

              onProgress?.({
                progress: 100,
                stageId: "completed",
                stageLabel: "Scan complete",
                processed: 1,
                total: 1,
                elapsedSeconds: result.durationSeconds,
              });

              onComplete?.(result);
            },
          },
          {
            signal: abortController.signal,
          },
        );
      } catch (error) {
        clearInterval(spinnerId);

        if (error.name === "AbortError") {
          return;
        }

        addLine(
          `[ERROR] ${error.message || "Scan failed"}`,
          "error",
        );
      }
    };

    if (mode === "preview") {
      runPreview();
    } else {
      runScan();
    }

    return () => {
      cancelled = true;

      abortController.abort();

      clearTimeout(timeoutId);
      clearInterval(spinnerId);
    };
  }, [
    mode,
    target,
    onComplete,
    onProgress,
    onStageChange,
  ]);

  /*
   * Scroll only when a new command becomes active.
   * The command is placed roughly 16% below the terminal top.
   */
  useEffect(() => {
    const terminalBody = terminalBodyRef.current;
    const activeCommand = lineRefs.current[activeCommandId];

    if (!terminalBody || !activeCommand) return;

    const desiredTopOffset = terminalBody.clientHeight * 0.16;

    const targetScrollPosition =
      activeCommand.offsetTop -
      terminalBody.offsetTop -
      desiredTopOffset;

    terminalBody.scrollTo({
      top: Math.max(0, targetScrollPosition),
      behavior: "smooth",
    });
  }, [activeCommandId]);

  return (
    <div className="w-full overflow-hidden rounded-[14px] border border-white/10 bg-[rgba(8,7,22,0.88)] shadow-[0_32px_90px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-[18px]">
      <div className="flex h-[44px] items-center gap-2 border-b border-white/10 bg-white/[0.035] px-[14px]">
        <div className="h-[11px] w-[11px] shrink-0 rounded-full bg-[#ff5f57]" />
        <div className="h-[11px] w-[11px] shrink-0 rounded-full bg-[#ffbd2e]" />
        <div className="h-[11px] w-[11px] shrink-0 rounded-full bg-[#28c840]" />

        <div className="ml-3 truncate font-['JetBrains_Mono'] text-[12px] text-white/40">
          recon@maxim: ~/{target}
        </div>
      </div>

      <div
        ref={terminalBodyRef}
        className={`terminal-body overflow-y-auto p-[22px] text-left font-['JetBrains_Mono'] text-[13px] leading-[1.45] tracking-[-0.15px] text-[#d7dce8] transition-[min-height,max-height] duration-700 max-[560px]:p-[15px] max-[560px]:text-[10.5px] ${
          mode === "scanning"
            ? "min-h-[620px] max-h-[700px] max-[900px]:min-h-[520px] max-[900px]:max-h-[600px] max-[560px]:min-h-[420px] max-[560px]:max-h-[500px]"
            : "min-h-[360px] max-h-[460px] max-[900px]:min-h-[330px] max-[560px]:min-h-[310px] max-[560px]:max-h-[400px]"
        }`}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            ref={(element) => {
              if (element) {
                lineRefs.current[line.id] = element;
              } else {
                delete lineRefs.current[line.id];
              }
            }}
            className={`terminal-line ${line.className}`}
          >
            {line.text}
          </div>
        ))}

        {/* Extra room so the newest command can scroll near the top */}
        {mode === "scanning" && (
          <div
            aria-hidden="true"
            className="h-[430px] max-[900px]:h-[340px] max-[560px]:h-[260px]"
          />
        )}
      </div>
    </div>
  );
}

export default Terminal;