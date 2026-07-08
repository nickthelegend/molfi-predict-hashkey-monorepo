// End-to-end: a FRESH MolfiAgent funds itself and trades on HashKey testnet.
//
//   treasury drips HSK for gas → agent faucets mUSDC + approves → treasury (admin)
//   opens a market → agent places a REAL on-chain bet → treasury resolves →
//   agent redeems. Everything signed by the agent's own key; real tx hashes.
//
// Usage: node examples/e2e-agent-trade.mjs
import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { MolfiAgent, TESTNET } from "../dist/index.js";

const RPC = TESTNET.rpcUrl;
const provider = new ethers.JsonRpcProvider(RPC, TESTNET.chainId);
const CONTRACTS = "../molfi-contracts";
const dep = JSON.parse(readFileSync(`${CONTRACTS}/deployments/133.json`, "utf8"));
const env = Object.fromEntries(readFileSync(`${CONTRACTS}/.env`, "utf8").split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const treasury = new ethers.Wallet(env.PRIVATE_KEY.trim(), provider);
const abi = (n) => JSON.parse(readFileSync(`${CONTRACTS}/out/${n}.sol/${n}.json`, "utf8")).abi;
const market = new ethers.Contract(dep.market, abi("Market"), treasury);
const escrow = new ethers.Contract(dep.predictEscrow, abi("PredictEscrow"), provider);
const ex = (h) => `https://testnet-explorer.hsk.xyz/tx/${h}`;

async function main() {
  console.log("=== Molfi agent — end-to-end trade on HashKey testnet ===");
  console.log("treasury:", treasury.address);

  // 1. Fresh agent wallet.
  const agent = MolfiAgent.create();
  console.log("\n[1] fresh agent wallet:", agent.address);

  // 2. Treasury drips HSK for gas.
  const drip = await treasury.sendTransaction({ to: agent.address, value: ethers.parseEther("0.015") });
  await drip.wait();
  console.log(`[2] treasury dripped 0.015 HSK for gas  ${ex(drip.hash)}`);
  console.log("    agent HSK:", ethers.formatEther(await agent.hskBalance()));

  // 3. Agent onboards: faucet 10,000 mUSDC + approve escrow/confidential.
  const ob = await agent.onboard();
  console.log(`[3] onboarded — faucet tx ${ex(ob.faucet.hash)}`);
  console.log("    agent mUSDC:", await agent.musdc());

  // 4. Treasury (admin) opens a market.
  const marketId = ethers.keccak256(ethers.toUtf8Bytes(`agent-e2e-${Date.now()}`));
  const now = (await provider.getBlock("latest")).timestamp;
  const cr = await market.create(marketId, "Will the agent's YES bet win?", now + 3600);
  await cr.wait();
  console.log(`\n[4] admin opened market ${marketId.slice(0, 14)}…  ${ex(cr.hash)}`);

  // 5. Agent places a REAL on-chain bet.
  const bet = await agent.bet(marketId, "YES", 100);
  console.log(`[5] agent bet 100 mUSDC on YES  ${ex(bet.hash)}`);
  const posYes = await escrow.position(marketId, 0, agent.address);
  console.log("    agent position YES:", ethers.formatUnits(posYes, 6), "mUSDC");
  console.log("    agent mUSDC after bet:", await agent.musdc());

  // 6. Treasury resolves YES; agent redeems.
  const rs = await market.resolve(marketId, 0);
  await rs.wait();
  console.log(`\n[6] admin resolved market → YES  ${ex(rs.hash)}`);
  const redeem = await agent.redeem(marketId);
  console.log(`[7] agent redeemed  ${ex(redeem.hash)}`);
  console.log("    agent mUSDC after redeem:", await agent.musdc());

  console.log("\n=== ✅ AGENT TRADED END-TO-END ON HASHKEY (fund → bet → resolve → redeem) ===");
  console.log("agent secret (testnet only):", agent.secret().privateKey);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
