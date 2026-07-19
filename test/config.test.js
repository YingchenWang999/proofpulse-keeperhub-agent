import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

function withEnv(values, callback) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("defaults to Sepolia, dry-run, and rules", () => {
  withEnv(
    {
      CHAIN_ID: undefined,
      CONTRACT_ADDRESS: undefined,
      ALLOW_MAINNET: undefined,
      DRY_RUN: undefined,
      EVALUATOR_MODE: undefined,
    },
    () => {
      const config = loadConfig({ requireContract: false });
      assert.equal(config.chainId, 11155111);
      assert.equal(config.dryRun, true);
      assert.equal(config.allowMainnet, false);
      assert.equal(config.evaluatorMode, "rules");
    },
  );
});

test("rejects mainnet unless explicitly enabled", () => {
  withEnv({ CHAIN_ID: "1", ALLOW_MAINNET: "false" }, () => {
    assert.throws(() => loadConfig({ requireContract: false }), /not in the testnet allowlist/);
  });
});

test("requires a deployed contract address for execution", () => {
  withEnv({ CHAIN_ID: "11155111", CONTRACT_ADDRESS: "not-an-address" }, () => {
    assert.throws(() => loadConfig(), /CONTRACT_ADDRESS/);
  });
});

test("rejects the zero address", () => {
  withEnv({ CHAIN_ID: "11155111", CONTRACT_ADDRESS: `0x${"00".repeat(20)}` }, () => {
    assert.throws(() => loadConfig(), /zero address/);
  });
});

test("disables automatic writes and configures finite request timeouts by default", () => {
  withEnv(
    {
      CHAIN_ID: "11155111",
      CONTRACT_ADDRESS: `0x${"11".repeat(20)}`,
      AUTO_RECORD: undefined,
      RPC_TIMEOUT_MS: undefined,
      OLLAMA_TIMEOUT_MS: undefined,
      KH_PROCESS_TIMEOUT_MS: undefined,
    },
    () => {
      const config = loadConfig();
      assert.equal(config.autoRecord, false);
      assert.equal(config.rpcTimeoutMs, 10_000);
      assert.equal(config.ollamaTimeoutMs, 30_000);
      assert.equal(config.khProcessTimeoutMs, 360_000);
    },
  );
});

test("rejects a remote Ollama endpoint to keep inference local", () => {
  withEnv(
    {
      CHAIN_ID: "11155111",
      CONTRACT_ADDRESS: `0x${"11".repeat(20)}`,
      EVALUATOR_MODE: "ollama",
      OLLAMA_URL: "https://paid-model.example.com",
    },
    () => assert.throws(() => loadConfig(), /OLLAMA_URL must use a local host/),
  );
});

test("requires a reviewed contract code hash before live execution", () => {
  withEnv(
    {
      CHAIN_ID: "11155111",
      CONTRACT_ADDRESS: `0x${"11".repeat(20)}`,
      DRY_RUN: "false",
      EXPECTED_CONTRACT_CODE_SHA256: undefined,
    },
    () => assert.throws(() => loadConfig(), /EXPECTED_CONTRACT_CODE_SHA256 is required/),
  );
});
