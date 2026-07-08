// HSP agent-pays-for-proof demo — the full x402 settlement loop on HashKey.
//
// An autonomous agent hits the premium ZK proof endpoint, gets a 402 with HSP
// payment requirements, settles the micro-fee on-chain (zero-custody), has the
// adapter sign a receipt, then retries with an X-PAYMENT header and receives the
// proof. Finally it verifies the payment independently.
//
// Prereq: backend running (MOLFI_KEEPER=off ok), agent wallet holds mUSDC + HSK gas.
// Usage: node hsp_demo.mjs [http://localhost:4000]
import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import * as hsp from "./hsp.js";

const API = process.argv[2] || process.env.MOLFI_API_URL || "http://localhost:4000";
const env = Object.fromEntries(readFileSync(".env", "utf8").split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const RPC = env.MOLFI_RPC_URL || "https://testnet.hsk.xyz";
const CHAIN_ID = Number(env.MOLFI_CHAIN_ID) || 133;
const dep = JSON.parse(readFileSync(`${env.MOLFI_CONTRACTS_DIR || "../molfi-contracts"}/deployments/${CHAIN_ID}.json`, "utf8"));

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
const agent = new ethers.Wallet(env.PRIVATE_KEY.trim(), provider);
const get = (p, h) => fetch(`${API}${p}`, { headers: h }).then(async (r) => ({ status: r.status, body: await r.json() }));
const post = (p, b) => fetch(`${API}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());

async function main() {
  console.log(`\n=== HSP agent-pays-for-proof on HashKey (chain ${CHAIN_ID}) ===`);
  console.log(`agent ${agent.address}`);

  // 1. Hit the premium endpoint cold → expect 402 with HSP requirements.
  let r = await get("/api/premium/zk/proof");
  console.log(`\n[1] GET /api/premium/zk/proof → ${r.status}`);
  if (r.status !== 402) throw new Error("expected 402 payment required");
  const req = r.body.accepts[0];
  console.log(`    HSP requires ${ethers.formatUnits(req.amount, 6)} mUSDC → ${req.to} (${req.capability})`);

  // 2. Build + sign a mandate for the required payment.
  const { mandate, signature: mandateSig, paymentId } = await hsp.buildMandate(agent, {
    to: req.to, token: req.token, amount: req.amount, chainId: req.chainId,
  });
  console.log(`\n[2] signed mandate  paymentId ${paymentId.slice(0, 18)}…`);

  // 3. Settle on-chain (zero-custody ERC-20 transfer, agent's own wallet).
  const { txHash } = await hsp.settleMandate(agent, req.token, req.to, req.amount);
  console.log(`[3] settled on-chain  tx ${txHash}`);

  // 4. Adapter observes + signs a receipt.
  const obs = await post("/api/hsp/observe", { mandate, mandateSig, txHash });
  console.log(`[4] adapter receipt signed by ${obs.adapter.slice(0, 10)}…`);

  // 5. Retry with the X-PAYMENT header.
  const xpayment = Buffer.from(JSON.stringify({
    mandate, mandateSig, receipt: obs.receipt, receiptSig: obs.receiptSig, adapter: obs.adapter,
  })).toString("base64");
  r = await get("/api/premium/zk/proof", { "x-payment": xpayment });
  console.log(`\n[5] retry with X-PAYMENT → ${r.status}  ${r.status === 200 ? "✅ PROOF UNLOCKED (paidVia " + r.body.paidVia + ")" : JSON.stringify(r.body)}`);
  if (r.status !== 200) throw new Error("paywall did not accept payment");

  // 6. Independent verification (the HSP rule).
  const v = await post("/api/hsp/verify", { mandate, mandateSig, receipt: obs.receipt, receiptSig: obs.receiptSig, adapter: obs.adapter });
  console.log(`[6] independent verify → ${v.outcomeClass}  checks=${JSON.stringify(v.checks)}`);

  console.log(`\n=== HSP FLOW COMPLETE — agent paid via HSP, proof served, settlement verified on-chain ===`);
  console.log(`    settlement tx: https://testnet-explorer.hsk.xyz/tx/${txHash}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message || e); process.exit(1); });
