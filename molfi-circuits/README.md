# molfi-circuits

Circom ZK circuits for **Molfi** on **HashKey Chain**, compiled to **BN254** so their Groth16
proofs verify on-chain through the EVM `alt_bn128` precompiles.

| Circuit | Statement | Public signals | On-chain consumer |
|---|---|---|---|
| `solvency` | hidden `balance ≥ threshold` (64-bit range) | `[domain, threshold]` | `PredictEscrow.betZk` |
| `confidential_bet` | Merkle membership of a note whose `outcome` == winner + nullifier | `[root, nullifierHash, outcome, recipient]` | `ConfidentialBet.claim` |
| `withdraw` | Merkle membership + nullifier (privacy-pool exit) | `[root, nullifierHash, recipient, amount]` | `PrivacyPool.withdraw` |
| `mul` | domain-bound `a*b == c` (verifier smoke test) | `[domain, c]` | `Market.resolveWithProof` |

## Build (BN254 → Solidity verifier)

```bash
npm install                                   # circomlib
CIRCOM=/path/to/circom scripts/build_bn254.sh <circuit> [ptau_power]
```

Each run compiles the circuit on BN254, runs a shared powers-of-tau + Groth16 setup, produces a
real proof, verifies it off-chain, and exports:

- `build_evm/<circuit>/verifier.sol` — a snarkjs Groth16 verifier (copied + renamed into
  `molfi-contracts/src/verifiers/`).
- `build_evm/<circuit>/calldata.txt` — Solidity calldata for a sample proof.

Requires **circom 2.x** (the Rust compiler) and `snarkjs`. `circomlib` is installed via npm.
