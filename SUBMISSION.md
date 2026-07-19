# ProofPulse submission draft

## One-line description

ProofPulse is a zero-principal chain-health agent that turns live EVM observations into policy-checked, tamper-evident decisions and settles those decisions onchain through KeeperHub.

## Problem

AI agents often stop after generating a recommendation. Operators then lack proof that the agent acted, what evidence it used, and whether the action respected a safety policy.

## Solution

ProofPulse reads a live block, verifies that the RPC is connected to the configured chain, evaluates freshness and base-fee conditions using deterministic rules or a local Ollama model, hashes the full evidence bundle, and asks KeeperHub to call a minimal non-payable registry contract. KeeperHub supplies the execution record while the public chain supplies settlement proof.

## KeeperHub integration

The agent invokes `kh execute contract-call` with a fixed chain, registry address, ABI, method, and zero-value argument set. It waits for confirmation and stores the returned transaction hash beside the evidence hash. The integration is real execution, not a mocked transaction.

## Safety and cost

The default network is Sepolia. Mainnet is blocked unless explicitly enabled. The contract cannot receive value through the agent method, and the executor contains no token transfer, approval, trading, deposit, staking, or bridge capability. The default evaluator is free; Ollama inference is local. Automatic writes are disabled for the demo, retries are idempotent per observed block, and a failed KeeperHub response is retained as an audit artifact rather than reported as success.

## Demo flow

1. Show the latest Sepolia block snapshot.
2. Show the AI/rules health decision and evidence hash.
3. Show the deterministic policy fixing chain, contract, method, and zero native value.
4. Execute through KeeperHub and wait for confirmation.
5. Open the transaction in the explorer and read the stored decision.
6. Match the onchain evidence hash to the local run artifact.

## Links to add before submission

- Repository: `TODO`
- Demo video: `TODO`
- Live app or terminal recording: `TODO`
- KeeperHub execution: `TODO`
- Explorer transaction: `TODO`
- Deployed DecisionRegistry: `TODO`
