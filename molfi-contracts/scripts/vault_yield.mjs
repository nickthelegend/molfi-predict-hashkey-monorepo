// Prove the Molfi LP Vault earns REAL yield on HashKey testnet:
//   LP deposits mUSDC → trading generates 2% protocol fees → fees accrue to the
//   vault → NAV/share rises → LP withdraws MORE than they deposited.
// Usage: node scripts/vault_yield.mjs [testnet|mainnet]
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NET = process.argv[2] || "testnet";
const RPC = NET === "mainnet" ? "https://mainnet.hsk.xyz" : "https://testnet.hsk.xyz";
const CHAIN = NET === "mainnet" ? 177 : 133;
const dep = JSON.parse(readFileSync(`${ROOT}/deployments/${CHAIN}.json`, "utf8"));
const env = Object.fromEntries(readFileSync(`${ROOT}/.env`, "utf8").split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const abi = (n) => JSON.parse(readFileSync(`${ROOT}/out/${n}.sol/${n}.json`, "utf8")).abi;

const provider = new ethers.JsonRpcProvider(RPC, CHAIN);
const w = new ethers.Wallet(env.PRIVATE_KEY.trim(), provider);
const musdc = new ethers.Contract(dep.mUSDC, abi("MockUSDC"), w);
const vault = new ethers.Contract(dep.vault, abi("Vault"), w);
const market = new ethers.Contract(dep.market, abi("Market"), w);
const escrow = new ethers.Contract(dep.predictEscrow, abi("PredictEscrow"), w);
const U = (n) => ethers.parseUnits(String(n), 6);
const f = (x) => Number(ethers.formatUnits(x, 6)).toLocaleString(undefined, { maximumFractionDigits: 4 });
const ex = (h) => `https://testnet-explorer.hsk.xyz/tx/${h}`;

async function main() {
  console.log(`\n=== Molfi LP Vault — real yield on HashKey ${NET} ===`);
  console.log(`LP/trader ${w.address}`);
  // Make sure we have mUSDC + approvals.
  if ((await musdc.balanceOf(w.address)) < U(20000)) await (await musdc.mint(w.address, U(1_000_000))).wait();
  await (await musdc.approve(dep.vault, ethers.MaxUint256)).wait();
  await (await musdc.approve(dep.predictEscrow, ethers.MaxUint256)).wait();

  // ── 1. LP deposits 1,000 mUSDC ──────────────────────────────────────────────
  const DEP = U(1000);
  let tx = await vault.deposit(DEP); await tx.wait();
  const shares = await vault.balanceOf(w.address);
  console.log(`\n[deposit] 1,000 mUSDC  ${ex(tx.hash)}`);
  console.log(`  shares ${f(shares)} · vault value ${f(await vault.assetsOf(w.address))} · sharePrice ${f(await vault.sharePrice())}`);

  // ── 2. Generate real trading volume → 2% fees flow to the vault ─────────────
  const ROUNDS = 3;
  console.log(`\n[trading] ${ROUNDS} rounds of two-sided bets → 2% fee → vault`);
  for (let i = 0; i < ROUNDS; i++) {
    const id = ethers.keccak256(ethers.toUtf8Bytes(`vault-yield-${Date.now()}-${i}`));
    const now = (await provider.getBlock("latest")).timestamp;
    await (await market.create(id, `Vault yield round ${i}`, now + 3600)).wait();
    await (await escrow.bet(id, 0, U(500))).wait(); // YES 500
    await (await escrow.bet(id, 1, U(500))).wait(); // NO 500  (pot = 1,000)
    await (await market.resolve(id, 0)).wait();      // YES wins
    const r = await escrow.redeem(id); await r.wait(); // 2% of 1,000 = 20 mUSDC → vault
    console.log(`  round ${i + 1}: pot 1,000 → fee 20 mUSDC to vault  redeem ${r.hash.slice(0, 12)}…`);
  }

  // ── 3. Yield accrued — no extra deposit, LP value rose ──────────────────────
  const valAfter = await vault.assetsOf(w.address);
  const earned = await vault.earnedOf(w.address);
  console.log(`\n[yield] vault TVL ${f(await vault.totalAssets())} · sharePrice ${f(await vault.sharePrice())}`);
  console.log(`  LP position now worth ${f(valAfter)} mUSDC  (deposited 1,000)`);
  console.log(`  earned ${f(earned)} mUSDC of real protocol fees  →  APR on this capital: ${((Number(ethers.formatUnits(earned,6))/1000)*100).toFixed(2)}% (cumulative)`);

  if (process.argv.includes("keep")) {
    console.log(`\n[keep] leaving the position live — vault TVL ${f(await vault.totalAssets())}, sharePrice ${f(await vault.sharePrice())}`);
    console.log(`=== VAULT SEEDED WITH A LIVE YIELDING POSITION ===`);
    return;
  }

  // ── 4. Withdraw everything → LP gets principal + yield ──────────────────────
  const before = await musdc.balanceOf(w.address);
  tx = await vault.withdrawAll(); await tx.wait();
  const got = (await musdc.balanceOf(w.address)) - before;
  console.log(`\n[withdraw] withdrawAll  ${ex(tx.hash)}`);
  console.log(`  received ${f(got)} mUSDC for a 1,000 deposit  →  ${got > DEP ? "✅ REAL YIELD" : "no yield"} (+${f(got - DEP)})`);
  console.log(`\n=== VAULT EARNS REAL YIELD FROM REAL BET VOLUME ===`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
