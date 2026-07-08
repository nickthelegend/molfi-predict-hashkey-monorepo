---
name: molfi-trade
description: >-
  Trade on the Molfi prediction market (HashKey Chain / EVM) as an autonomous
  agent. Use when you (an AI agent) need to spin up an EVM wallet, self-fund with
  the mUSDC faucet, read live on-chain markets and odds, place REAL on-chain bets
  that escrow mUSDC (optionally gated by a zero-knowledge solvency proof or fully
  confidential / hidden-side), and redeem winnings after a market resolves.
---

# Molfi — Agent Trading Skill (HashKey Chain)

Molfi is a **prediction market on HashKey Chain** (an EVM L2). Markets are binary
(YES/NO) questions like *"Will BTC be ≥ \$60k at 04:00?"*. A backend publishes the
live on-chain markets and implied odds; **money is real and on-chain**: bets
escrow `mUSDC` in the `PredictEscrow` contract, markets settle from an oracle, and
winners redeem pro-rata (2% fee → LP vault).

The recommended path is the **SDK** (`molfi-predict-sdk`) — one `MolfiAgent`
class. Everything below is **HashKey testnet**. Keep the wallet private key (`0x…`)
secret.

---

## Two things a fresh wallet needs

1. **HSK for gas.** A brand-new EVM wallet has zero HSK and cannot pay for any
   transaction. Fund `agent.address` with a little testnet **HSK** first (native
   token). Without it, even the faucet call fails.
2. **mUSDC to bet with.** The mUSDC token has an **open faucet** — anyone can mint
   10,000 test mUSDC to any address. `onboard()` calls it for you (and then
   approves the escrow/confidential contracts).

`mUSDC` has **6 decimals** (1 mUSDC = 1,000,000 base units). The SDK takes human
mUSDC numbers. Outcomes: **YES = 0, NO = 1**.

---

## Live deployment (testnet, chainId 133)

| Thing | Value |
|---|---|
| Backend API | `http://localhost:4000` (or `$MOLFI_API_URL`) |
| RPC | `https://testnet.hsk.xyz` |
| Explorer | `https://testnet-explorer.hsk.xyz` |
| mUSDC token | `0xCcCe188934316cE9ea6f8237F7e6249aB2E0C903` |
| PredictEscrow | `0xDd5782CE36e035709b2e3F640377d3Ec6F1f1dA1` |
| Market | `0xd3f3c363CF22eD8DbAB26b9De5b12340D3816C49` |
| ConfidentialBet | `0x6731FecE71e14155EBA0b11A116a68eA395dd14e` |
| LP vault | `0x6F1Bd7d424AB69B9F3689Cee208863Ce0B27f784` |

These addresses are embedded in the SDK (`DEPLOYMENT_133`); override any of them
via `MOLFI_*` env vars for a fresh deployment.

---

## Quick start (Node)

```bash
cd molfi-predict-sdk && npm install && npm run build
```

```ts
import { MolfiAgent } from "molfi-predict-sdk";

// 1. New EVM wallet — save agent.secret() to trade again later.
const agent = MolfiAgent.create();
console.log("fund this address with a little testnet HSK:", agent.address);

// (fund agent.address with HSK for gas, then:)

// 2. Self-onboard: claim 10,000 mUSDC + approve the escrow/confidential contracts.
await agent.onboard();                 // → { address, musdc: 10000, faucet, approveEscrow, ... }

// 3. Read live on-chain markets (implied YES odds, open interest, close time).
const markets = await agent.markets();
const m = markets[0];                  // { marketId, symbol, question, yesPrice, ... }

// 4. Place a REAL on-chain bet: escrow 100 mUSDC on YES.
const tx = await agent.bet(m.marketId, "YES", 100);
console.log("bet tx:", tx.hash, tx.explorerUrl);
console.log("mUSDC balance:", await agent.musdc());

// 5. After the market resolves, claim winnings.
if (await agent.isResolved(m.marketId)) {
  const r = await agent.redeem(m.marketId);
  console.log("redeemed:", r.explorerUrl);
}
```

Runnable demo: `node examples/agent-trade.mjs`.

### Private (ZK-gated) bet
`agent.betZk(marketId, side, amount)` fetches a Groth16 **solvency** proof from
the backend (`/api/zk/proof`) and places a bet the `PredictEscrow` contract
verifies **on-chain** before escrowing — proving your hidden collateral ≥ a
threshold without revealing your balance. The proof's domain is burned as a
single-use nullifier.

```ts
await agent.betZk(m.marketId, "NO", 50);   // solvency-gated, same tx shape
```

### Confidential (hidden-side) bet
`agent.confidentialBet(side)` escrows a fixed-denomination **commitment note** —
nothing on-chain reveals which outcome it backs. **Save the returned `note`**; it
is required to claim.

```ts
const { note, hash } = await agent.confidentialBet("YES");   // hidden side
// … market resolves …
const claim = await agent.confidentialClaim(note, m.marketId); // null if lost / unresolved
if (claim) console.log("confidential payout:", claim.explorerUrl);
```

---

## MolfiAgent API

| Method | Does |
|---|---|
| `MolfiAgent.create(opts?)` | Fresh random EVM wallet (or `{ privateKey }` to restore), connected to HashKey testnet. |
| `agent.address` | The agent's EVM address (fund it with HSK). |
| `agent.secret()` | `{ address, privateKey }` — persist to reuse this wallet. |
| `agent.hskBalance()` | Native HSK gas balance (base units). |
| `await agent.onboard()` | mUSDC faucet + approve escrow & confidential contracts. |
| `await agent.markets(status?)` | Open (or `"closed"`) on-chain markets from the backend. |
| `await agent.musdc()` | mUSDC balance (human number). |
| `await agent.bet(marketId, side, amount)` | Plain bet — escrow mUSDC on YES/NO. |
| `await agent.betZk(marketId, side, amount)` | Solvency-gated ZK bet. |
| `await agent.redeem(marketId)` | Claim winnings after resolution. |
| `await agent.confidentialBet(side)` | Hidden-side bet → returns `{ note, ... }`. |
| `await agent.confidentialClaim(note, marketId)` | Claim a confidential winning note. |
| `await agent.isResolved(marketId)` / `winningOutcome(marketId)` | Resolution state. |

Every write returns `{ hash, explorerUrl }`.

---

## Backend API (read/prepare)

| Endpoint | Returns |
|---|---|
| `GET /api/onchain/markets` (`?status=closed`) | bettable markets: `marketId` (bytes32), `symbol`, `question`, `yesPrice`, `closeTs`, `oi` |
| `GET /api/zk/proof` | Groth16 solvency calldata `{a,b,c,pubSignals,domain}` for `betZk` |
| `POST /api/confidential/prepare-commit` `{side}` | `{note, commitment, denom}` for a hidden-side bet |
| `POST /api/confidential/prepare-claim` `{note, marketId, recipient}` | ZK proof + `{root, nullifierHash, recipient, won}` |

## How payout works
Pari-mutuel: when a market resolves, each winner gets
`stake × total_pool ÷ winning_pool`, minus a 2% fee routed to the LP vault.
Betting the only-correct side returns your stake plus the losing side's pot.

## Rules for agents
- This is **testnet**; never use a mainnet key. Treat `0x…` private keys as secrets.
- Fund `agent.address` with a little **HSK** for gas before any write — a fresh
  wallet has zero HSK.
- Only bet on markets from `/api/onchain/markets`; other ids escrow funds that
  can't be redeemed.
- The SDK takes **human mUSDC** amounts; it converts to 6-decimal base units for you.
