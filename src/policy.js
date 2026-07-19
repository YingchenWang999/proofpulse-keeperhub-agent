import { TESTNET_CHAIN_IDS, ZERO_ADDRESS, validateAddress } from "./config.js";

const MAX_SUMMARY_BYTES = 240;

function truncateUtf8(value, maxBytes) {
  const input = String(value).trim();
  let output = "";
  let bytes = 0;
  for (const character of input) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (bytes + characterBytes > maxBytes) break;
    output += character;
    bytes += characterBytes;
  }
  return output;
}

export function enforceExecutionPolicy({ config, decision }) {
  if (!config.allowMainnet && !TESTNET_CHAIN_IDS.has(config.chainId)) {
    throw new Error("Policy rejected a non-testnet chain");
  }
  if (!validateAddress(config.contractAddress)) {
    throw new Error("Policy rejected an invalid contract address");
  }
  if (config.contractAddress.toLowerCase() === ZERO_ADDRESS) {
    throw new Error("Policy rejected the zero address");
  }
  if (![1, 2, 3].includes(decision.status)) {
    throw new Error("Policy rejected an invalid status");
  }
  if (!Number.isInteger(decision.confidenceBps) || decision.confidenceBps < 0 || decision.confidenceBps > 10_000) {
    throw new Error("Policy rejected confidence outside 0-10000 bps");
  }

  const summary = truncateUtf8(decision.summary, MAX_SUMMARY_BYTES);
  if (!summary) throw new Error("Policy rejected an empty summary");

  return {
    ...decision,
    summary,
    execution: {
      chainId: config.chainId,
      contract: config.contractAddress,
      method: "recordDecision",
      nativeValueWei: "0",
    },
  };
}

export { MAX_SUMMARY_BYTES, truncateUtf8 };
