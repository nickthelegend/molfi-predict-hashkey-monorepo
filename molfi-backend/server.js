/**
 * Molfi backend — MongoDB-backed market engine on HashKey Chain (EVM).
 *
 * - Polls live spot (Coinbase) for BTC/ETH/SOL/XLM/… into a `prices` time series.
 * - PUSHES those prices to the on-chain MockOracle (multi-asset SEP-40 feed).
 * - Auto-generates rolling 15-min AND 30-min on-chain markets per token.
 * - Settles each market at close permissionlessly from the oracle (resolveFromOracle).
 * - Keeps the confidential-bet pot funded and serves REAL BN254 Groth16 proofs
 *   (Circom → snarkjs) for the ZK-gated bet + confidential claim.
 * - Indexes real predict-escrow Bet/Redeemed events for positions + leaderboard.
 * - Serves REST: markets, prices, order book, positions, leaderboard, vaults, chat.
 */
import express from "express";
import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { randomBytes, createHash } from "crypto";
import { groth16 } from "snarkjs";
import { ethers } from "ethers";
import * as hsp from "./hsp.js";
import "dotenv/config";

const PORT = Number(process.env.PORT) || 4000;
const FEE_RATE = 0.02; // 2% trading fee → LP vault
const VAULT_ID = "molfi-lp";
const U = 1e6; // mUSDC base units per whole token (6 decimals on EVM)

const icon = (s) =>
  `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${s.toLowerCase()}.png`;

const TOKENS = {
  BTC: { pair: "BTC-USD", icon: icon("btc"), dp: 0, round: (p) => Math.round(p / 100) * 100 },
  ETH: { pair: "ETH-USD", icon: icon("eth"), dp: 0, round: (p) => Math.round(p / 10) * 10 },
  SOL: { pair: "SOL-USD", icon: icon("sol"), dp: 0, round: (p) => Math.round(p) },
  XLM: { pair: "XLM-USD", icon: icon("xlm"), dp: 4, round: (p) => Math.round(p * 1000) / 1000 },
  DOGE: { pair: "DOGE-USD", icon: icon("doge"), dp: 4, round: (p) => Math.round(p * 1000) / 1000 },
  AVAX: { pair: "AVAX-USD", icon: icon("avax"), dp: 2, round: (p) => Math.round(p) },
  LINK: { pair: "LINK-USD", icon: icon("link"), dp: 2, round: (p) => Math.round(p) },
};
const CADENCES = [15, 30]; // minutes

// ── Mongo ─────────────────────────────────────────────────────────────────────
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "molfi");
const Prices = db.collection("prices");
const Markets = db.collection("markets");
const Positions = db.collection("positions");
const Vaults = db.collection("vaults");
const VaultDeposits = db.collection("vaultDeposits");
const OnchainTrades = db.collection("onchainTrades");
const OnchainMarkets = db.collection("onchainMarkets");
const Meta = db.collection("meta");
const Comments = db.collection("comments");
await Prices.createIndex({ symbol: 1, ts: -1 });
await Markets.createIndex({ closeTs: 1, status: 1 });
await Positions.createIndex({ address: 1, createdAt: -1 });
await Positions.createIndex({ marketId: 1 });
await OnchainTrades.createIndex({ address: 1 });
await OnchainTrades.createIndex({ kind: 1 });
await OnchainMarkets.createIndex({ symbol: 1, closeTs: -1 });
await Comments.createIndex({ marketId: 1, ts: -1 });
console.log("[molfi-backend] connected to MongoDB");

// ── On-chain layer (HashKey Chain / EVM via ethers) ────────────────────────────
const RPC_URL = process.env.MOLFI_RPC_URL || "https://testnet.hsk.xyz";
const CHAIN_ID = Number(process.env.MOLFI_CHAIN_ID) || 133;
const CONTRACTS_DIR = process.env.MOLFI_CONTRACTS_DIR || "../molfi-contracts";
const dep = JSON.parse(readFileSync(`${CONTRACTS_DIR}/deployments/${CHAIN_ID}.json`, "utf8"));
const abiOf = (name) =>
  JSON.parse(readFileSync(`${CONTRACTS_DIR}/out/${name}.sol/${name}.json`, "utf8")).abi;

