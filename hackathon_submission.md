# Molfi — HashKey Chain On-Chain Horizon Hackathon Submission

**Molfi is a private, agent-native prediction market on HashKey Chain.** You bet on real-world
outcomes; your *side* stays hidden on-chain, proven with zero-knowledge; and **AI agents can
trade it end-to-end from a single skill file** — generate a wallet, fund themselves, place a
ZK-verified bet, and redeem — with no human in the loop.

- **Track:** DeFi × AI
- **Network:** HashKey Chain **testnet** (chain 133) — mainnet deploy staged (`deploy-mainnet.sh`)
- **Live:** Solidity contracts + backend keeper + web app + autonomous-agent SDK, all hitting real deployed contracts

---

## 1. Why this fits DeFi × AI

- **DeFi:** on-chain financial infrastructure — a pari-mutuel prediction-market venue with real
  mUSDC escrow, a 2% LP fee, an oracle-settled market lifecycle, and an LP vault. It is a
  self-sustaining venue: a keeper rolls fresh 15m/30m crypto markets and settles them from a
  multi-asset on-chain price feed, permissionlessly.
- **AI:** the venue is **agent-native**. An LLM agent reads one `SKILL.md`, spins up a HashKey
  wallet, funds itself from the mUSDC faucet, and autonomously places **ZK-verified** bets and
  redeems — the "AI-driven intelligent trading" the track calls for, with the privacy guarantees
  an automated trader needs (its balance and its side stay hidden on-chain).
- **HSP:** settlement runs on **HSP (HashKey Settlement Protocol)** — the recommended DeFi rail.
  An agent pays a verifiable micro-fee via HSP to unlock the privacy primitive it needs (the ZK
  proof service, behind an x402 paywall); the fee settles zero-custody to the protocol vault and
  is independently verifiable. See §2.5.

---

## 2. Three real ZK mechanisms — all verified on-chain

Everything below is a **BN254 Groth16 proof verified inside a HashKey transaction** by an
auto-generated snarkjs verifier contract (using the `alt_bn128` precompiles). Circuits are
Circom + snarkjs, compiled to BN254 (`molfi-circuits/scripts/build_bn254.sh`).

