<div align="center">

# Molfi — Migration & Architecture Plan
### Private prediction markets on HashKey Chain · `molfi.fun`

</div>

> Forked from the Predifi app architecture (React/Vite + Supabase + off-chain CLOB).
> This document is the agreed shape of the system. Privacy is the headline
> feature; the CLOB prediction market is the substrate it runs on.

---

## 0. TL;DR

Molfi is a **private prediction market on HashKey Chain (EVM)**:

- **molfi-predict-landing** — Next.js marketing site (branded `molfi`, HashKey Chain). Minimal change.
- **molfi-predict-app** — React/Vite trading app. Pin to HashKey Chain, connect via **MetaMask**, talk to contracts through `viem`/`ethers` + `@molfi/predict-sdk`.
- **molfi-predict-sdk** — `@molfi/predict-sdk`. Canonical CLOB order construction, EIP-712 signing, and **client-side ZK proof generation**.
- **molfi-contracts** *(Solidity / Foundry)* — Market + CLOB settlement + **Groth16 verifier** + **Privacy Pool**.

**The hook:** positions are confidential. You can prove "I hold a valid YES position in market X and I'm exiting `n` shares" without revealing your full position or identity, using a Privacy-Pools-style commitment tree + on-chain Groth16 verification. Deposits/withdrawals are visible; in-pool trading is private.

---

## 1. Repository roles

| Repo | Stack | Role | Load |
|------|-------|------|------|
| `molfi-predict-landing` | Next.js 16, Tailwind | Marketing, waitlist, docs entry | **Low** — already `molfi`; copy targets "private prediction markets on HashKey Chain" |
| `molfi-predict-app` | React 18 + Vite + shadcn/ui + Supabase | The trading dApp | **High** — wallet layer pinned to HashKey/MetaMask |
| `molfi-predict-sdk` | TypeScript lib | Order signing + proof gen, shared by app/bots/3rd-parties | **New** — scaffolded |
| `molfi-contracts` | Solidity + Foundry | On-chain markets, settlement, ZK verifier, privacy pool | **New** — to scaffold |

---

## 2. Target architecture

```
                       molfi-predict-landing (Next.js)
                                   │  "Launch app"
                                   ▼
┌──────────────────────────── molfi-predict-app (React/Vite) ───────────────────────────┐
│  MetaMask  ──connect/sign──►  @molfi/predict-sdk                                        │
│  (EVM signer)                 • buildOrder / canonicalize                               │
│                               • signOrder (EIP-712 over canonical hash)                 │
│                               • generateExitProof (WASM, client-side)                   │
│  React Query · shadcn/ui · Supabase (off-chain user/vault/notify data, edge fns)       │
└───────────────┬───────────────────────────────────────────────┬───────────────────────┘
                │ signed orders (REST/WS)                         │ signed EVM txs
                ▼                                                 ▼
        Matching API (off-chain CLOB)                 HashKey Chain RPC (testnet 133 → mainnet 177)
        • orderbook, matching, risk                               │
        • batches fills for settlement ──────────────────────────►│
                                                                  ▼
                              ┌────────────── molfi-contracts (Solidity) ─────────────┐
                              │  Market         — lifecycle, outcomes, resolution      │
                              │  ClobSettlement — verify matched-order sigs, settle    │
                              │  Verifier       — Groth16 (BN254) ONLY                 │ ← narrow audit surface
                              │  PrivacyPool    — commitment Merkle tree, nullifiers   │
                              │  Policy         — compliance/ASP allow-deny, limits    │
                              └────────────────────────────────────────────────────────┘
```

Design rule: **verifier / policy / application are separate contracts.** The verifier does cryptography only (Groth16 over BN254 via the `alt_bn128` precompiles); policy does risk/compliance; the market/pool does state transitions after both pass.

---

## 3. Predifi → Molfi (HashKey) mapping

| Today (Predifi) | Tomorrow (Molfi) | Notes |
|-----------------|------------------|-------|
| multi-chain `wagmi`/`viem`/`ethers` | `viem` + `ethers` pinned to HashKey Chain | tx build/submit, RPC `https://testnet.hsk.xyz` |
| scattered `ethers` usage | centralized in `@molfi/predict-sdk` | one place for tx/proof helpers |
| Alchemy Account Kit (`@account-kit/*`) | MetaMask key wallets (smart accounts optional, stretch) | start with EOA wallets |
| Dynamic Labs (`@dynamic-labs/*`, incl. **Solana**) | **MetaMask** | single EVM signer, HashKey Chain |
| EIP-712 order signing (`useEIP712Signature`) | EIP-712 sign over canonical order hash | now lives in `@molfi/predict-sdk` |
| Solidity ^0.8.25 + OZ UUPS (multi-chain) | Solidity + Foundry + OZ, deployed to HashKey Chain | upgradeable via UUPS/transparent proxy |
| Stork Oracle | HashKey push oracle (MockOracle / Chainlink-style feed) or admin resolution | resolution source for market settlement |
| GMX SDK (`@gmx-io/sdk`) | **remove** | perps integration is out of scope for v1 |
| Optimism / BSC chains | HashKey Chain testnet (133) → mainnet (177) | single network |

**Solana removal is trivial:** the only chain-level coupling is the `@dynamic-labs/solana` dependency. The other `"Solana"` strings are just **market topics** ("Solana to flip BNB?") and are fine to keep as prediction content.

---

## 4. Privacy layer — the hook

Pattern: **Privacy Pools** (Buterin/Soleimani et al.), adapted to predictions, on EVM (Circom + Groth16 + Solidity verifier).

