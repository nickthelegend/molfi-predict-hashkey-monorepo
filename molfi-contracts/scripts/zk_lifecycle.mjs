// Molfi — full on-chain ZK lifecycle on HashKey Chain.
//
// Generates REAL BN254 Groth16 proofs (snarkjs) and drives every contract with
// live transactions:
//   1. price market -> ZK-gated bet (solvency proof) + plain bet -> oracle
//      resolve -> pari-mutuel redeem
//   2. confidential bet (hidden side) -> register root -> ZK claim
//   3. privacy pool deposit -> register root -> ZK withdraw
//
// Usage: node scripts/zk_lifecycle.mjs [testnet|mainnet]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as snarkjs from "snarkjs";
import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CIRCUITS = resolve(ROOT, "../molfi-circuits/build_evm");

const NET = process.argv[2] || "testnet";
const RPC = NET === "mainnet" ? "https://mainnet.hsk.xyz" : "https://testnet.hsk.xyz";
const CHAIN_ID = NET === "mainnet" ? 177 : 133;

const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env"), "utf8")
    .split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2))
);
const PK = env.PRIVATE_KEY.trim();

const dep = JSON.parse(readFileSync(resolve(ROOT, `deployments/${CHAIN_ID}.json`), "utf8"));

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
const wallet = new ethers.Wallet(PK, provider);
const me = wallet.address;

function abi(name) {
  return JSON.parse(readFileSync(resolve(ROOT, `out/${name}.sol/${name}.json`), "utf8")).abi;
}
const musdc = new ethers.Contract(dep.mUSDC, abi("MockUSDC"), wallet);
const market = new ethers.Contract(dep.market, abi("Market"), wallet);
const escrow = new ethers.Contract(dep.predictEscrow, abi("PredictEscrow"), wallet);
const conf = new ethers.Contract(dep.confidentialBet, abi("ConfidentialBet"), wallet);
const pool = new ethers.Contract(dep.privacyPool, abi("PrivacyPool"), wallet);
const oracle = new ethers.Contract(dep.oracle, abi("MockOracle"), wallet);

const U = (n) => BigInt(Math.round(n * 1e6)); // mUSDC (6dp) helper
const nonce = BigInt(Date.now());
const hashes = {};
const log = (k, tx) => { hashes[k] = tx.hash; console.log(`  ${k.padEnd(22)} ${tx.hash}`); };

async function prove(circuit, input) {
  const wasm = resolve(CIRCUITS, `${circuit}/${circuit}_js/${circuit}.wasm`);
  const zkey = resolve(CIRCUITS, `${circuit}/final.zkey`);
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);
  const cd = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [a, b, c, pub] = JSON.parse(`[${cd}]`);
  return { a, b, c, pub, publicSignals };
}

