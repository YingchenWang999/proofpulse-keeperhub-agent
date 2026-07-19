import test from "node:test";
import assert from "node:assert/strict";
import {
  buildKeeperHubInvocation,
  buildKeeperHubStatusInvocation,
  executeThroughKeeperHub,
  findTransactionHash,
  parseJsonOutput,
  runProcess,
} from "../src/keeperhub.js";

const config = {
  chainId: 11155111,
  contractAddress: "0x1111111111111111111111111111111111111111",
  khBin: "kh",
  khTimeout: "5m",
  abiFile: "/tmp/DecisionRegistry.json",
  rootDir: "/tmp",
  dryRun: true,
};
const decision = { status: 1, confidenceBps: 9500, summary: "healthy" };
const evidence = { runId: `0x${"11".repeat(32)}`, evidenceHash: `0x${"22".repeat(32)}` };

test("builds a zero-value KeeperHub contract call", () => {
  const invocation = buildKeeperHubInvocation(config, decision, evidence);
  assert.equal(invocation.command, "kh");
  assert.ok(invocation.args.includes("contract-call"));
  assert.ok(invocation.args.includes("recordDecision"));
  assert.ok(!invocation.args.includes("--value"));
  const encodedArgs = invocation.args[invocation.args.indexOf("--args") + 1];
  assert.deepEqual(JSON.parse(encodedArgs), [evidence.runId, 1, 9500, evidence.evidenceHash, "healthy"]);
});

test("builds a read-only status lookup for a completed execution", () => {
  assert.deepEqual(buildKeeperHubStatusInvocation(config, "exec-123"), {
    command: "kh",
    args: ["execute", "status", "exec-123", "--json"],
  });
});

test("dry-run never starts the CLI", async () => {
  const runner = async () => assert.fail("runner must not be called");
  const output = await executeThroughKeeperHub(config, decision, evidence, runner);
  assert.equal(output.mode, "dry-run");
});

test("extracts a transaction hash from nested CLI JSON", () => {
  const hash = `0x${"ab".repeat(32)}`;
  const parsed = parseJsonOutput(`progress\n${JSON.stringify({ data: { transactionHash: hash } })}`);
  assert.equal(findTransactionHash(parsed), hash);
});

test("does not treat a generic object hash as a transaction hash", () => {
  assert.equal(findTransactionHash({ hash: `0x${"ab".repeat(32)}` }), null);
});

test("rejects a terminal failed response even when the CLI exits zero", async () => {
  const liveConfig = { ...config, dryRun: false };
  const runner = async () => ({
    code: 0,
    stdout: JSON.stringify({ executionId: "exec-failed", status: "failed", error: "simulation reverted" }),
    stderr: "",
  });
  await assert.rejects(
    executeThroughKeeperHub(liveConfig, decision, evidence, runner),
    /KeeperHub execution exec-failed failed: simulation reverted/,
  );
});

test("requires a completed receipt with an execution ID and transaction hash", async () => {
  const liveConfig = { ...config, dryRun: false };
  let calls = 0;
  const runner = async () => ({
    code: 0,
    stdout: JSON.stringify({ executionId: "exec-no-hash", status: "completed" }),
    stderr: "",
  });
  await assert.rejects(
    executeThroughKeeperHub(liveConfig, decision, evidence, async (...args) => {
      calls += 1;
      return runner(...args);
    }),
    /completed without a valid transactionHash/,
  );
  assert.equal(calls, 2);
});

test("reconciles a completed execution by fetching its transaction hash", async () => {
  const hash = `0x${"ef".repeat(32)}`;
  const liveConfig = { ...config, dryRun: false };
  const invocations = [];
  const runner = async (command, args) => {
    invocations.push([command, args]);
    if (args.includes("contract-call")) {
      return {
        code: 0,
        stdout: JSON.stringify({ executionId: "exec-delayed-hash", status: "completed" }),
        stderr: "",
      };
    }
    return {
      code: 0,
      stdout: JSON.stringify({
        executionId: "exec-delayed-hash",
        status: "completed",
        transactionHash: hash,
      }),
      stderr: "",
    };
  };
  const output = await executeThroughKeeperHub(liveConfig, decision, evidence, runner);
  assert.equal(output.transactionHash, hash);
  assert.equal(invocations.length, 2);
  assert.deepEqual(invocations[1], ["kh", ["execute", "status", "exec-delayed-hash", "--json"]]);
});

test("returns an auditable completed receipt", async () => {
  const hash = `0x${"cd".repeat(32)}`;
  const liveConfig = { ...config, dryRun: false };
  const runner = async () => ({
    code: 0,
    stdout: JSON.stringify({
      executionId: "exec-ok",
      status: "completed",
      transactionHash: hash,
      transactionLink: "https://sepolia.etherscan.io/tx/test",
    }),
    stderr: "",
  });
  const output = await executeThroughKeeperHub(liveConfig, decision, evidence, runner);
  assert.equal(output.executionId, "exec-ok");
  assert.equal(output.status, "completed");
  assert.equal(output.transactionHash, hash);
});

test("terminates a stuck child process", async () => {
  await assert.rejects(
    runProcess(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], {
      timeoutMs: 50,
      killGraceMs: 50,
    }),
    /timed out after 50ms/,
  );
});
