# Molfi Roadmap

> Private prediction markets on HashKey Chain · `molfi.fun`
> Companion to [`MOLFI_MIGRATION_PLAN.md`](MOLFI_MIGRATION_PLAN.md). High-level phases here; granular tasks in [`TODO.md`](TODO.md).

## Vision
A Polymarket-style CLOB prediction market on **HashKey Chain (EVM)** where **positions are confidential** — prove a valid, in-the-money position and exit without revealing identity or full holdings (Privacy-Pools pattern + on-chain Groth16 verification).

## Status at a glance
Contract suite built and tested with **Foundry** (`forge test`); **five Solidity
contracts deployed to HashKey Chain testnet (chainId 133, RPC
`https://testnet.hsk.xyz`)** with a **real BN254 Groth16 proof verified
on-chain** (via the `alt_bn128` precompiles) and a confidential
deposit→withdraw flow run end-to-end (real tx hashes in the top-level
[`README.md`](README.md); addresses in `molfi-contracts/deployments/133.json`);
oracle settlement works; the app connects via **MetaMask**.

## Phases

### ✅ Phase 0 — Workspace
Cloned landing, copied app → `molfi-predict-app`, scaffolded `@molfi/predict-sdk`, wrote migration plan.

### ✅ Phase 1 — Rebrand the app for HashKey
`molfi-predict-app` targets HashKey Chain: legacy multi-chain wallet stack removed, **MetaMask** wired through a single reactive `useWallet`, network pinned to HashKey Chain (chainId 133), shell rebranded. Builds green.

### ✅ Phase 2 — On-chain core *(contracts done; deploy live)*
- `molfi-contracts` (Foundry) workspace: `Verifier`, `PrivacyPool`, `Market`, `ClobSettlement`, `Policy` — security-hardened, compiled.
- **Settlement wired**: `deposit` (account model) → `settle` (ECDSA / EIP-712 signatures + nonce guards + escrow + positions) → `redeem` (market + verifier cross-calls + payout). E2e test bets, settles, and pays the winner.

### ✅ Phase 2.5 — Oracle resolution (BTC & price markets)
- Push price-oracle interface (HashKey MockOracle / Chainlink-style feed) in `Market`.
- `createPriceMarket` + permissionless `resolveFromOracle` (price vs threshold + staleness), alongside admin and ZK resolution paths.
- E2e tests: BTC ≥ $100k settles from the oracle and pays the winner; NO case; stale-price rejection.

### ✅ Phase 3 — Privacy layer (the hook) *(real proof routed end-to-end)*
- ✅ `Verifier` (Groth16 / BN254), `PrivacyPool` (commitment tree + nullifiers + `registerRoot`), `Policy` (ASP membership).
- ✅ **Real circom + snarkjs (BN254) pipeline** in `molfi-circuits/`: `solvency` (balance ≥ threshold, hidden) and `withdraw` (Poseidon Merkle membership + nullifier).
- ✅ **Real proofs verify on-chain** on `Verifier` via the `alt_bn128` precompiles: solvency + membership accepted, tampered rejected.
- ✅ **`PrivacyPool.withdraw` gated by a real proof end-to-end**: deposit → operator checkpoints root → withdraw unlocked by genuine proof → nullifier burned → double-spend rejected.
- ⏳ Pending: on-chain Poseidon tree to retire off-chain `registerRoot`; cryptographic recipient/amount binding; SDK `generateExitProof`; app confidential deposit→exit flow.

### Phase 4 — Demo polish
- Negative-path tests (tampered proof ✅, stale nonce ✅, double-spend nullifier ✅) — expand coverage.
- Landing + app + 90s demo. Mainnet checklist for HashKey Chain mainnet (chainId 177).

## Repos
| Repo | Role | Status |
|------|------|--------|
| `molfi-predict-landing` | Marketing site (Next.js) | HashKey rebrand ✅ |
| `molfi-predict-app` | Trading dApp (React/Vite) | P1 ✅; SDK wiring pending |
| `molfi-predict-sdk` | Order signing + proof gen (TS) | scaffolded; signer/proof wiring pending |
| `molfi-contracts` | Solidity contracts (Foundry) | P2/2.5 ✅, P3 proofs ✅ |
| `molfi-circuits` | Circom + Groth16 (BN254) | `solvency`, `withdraw` ✅ |
