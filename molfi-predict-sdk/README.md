# molfi-predict-sdk

Agent-native TypeScript SDK for the **Molfi** prediction market on **HashKey
Chain (EVM)**. One `MolfiAgent` class lets an autonomous agent (or a human) spin
up a wallet, self-fund with the mUSDC faucet, read live on-chain markets, and
place **real on-chain bets** that escrow mUSDC — plain, ZK-solvency-gated, or
fully confidential (hidden side) — then redeem winnings. Built on
[ethers v6](https://docs.ethers.org/v6/).

> 🤖 Agents: see [`SKILL.md`](./SKILL.md) for the autonomous-trading runbook.

## Install & build

```bash
npm install
npm run build
node examples/agent-trade.mjs   # demo: wallet → HSK check → faucet → read markets → bet
```

## Two things a fresh wallet needs

1. **HSK for gas** — a new EVM wallet has zero HSK and can't pay for any tx. Fund
   `agent.address` with a little testnet HSK first (native token).
2. **mUSDC to bet with** — `onboard()` claims 10,000 test mUSDC from the open
   faucet and approves the contracts.

## Quick start — autonomous agent

```ts
import { MolfiAgent } from "molfi-predict-sdk";

const agent = MolfiAgent.create();            // fresh EVM wallet (save agent.secret())
console.log("fund with HSK:", agent.address); // needs a little HSK for gas

await agent.onboard();                         // mUSDC faucet + approvals

const markets = await agent.markets();         // open on-chain markets + implied odds
const m = markets[0];                          // { marketId, symbol, question, yesPrice, ... }

const tx = await agent.bet(m.marketId, "YES", 100);  // escrow 100 mUSDC on YES (real tx)
console.log(tx.hash, tx.explorerUrl);

if (await agent.isResolved(m.marketId)) {
  await agent.redeem(m.marketId);              // claim pro-rata winnings
}
```

Restore an existing trader: `MolfiAgent.create({ privateKey: "0x…" })`. Point at
another deployment or network with `config` overrides / env vars
(`MOLFI_RPC_URL`, `MOLFI_API_URL`, `MOLFI_PREDICT_ESCROW`, …) — see
[`src/config.ts`](./src/config.ts).

## Private & confidential bets

```ts
await agent.betZk(m.marketId, "NO", 50);       // solvency proof verified on-chain

const { note } = await agent.confidentialBet("YES");   // hidden side — SAVE the note
const claim = await agent.confidentialClaim(note, m.marketId); // null if lost/unresolved
```

## API surface

| Group | Members |
|---|---|
| Agent | `MolfiAgent` (`create`, `address`, `secret`, `hskBalance`, `onboard`, `markets`, `market`, `musdc`, `bet`, `betZk`, `redeem`, `confidentialBet`, `confidentialClaim`, `isResolved`, `winningOutcome`, `txUrl`) |
| Chain | `MolfiChain` (`faucet`, `approve`, `allowance`, `musdcBalance`, `bet`, `betZk`, `redeem`, `escrowTotal`, `escrowPosition`, `commit`, `claim`, `isResolved`, `winningOutcome`, `resolveFromOracle`) |
| Wallet | `createWallet`, `walletFromPrivateKey`, `walletInfo`, `makeProvider` |
| Data | `fetchOnChainMarkets`, `fetchOnChainMarket`, `fetchSolvencyProof`, `prepareCommit`, `prepareClaim` |
| Config | `TESTNET`, `MAINNET`, `DEPLOYMENT_133`, `resolveConfig`, `txUrl`, `addressUrl`, `toBaseUnits`, `fromBaseUnits`, `OUTCOME_YES`, `OUTCOME_NO` |
| ABIs | `MUSDC_ABI`, `ESCROW_ABI`, `CONFIDENTIAL_ABI`, `MARKET_ABI` |

mUSDC has **6 decimals**. Outcomes: **YES=0, NO=1**. `Side` accepts `"YES"`,
`"NO"`, or the raw code `0`/`1`. Default config targets HashKey **testnet**
(chainId 133). Every write returns `{ hash, explorerUrl }`.

## Network facts

| | Testnet | Mainnet |
|---|---|---|
| chainId | 133 | 177 |
| RPC | `https://testnet.hsk.xyz` | `https://mainnet.hsk.xyz` |
| Explorer | `https://testnet-explorer.hsk.xyz` | `https://hashkey.blockscout.com` |
| Gas token | HSK | HSK |
