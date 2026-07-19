#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceName = "contracts/DecisionRegistry.sol";
const source = await readFile(path.join(rootDir, sourceName), "utf8");
const runtimeAbi = JSON.parse(await readFile(path.join(rootDir, "abi/DecisionRegistry.json"), "utf8"));

const input = {
  language: "Solidity",
  sources: { [sourceName]: { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
  },
};
const compiler = spawnSync("npx", ["--yes", "solc@0.8.30", "--standard-json"], {
  input: JSON.stringify(input),
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
if (compiler.error) throw compiler.error;
if (compiler.status !== 0) {
  throw new Error(`solc failed with exit code ${compiler.status}: ${compiler.stderr.trim()}`);
}
const jsonStart = compiler.stdout.indexOf("{");
if (jsonStart < 0) throw new Error(`solc returned no JSON output: ${compiler.stdout.trim()}`);
const output = JSON.parse(compiler.stdout.slice(jsonStart));
const diagnostics = output.errors ?? [];
for (const diagnostic of diagnostics) {
  const stream = diagnostic.severity === "error" ? process.stderr : process.stdout;
  stream.write(`${diagnostic.formattedMessage}\n`);
}
if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) process.exit(1);

const compiled = output.contracts?.[sourceName]?.DecisionRegistry;
if (!compiled?.evm?.bytecode?.object) throw new Error("DecisionRegistry produced no deployable bytecode");

function signature(item) {
  return `${item.type}:${item.name ?? ""}(${(item.inputs ?? []).map((inputItem) => inputItem.type).join(",")})`;
}

const compiledBySignature = new Map(compiled.abi.map((item) => [signature(item), item]));
for (const item of runtimeAbi) {
  const match = compiledBySignature.get(signature(item));
  if (!match) throw new Error(`Runtime ABI entry is missing from the contract: ${signature(item)}`);
  if (match.stateMutability !== item.stateMutability) {
    throw new Error(`Runtime ABI mutability drifted for ${signature(item)}`);
  }
}

const decisionsGetter = compiled.abi.find((item) => item.type === "function" && item.name === "decisions");
const getterInputs = decisionsGetter?.inputs?.map((item) => item.type).join(",");
if (getterInputs !== "address,bytes32") {
  throw new Error("decisions getter must scope run IDs by recorder address");
}

const runtimeCode = Buffer.from(compiled.evm.deployedBytecode.object, "hex");
const runtimeCodeSha256 = `0x${createHash("sha256").update(runtimeCode).digest("hex")}`;
console.log(`DecisionRegistry compiled with solc 0.8.30; runtime SHA-256 ${runtimeCodeSha256}; ABI is in sync`);
