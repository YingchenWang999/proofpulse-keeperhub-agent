# Verified Sepolia deployment and execution

Verification date: 2026-07-19 (Asia/Shanghai)

## DecisionRegistry deployment

- Chain: Ethereum Sepolia (`11155111`)
- Contract: [`0xa64c51b5D542649D47c8F5487D5E296F1216B788`](https://sepolia.etherscan.io/address/0xa64c51b5D542649D47c8F5487D5E296F1216B788)
- Deployment transaction: [`0x3bae091e94ae1e5d5166ca747797eeccb833acdedce6847b2f755539508223df`](https://sepolia.etherscan.io/tx/0x3bae091e94ae1e5d5166ca747797eeccb833acdedce6847b2f755539508223df)
- KeeperHub execution ID: `tsch9i62ny0zwdcwaefrr`
- Factory: ERC-2470 Singleton Factory at `0xce0042B868300000d44A59004Da54A005ffdcf9f`
- Salt: `0xc0d49599efc445fa908995617b9329ab69b2c45959830bc977b7ba1b2ee1baaa`
- Runtime size: 1,752 bytes
- Runtime SHA-256: `0xde8fde31105f34d65c02ad2e5b3a425a9dd82f5428a6725a8d5a845114157683`
- Receipt status: `1`
- KeeperHub sponsorship: `true`
- Gas used: 497,324
- Native value: `0`

The predicted CREATE2 address was checked for empty code before submission. After deployment, the code fetched from Sepolia produced the exact same SHA-256 as the locally compiled runtime.

## ProofPulse decision execution

- KeeperHub organisation wallet/recorder: `0xfE40333a96225D1474d1456180975B2B2B7ee794`
- KeeperHub execution ID: `42y70sy5vrb2k8hhlafpz`
- Transaction: [`0x830da04e05873465cc20a59875ccd43c6dbba255831d1af8b6344a742e3ae71a`](https://sepolia.etherscan.io/tx/0x830da04e05873465cc20a59875ccd43c6dbba255831d1af8b6344a742e3ae71a)
- Run ID: `0xdc00ff4b0bcba4822e7c20ad37c6617afc7322765122b3f1cbf17afbb72a4c05`
- Evidence hash: `0x6537c212e24198dfc7297f72f3c3082c12f5d136d32ba87d17d7f238c882e8fd`
- Observed block: 11,302,806
- Recorded status: `1` (healthy)
- Confidence: `9500` basis points
- Summary: `block freshness and base fee are within policy limits`
- Receipt status: `1`
- KeeperHub sponsorship: `true`
- Gas used: 162,456
- Native value: `0`

## Independent state read-back

Calling `decisions(recorder, runId)` returned the recorder above, the exact status, confidence, evidence hash, and summary. This verifies that the decision was not merely accepted by an API: it was settled in the registry on Sepolia.

## Response reconciliation note

The initial KeeperHub CLI response contained a terminal execution ID but omitted the transaction hash, so the original local artifact correctly recorded a failure instead of guessing success. A subsequent read-only execution-status lookup returned the successful receipt and transaction hash, and an independent RPC receipt plus contract state read-back confirmed settlement. The client now handles this response shape automatically and retains the strict rule that both execution ID and transaction hash are required.
