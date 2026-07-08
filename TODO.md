# Molfi TODO

Granular checklist. Phases mirror [`ROADMAP.md`](ROADMAP.md).

## Phase 0 — Workspace ✅
- [x] Clone landing → `molfi-predict-landing`
- [x] Copy predifi app → `molfi-predict-app`
- [x] Scaffold `@molfi/predict-sdk` (buildOrder, canonicalize, MolfiClient, types)
- [x] Write `MOLFI_MIGRATION_PLAN.md`, `ROADMAP.md`, `TODO.md`

## Phase 1 — Rebrand the app for HashKey 🔨
**Dependencies**
- [ ] `package.json`: remove legacy multi-chain wallet SDKs (Dynamic Labs / Solana connectors)
- [ ] `package.json`: keep/standardize `viem` + `ethers` for EVM; add `@molfi/predict-sdk`
- [ ] `npm install` — confirm lockfile resolves

**Wallet layer**
- [ ] `src/lib/hashkey/client.ts` — viem/ethers client pinned to HashKey Chain (chainId 133, RPC `https://testnet.hsk.xyz`)
- [ ] Rewrite `src/hooks/useWallet.ts` → MetaMask (address `0x…`, isConnected, connect, disconnect, signTransaction; add-network helper for HashKey Chain)
- [ ] `src/components/WalletButton.tsx` — MetaMask connect/disconnect button

**Remove legacy multi-chain imports**
- [ ] `src/App.tsx` — drop legacy provider wrappers; use a single HashKey/MetaMask provider
- [ ] `src/hooks/useTransactions.ts` — target HashKey Chain via viem/ethers
- [ ] `src/hooks/useRouterAccount.ts` — stub inert state (no CREATE2 router in v1)
- [ ] `src/pages/MobileAuthBridge.tsx` — MetaMask mobile deep-link / WalletConnect

**Signing**
- [ ] `src/hooks/useEIP712Signature.ts` — rewire to `@molfi/predict-sdk` (EIP-712 order signing)

**Rebrand shell**
- [ ] `index.html` — title/meta/OG → Molfi
- [ ] App name + visible "Predifi" strings → "Molfi"
- [ ] `.env.template` — `VITE_HASHKEY_CHAIN_ID=133`, `VITE_HASHKEY_RPC_URL=https://testnet.hsk.xyz`

**Gate**
- [ ] App builds green (`npm run build`)
- [ ] Connect MetaMask on HashKey Chain testnet end-to-end in dev

## Phase 2 — On-chain core
- [x] Scaffold `molfi-contracts` (Foundry) + `Market`, `ClobSettlement`
- [x] Wire settlement flow: `deposit` (account model) → `settle` (ECDSA / EIP-712 + nonce guards + escrow + positions) → `redeem` (market outcome cross-call + ZK proof + payout)
- [x] Cross-contract wiring: settlement→market (`winningOutcome`), settlement→verifier, market→verifier (`resolveWithProof`)
- [x] `forge test` green: unit suites + e2e integration incl. bet→settle→win
- [x] Compile all 5 contracts
- [x] **Deployed all 5 to HashKey Chain testnet** + ran ZK withdrawal & market lifecycle on-chain (addresses + tx hashes in top-level README.md / `molfi-contracts/deployments/133.json`)
- [x] **Full BTC market bet on testnet** (Alice YES vs Bob NO): deposit → settle (real EIP-712 orders) → resolve → redeem; Alice won the pot, Bob's claim rejected
- [x] Simplified `Clob.redeem` to outcome+position (CLOB is the transparent venue; ZK lives in the pool) — removed the unneeded proof gate
- [x] **Frontend wired to live contracts** — `/demo` page reads market outcome + submits a deposit tx via MetaMask (`src/services/molfi.ts`, `src/config/molfi.ts`, `src/pages/MolfiDemo.tsx`)
- [ ] Wire the remaining trading screens to the contracts; remove residual legacy EVM/perps UI

## Phase 2.5 — Oracle resolution (BTC & price markets) ✅
- [x] Push-oracle `Asset`/`PriceData` types + `OracleClient` in `Market` (MockOracle / Chainlink-style feed)
- [x] `createPriceMarket` + permissionless `resolveFromOracle` (price vs threshold, staleness guard)
- [x] Kept admin `resolve` + ZK `resolveWithProof` paths
- [x] Integration tests: BTC≥100k oracle settlement pays winner, NO case, stale-price rejection
- [ ] Point at the production price feed address on deploy

## Phase 3 — Privacy layer (the hook)
- [x] `Verifier` contract — Groth16 over BN254 (via `alt_bn128` precompiles), domain-bound, admin VK
- [x] `PrivacyPool` — commitment Merkle tree + nullifier set, verifier cross-call
- [x] `Policy` — ASP allow-list root + deposit limits
- [x] **Real Circom circuits + BN254 Groth16 keys** (`molfi-circuits/`): `solvency` (balance≥threshold, balance hidden) + `mul` canary
- [x] **Real proof verifies on `Verifier` on-chain** (replaces mock): genuine proof accepted, tampered input rejected
- [x] snarkjs→Solidity calldata converter (`scripts/to_calldata.mjs`)
- [x] **Poseidon Merkle-membership + nullifier circuit** (`withdraw.circom`, depth 8); root/nullifierHash as outputs so no field-specific JS hashing needed
- [x] **Real membership proof verifies on `Verifier`**
- [x] **`PrivacyPool.withdraw` routes the REAL proof end-to-end** — `registerRoot` (off-chain Poseidon tree checkpoint) + verify via real verifier + nullifier burn + payout. Test: deposit→register→withdraw→paid, double-spend rejected.
- [ ] On-chain Poseidon tree (remove the off-chain root-registration trust) — Solidity Poseidon or dedicated verifier variant
- [x] Bind **amount** in the pool — `withdraw` requires the proof's amount signal == payout; `AmountMismatch` rejects mismatches (tested)
- [ ] Bind **recipient** in the pool (front-running guard) — intrinsically client-side: the prover sets `recipient = H(withdrawal address)`, so this lands with `generateExitProof`
- [x] SDK: contract-aligned CLOB order signing — `signClobOrder` byte-matches `ClobSettlement.canonicalOrderBytes`; `EvmKeypairSigner` (ECDSA / secp256k1)
- [ ] SDK `generateExitProof` (wrap snarkjs/wasm prover) so the app produces proofs client-side
- [ ] App: confidential deposit → private exit flow

## Phase 4 — Demo polish
- [ ] Negative-path tests (tampered proof, stale nonce, double-spend nullifier)
- [ ] Resolution oracle decision (admin v1 vs push price feed)
- [ ] Landing copy + app polish + 90s demo
- [ ] Mainnet checklist (HashKey Chain mainnet, chainId 177)

## Open decisions (defaults in plan §8)
- [ ] Circuit stack: Circom+Groth16 *(default)* vs Noir/UltraHonk
- [ ] Collateral: mUSDC (6 decimals) *(default)* vs mock token
- [ ] Resolution: admin v1 *(default)* vs push oracle
- [ ] Matching engine: re-point Predifi CLOB API vs stub — **need to confirm current API**
