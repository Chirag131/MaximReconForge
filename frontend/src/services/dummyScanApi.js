const wait = (milliseconds, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Scan cancelled", "AbortError"));
      return;
    }

    const timeoutId = setTimeout(resolve, milliseconds);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        reject(new DOMException("Scan cancelled", "AbortError"));
      },
      { once: true },
    );
  });

const buildScanStages = (target) => [
  {
    id: "validation",
    label: "Target validation",
    progress: 10,
    command: `reconforge validate ${target}`,
    runningMessage: "Validating target and resolving DNS",
    duration: 2200,
    output: [
      `[SUCCESS] Target accepted: ${target}`,
      "[INFO] Target type: DOMAIN",
      "[INFO] DNS resolution successful",
    ],
    metrics: {
      total: 3,
    },
  },
  {
    id: "subfinder",
    label: "Subdomain discovery",
    progress: 30,
    command: `subfinder -d ${target} -silent`,
    runningMessage: "Querying passive subdomain sources",
    duration: 6500,
    output: [
      `api.${target}`,
      `cdn.${target}`,
      `mail.${target}`,
      `admin.${target}`,
      `dev.${target}`,
      "[SUCCESS] 128 unique subdomains collected",
    ],
    metrics: {
      total: 8,
    },
  },
  {
    id: "assetfinder",
    label: "Passive result merging",
    progress: 45,
    command: `assetfinder --subs-only ${target}`,
    runningMessage: "Merging and deduplicating passive results",
    duration: 4800,
    output: [
      `assets.${target}`,
      `staging.${target}`,
      `support.${target}`,
      "[SUCCESS] Passive results merged",
      "[INFO] 128 unique assets remain after deduplication",
    ],
    metrics: {
      total: 128,
    },
  },
  {
    id: "httpx",
    label: "Live host probing",
    progress: 62,
    command: "httpx -silent -status-code -title -tech-detect",
    runningMessage: "Probing discovered hosts",
    duration: 7200,
    output: [
      `https://api.${target} [200] API Gateway`,
      `https://admin.${target} [403] Admin Portal`,
      `https://cdn.${target} [200] Static Content`,
      `https://mail.${target} [302] Webmail`,
      "[SUCCESS] 52 live hosts detected",
    ],
    metrics: {
      total: 128,
    },
  },
  {
    id: "katana",
    label: "Endpoint crawling",
    progress: 82,
    command: `katana -u https://${target} -silent`,
    runningMessage: "Crawling applications and extracting endpoints",
    duration: 9000,
    output: [
      "/login",
      "/dashboard",
      "/api/v1/users",
      "/api/v1/auth",
      "/graphql",
      "/assets/app.js",
      "[SUCCESS] 231 unique URLs collected",
    ],
    metrics: {
      total: 52,
    },
  },
  {
    id: "nmap",
    label: "Service scanning",
    progress: 98,
    command: `nmap -sV --top-ports 1000 ${target}`,
    runningMessage: "Scanning ports and identifying services",
    duration: 8500,
    output: [
      "22/tcp   open  ssh    OpenSSH 9.2",
      "80/tcp   open  http   nginx",
      "443/tcp  open  https  nginx",
      "8080/tcp open  http   proxy",
      "[SUCCESS] 7 open ports identified",
    ],
    metrics: {
      total: 1000,
    },
  },
];

export async function startDummyScan(
  target,
  handlers = {},
  options = {},
) {
  const {
    onStart,
    onStageStart,
    onStageProgress,
    onStageComplete,
    onComplete,
  } = handlers;

  const { signal } = options;

  const stages = buildScanStages(target);
  const scanId = `scan-${Date.now()}`;
  const startedAt = Date.now();

  onStart?.({
    scanId,
    target,
    status: "running",
    progress: 0,
    totalStages: stages.length,
  });

  for (let index = 0; index < stages.length; index += 1) {
    if (signal?.aborted) {
      throw new DOMException("Scan cancelled", "AbortError");
    }

    const stage = stages[index];
    const previousProgress =
      index === 0 ? 0 : stages[index - 1].progress;

    onStageStart?.({
      ...stage,
      index,
      totalStages: stages.length,
    });

    const updates = Math.max(
      1,
      Math.floor(stage.duration / 400),
    );

    for (let update = 1; update <= updates; update += 1) {
      await wait(stage.duration / updates, signal);

      const stageRatio = update / updates;

      const progress = Math.round(
        previousProgress +
          (stage.progress - previousProgress) * stageRatio,
      );

      const processed = Math.min(
        stage.metrics.total,
        Math.max(
          1,
          Math.round(stage.metrics.total * stageRatio),
        ),
      );

      onStageProgress?.({
        ...stage,
        index,
        progress,
        stageProgress: Math.round(stageRatio * 100),
        processed,
        total: stage.metrics.total,
        elapsedSeconds: Math.floor(
          (Date.now() - startedAt) / 1000,
        ),
      });
    }

    await onStageComplete?.({
      ...stage,
      index,
      totalStages: stages.length,
    });
  }

  const result = {
    scanId,
    target,
    status: "completed",
    progress: 100,
    durationSeconds: Math.floor(
      (Date.now() - startedAt) / 1000,
    ),
    summary: {
      subdomains: 128,
      liveHosts: 52,
      urls: 231,
      openPorts: 7,
    },
  };

  onComplete?.(result);

  return result;
}