# ProofPulse — KeeperHub Agents Onchain

ProofPulse is a zero-principal AI agent that observes EVM chain health, classifies the latest conditions, and records a tamper-evident decision through KeeperHub. It never transfers tokens, grants approvals, trades, deposits, stakes, or sends native value.

The project targets the KeeperHub Agents Onchain hackathon's core requirement: the agent must land a real transaction through KeeperHub rather than mock execution.

## Verified Sepolia settlement

- Registry: [`0xa64c51b5D542649D47c8F5487D5E296F1216B788`](https://sepolia.etherscan.io/address/0xa64c51b5D542649D47c8F5487D5E296F1216B788)
- KeeperHub execution: `42y70sy5vrb2k8hhlafpz`
- Transaction: [`0x830da04e05873465cc20a59875ccd43c6dbba255831d1af8b6344a742e3ae71a`](https://sepolia.etherscan.io/tx/0x830da04e05873465cc20a59875ccd43c6dbba255831d1af8b6344a742e3ae71a)
- Onchain run ID: `0xdc00ff4b0bcba4822e7c20ad37c6617afc7322765122b3f1cbf17afbb72a4c05`
- Evidence hash: `0x6537c212e24198dfc7297f72f3c3082c12f5d136d32ba87d17d7f238c882e8fd`
- Settlement: successful, KeeperHub-sponsored, `0` native value, no user principal transferred

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the deployment, receipt, bytecode, and state read-back evidence.

## Why it is safe to demo

- Sepolia is the default and mainnet is blocked unless `ALLOW_MAINNET=true` is set explicitly.
- The only executable method is `DecisionRegistry.recordDecision(...)`.
- The registry method is non-payable and the CLI invocation has no value flag.
- `DRY_RUN=true` is the default.
- Automatic anomaly writes are disabled unless `AUTO_RECORD=true` is explicitly set.
- The rules evaluator has no API cost. Optional Ollama support keeps AI inference local.
- Every decision produces a local JSON artifact containing the evidence hash and any transaction hash returned by KeeperHub.
- RPC chain IDs and deployed contract bytecode are verified, transient RPC failures receive bounded retries, network/model calls have finite timeouts, and failed KeeperHub executions are preserved as audit artifacts.

## Architecture

```mermaid
flowchart LR
    RPC["Sepolia JSON-RPC"] --> Snapshot["Block snapshot"]
    Snapshot --> AI["Rules or local Ollama evaluator"]
    AI --> Policy["Deterministic safety policy"]
    Policy --> KH["KeeperHub CLI"]
    KH --> Registry["DecisionRegistry on Sepolia"]
    Registry --> Receipt["Transaction + audit artifact"]
```

## Prerequisites

- Node.js 20 or newer
- A free KeeperHub account and authenticated `kh` CLI
- A deployed `DecisionRegistry` address on Sepolia (the verified deployment above is preconfigured locally)
- A Sepolia RPC endpoint

KeeperHub CLI authentication can be interactive:

```bash
kh auth login
kh auth status
```

For CI, create an organisation API key in KeeperHub and provide `KH_API_KEY` through the environment. Never save it in this repository.

## Setup

```bash
cp .env.example .env
```

Load the values using your preferred environment manager. Set `CONTRACT_ADDRESS` to the verified deployment above or to a registry you deploy and verify yourself. Do not substitute an unverified address.

Run all local checks:

```bash
npm run check
node scripts/verify-environment.mjs
```

Preview the exact KeeperHub call without submitting it:

```bash
set -a
source .env
set +a
npm run demo
```

The output must show `execution.mode` as `dry-run`. Review its chain, contract, method, arguments, and `snapshot.contractCodeSha256`. Copy that reviewed hash into `EXPECTED_CONTRACT_CODE_SHA256` in `.env`; live mode refuses to run without it and rejects changed bytecode.

## One controlled live transaction

Only after the dry run is correct and the KeeperHub free gas allowance is confirmed:

```bash
DRY_RUN=false FORCE_RECORD=true npm start
```

This is the only command in the project that authorizes a chain write. It calls the fixed non-payable registry method and waits for confirmation. A run artifact is saved under `artifacts/` and is ignored by Git.

KeeperHub CLI v0.10.0 may initially return a completed execution ID before including the transaction hash. ProofPulse performs one read-only `kh execute status` reconciliation in that case and still refuses to report success unless the final response contains both identifiers.

For unattended anomaly recording, `AUTO_RECORD=true` must be set separately. Keep it false for the one-transaction hackathon demo so a degraded RPC cannot cause repeated writes. Repeating the same observed block uses the same onchain run ID and reverts rather than creating duplicate records.

## AI modes

The default mode is deterministic and free:

```bash
EVALUATOR_MODE=rules npm start
```

For a local language-model decision, install Ollama separately, pull the configured model, then run:

```bash
EVALUATOR_MODE=ollama OLLAMA_MODEL=qwen3:4b npm start
```

The local model can classify and explain conditions but cannot choose a destination, method, value, or chain. Those fields remain fixed by the policy layer. The deterministic evaluator is also run in Ollama mode, and the model cannot downgrade a deterministic degraded or critical result.

## Submission evidence

- Public source: <https://github.com/YingchenWang999/proofpulse-keeperhub-agent>
- Real KeeperHub execution and explorer transaction: linked above
- Deployment and read-back evidence: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- Architecture and safety explanation: this README and [`SECURITY.md`](SECURITY.md)
- Demo recording script: [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)
- Explicit guarantee: the execution path transfers no user principal and sends zero native value

See [`SUBMISSION.md`](SUBMISSION.md) for ready-to-paste submission copy. Only the final video URL and the hackathon submission action remain external.
