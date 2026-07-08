# molfi-contracts

Solidity (Foundry) smart contracts for **Molfi** — a private, agent-native prediction market on **HashKey Chain**.

Architecture follows a **verifier / market / application** split: cryptography, resolution, and escrow logic live in separate, independently-auditable contracts. Zero-knowledge is real: **BN254 Groth16** proofs (Circom + snarkjs) verified **on-chain** through HashKey's `alt_bn128` precompiles.

| Contract | Responsibility |
|----------|----------------|
| `verifiers/*` | Auto-generated snarkjs Groth16 verifiers (BN254): `SolvencyVerifier`, `ConfidentialBetVerifier`, `WithdrawVerifier`, `MulVerifier`. Cryptography only. |
| `Market` | Binary market lifecycle `Trading → Resolving → Resolved`. Three resolution paths: admin `resolve`, ZK `resolveWithProof`, and permissionless **`resolveFromOracle`** (multi-asset price feed). |
| `PredictEscrow` | Pari-mutuel YES/NO betting with real mUSDC. `bet` (open) and **`betZk`** (gated on a solvency proof — prove hidden collateral ≥ threshold — with the proof's domain burned as a single-use nullifier). 2% fee → `Vault`. |
| `ConfidentialBet` | Bets whose **side is hidden**: `commit` a Poseidon note, `claim` with a ZK proof where the contract injects the resolved winning outcome as a public input (so losing notes can't prove). |
| `PrivacyPool` | Privacy-Pools-style shielded deposit + proof-gated `withdraw` (Poseidon Merkle membership + nullifier). |
| `MockUSDC` | Testnet mUSDC (6 dp) with an open `faucet`. |
| `MockOracle` | Multi-asset push price oracle (SEP-40-style; keeper-fed). |
| `Vault` | LP / protocol-fee sink. |

## Three ZK mechanisms — all verified on-chain

| Mechanism | Circuit | Public signals | Contract entry |
|---|---|---|---|
| **ZK-gated bet** | `solvency` | `[domain, threshold]` | `PredictEscrow.betZk` |
| **Confidential bet** (hidden side) | `confidential_bet` | `[root, nullifierHash, outcome, recipient]` | `ConfidentialBet.claim` |
| **Privacy pool** withdraw | `withdraw` | `[root, nullifierHash, recipient, amount]` | `PrivacyPool.withdraw` |

Circuits live in [`../molfi-circuits`](../molfi-circuits); `build_bn254.sh` compiles each on BN254 and exports the Solidity verifier via `snarkjs zkey export solidityverifier`.

## Deployed — HashKey Chain testnet (chain 133)

RPC `https://testnet.hsk.xyz` · Explorer `https://testnet-explorer.hsk.xyz`. Addresses in [`deployments/133.json`](deployments/133.json):

| Contract | Address |
|---|---|
| PredictEscrow | `0xDd5782CE36e035709b2e3F640377d3Ec6F1f1dA1` |
| ConfidentialBet | `0x6731FecE71e14155EBA0b11A116a68eA395dd14e` |
| PrivacyPool | `0x4ce8970d2B0FbFd478e857F603Fc7526E0CC989a` |
| Market | `0xd3f3c363CF22eD8DbAB26b9De5b12340D3816C49` |
| MockOracle | `0x5439778405627512eAae2210b2584D6A9B4D517B` |
| mUSDC | `0xCcCe188934316cE9ea6f8237F7e6249aB2E0C903` |
| Vault | `0x6F1Bd7d424AB69B9F3689Cee208863Ce0B27f784` |
| SolvencyVerifier | `0xb70F0Bc326C93793AACC7d8877Af911E2E73e69b` |
| ConfidentialBetVerifier | `0x412A3825052feF744DBd80b4f714F1546EA8D25d` |
| WithdrawVerifier | `0x955C8FE38d010F3132a9679B9e2489698345e967` |
| MulVerifier | `0x223ccE84DB36b239a91d224C2A28DF9874de5Db1` |

## Build & test

```bash
forge build
```

## Deploy

```bash
# testnet (chain 133)
forge script script/Deploy.s.sol:Deploy --rpc-url https://testnet.hsk.xyz --broadcast --slow

# mainnet (chain 177) — needs HSK for gas on the deployer
./deploy-mainnet.sh
```

## Prove all three ZK flows on-chain (one command)

```bash
cd scripts && npm install && cd ..
node scripts/zk_lifecycle.mjs testnet   # or: mainnet
```

Generates fresh BN254 Groth16 proofs and drives the whole lifecycle with live transactions:
price market → **ZK-gated bet** (solvency proof) → oracle resolve → pari-mutuel redeem →
**confidential claim** (hidden side) → **privacy-pool withdraw**. Prints every tx hash.
A recorded run is in [`deployments/lifecycle-133.json`](deployments/lifecycle-133.json).
