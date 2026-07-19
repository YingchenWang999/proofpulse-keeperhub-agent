import { spawn } from "node:child_process";

export function buildKeeperHubInvocation(config, decision, evidence) {
  const contractArgs = [
    evidence.runId,
    decision.status,
    decision.confidenceBps,
    evidence.evidenceHash,
    decision.summary,
  ];
  return {
    command: config.khBin,
    args: [
      "execute",
      "contract-call",
      "--chain",
      String(config.chainId),
      "--contract",
      config.contractAddress,
      "--method",
      "recordDecision",
      "--args",
      JSON.stringify(contractArgs),
      "--abi-file",
      config.abiFile,
      "--wait",
      "--timeout",
      config.khTimeout,
      "--json",
      "--yes",
    ],
  };
}

export function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let forceKillTimer;
    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          forceKillTimer = setTimeout(() => child.kill("SIGKILL"), options.killGraceMs ?? 1_000);
        }, options.timeoutMs)
      : null;
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      reject(error);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (timedOut) {
        reject(new Error(`KeeperHub CLI timed out after ${options.timeoutMs}ms`));
        return;
      }
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error(`KeeperHub CLI exited with ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}

function parseJsonOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split("\n").reverse();
    for (const line of lines) {
      try {
        return JSON.parse(line);
      } catch {
        // Keep looking for a JSON result line after any CLI progress output.
      }
    }
    return { raw: trimmed };
  }
}

function findTransactionHash(value) {
  if (!value || typeof value !== "object") return null;
  for (const key of ["transactionHash", "txHash"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && /^0x[0-9a-fA-F]{64}$/.test(candidate)) return candidate;
  }
  for (const nested of Object.values(value)) {
    const found = findTransactionHash(nested);
    if (found) return found;
  }
  return null;
}

function parseExecutionReceipt(parsed) {
  const executionId = typeof parsed.executionId === "string" ? parsed.executionId.trim() : "";
  const status = typeof parsed.status === "string" ? parsed.status.toLowerCase() : "";
  if (!executionId) throw new Error("KeeperHub response did not include an executionId");
  if (status === "failed") {
    const detail = typeof parsed.error === "string" && parsed.error.trim() ? `: ${parsed.error.trim()}` : "";
    throw new Error(`KeeperHub execution ${executionId} failed${detail}`);
  }
  if (status !== "completed") {
    throw new Error(`KeeperHub execution ${executionId} returned unexpected terminal status: ${status || "missing"}`);
  }
  const transactionHash = findTransactionHash(parsed);
  if (!transactionHash) {
    throw new Error(`KeeperHub execution ${executionId} completed without a valid transactionHash`);
  }
  return {
    executionId,
    status,
    transactionHash,
    transactionLink: typeof parsed.transactionLink === "string" ? parsed.transactionLink : null,
  };
}

export async function executeThroughKeeperHub(config, decision, evidence, runner = runProcess) {
  const invocation = buildKeeperHubInvocation(config, decision, evidence);
  if (config.dryRun) {
    return { mode: "dry-run", invocation, transactionHash: null };
  }
  const result = await runner(invocation.command, invocation.args, {
    cwd: config.rootDir,
    timeoutMs: config.khProcessTimeoutMs,
  });
  const parsed = parseJsonOutput(result.stdout);
  const receipt = parseExecutionReceipt(parsed);
  return {
    mode: "live",
    result: parsed,
    ...receipt,
  };
}

export { findTransactionHash, parseExecutionReceipt, parseJsonOutput };