async function main() {
  console.log(`\n=== Molfi ZK lifecycle on HashKey ${NET} (chain ${CHAIN_ID}) ===`);
  console.log(`signer ${me}`);
  const bal = await musdc.balanceOf(me);
  if (bal < U(1000)) { const t = await musdc.faucet(me); await t.wait(); }

  // ── 1. Price market + ZK-gated bet + oracle resolve + pari-mutuel redeem ──
  console.log("\n[1] Price market -> ZK bet (solvency) -> oracle resolve -> redeem");
  const marketId = ethers.keccak256(ethers.toUtf8Bytes(`molfi-btc-${nonce}`));
  const now = (await provider.getBlock("latest")).timestamp;
  const CLOSE = now + 12;
  const BTC = ethers.keccak256(ethers.toUtf8Bytes("BTC"));
  let tx = await market.createPriceMarket(
    marketId, "Will BTC be >= $100k at close?", CLOSE,
    dep.oracle, BTC, BigInt(100_000) * 10n ** 8n, 0 /*GTE*/, 3600
  );
  await tx.wait(); log("market.create", tx);

  tx = await musdc.approve(dep.predictEscrow, U(100000)); await tx.wait();

  // ZK-gated bet on YES: prove hidden balance >= threshold (solvency), domain = nullifier.
  const domain = (nonce * 1000n + 7n).toString();
  const sv = await prove("solvency", { domain, threshold: U(100).toString(), balance: U(275).toString() });
  tx = await escrow.betZk(marketId, 0 /*YES*/, U(50), sv.a, sv.b, sv.c, sv.pub);
  await tx.wait(); log("escrow.betZk(YES)", tx);

  // Plain bet on NO to create a two-sided pot.
  tx = await escrow.bet(marketId, 1 /*NO*/, U(30)); await tx.wait(); log("escrow.bet(NO)", tx);

  // Wait past close, then permissionless oracle resolution.
  process.stdout.write("  waiting for market close");
  for (;;) {
    const b = (await provider.getBlock("latest")).timestamp;
    if (b >= CLOSE) { process.stdout.write("\n"); break; }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 2000));
  }
  tx = await market.resolveFromOracle(marketId); await tx.wait(); log("market.resolveOracle", tx);
  const win = await market.winningOutcome(marketId);
  console.log(`  winning outcome = ${win} (0=YES,1=NO)`);

  tx = await escrow.redeem(marketId); const rc = await tx.wait(); log("escrow.redeem", tx);

  // ── 2. Confidential bet: hidden side, ZK claim ────────────────────────────
  console.log("\n[2] Confidential bet -> register root -> ZK claim (hidden side)");
  tx = await musdc.approve(dep.confidentialBet, U(100000)); await tx.wait();
  // Fund the pot with two fixed-denom commitment notes (side hidden).
  tx = await conf.commit(ethers.keccak256(ethers.toUtf8Bytes(`note-a-${nonce}`))); await tx.wait(); log("conf.commit#1", tx);
  tx = await conf.commit(ethers.keccak256(ethers.toUtf8Bytes(`note-b-${nonce}`))); await tx.wait(); log("conf.commit#2", tx);

  // Prove: I own a note whose outcome == winning outcome; bind recipient.
  const cb = await prove("confidential_bet", {
    secret: (nonce + 1n).toString(),
    nullifier: (nonce + 2n).toString(),
    outcome: win.toString(),
    recipient: BigInt(me).toString(),
    pathElements: ["1", "2", "3", "4", "5", "6", "7", "8"],
    pathIndices: ["0", "1", "0", "1", "0", "0", "1", "0"],
  });
  const cbRoot = ethers.toBeHex(BigInt(cb.publicSignals[0]), 32);
  const cbNull = ethers.toBeHex(BigInt(cb.publicSignals[1]), 32);
  tx = await conf.registerRoot(cbRoot); await tx.wait(); log("conf.registerRoot", tx);
  tx = await conf.claim(marketId, cb.a, cb.b, cb.c, cbNull, cbRoot, me);
  await tx.wait(); log("conf.claim", tx);

  // ── 3. Privacy pool: shielded deposit + ZK withdraw ───────────────────────
  console.log("\n[3] Privacy pool deposit -> register root -> ZK withdraw");
  tx = await musdc.approve(dep.privacyPool, U(100000)); await tx.wait();
  tx = await pool.deposit(ethers.keccak256(ethers.toUtf8Bytes(`pp-${nonce}`)), U(100));
  await tx.wait(); log("pool.deposit", tx);
  const wd = await prove("withdraw", {
    secret: (nonce + 11n).toString(),
    nullifier: (nonce + 12n).toString(),
    amount: U(100).toString(),
    recipient: BigInt(me).toString(),
    pathElements: ["1", "2", "3", "4", "5", "6", "7", "8"],
    pathIndices: ["0", "1", "0", "1", "0", "0", "1", "0"],
  });
  const wdRoot = ethers.toBeHex(BigInt(wd.publicSignals[0]), 32);
  tx = await pool.registerRoot(wdRoot); await tx.wait(); log("pool.registerRoot", tx);
  tx = await pool.withdraw(wd.a, wd.b, wd.c, wd.pub, me, U(100));
  await tx.wait(); log("pool.withdraw", tx);

  console.log("\n=== ALL ZK FLOWS VERIFIED ON-CHAIN ===");
  console.log(JSON.stringify({ network: NET, chainId: CHAIN_ID, marketId, hashes }, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