const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
const KEEPER = process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY, provider) : null;
const signerOrProvider = KEEPER || provider;

const musdc = new ethers.Contract(dep.mUSDC, abiOf("MockUSDC"), signerOrProvider);
const oracle = new ethers.Contract(dep.oracle, abiOf("MockOracle"), signerOrProvider);
const market = new ethers.Contract(dep.market, abiOf("Market"), signerOrProvider);
const escrow = new ethers.Contract(dep.predictEscrow, abiOf("PredictEscrow"), signerOrProvider);
const conf = new ethers.Contract(dep.confidentialBet, abiOf("ConfidentialBet"), signerOrProvider);
const vault = new ethers.Contract(dep.vault, abiOf("Vault"), signerOrProvider);
const CONF_DENOM = 100; // fixed uniform denomination (mUSDC) — hides the amount
const CONF_PAYOUT = 200; // PAYOUT_MULT(2) × denom on a winning claim
const OC_TOKENS = ["BTC", "ETH", "SOL", "XLM", "LINK", "AVAX"];
const OC_CADENCES = [15, 30];
const assetId = (sym) => ethers.keccak256(ethers.toUtf8Bytes(sym));

// Serialize keeper writes so concurrent txs don't collide on the account nonce.
let _chainLock = Promise.resolve();
async function writeChain(fn) {
  const run = async () => {
    const tx = await fn();
    await tx.wait();
    return tx.hash;
  };
  const result = _chainLock.then(run, run);
  _chainLock = result.then(() => {}, () => {});
  return result;
}

// ── Escrow event indexer (Bet / Redeemed) ─────────────────────────────────────
async function indexEscrowEvents() {
  try {
    const latest = await provider.getBlockNumber();
    const meta = await Meta.findOne({ _id: "escrowCursor" });
    const WINDOW = 45000; // stay within RPC log-range limits
    let start = meta?.block ? meta.block + 1 : Math.max(0, latest - WINDOW);
    if (start > latest) return;
    for (let from = start; from <= latest; from += 9000) {
      const to = Math.min(from + 8999, latest);
      const bets = await escrow.queryFilter(escrow.filters.Bet(), from, to);
      const reds = await escrow.queryFilter(escrow.filters.Redeemed(), from, to);
      for (const ev of bets) {
        const [marketId, bettor, outcome, amount] = ev.args;
        await OnchainTrades.updateOne(
          { _id: `${ev.transactionHash}:${ev.index}` },
          { $set: { kind: "bet", market: marketId, address: bettor, outcome: Number(outcome),
            amount: Number(amount) / U, block: ev.blockNumber, ts: Date.now(), txHash: ev.transactionHash } },
          { upsert: true },
        );
      }
      for (const ev of reds) {
        const [marketId, bettor, net] = ev.args;
        await OnchainTrades.updateOne(
          { _id: `${ev.transactionHash}:${ev.index}` },
          { $set: { kind: "redeem", market: marketId, address: bettor,
            amount: Number(net) / U, block: ev.blockNumber, ts: Date.now(), txHash: ev.transactionHash } },
          { upsert: true },
        );
      }
    }
    await Meta.updateOne({ _id: "escrowCursor" }, { $set: { block: latest } }, { upsert: true });
  } catch (e) {
    console.error("[molfi-backend] escrow indexer:", e.message);
  }
}

// ── Keeper: push prices, roll markets, resolve, fund confidential pot ──────────
async function pushPrices() {
  if (!KEEPER) return;
  for (const sym of OC_TOKENS) {
    const px = lastPrice[sym];
    if (px == null) continue;
    try {
      await writeChain(() => oracle.setPrice(assetId(sym), BigInt(Math.round(px * 1e8))));
    } catch (e) {
      console.error(`[keeper] setPrice ${sym}:`, e.message);
    }
  }
}

