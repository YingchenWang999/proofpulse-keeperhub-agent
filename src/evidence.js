import { createHash } from "node:crypto";

function sha256Hex(value) {
  return `0x${createHash("sha256").update(value).digest("hex")}`;
}

export function buildEvidence({ snapshot, decision, agentName, runNonce }) {
  const canonical = JSON.stringify({ agentName, snapshot, decision });
  const identity =
    runNonce ??
    JSON.stringify({
      agentName,
      chainId: snapshot.chainId,
      blockNumber: snapshot.blockNumber,
      evaluator: decision.evaluator,
    });
  return {
    runId: sha256Hex(identity),
    evidenceHash: sha256Hex(canonical),
    canonical,
  };
}
