import { useEffect, useRef, useState } from "react";

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

const steps = [
  {
    text: "❯ reconforge scan example.com --full",
    className: "command",
    instant: true,
  },
  {
    text: "",
    className: "dim",
    instant: true,
  },
  {
    run: "Validating target",
    done: "[SUCCESS] Target is valid",
  },
  {
    run: "Detecting target type",
    done: "[SUCCESS] Target type: DOMAIN",
  },
  {
    text: "$ subfinder -d example.com -silent",
    className: "command",
    instant: true,
  },
  {
    run: "Collecting subdomains",
    done: `api.example.com
cdn.example.com
mail.example.com
admin.example.com`,
  },
  {
    text: "$ assetfinder --subs-only example.com",
    className: "command",
    instant: true,
  },
  {
    run: "Merging passive results",
    done: "[SUCCESS] 128 unique subdomains collected",
  },
  {
    text: "$ httpx -silent -status-code -title",
    className: "command",
    instant: true,
  },
  {
    run: "Probing live hosts",
    done: `https://api.example.com [200] API Gateway
https://admin.example.com [403] Admin Portal`,
  },
  {
    text: "$ katana -u https://api.example.com -silent",
    className: "command",
    instant: true,
  },
  {
    run: "Crawling endpoints",
    done: `/login
/api/v1/users
/graphql
/assets/app.js`,
  },
  {
    text: "$ nmap -sV api.example.com",
    className: "command",
    instant: true,
  },
  {
    run: "Scanning exposed services",
    done: `22/tcp open ssh
80/tcp open http
443/tcp open https`,
  },
  {
    text: "",
    className: "dim",
    instant: true,
  },
  {
    text: "Scan completed in 01m 42s",
    className: "success",
    instant: true,
  },
];

function Terminal() {
  const [lines, setLines] = useState([]);
  const terminalBodyRef = useRef(null);

  useEffect(() => {
    let currentIndex = 0;
    let timeoutId;
    let spinnerId;
    let cancelled = false;

    const addLine = (text, className) => {
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

    const runStep = () => {
      if (cancelled || currentIndex >= steps.length) {
        return;
      }

      const step = steps[currentIndex];

      if (step.instant) {
        addLine(step.text, step.className);

        currentIndex += 1;
        timeoutId = setTimeout(runStep, 350);
        return;
      }

      let frame = 0;

      const lineId = addLine(
        `${spinnerFrames[0]} ${step.run}...`,
        "info",
      );

      spinnerId = setInterval(() => {
        frame = (frame + 1) % spinnerFrames.length;

        updateLine(
          lineId,
          `${spinnerFrames[frame]} ${step.run}...`,
          "info",
        );
      }, 80);

      timeoutId = setTimeout(() => {
        clearInterval(spinnerId);

        updateLine(lineId, step.done, "success");

        currentIndex += 1;
        timeoutId = setTimeout(runStep, 450);
      }, 1300);
    };

    runStep();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      clearInterval(spinnerId);
    };
  }, []);

  useEffect(() => {
    const terminalBody = terminalBodyRef.current;

    if (terminalBody) {
      terminalBody.scrollTop = terminalBody.scrollHeight;
    }
  }, [lines]);

  return (
  <div className="w-full max-w-[920px] overflow-hidden rounded-[14px] border border-white/10 bg-[rgba(8,7,22,0.88)] shadow-[0_32px_90px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-[18px]">
    <div className="flex h-[44px] items-center gap-2 border-b border-white/10 bg-white/[0.035] px-[14px]">
      <div className="h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
      <div className="h-[11px] w-[11px] rounded-full bg-[#ffbd2e]" />
      <div className="h-[11px] w-[11px] rounded-full bg-[#28c840]" />

      <div className="ml-3 font-['JetBrains_Mono'] text-[12px] text-white/40">
        recon@maxim: ~/example.com
      </div>
    </div>

    <div
      ref={terminalBodyRef}
      className="font-['JetBrains_Mono'] min-h-[360px] max-h-[460px] overflow-y-auto p-[22px] text-left text-[13px] leading-[1.45] tracking-[-0.15px] text-[#d7dce8]"
    >
      {lines.map((line) => (
        <div
          key={line.id}
          className={`mb-[5px] min-h-[18px] whitespace-pre-wrap break-words ${line.className}`}
        >
          {line.text}
        </div>
      ))}
    </div>
  </div>
);
}

export default Terminal;