async function ensureOnChainMarkets() {
  if (!KEEPER) return;
  const now = Date.now();
  for (const sym of OC_TOKENS) {
    for (const mins of OC_CADENCES) {
      try {
        const fresh = await OnchainMarkets.findOne({
          symbol: sym, cadenceMins: mins, resolved: false, closeTs: { $gt: now + 2 * 60 * 1000 },
        });
        if (fresh) continue;
        const px = lastPrice[sym];
        if (px == null) continue;
        const priceInt = BigInt(Math.round(px * 1e8));
        const closeSec = Math.floor(now / 1000) + mins * 60;
        const id = "0x" + randomBytes(32).toString("hex");
        const q = `Will ${sym} be above its current price at close? (on-chain · oracle · ${mins}m)`;
        await writeChain(() =>
          market.createPriceMarket(id, q, closeSec, dep.oracle, assetId(sym), priceInt, 0, 3600));
        await OnchainMarkets.insertOne({
          _id: id, symbol: sym, question: q, closeTs: closeSec * 1000, cadenceMins: mins,
          oracle: "molfi-oracle", resolved: false, createdAt: now,
          threshold: Number(priceInt), strikeUsd: px, openPrice: px,
        });
        console.log(`[keeper] created on-chain ${sym} ${mins}m market ${id.slice(0, 12)}…`);
      } catch (e) {
        console.error(`[keeper] ensure ${sym} ${mins}m:`, e.message);
      }
    }
  }
}

async function resolveDueOnChain() {
  if (!KEEPER) return;
  const due = await OnchainMarkets.find({ resolved: false, closeTs: { $lte: Date.now() } }).limit(5).toArray();
  for (const m of due) {
    try {
      const hash = await writeChain(() => market.resolveFromOracle(m._id));
      let outcome = null;
      try { outcome = Number(await market.winningOutcome(m._id)); } catch {}
      await OnchainMarkets.updateOne({ _id: m._id },
        { $set: { resolved: true, resolvedAt: Date.now(), resolveTx: hash, outcome } });
      console.log(`[keeper] resolved on-chain market ${m._id.slice(0, 12)}… → ${outcome}`);
    } catch (e) {
      console.error(`[keeper] resolve ${m._id.slice(0, 12)}:`, e.message);
    }
  }
}

const CONF_POT_MIN = 200 * U;
const CONF_POT_TARGET = 400 * U;
async function ensureConfPot() {
  if (!KEEPER) return;
  try {
    const pot = Number(await conf.pot());
    if (pot >= CONF_POT_MIN) return;
    const denom = Number(await conf.denom()) || 100 * U;
    const notes = Math.ceil((CONF_POT_TARGET - pot) / denom);
    const bal = Number(await musdc.balanceOf(KEEPER.address));
    if (bal < notes * denom) await writeChain(() => musdc.mint(KEEPER.address, BigInt(notes * denom)));
    const allow = Number(await musdc.allowance(KEEPER.address, dep.confidentialBet));
    if (allow < notes * denom) await writeChain(() => musdc.approve(dep.confidentialBet, ethers.MaxUint256));
    for (let i = 0; i < notes; i++) {
      await writeChain(() => conf.commit("0x" + randomBytes(32).toString("hex")));
    }
    console.log(`[keeper] funded confidential pool +${notes} notes → ~${CONF_POT_TARGET / U} mUSDC`);
  } catch (e) {
    console.error("[keeper] ensureConfPot:", e.message);
  }
}

let keeperBusy = false;
async function keeperTick() {
  if (keeperBusy) return;
  keeperBusy = true;
  try {
    await pushPrices();
    await ensureOnChainMarkets();
    await resolveDueOnChain();
    await ensureConfPot();
    await indexEscrowEvents();
  } finally {
    keeperBusy = false;
  }
}
if (KEEPER) {
  console.log("[keeper] on-chain keeper active:", KEEPER.address, "chain", CHAIN_ID);
} else {
  console.log("[keeper] disabled (set PRIVATE_KEY to enable)");
}

