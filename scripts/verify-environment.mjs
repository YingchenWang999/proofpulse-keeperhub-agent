#!/usr/bin/env node
import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { loadConfig } from "../src/config.js";
import { collectChainSnapshot } from "../src/rpc.js";

const checks = [];
const config = loadConfig({ requireContract: false });

checks.push({ name: "Node.js >= 20", ok: Number(process.versions.node.split(".")[0]) >= 20 });
checks.push({ name: "testnet selected or mainnet explicitly enabled", ok: Boolean(config.chainId) });
const hasContractAddress =
  /^0x[0-9a-fA-F]{40}$/.test(config.contractAddress) && !/^0x0{40}$/i.test(config.contractAddress);
checks.push({
  name: "non-zero CONTRACT_ADDRESS configured",
  ok: hasContractAddress,
});
checks.push({
  name: "live mode pins reviewed contract bytecode",
  ok: config.dryRun || /^0x[0-9a-f]{64}$/.test(config.expectedContractCodeSha256),
});

if (hasContractAddress) {
  try {
    const snapshot = await collectChainSnapshot(config);
    checks.push({
      name: "RPC chain and deployed contract verified",
      ok: true,
      detail: `block ${snapshot.blockNumber}, code ${snapshot.contractCodeSha256}`,
    });
  } catch (error) {
    checks.push({ name: "RPC chain and deployed contract verified", ok: false, detail: error.message });
  }
} else {
  checks.push({ name: "RPC chain and deployed contract verified", ok: false, detail: "configure the contract first" });
}

try {
  await access(config.abiFile);
  checks.push({ name: "DecisionRegistry ABI present", ok: true });
} catch {
  checks.push({ name: "DecisionRegistry ABI present", ok: false });
}

const kh = spawnSync(config.khBin, ["auth", "status"], { encoding: "utf8", timeout: 10_000 });
checks.push({
  name: "KeeperHub CLI installed and authenticated",
  ok: kh.status === 0,
  detail: (kh.stdout || kh.stderr || "kh was not found").trim(),
});

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
}
if (checks.some((check) => !check.ok)) process.exitCode = 1;
