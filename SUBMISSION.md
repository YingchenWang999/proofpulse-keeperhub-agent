# ProofPulse submission draft

## One-line description

ProofPulse is a zero-principal chain-health agent that turns live EVM observations into policy-checked, tamper-evident decisions and settles those decisions onchain through KeeperHub.

## Problem

AI agents often stop after generating a recommendation. Operators then lack proof that the agent acted, what evidence it used, and whether the action respected a safety policy.

## Solution

ProofPulse reads a live block, verifies that the RPC is connected to the configured chain, evaluates freshness and base-fee conditions using deterministic rules or a local Ollama model, hashes the full evidence bundle, and asks KeeperHub to call a minimal non-payable registry contract. KeeperHub supplies the execution record while the public chain supplies settlement proof.

## KeeperHub integration

The agent invokes `kh execute contract-call` with a fixed chain, registry address, ABI, method, and zero-value argument set. It waits for confirmation and stores the returned transaction hash beside the evidence hash. If KeeperHub returns the completed execution ID before the hash, the agent reconciles it through the read-only status command and still requires both identifiers. The integration is real execution, not a mocked transaction.

## Safety and cost

The default network is Sepolia. Mainnet is blocked unless explicitly enabled. The contract cannot receive value through the agent method, and the executor contains no token transfer, approval, trading, deposit, staking, or bridge capability. The default evaluator is free; Ollama inference is local. Automatic writes are disabled for the demo, retries are idempotent per observed block, and a failed KeeperHub response is retained as an audit artifact rather than reported as success.

## Demo flow

1. Show the latest Sepolia block snapshot.
2. Show the AI/rules health decision and evidence hash.
3. Show the deterministic policy fixing chain, contract, method, and zero native value.
4. Execute through KeeperHub and wait for confirmation.
5. Open the transaction in the explorer and read the stored decision.
6. Match the onchain evidence hash to the local run artifact.

## Verified links and identifiers

- Hackathon: <https://dorahacks.io/hackathon/agents-onchain>
- DoraHacks BUIDL: <https://dorahacks.io/buidl/47244>
- Repository: <https://github.com/YingchenWang999/proofpulse-keeperhub-agent>
- KeeperHub execution: `42y70sy5vrb2k8hhlafpz`
- Explorer transaction: <https://sepolia.etherscan.io/tx/0x830da04e05873465cc20a59875ccd43c6dbba255831d1af8b6344a742e3ae71a>
- Deployed DecisionRegistry: <https://sepolia.etherscan.io/address/0xa64c51b5D542649D47c8F5487D5E296F1216B788>
- Deployment transaction: <https://sepolia.etherscan.io/tx/0x3bae091e94ae1e5d5166ca747797eeccb833acdedce6847b2f755539508223df>
- Run ID: `0xdc00ff4b0bcba4822e7c20ad37c6617afc7322765122b3f1cbf17afbb72a4c05`
- Evidence hash: `0x6537c212e24198dfc7297f72f3c3082c12f5d136d32ba87d17d7f238c882e8fd`
- Demo video: <https://youtu.be/XnZ4nJUDMVw>

## Verified result

The Sepolia receipt has status `1`. KeeperHub marked the execution sponsored and reported 162,456 gas used. The call sent zero native value. Reading the registry back for the KeeperHub organisation wallet and run ID returns status `1`, confidence `9500`, the exact evidence hash above, and the summary `block freshness and base fee are within policy limits`.
