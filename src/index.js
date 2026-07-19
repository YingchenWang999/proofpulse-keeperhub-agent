#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { collectChainSnapshot } from "./rpc.js";
import { evaluateSnapshot } from "./evaluator.js";
import { enforceExecutionPolicy } from "./policy.js";
import { buildEvidence } from "./evidence.js";
import { executeThroughKeeperHub } from "./keeperhub.js";
import { saveRunArtifact } from "./artifacts.js";

export async function runAgent(config = loadConfig(), dependencies = {}) {
  const services = {
    collectChainSnapshot,
    evaluateSnapshot,
    executeThroughKeeperHub,
    saveRunArtifact,
    ...dependencies,
  };
  const snapshot = await services.collectChainSnapshot(config);
  const rawDecision = await services.evaluateSnapshot(snapshot, config);
  const decision = enforceExecutionPolicy({ config, decision: rawDecision });
  const evidence = buildEvidence({ snapshot, decision, agentName: config.agentName });

  const shouldRecord = config.forceRecord || (config.autoRecord && decision.status !== 1);
  let execution;
  let executionError;
  if (shouldRecord) {
    try {
      execution = await services.executeThroughKeeperHub(config, decision, evidence);
    } catch (error) {
      executionError = error;
      execution = { mode: "failed", error: error.message };
    }
  } else {
    execution = {
      mode: "skipped",
      reason: "recording not authorized; set FORCE_RECORD=true for one run or AUTO_RECORD=true for anomalies",
    };
  }

  const artifact = {
    schemaVersion: 1,
    agent: config.agentName,
    snapshot,
    decision,
    evidence: { runId: evidence.runId, evidenceHash: evidence.evidenceHash },
    execution,
  };
  const artifactFile = await services.saveRunArtifact(config.artifactDir, artifact);
  if (executionError) {
    const error = new Error(`ProofPulse execution failed; audit artifact: ${artifactFile}`, { cause: executionError });
    error.artifactFile = artifactFile;
    throw error;
  }
  return { artifact, artifactFile };
}

async function main() {
  const { artifact, artifactFile } = await runAgent();
  console.log(JSON.stringify({ ...artifact, artifactFile }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`ProofPulse failed: ${error.message}`);
    process.exitCode = 1;
  });
}
