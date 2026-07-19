# Security model

## Protected assets

ProofPulse is deliberately designed not to manage assets. Its only onchain output is a decision record containing hashes, status, confidence, and a short summary.

## Hard controls

1. Sepolia and Base Sepolia are the only default-allowed chain IDs.
2. A single configured contract address is allowlisted.
3. `recordDecision` is the only callable method.
4. The method is non-payable; no native value argument is emitted.
5. Token approvals, transfers, swaps, deposits, staking, bridging, and arbitrary calldata are absent from the executor.
6. Local-model output is untrusted data and passes through deterministic validation.
7. Summaries are bounded to 240 UTF-8 bytes both offchain and onchain.
8. Duplicate run IDs revert onchain.
9. Live execution requires an explicit `DRY_RUN=false` override.
10. Automatic anomaly writes require a second explicit `AUTO_RECORD=true` opt-in.
11. The RPC-reported chain ID must match `CHAIN_ID`, and implausible future block timestamps are rejected.
12. RPC, Ollama, and KeeperHub child-process operations have finite timeouts. RPC transport, rate-limit, and server failures receive at most three attempts; deterministic JSON-RPC errors are not retried.
13. Ollama is restricted to loopback hosts so local observations are not sent to an unintended paid or remote service.
14. Run IDs are deterministic per agent, chain, block, and evaluator; contract storage scopes them by recorder to prevent cross-account preemption.
15. A live KeeperHub result is accepted only when status is `completed` and both the execution ID and transaction hash are present. If the initial completed response omits the hash, one read-only status lookup reconciles it before validation.
16. The configured registry address must contain deployed bytecode on the same RPC/chain before any KeeperHub call is built; its code size and SHA-256 are included in evidence. Live mode requires the operator to pin the hash reviewed during dry-run and rejects changed bytecode.

## Remaining risks

- A malicious or compromised RPC can provide false observations. The resulting record is still only an attestation and cannot move assets.
- An operator can configure the wrong contract address. The dry-run review and environment check mitigate this; the address must be verified in the explorer before live execution.
- KeeperHub credentials can authorize actions outside this repository. Store them only in the OS keychain or environment and use a dedicated least-privilege organisation. The project never writes credentials into artifacts or tracked files.
- A mainnet transaction may consume gas credits. Mainnet is blocked by default and is unnecessary for development.
- Setting `AUTO_RECORD=true` can consume the available execution/gas allowance during sustained anomalies. It is intentionally disabled for the demo.
