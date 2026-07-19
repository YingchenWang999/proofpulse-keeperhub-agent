import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TESTNET_CHAIN_IDS = new Set([11155111, 84532]);
const ZERO_ADDRESS = `0x${"00".repeat(20)}`;

function readBoolean(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

function readNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return value;
}

function readPositiveNumber(name, fallback) {
  const value = readNumber(name, fallback);
  if (value === 0) throw new Error(`${name} must be greater than zero`);
  return value;
}

function readPositiveInteger(name, fallback) {
  const value = readPositiveNumber(name, fallback);
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a safe integer`);
  return value;
}

function validateAddress(address) {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

function readHttpUrl(name, fallback) {
  const value = process.env[name] ?? fallback;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  return parsed.href;
}

export function loadConfig({ requireContract = true } = {}) {
  const chainId = readNumber("CHAIN_ID", 11155111);
  const contractAddress = process.env.CONTRACT_ADDRESS ?? "";
  const allowMainnet = readBoolean("ALLOW_MAINNET", false);
  const dryRun = readBoolean("DRY_RUN", true);
  const expectedContractCodeSha256 = (process.env.EXPECTED_CONTRACT_CODE_SHA256 ?? "").toLowerCase();

  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("CHAIN_ID must be a positive safe integer");
  if (!allowMainnet && !TESTNET_CHAIN_IDS.has(chainId)) {
    throw new Error(
      `CHAIN_ID ${chainId} is not in the testnet allowlist; keep ALLOW_MAINNET=false for zero-principal operation`,
    );
  }
  if (requireContract && !validateAddress(contractAddress)) {
    throw new Error("CONTRACT_ADDRESS must be a deployed 20-byte EVM address");
  }
  if (requireContract && contractAddress.toLowerCase() === ZERO_ADDRESS) {
    throw new Error("CONTRACT_ADDRESS must not be the zero address");
  }
  if (expectedContractCodeSha256 && !/^0x[0-9a-f]{64}$/.test(expectedContractCodeSha256)) {
    throw new Error("EXPECTED_CONTRACT_CODE_SHA256 must be a 32-byte hex value");
  }
  if (requireContract && !dryRun && !expectedContractCodeSha256) {
    throw new Error("EXPECTED_CONTRACT_CODE_SHA256 is required when DRY_RUN=false");
  }

  const evaluatorMode = process.env.EVALUATOR_MODE ?? "rules";
  if (!["rules", "ollama"].includes(evaluatorMode)) {
    throw new Error("EVALUATOR_MODE must be rules or ollama");
  }
  const ollamaUrl = readHttpUrl("OLLAMA_URL", "http://127.0.0.1:11434");
  if (evaluatorMode === "ollama") {
    const hostname = new URL(ollamaUrl).hostname;
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) {
      throw new Error("OLLAMA_URL must use a local host to prevent unintended paid or remote inference");
    }
  }

  return {
    rootDir: ROOT_DIR,
    chainId,
    rpcUrl: readHttpUrl("RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com"),
    contractAddress,
    expectedContractCodeSha256,
    khBin: process.env.KH_BIN ?? "kh",
    khTimeout: process.env.KH_TIMEOUT ?? "5m",
    khProcessTimeoutMs: readPositiveInteger("KH_PROCESS_TIMEOUT_MS", 360_000),
    dryRun,
    forceRecord: readBoolean("FORCE_RECORD", false),
    autoRecord: readBoolean("AUTO_RECORD", false),
    allowMainnet,
    rpcTimeoutMs: readPositiveInteger("RPC_TIMEOUT_MS", 10_000),
    ollamaTimeoutMs: readPositiveInteger("OLLAMA_TIMEOUT_MS", 30_000),
    maxBlockLagSeconds: readNumber("MAX_BLOCK_LAG_SECONDS", 120),
    maxBaseFeeGwei: readNumber("MAX_BASE_FEE_GWEI", 100),
    evaluatorMode,
    ollamaUrl,
    ollamaModel: process.env.OLLAMA_MODEL ?? "qwen3:4b",
    agentName: process.env.AGENT_NAME ?? "ProofPulse",
    artifactDir: path.resolve(ROOT_DIR, process.env.ARTIFACT_DIR ?? "artifacts"),
    abiFile: path.join(ROOT_DIR, "abi", "DecisionRegistry.json"),
  };
}

export { TESTNET_CHAIN_IDS, ZERO_ADDRESS, validateAddress };
