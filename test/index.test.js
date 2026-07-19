import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runAgent } from "../src/index.js";

const snapshot = {
  chainId: 11155111,
  blockNumber: "123",
  blockTimestamp: 1000,
  blockLagSeconds: 500,
  baseFeeGwei: 1,
  observedAt: "2026-07-18T00:00:00.000Z",
};
const decision = {
  status: 3,
  confidenceBps: 9000,
  summary: "stale block",
  evaluator: "rules-v1",
};

function makeConfig(artifactDir) {
  return {
    artifactDir,
    agentName: "ProofPulse",
    forceRecord: false,
    autoRecord: false,
    chainId: 11155111,
    allowMainnet: false,
    contractAddress: `0x${"11".repeat(20)}`,
  };
}

test("does not auto-submit degraded decisions unless AUTO_RECORD is enabled", async () => {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), "proofpulse-test-"));
  let executionCalls = 0;
  const result = await runAgent(makeConfig(artifactDir), {
    collectChainSnapshot: async () => snapshot,
    evaluateSnapshot: async () => decision,
    executeThroughKeeperHub: async () => {
      executionCalls += 1;
      return { mode: "live" };
    },
  });
  assert.equal(executionCalls, 0);
  assert.equal(result.artifact.execution.mode, "skipped");
});

test("persists a failure artifact before surfacing a KeeperHub error", async () => {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), "proofpulse-test-"));
  const config = { ...makeConfig(artifactDir), forceRecord: true };
  let caught;
  try {
    await runAgent(config, {
      collectChainSnapshot: async () => snapshot,
      evaluateSnapshot: async () => decision,
      executeThroughKeeperHub: async () => {
        throw new Error("KeeperHub execution failed");
      },
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught);
  assert.match(caught.message, /audit artifact/);
  const artifact = JSON.parse(await readFile(caught.artifactFile, "utf8"));
  assert.equal(artifact.execution.mode, "failed");
  assert.equal(artifact.execution.error, "KeeperHub execution failed");
});
