import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidence } from "../src/evidence.js";

const input = {
  snapshot: { chainId: 11155111, blockNumber: "123", observedAt: "2026-07-18T00:00:00.000Z" },
  decision: { status: 1, confidenceBps: 9500, evaluator: "rules-v1", summary: "healthy" },
  agentName: "ProofPulse",
};

test("uses a deterministic run ID for idempotent retries of the same block", () => {
  assert.equal(buildEvidence(input).runId, buildEvidence(input).runId);
});

test("changes the run ID when the observed block changes", () => {
  const first = buildEvidence(input).runId;
  const second = buildEvidence({ ...input, snapshot: { ...input.snapshot, blockNumber: "124" } }).runId;
  assert.notEqual(first, second);
});
