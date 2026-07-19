import test from "node:test";
import assert from "node:assert/strict";
import { enforceExecutionPolicy, MAX_SUMMARY_BYTES } from "../src/policy.js";

const config = {
  chainId: 11155111,
  allowMainnet: false,
  contractAddress: "0x1111111111111111111111111111111111111111",
};

test("allows only the fixed non-payable registry method", () => {
  const result = enforceExecutionPolicy({
    config,
    decision: { status: 1, confidenceBps: 9500, summary: "healthy", evaluator: "rules-v1" },
  });
  assert.deepEqual(result.execution, {
    chainId: 11155111,
    contract: config.contractAddress,
    method: "recordDecision",
    nativeValueWei: "0",
  });
});

test("truncates multibyte summaries to the contract limit", () => {
  const result = enforceExecutionPolicy({
    config,
    decision: { status: 2, confidenceBps: 8000, summary: "链".repeat(200), evaluator: "ollama" },
  });
  assert.ok(Buffer.byteLength(result.summary, "utf8") <= MAX_SUMMARY_BYTES);
});

test("rejects invalid decisions", () => {
  assert.throws(
    () => enforceExecutionPolicy({ config, decision: { status: 9, confidenceBps: 1, summary: "bad" } }),
    /invalid status/,
  );
});

test("rejects the zero address even when config loading is bypassed", () => {
  assert.throws(
    () =>
      enforceExecutionPolicy({
        config: { ...config, contractAddress: `0x${"00".repeat(20)}` },
        decision: { status: 1, confidenceBps: 9500, summary: "healthy" },
      }),
    /zero address/,
  );
});
