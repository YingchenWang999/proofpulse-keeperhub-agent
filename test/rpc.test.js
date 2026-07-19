import test from "node:test";
import assert from "node:assert/strict";
import { collectChainSnapshot } from "../src/rpc.js";

const defaultBlock = { number: "0x64", timestamp: "0x3e8", baseFeePerGas: "0x3b9aca00" };

function makeRpcFetch({ chainId = "0xaa36a7", block = defaultBlock, code = "0x6000", seenSignals } = {}) {
  return async (_url, options) => {
    seenSignals?.push(options.signal);
    const { method } = JSON.parse(options.body);
    const results = {
      eth_chainId: chainId,
      eth_getBlockByNumber: block,
      eth_getCode: code,
    };
    return {
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: results[method] }),
    };
  };
}

const config = {
  rpcUrl: "https://rpc.invalid",
  chainId: 11155111,
  contractAddress: `0x${"11".repeat(20)}`,
  rpcTimeoutMs: 1000,
};

test("normalizes a latest-block RPC response and contract code proof", async () => {
  const snapshot = await collectChainSnapshot(config, {
    fetchImpl: makeRpcFetch(),
    nowMs: 1_010_000,
  });
  assert.equal(snapshot.blockNumber, "100");
  assert.equal(snapshot.blockLagSeconds, 10);
  assert.equal(snapshot.baseFeeGwei, 1);
  assert.equal(snapshot.contractCodeSizeBytes, 2);
  assert.match(snapshot.contractCodeSha256, /^0x[0-9a-f]{64}$/);
});

test("rejects an RPC endpoint connected to a different chain", async () => {
  await assert.rejects(
    collectChainSnapshot(config, {
      fetchImpl: makeRpcFetch({ chainId: "0x1" }),
      nowMs: 1_010_000,
    }),
    /RPC chain ID 1 does not match configured CHAIN_ID 11155111/,
  );
});

test("rejects a block timestamp too far in the future", async () => {
  await assert.rejects(
    collectChainSnapshot(config, {
      fetchImpl: makeRpcFetch({ block: { ...defaultBlock, timestamp: "0x7d0" } }),
      nowMs: 1_000_000,
    }),
    /block timestamp is 1000s in the future/,
  );
});

test("rejects an address with no deployed bytecode", async () => {
  await assert.rejects(
    collectChainSnapshot(config, {
      fetchImpl: makeRpcFetch({ code: "0x" }),
      nowMs: 1_010_000,
    }),
    /CONTRACT_ADDRESS has no deployed bytecode/,
  );
});

test("rejects deployed bytecode that changed after dry-run review", async () => {
  await assert.rejects(
    collectChainSnapshot(
      { ...config, expectedContractCodeSha256: `0x${"00".repeat(32)}` },
      { fetchImpl: makeRpcFetch(), nowMs: 1_010_000 },
    ),
    /does not match EXPECTED_CONTRACT_CODE_SHA256/,
  );
});

test("passes a finite abort signal to every RPC request", async () => {
  const seenSignals = [];
  await collectChainSnapshot(config, {
    fetchImpl: makeRpcFetch({ seenSignals }),
    nowMs: 1_010_000,
  });
  assert.equal(seenSignals.length, 3);
  assert.ok(seenSignals.every((signal) => signal instanceof AbortSignal));
});

test("retries a transient RPC transport failure", async () => {
  let blockAttempts = 0;
  const stableFetch = makeRpcFetch();
  const fetchImpl = async (url, options) => {
    const { method } = JSON.parse(options.body);
    if (method === "eth_getBlockByNumber" && blockAttempts++ === 0) {
      throw new Error("temporary connection reset");
    }
    return stableFetch(url, options);
  };
  const snapshot = await collectChainSnapshot(config, { fetchImpl, nowMs: 1_010_000 });
  assert.equal(snapshot.blockNumber, "100");
  assert.equal(blockAttempts, 2);
});
