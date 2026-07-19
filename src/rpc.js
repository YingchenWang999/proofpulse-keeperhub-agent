import { createHash } from "node:crypto";

const WEI_PER_GWEI = 1_000_000_000n;
const MAX_FUTURE_BLOCK_SKEW_SECONDS = 15n;
const RPC_MAX_ATTEMPTS = 3;

function hexToBigInt(value, field) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    throw new Error(`RPC returned an invalid ${field}`);
  }
  return BigInt(value);
}

export async function rpcCall(rpcUrl, method, params, fetchImpl = fetch, timeoutMs = 10_000) {
  let lastError;
  for (let attempt = 1; attempt <= RPC_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const error = new Error(`RPC ${method} failed with HTTP ${response.status}`);
        if (![408, 429].includes(response.status) && response.status < 500) throw error;
        lastError = error;
      } else {
        const body = await response.json();
        if (body.error) throw new Error(`RPC ${method} failed: ${body.error.message}`);
        return body.result;
      }
    } catch (error) {
      if (error.message.startsWith(`RPC ${method} failed`)) throw error;
      lastError = new Error(`RPC ${method} request failed: ${error.message}`, { cause: error });
    }
    if (attempt < RPC_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }
  throw lastError;
}

export async function collectChainSnapshot(config, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowMs = options.nowMs ?? Date.now();
  const [rpcChainIdHex, block, contractCode] = await Promise.all([
    rpcCall(config.rpcUrl, "eth_chainId", [], fetchImpl, config.rpcTimeoutMs),
    rpcCall(config.rpcUrl, "eth_getBlockByNumber", ["latest", false], fetchImpl, config.rpcTimeoutMs),
    rpcCall(config.rpcUrl, "eth_getCode", [config.contractAddress, "latest"], fetchImpl, config.rpcTimeoutMs),
  ]);
  const rpcChainId = hexToBigInt(rpcChainIdHex, "chain ID");
  if (rpcChainId !== BigInt(config.chainId)) {
    throw new Error(`RPC chain ID ${rpcChainId} does not match configured CHAIN_ID ${config.chainId}`);
  }
  if (!block) throw new Error("RPC returned no latest block");
  if (typeof contractCode !== "string" || !/^0x(?:[0-9a-f]{2})*$/i.test(contractCode)) {
    throw new Error("RPC returned invalid contract bytecode");
  }
  if (/^0x0*$/i.test(contractCode)) {
    throw new Error("CONTRACT_ADDRESS has no deployed bytecode on the configured chain");
  }
  const contractCodeBytes = Buffer.from(contractCode.slice(2), "hex");
  const contractCodeSha256 = `0x${createHash("sha256").update(contractCodeBytes).digest("hex")}`;
  if (config.expectedContractCodeSha256 && contractCodeSha256 !== config.expectedContractCodeSha256) {
    throw new Error(
      `deployed contract code hash ${contractCodeSha256} does not match EXPECTED_CONTRACT_CODE_SHA256`,
    );
  }

  const number = hexToBigInt(block.number, "block number");
  const timestamp = hexToBigInt(block.timestamp, "block timestamp");
  const baseFeeWei = block.baseFeePerGas ? hexToBigInt(block.baseFeePerGas, "base fee") : 0n;
  const nowSeconds = BigInt(Math.floor(nowMs / 1000));
  if (timestamp > nowSeconds + MAX_FUTURE_BLOCK_SKEW_SECONDS) {
    throw new Error(`RPC block timestamp is ${timestamp - nowSeconds}s in the future`);
  }
  if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("RPC block timestamp exceeds JavaScript's safe integer range");
  }
  const blockLagSeconds = nowSeconds > timestamp ? Number(nowSeconds - timestamp) : 0;
  const baseFeeGwei = Number(baseFeeWei) / Number(WEI_PER_GWEI);
  if (!Number.isFinite(baseFeeGwei)) throw new Error("RPC base fee exceeds the supported numeric range");

  return {
    chainId: config.chainId,
    blockNumber: number.toString(),
    blockTimestamp: Number(timestamp),
    blockLagSeconds,
    baseFeeGwei,
    contractCodeSizeBytes: contractCodeBytes.length,
    contractCodeSha256,
    observedAt: new Date(nowMs).toISOString(),
  };
}

export { MAX_FUTURE_BLOCK_SKEW_SECONDS, RPC_MAX_ATTEMPTS };