| Mechanism | What it proves | Circuit | Contract |
|---|---|---|---|
| **ZK-gated bet** (`betZk`) | hidden collateral **≥ threshold** (a *solvency* proof — your balance never appears on-chain) + single-use **nullifier** (the proof's domain, burned) | `solvency` | `PredictEscrow` |
| **Confidential bet** | your **side is hidden** — commit a Poseidon note, then prove in ZK you backed the *resolved winner* (the contract injects the winner as a public input, so a losing note can't produce a valid proof), redeem unlinkably | `confidential_bet` | `ConfidentialBet` |
| **Privacy pool** | Poseidon Merkle membership + nullifier withdraw (Tornado-style shielded exit) | `withdraw` | `PrivacyPool` |

**Proven live on HashKey testnet.** `node molfi-contracts/scripts/zk_lifecycle.mjs testnet`
generates fresh proofs and drives the whole thing with real transactions. A recorded run
(`molfi-contracts/deployments/lifecycle-133.json`):

| Flow | tx |
|---|---|
| ZK-gated bet (`betZk`, solvency Groth16 + nullifier) | `0xeeee3a620013bf82a49d2b5792da8fc8d5efd15defd960864fb146815c6df683` |
| Oracle resolve (`resolveFromOracle`) | `0xea9364364e337b7ddb5ad4435ceff2930fa66b80848080cd955d9d407699d867` |
| Pari-mutuel redeem | `0x9fda16467af9ef8cbb90a25d86f9d3963d1f716eb3894205897b28057dd0b6a1` |
| Confidential claim (side hidden) | `0x17dec342e1c00f08d175517b732ca816320d10b3b4cd4b422e95e176f031d3c4` |
| Privacy-pool withdraw | `0x99613b28e54af922392f2d5515df8435549b2cb2ec99910b692a0a80abec8731` |

View on `https://testnet-explorer.hsk.xyz/tx/<hash>`.

---

## 2.5. HSP integration (HashKey Settlement Protocol)

Molfi uses **HSP** as its DeFi payment rail — "verify the settlement, not the promise." The
integration (`molfi-backend/hsp.js`, `molfi-predict-sdk/src/hsp.ts`) implements HSP's wire model
directly so it runs self-contained on HashKey and drops into the official HSP Coordinator when
`HSP_COORDINATOR_URL` + `HSP_API_KEY` are set:

- **Mandate** — the payer signs an EIP-712 intent (`primaryType: "Mandate"`, v1).
- **Settlement** — a zero-custody ERC-20 (mUSDC) transfer from the payer's own wallet.
- **Receipt** — the adapter observes the on-chain tx and signs it (`proves:settlement-verified:v1`).
- **Verification** — `ACCEPT ⟺ requiredCapabilities ⊆ satisfiedCapabilities`, plus the on-chain
  transfer is re-checked from logs; the coordinator can't move funds, so a lie fails verification.

**The headline flow — an agent pays via HSP to get a ZK proof (x402 paywall).** Proven live on
HashKey testnet (`node molfi-backend/hsp_demo.mjs`):

```
[1] GET /api/premium/zk/proof            → 402  (HSP requires 0.5 mUSDC → protocol vault)
[2] sign mandate → [3] settle on-chain → [4] adapter signs receipt
[5] retry with X-PAYMENT header          → 200  proof unlocked (paidVia HSP)
[6] independent verify                   → ACCEPT (6/6 checks pass)
```

Settlement tx: `https://testnet-explorer.hsk.xyz/tx/0x040e97b5bfa9af33755aa2095ee92b29df09e96b94cebe522864a498788e3f99`

In the SDK it's one call: `await agent.betZkViaHSP(marketId, "YES", 50)` — pay for the proof via
HSP, then place the private bet.

## 3. The differentiator: agent-native

`molfi-predict-sdk` ships a skill file (`SKILL.md`) + TypeScript SDK (`MolfiAgent`) so an LLM
agent can trade with zero human setup:

```ts
import { MolfiAgent } from "molfi-predict-sdk";

const agent = MolfiAgent.create();          // fresh HashKey (EVM) wallet
await agent.onboard();                        // mUSDC faucet + approvals
await agent.betZk(marketId, "YES", 50);       // ZK-gated bet, verified on-chain
await agent.redeem(marketId);                  // claim winnings
```

The proof is generated by the backend ZK service (`GET /api/zk/proof`) and verified on-chain by
`PredictEscrow.betZk` before any mUSDC escrows — the agent proves it is solvent without ever
revealing its balance, and each proof is single-use.

---

## 4. Architecture

```
molfi-contracts   Solidity (Foundry): PredictEscrow · ConfidentialBet · PrivacyPool · Market
                  · MockOracle · MockUSDC · Vault + snarkjs BN254 Groth16 verifiers
molfi-circuits    Circom circuits (solvency · confidential_bet · withdraw) → BN254 → Solidity verifier
molfi-backend     Node/ethers: keeper (push prices, roll markets, resolve, fund conf pot),
                  ZK proof service, escrow-event indexer, market/vault/leaderboard API, IPFS chat (Mongo)
molfi-predict-app Primary web app (React + Vite + wagmi/viem, MetaMask)
molfi-app         Secondary web app
molfi-predict-sdk Agent SDK + SKILL.md
molfi-predict-landing  Landing page (Next.js)
```

Resolution has three paths: admin `resolve`, ZK `resolveWithProof`, and permissionless
`resolveFromOracle` (reads the multi-asset `MockOracle` — the keeper pushes live Coinbase spot
into it each tick, so markets settle themselves).

---

## 5. Deployed — HashKey Chain testnet (chain 133)

RPC `https://testnet.hsk.xyz` · Explorer `https://testnet-explorer.hsk.xyz` · full list in
`molfi-contracts/deployments/133.json`.

| Contract | Address |
|---|---|
| PredictEscrow | `0xDd5782CE36e035709b2e3F640377d3Ec6F1f1dA1` |
| ConfidentialBet | `0x6731FecE71e14155EBA0b11A116a68eA395dd14e` |
| PrivacyPool | `0x4ce8970d2B0FbFd478e857F603Fc7526E0CC989a` |
| Market | `0xd3f3c363CF22eD8DbAB26b9De5b12340D3816C49` |
| MockOracle | `0x5439778405627512eAae2210b2584D6A9B4D517B` |
| mUSDC (faucet) | `0xCcCe188934316cE9ea6f8237F7e6249aB2E0C903` |
| Vault | `0x6F1Bd7d424AB69B9F3689Cee208863Ce0B27f784` |

**Mainnet (chain 177):** `./molfi-contracts/deploy-mainnet.sh` deploys the full stack in one
command once the deployer holds HSK for gas; then `node scripts/zk_lifecycle.mjs mainnet` re-proves
all three ZK flows on mainnet.

---

## 6. Honest scope

- The confidential-bet / privacy-pool **anonymity set** uses an off-chain Poseidon tree whose root
  the admin checkpoints (`registerRoot`) — the standard pattern when on-chain Poseidon is too
  expensive per deposit. The ZK verification, outcome-binding, side-hiding, and nullifiers are all
  **real and on-chain**; a shared multi-leaf accumulator + client-side proving is the production
  follow-up.
- Proving is currently server-assisted (backend ZK service). Moving proof generation client-side
  (browser wasm) is a drop-in next step — the on-chain verification path is unchanged.
- **HSP** is integrated as a self-contained adapter/coordinator (§2.5) and verified live on testnet.
  Wiring it to the *official* HSP Coordinator only needs the organizer's `HSP_COORDINATOR_URL` +
  `HSP_API_KEY`; the mandate/receipt/verification and on-chain settlement are already real.

---

## 7. Run it

```bash
# contracts + on-chain ZK proof
cd molfi-contracts && forge build
forge script script/Deploy.s.sol:Deploy --rpc-url https://testnet.hsk.xyz --broadcast --slow
cd scripts && npm install && cd .. && node scripts/zk_lifecycle.mjs testnet

# backend (keeper + ZK service + API)
cd ../molfi-backend && npm install && cp .env.example .env   # MONGODB_URI, PRIVATE_KEY
npm start

# web app
cd ../molfi-predict-app && npm install && npm run dev
```