**Flow:**
1. **Deposit (public):** trader deposits collateral (**mUSDC**, 6 decimals) into `PrivacyPool`, which inserts a commitment `C = Poseidon(secret, nullifier, amount, market)` into a Merkle tree. The deposit is visible; the link to future positions is not.
2. **Trade (private):** orders carry a commitment to the position, not the identity. Matching happens off-chain on the CLOB; the SDK signs canonical orders (EIP-712).
3. **Exit / settle (private):** to withdraw winnings, the trader generates a **Groth16 proof** *client-side in WASM* proving:
   - knowledge of `(secret, nullifier)` for a commitment in the tree (Merkle membership),
   - the position resolved in-the-money for the market's outcome,
   - the nullifier is unspent,
   without revealing which deposit it was. `Verifier` checks the proof (BN254 via `alt_bn128` precompiles); `PrivacyPool` burns the nullifier and pays out.
4. **Compliance:** `Policy` holds an ASP (Association Set Provider) allow/deny root so the pool can stay compliant (the Privacy Pools thesis) — membership proofs gate deposits.

**On-chain crypto:**
- BN254 pairing / EC ops are native EVM precompiles (`alt_bn128` add / mul / pairing at `0x06`/`0x07`/`0x08`) — no protocol upgrade needed on HashKey Chain.
- Poseidon runs inside the circuit; the Solidity side compares the public root / nullifierHash outputs.
- Every proof statement **binds a nonce/market/action** for anti-replay; nullifiers persist as replay guards.

**Circuit tooling:** Circom + Groth16 (snarkjs) — fast to build, cheap to verify on-chain via the BN254 precompiles.

---

## 5. `@molfi/predict-sdk` (scaffolded)

Already created: `buildOrder`, `canonicalize`, `MolfiClient.signOrder/submitOrder`, types, `Signer` interface.

**Next additions:**
- `EvmKeypairSigner` and `MetaMaskSigner` implementing `Signer` (ECDSA / secp256k1, EIP-712).
- `generateExitProof(input)` — wraps the WASM prover (snarkjs/Circom artifacts) for client-side proof gen.
- `buildSettlementTx` / `buildExitTx` — assemble EVM contract calls.
- Replace placeholder SHA-256 order hash with **Poseidon** so the same hash is reproducible inside the circuit and on-chain.

---

## 6. `molfi-contracts` (Solidity / Foundry, to scaffold)

```
molfi-contracts/
├── foundry.toml               # workspace
├── src/
│   ├── Market.sol             # lifecycle: create, trade-window, resolve, payout-ratio
│   ├── ClobSettlement.sol     # verify maker/taker sigs, move collateral, settle fills
│   ├── Verifier.sol           # Groth16 verify ONLY (BN254) — narrow audit
│   ├── PrivacyPool.sol        # commitment Merkle tree + nullifier set + deposit/exit
│   └── Policy.sol             # ASP allow/deny root, position/risk limits
└── deployments/133.json       # canonical testnet addresses
```
Generate `Verifier.sol` from the snarkjs Groth16 export (`snarkjs zkey export solidityverifier`). Use OpenZeppelin Solidity contracts for ownable/upgradeable/pausable scaffolding (`openzeppelin-skills:setup-solidity-contracts`).

---

## 7. Phased roadmap

**Phase 0 — Workspace (DONE)**
- [x] Clone landing, copy app → `molfi-predict-app`, scaffold `molfi-predict-sdk`, write this plan.

**Phase 1 — Rebrand the app for HashKey**
- [ ] Pin the wallet layer to HashKey Chain + **MetaMask**; remove legacy multi-chain SDKs (Dynamic Labs / Solana), GMX services/pages.
- [ ] Replace `PredifiWalletContext` → `MolfiWalletContext` backed by MetaMask.
- [ ] Rebrand: name, logo, copy, `molfi.fun`, env keys (`VITE_HASHKEY_*`).
- [ ] App builds & runs with a connect-wallet flow on HashKey testnet. *(Compiles green = gate.)*

**Phase 2 — On-chain core**
- [ ] Scaffold `molfi-contracts`: `Market` + `ClobSettlement`, deploy to testnet via `forge script`.
- [ ] SDK: `MetaMaskSigner`, `buildSettlementTx`; app places a real (public) order end-to-end.

**Phase 3 — Privacy layer (the hook)**
- [ ] `Verifier` (snarkjs Groth16 export) + `PrivacyPool` (commitment tree + nullifiers) + `Policy`.
- [ ] Circom circuit + WASM prover; SDK `generateExitProof`; Poseidon order/commitment hashing.
- [ ] Confidential deposit → private exit demo flow in the app.

**Phase 4 — Polish for demo**
- [ ] Negative-path tests (tampered proof, stale nonce, double-spend nullifier).
- [ ] Landing page + app + a 90s demo. Deploy checklist for HashKey Chain mainnet (chainId 177).

---

## 8. Open questions

1. **Circuit stack:** Circom+Groth16 (fast, cheap BN254 verify) vs Noir/UltraHonk (friendlier DSL)? *Default: Circom+Groth16.*
2. **Collateral asset:** mUSDC (6 decimals) vs a mock token? *Default: mUSDC.*
3. **Resolution oracle:** admin-resolved for the hackathon vs push price feed (MockOracle / Chainlink-style)? *Default: admin-resolved v1, oracle as stretch.*
4. **Smart wallets / account abstraction:** start with EOA/MetaMask and add smart accounts later? *Default: yes, key wallets first.*
5. **Matching engine:** reuse Predifi's off-chain CLOB API as-is (just re-point), or stub a minimal matcher? *Need to confirm what API the app currently calls.*
