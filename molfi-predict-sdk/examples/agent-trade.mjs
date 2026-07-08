/**
 * Autonomous Molfi trading agent on HashKey Chain — runnable demo.
 *
 *   cd molfi-predict-sdk && npm install && npm run build
 *   node examples/agent-trade.mjs
 *
 * It generates a fresh EVM wallet, then (once the wallet has a little testnet HSK
 * for gas) claims mUSDC + approves the contracts, reads the live on-chain
 * markets, and places a REAL mUSDC bet. Pass MOLFI_MARKET_ID=<bytes32> to bet on
 * a specific market, or MOLFI_PRIVATE_KEY=<0x…> to reuse a funded wallet.
 *
 * NOTE: a brand-new wallet has zero HSK and cannot pay gas. Fund `agent.address`
 * with a little testnet HSK (from https://testnet.hsk.xyz) before onboarding.
 */
import { MolfiAgent } from "../dist/index.js";

const log = (...a) => console.log(...a);

const agent = MolfiAgent.create({ privateKey: process.env.MOLFI_PRIVATE_KEY });
log("🪪  agent wallet:", agent.address);
log("    explorer:", agent.explorerUrl);

const hsk = await agent.hskBalance();
if (hsk === 0n) {
  log("\n⛽  This wallet has 0 HSK — fund it with a little testnet HSK, then re-run:");
  log("    ", agent.address);
  process.exit(0);
}

log("\n💧  onboarding (mUSDC faucet + approvals)…");
const onboarded = await agent.onboard();
log("    faucet tx:", onboarded.faucet.hash);
log("    mUSDC balance:", onboarded.musdc);

log("\n📈  live on-chain markets (top 3 by implied YES odds):");
const markets = await agent.markets();
for (const m of markets.slice(0, 3)) {
  log(`    ${m.symbol}  ${(m.yesPrice * 100).toFixed(0)}% YES  —  ${m.question}`);
}

const marketId = process.env.MOLFI_MARKET_ID || markets[0]?.marketId;
if (!marketId) {
  log("\nℹ️  No open on-chain market to bet on. Set MOLFI_MARKET_ID=<bytes32>.");
  process.exit(0);
}

log(`\n🎯  placing a REAL on-chain bet: 100 mUSDC on YES of ${marketId.slice(0, 12)}…`);
const tx = await agent.bet(marketId, "YES", 100);
log("    bet tx:", tx.hash);
log("    explorer:", tx.explorerUrl);
log("    mUSDC balance now:", await agent.musdc());
log("\n✅  Done. When the market resolves, call agent.redeem(marketId) to claim winnings.");
