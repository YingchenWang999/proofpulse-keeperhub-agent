import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSnapshot, evaluateWithRules, parseOllamaDecision, STATUS } from "../src/evaluator.js";

const config = { maxBlockLagSeconds: 120, maxBaseFeeGwei: 100 };

test("marks a fresh, inexpensive block healthy", () => {
  const result = evaluateWithRules({ blockLagSeconds: 12, baseFeeGwei: 1.5 }, config);
  assert.equal(result.status, STATUS.HEALTHY);
  assert.match(result.summary, /within policy limits/);
});

test("marks a stale block degraded or critical", () => {
  assert.equal(evaluateWithRules({ blockLagSeconds: 180, baseFeeGwei: 1 }, config).status, STATUS.DEGRADED);
  assert.equal(evaluateWithRules({ blockLagSeconds: 500, baseFeeGwei: 1 }, config).status, STATUS.CRITICAL);
});

test("validates structured local-model output", () => {
  const result = parseOllamaDecision(
    JSON.stringify({ status: "degraded", confidenceBps: 8750, summary: "Block production is delayed" }),
  );
  assert.deepEqual(result, {
    status: STATUS.DEGRADED,
    confidenceBps: 8750,
    summary: "Block production is delayed",
    evaluator: "ollama",
  });
});

test("rejects a local-model response without finite confidence", () => {
  assert.throws(
    () => parseOllamaDecision(JSON.stringify({ status: "healthy", summary: "fine" })),
    /confidenceBps must be a finite number/,
  );
});

test("local AI cannot downgrade a deterministic critical signal", async () => {
  let signal;
  const fetchImpl = async (_url, options) => {
    signal = options.signal;
    return {
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({ status: "healthy", confidenceBps: 9900, summary: "looks healthy" }),
        },
      }),
    };
  };
  const result = await evaluateSnapshot(
    { blockLagSeconds: 500, baseFeeGwei: 1 },
    { ...config, evaluatorMode: "ollama", ollamaUrl: "http://localhost", ollamaModel: "test", ollamaTimeoutMs: 50 },
    fetchImpl,
  );
  assert.equal(result.status, STATUS.CRITICAL);
  assert.match(result.summary, /deterministic guardrail/);
  assert.ok(signal instanceof AbortSignal);
});