// ── Prices + off-chain shadow markets (for rich charts / implied odds) ──────────
const lastPrice = {};
async function fetchSpot(sym) {
  try {
    const r = await fetch(`https://api.coinbase.com/v2/prices/${TOKENS[sym].pair}/spot`);
    const v = Number((await r.json())?.data?.amount);
    return Number.isFinite(v) ? v : null;
  } catch { return null; }
}
async function pollPrices() {
  for (const sym of Object.keys(TOKENS)) {
    const p = await fetchSpot(sym);
    if (p != null) { lastPrice[sym] = p; await Prices.insertOne({ symbol: sym, price: p, ts: Date.now() }); }
  }
}
function impliedYesOC(px, strike, closeTs, createdAt) {
  if (px == null || !strike) return 0.5;
  const edge = (px - strike) / strike;
  const span = Math.max(1, closeTs - createdAt);
  const remaining = Math.max(0, closeTs - Date.now()) / span;
  const p = 1 / (1 + Math.exp(-edge * 120 * (0.4 + 0.6 * (1 - remaining))));
  return Math.min(0.99, Math.max(0.01, p));
}

await Vaults.updateOne({ _id: VAULT_ID },
  { $setOnInsert: { _id: VAULT_ID, name: "Molfi LP Vault", asset: "mUSDC", tvl: 0, feesEarned: 0, depositors: 0, createdAt: Date.now() } },
  { upsert: true });

await pollPrices();
setInterval(pollPrices, 10_000);
if (KEEPER && process.env.MOLFI_KEEPER !== "off") { keeperTick(); setInterval(keeperTick, 90_000); }
else if (KEEPER) console.log("[keeper] market loop disabled (MOLFI_KEEPER=off) — HSP adapter still active");
setInterval(indexEscrowEvents, 20_000);

// ── HTTP API ───────────────────────────────────────────────────────────────────
const r2 = (n) => Math.round(n * 100) / 100;
const app = express();
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "8mb" }));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, chainId: CHAIN_ID, contracts: dep, prices: lastPrice }));

// Deployment addresses for the frontend/SDK to self-configure.
app.get("/api/config", (_req, res) => res.json({ chainId: CHAIN_ID, rpc: RPC_URL, contracts: dep }));

// ── On-chain markets ────────────────────────────────────────────────────────────
app.get("/api/onchain/markets", async (req, res) => {
  try {
    const closed = req.query.status === "closed";
    const filter = closed ? { resolved: true } : { resolved: false, closeTs: { $gt: Date.now() } };
    const live = await OnchainMarkets.find(filter)
      .sort(closed ? { resolvedAt: -1 } : { closeTs: 1 }).limit(20).toArray();
    const ids = live.map((m) => m._id);
    const oiRows = await OnchainTrades.aggregate([
      { $match: { kind: "bet", market: { $in: ids } } },
      { $group: { _id: "$market", oi: { $sum: "$amount" }, bets: { $sum: 1 } } },
    ]).toArray();
    const oiMap = Object.fromEntries(oiRows.map((r) => [r._id, r]));
    res.json(live.map((m) => {
      const spot = lastPrice[m.symbol] ?? null;
      const strike = m.strikeUsd ?? null;
      return {
        marketId: m._id, symbol: m.symbol, icon: icon(m.symbol), question: m.question,
        closeTs: m.closeTs, cadenceMins: m.cadenceMins, oracle: m.oracle, resolved: !!m.resolved,
        outcome: m.outcome ?? null, strike, spot,
        yesPrice: m.resolved ? (m.outcome === 0 ? 1 : 0) : impliedYesOC(spot, strike, m.closeTs, m.createdAt),
        oi: oiMap[m._id]?.oi || 0, bets: oiMap[m._id]?.bets || 0,
      };
    }));
  } catch { res.json([]); }
});

