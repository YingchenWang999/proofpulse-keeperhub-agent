# ProofPulse demo recording script

Target length: 75–90 seconds.

## Recording order

1. Open the repository README and state: “ProofPulse is a zero-principal chain-health agent. It can only record a non-payable decision on Sepolia.”
2. In the terminal, load `.env` and run `npm run check`. Show all 37 tests passing.
3. Run `npm run demo`. Point out chain `11155111`, the registry address, `nativeValueWei: 0`, the decision, and the evidence hash. Do not run another live transaction.
4. Open the successful [record transaction](https://sepolia.etherscan.io/tx/0x830da04e05873465cc20a59875ccd43c6dbba255831d1af8b6344a742e3ae71a). Show successful status and zero transaction value.
5. Open the [DecisionRegistry](https://sepolia.etherscan.io/address/0xa64c51b5D542649D47c8F5487D5E296F1216B788) and the repository's `DEPLOYMENT.md`. Match the execution ID, run ID, and evidence hash.
6. End with: “KeeperHub sponsored and settled the real transaction; ProofPulse moved no user principal.”

## Submission caption

ProofPulse observes live Sepolia conditions, applies deterministic safety policy, hashes the evidence, and records the decision through KeeperHub. The demo shows the dry-run intent, successful sponsored transaction, and independently verified registry state. No token approval, transfer, trade, stake, deposit, bridge, or native-value payment exists in the execution path.