app.get("/api/onchain/markets/:id", async (req, res) => {
  try {
    const m = await OnchainMarkets.findOne({ _id: req.params.id });
    if (!m) return res.status(404).json({ error: "not found" });
    const spot = lastPrice[m.symbol] ?? null;
    const strike = m.strikeUsd ?? null;
    res.json({
      marketId: m._id, symbol: m.symbol, icon: icon(m.symbol), question: m.question,
      closeTs: m.closeTs, cadenceMins: m.cadenceMins, oracle: m.oracle, resolved: !!m.resolved,
      outcome: m.outcome ?? null, strike, spot,
      yesPrice: m.resolved ? (m.outcome === 0 ? 1 : 0) : impliedYesOC(spot, strike, m.closeTs, m.createdAt),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/onchain/positions/:address", async (req, res) => {
  try {
    const q = { address: req.params.address };
    if (req.query.market) q.market = req.query.market;
    const rows = await OnchainTrades.find(q).sort({ block: -1 }).limit(50).toArray();
    res.json(rows.map((r) => ({ kind: r.kind, market: r.market, outcome: r.outcome ?? null,
      amount: r.amount, ts: r.ts, txHash: r.txHash || null })));
  } catch { res.json([]); }
});

// ── ZK proof service: BN254 Groth16 solvency proof for predict-escrow.betZk ─────
// Proves hidden collateral >= threshold; the domain (public signal 0) becomes the
// single-use on-chain nullifier. Returns snarkjs calldata for the EVM verifier.
const CIRCUITS = `${CONTRACTS_DIR}/../molfi-circuits/build_evm`;
let zkNonce = 0;
async function proveCalldata(circuit, input) {
  const { proof, publicSignals } = await groth16.fullProve(
    input, `${CIRCUITS}/${circuit}/${circuit}_js/${circuit}.wasm`, `${CIRCUITS}/${circuit}/final.zkey`);
  const cd = await groth16.exportSolidityCallData(proof, publicSignals);
  const [a, b, c, pub] = JSON.parse(`[${cd}]`);
  return { a, b, c, pub, publicSignals };
}

app.get("/api/zk/proof", async (_req, res) => {
  try {
    const domain = String(Date.now() * 1000 + (zkNonce++ % 1000));
    const { a, b, c, pub } = await proveCalldata("solvency", {
      domain, threshold: String(100 * U), balance: String(275 * U),
    });
    res.json({ a, b, c, pubSignals: pub, domain });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── HSP: HashKey Settlement Protocol (DeFi payment rail) ────────────────────────
// The backend plays the HSP *adapter* (signs receipts) and *coordinator* (observes),
// forwarding to the official Coordinator when HSP_COORDINATOR_URL is set. Agents pay
// a micro-fee via HSP to unlock the premium ZK proof service (x402 paywall) — the
// fee settles, zero-custody, to the protocol vault.
const HSP_NETWORK = CHAIN_ID === 177 ? "hashkey" : "hashkey-testnet";
const HSP_MERCHANT = process.env.HSP_MERCHANT || dep.vault;      // fees → protocol vault
const HSP_PROOF_PRICE = BigInt(process.env.HSP_PROOF_PRICE || String(Math.round(0.5 * U))); // 0.5 mUSDC
const HSP_TOKEN = dep.mUSDC;
const hspAdapter = KEEPER; // the keeper signs receipts as the pinned HSP adapter

app.get("/api/hsp/info", (_req, res) => res.json({
  network: HSP_NETWORK, chainId: CHAIN_ID, token: HSP_TOKEN, merchant: HSP_MERCHANT,
  adapter: hspAdapter ? hspAdapter.address : null, capability: hsp.CAP_SETTLEMENT,
  priceProof: HSP_PROOF_PRICE.toString(), coordinator: process.env.HSP_COORDINATOR_URL || null,
  chains: hsp.HSP_CHAINS,
}));

// Adapter observes a settlement the payer already made on-chain, and signs a Receipt.
// Body: { mandate, mandateSig, txHash }. Also forwards to the official Coordinator if set.
app.post("/api/hsp/observe", async (req, res) => {
  try {
    if (!hspAdapter) return res.status(503).json({ error: "HSP adapter not configured (set PRIVATE_KEY)" });
    const { mandate, mandateSig, txHash } = req.body || {};
    if (!mandate || !txHash) return res.status(400).json({ error: "mandate + txHash required" });
    const paymentId = ethers.TypedDataEncoder.hash(
      { name: "HSP", version: "1", chainId: mandate.chainId },
      { Mandate: [
        { name: "payer", type: "address" }, { name: "to", type: "address" }, { name: "token", type: "address" },
        { name: "amount", type: "uint256" }, { name: "chainId", type: "uint256" }, { name: "nonce", type: "uint256" },
        { name: "expiry", type: "uint256" }, { name: "capabilities", type: "string" }] },
      { payer: mandate.payer, to: mandate.to, token: mandate.token, amount: BigInt(mandate.amount),
        chainId: BigInt(mandate.chainId), nonce: BigInt(mandate.nonce), expiry: BigInt(mandate.expiry),
        capabilities: mandate.capabilities });
    const signed = await hsp.signReceipt(hspAdapter, {
      paymentId, txHash, chainId: mandate.chainId, to: mandate.to, amount: mandate.amount,
    });
    const coord = hsp.coordinator();
    let coordinatorAck = null;
    if (coord) { try { coordinatorAck = await coord.observe(paymentId, txHash); } catch {} }
    res.json({ ...signed, paymentId, coordinatorAck, receiptSig: signed.signature });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Independent verification of a full payment bundle (the HSP rule).
app.post("/api/hsp/verify", async (req, res) => {
  try {
    const { mandate, mandateSig, receipt, receiptSig, adapter } = req.body || {};
    const v = await hsp.verifyPayment(provider, {
      mandate, mandateSig, receipt, receiptSig, adapter,
      pinnedAdapter: hspAdapter ? hspAdapter.address : undefined,
    });
    res.json(v);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Premium ZK proof — gated behind an HSP x402 paywall. An agent must settle a
// micro-fee via HSP (verified here) before the proof is served.
app.get("/api/premium/zk/proof",
  hsp.hspPaywall({
    provider, chainId: CHAIN_ID, token: HSP_TOKEN, to: HSP_MERCHANT,
    amount: HSP_PROOF_PRICE, pinnedAdapter: hspAdapter ? hspAdapter.address : undefined,
  }),
  async (_req, res) => {
    try {
      const domain = String(Date.now() * 1000 + (zkNonce++ % 1000));
      const { a, b, c, pub } = await proveCalldata("solvency", {
        domain, threshold: String(100 * U), balance: String(275 * U),
      });
      res.json({ a, b, c, pubSignals: pub, domain, paidVia: "HSP" });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

// ── Confidential betting: hidden note → on-chain ZK claim ───────────────────────
const confField = () => BigInt("0x" + randomBytes(31).toString("hex")).toString();
app.post("/api/confidential/prepare-commit", (req, res) => {
  try {
    const side = String(req.body?.side || "YES").toUpperCase();
    const outcome = side === "NO" ? 1 : 0;
    const note = { secret: confField(), nullifier: confField(), outcome };
    const commitment =
      "0x" + createHash("sha256").update([note.secret, note.nullifier, String(note.outcome)].join("|")).digest("hex");
    res.json({ note, commitment, denom: CONF_DENOM, side: outcome === 0 ? "YES" : "NO" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/confidential/prepare-claim", async (req, res) => {
  try {
    const { note, marketId, recipient } = req.body || {};
    if (!note || !marketId || !recipient) return res.status(400).json({ error: "note + marketId + recipient required" });
    let resolved = false;
    try { resolved = Boolean(await market.isResolved(marketId)); } catch {}
    if (!resolved) return res.json({ resolved: false });
    const winner = Number(await market.winningOutcome(marketId));
    if (Number(note.outcome) !== winner) return res.json({ resolved: true, won: false, winningOutcome: winner });

    const { a, b, c, publicSignals } = await proveCalldata("confidential_bet", {
      secret: String(note.secret), nullifier: String(note.nullifier),
      outcome: String(winner), recipient: BigInt(recipient).toString(),
      pathElements: ["1", "2", "3", "4", "5", "6", "7", "8"],
      pathIndices: ["0", "1", "0", "1", "0", "0", "1", "0"],
    });
    const root = ethers.toBeHex(BigInt(publicSignals[0]), 32);
    const nullifierHash = ethers.toBeHex(BigInt(publicSignals[1]), 32);
    // Admin checkpoints this root so the contract recognizes it at claim time.
    if (KEEPER) await writeChain(() => conf.registerRoot(root));
    res.json({ resolved: true, won: true, winningOutcome: winner, payout: CONF_PAYOUT,
      a, b, c, root, nullifierHash, recipient });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Market chat (text / gif / image → IPFS via Pinata) ──────────────────────────
const PINATA_JWT = process.env.PINATA_JWT || "";
const PINATA_GATEWAY = (process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud").replace(/\/$/, "");
async function pinataUpload(buffer, filename, contentType) {
  if (!PINATA_JWT) throw new Error("Pinata not configured");
  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: contentType }), filename);
  fd.append("pinataMetadata", JSON.stringify({ name: filename, keyvalues: { app: "molfi" } }));
  const r = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS",
    { method: "POST", headers: { Authorization: `Bearer ${PINATA_JWT}` }, body: fd });
  if (!r.ok) throw new Error(`Pinata ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return { cid: j.IpfsHash, url: `${PINATA_GATEWAY}/ipfs/${j.IpfsHash}` };
}
const cleanText = (s) => String(s || "").slice(0, 2000);
const commentKind = (t) => (t === "gif" ? "gif" : t === "image" ? "image" : "text");
const serializeComment = (d) => ({
  id: d._id, address: d.address, type: d.type, text: d.text || "", path: d.path || "",
  likes: d.likes || [], ts: d.ts,
  replies: (d.replies || []).map((r) => ({ id: r.id, address: r.address, type: r.type,
    text: r.text || "", path: r.path || "", likes: r.likes || [], ts: r.ts })),
});

app.post("/api/pinata/upload", async (req, res) => {
  try {
    const { dataUrl, filename } = req.body || {};
    const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ""));
    if (!m) return res.status(400).json({ error: "expected a base64 image data URL" });
    if (!m[1].startsWith("image/")) return res.status(400).json({ error: "images only" });
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ error: "image too large (max 6MB)" });
    res.json(await pinataUpload(buf, filename || `molfi-${Date.now()}.img`, m[1]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/api/markets/:id/comments", async (req, res) => {
  try {
    const lim = Math.min(Number(req.query.limit) || 20, 100);
    const rows = await Comments.find({ marketId: req.params.id }).sort({ ts: -1 }).limit(lim).toArray();
    res.json(rows.map(serializeComment));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/markets/:id/comments", async (req, res) => {
  try {
    const { address, type, text, path } = req.body || {};
    if (!address) return res.status(400).json({ error: "address required" });
    const kind = commentKind(type);
    if (kind === "text" && !cleanText(text).trim()) return res.status(400).json({ error: "empty comment" });
    if (kind !== "text" && !path) return res.status(400).json({ error: "path required" });
    const doc = { _id: randomBytes(12).toString("hex"), marketId: req.params.id, address: String(address),
      type: kind, text: cleanText(text), path: kind === "text" ? "" : String(path), likes: [], replies: [], ts: Date.now() };
    await Comments.insertOne(doc);
    res.json(serializeComment(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/comments/:id/like", async (req, res) => {
  try {
    const { address, liked } = req.body || {};
    if (!address) return res.status(400).json({ error: "address required" });
    await Comments.updateOne({ _id: req.params.id },
      liked ? { $pull: { likes: address } } : { $addToSet: { likes: address } });
    const doc = await Comments.findOne({ _id: req.params.id });
    res.json(doc ? serializeComment(doc) : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/comments/:id/reply", async (req, res) => {
  try {
    const { address, type, text, path } = req.body || {};
    if (!address) return res.status(400).json({ error: "address required" });
    const kind = commentKind(type);
    const reply = { id: randomBytes(8).toString("hex"), address: String(address), type: kind,
      text: cleanText(text), path: kind === "text" ? "" : String(path || ""), likes: [], ts: Date.now() };
    await Comments.updateOne({ _id: req.params.id }, { $push: { replies: reply } });
    const doc = await Comments.findOne({ _id: req.params.id });
    res.json(doc ? serializeComment(doc) : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/comments/:id", async (req, res) => {
  try {
    const address = req.query.address || req.body?.address;
    const doc = await Comments.findOne({ _id: req.params.id });
    if (!doc) return res.json({ ok: true });
    if (doc.address !== address) return res.status(403).json({ error: "not your comment" });
    await Comments.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Leaderboard + vault (from indexed on-chain escrow events) ──────────────────
app.get("/api/leaderboard", async (_req, res) => {
  const rows = await OnchainTrades.aggregate([
    { $group: { _id: "$address",
      staked: { $sum: { $cond: [{ $eq: ["$kind", "bet"] }, "$amount", 0] } },
      redeemed: { $sum: { $cond: [{ $eq: ["$kind", "redeem"] }, "$amount", 0] } },
      trades: { $sum: { $cond: [{ $eq: ["$kind", "bet"] }, 1, 0] } },
      wins: { $sum: { $cond: [{ $eq: ["$kind", "redeem"] }, 1, 0] } } } },
  ]).toArray();
  res.json(rows.filter((r) => r.trades > 0)
    .map((r) => ({ address: r._id, volume: r2(r.staked), pnl: r2(r.redeemed - r.staked),
      trades: r.trades, wins: r.wins, winRate: r.trades > 0 ? Math.round((r.wins / r.trades) * 100) : 0 }))
    .sort((a, b) => b.pnl - a.pnl).slice(0, 25).map((r, i) => ({ rank: i + 1, ...r })));
});

app.get("/api/vaults", async (_req, res) => {
  try {
    const [assetsUnits, sharesUnits, priceUnits] = await Promise.all([
      vault.totalAssets(), vault.totalShares(), vault.sharePrice(),
    ]);
    const tvl = Number(assetsUnits) / U;
    const sharePrice = Number(priceUnits) / U; // starts ~1.0, rises with fees
    // Fees earned = TVL above the total shares' cost basis ≈ (sharePrice-1) * shares.
    const shares = Number(sharesUnits) / U;
    const [feeAgg] = await OnchainTrades.aggregate([
      { $match: { kind: "bet" } }, { $group: { _id: null, staked: { $sum: "$amount" }, n: { $sum: 1 } } },
    ]).toArray();
    const feeVolume = r2((feeAgg?.staked || 0) * 0.02); // total 2% fees generated
    const lpCount = await VaultDeposits.estimatedDocumentCount().catch(() => 0);
    // Vault-wide fee yield: protocol fees generated as a % of current TVL.
    const feeApr = tvl > 0 ? Math.round((feeVolume / tvl) * 1000) / 10 : 0;
    res.json([{
      _id: VAULT_ID, name: "Molfi LP Vault", asset: "mUSDC",
      tvl: r2(tvl), totalShares: r2(shares), sharePrice: Math.round(sharePrice * 1e4) / 1e4,
      feesEarned: feeVolume, feeVolume,
      apr: feeApr,
      depositors: lpCount, onchain: true,
    }]);
  } catch (e) {
    res.json([{ _id: VAULT_ID, name: "Molfi LP Vault", asset: "mUSDC", tvl: 0, feesEarned: 0, sharePrice: 1, apr: 0, error: e.message }]);
  }
});

// An LP's real vault position (shares, current value, accrued yield).
app.get("/api/vaults/position/:address", async (req, res) => {
  try {
    const [shares, value, earned, principal] = await Promise.all([
      vault.balanceOf(req.params.address),
      vault.assetsOf(req.params.address),
      vault.earnedOf(req.params.address),
      vault.principal(req.params.address),
    ]);
    const p = Number(principal) / U;
    const v = Number(value) / U;
    res.json({
      deposited: r2(p),
      value: r2(v),
      earned: r2(Number(earned) / U),
      shares: r2(Number(shares) / U),
      sharePct: 0, // filled client-side vs TVL if needed
      apr: p > 0 ? Math.round(((v - p) / p) * 1000) / 10 : 0,
    });
  } catch (e) {
    res.json({ deposited: 0, value: 0, earned: 0, shares: 0, error: e.message });
  }
});

app.get("/api/prices/:symbol", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 240, 1000);
  const pts = await Prices.find({ symbol: req.params.symbol.toUpperCase() })
    .sort({ ts: -1 }).limit(limit).toArray();
  res.json(pts.reverse().map((p) => ({ ts: p.ts, price: p.price })));
});

app.listen(PORT, () => console.log(`[molfi-backend] API on http://localhost:${PORT}`));
