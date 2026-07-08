/**
 * HSP (HashKey Settlement Protocol) client for the Molfi agent SDK.
 *
 * Lets an autonomous agent pay a verifiable micro-fee to unlock the premium ZK
 * proof service (x402 paywall): build & sign an EIP-712 mandate, settle it
 * on-chain (zero-custody), have the adapter sign a receipt, then retry with an
 * `X-PAYMENT` header. Mirrors the backend `hsp.js` adapter.
 */
import { Contract, TypedDataEncoder, Wallet } from "ethers";
import type { MolfiConfig } from "./config.js";
import type { Groth16Calldata } from "./types.js";

const MANDATE_TYPES = {
  Mandate: [
    { name: "payer", type: "address" },
    { name: "to", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "chainId", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "capabilities", type: "string" },
  ],
};

const domain = (chainId: number) => ({ name: "HSP", version: "1", chainId });

export interface PaidProof {
  proof: Groth16Calldata & { paidVia?: string };
  settlementTx: string;
  paymentId: string;
}

/**
 * Pay for one premium ZK proof via HSP and return it plus the settlement tx.
 * Requires the agent wallet to hold mUSDC + a little HSK for gas.
 */
export async function payForProof(wallet: Wallet, config: MolfiConfig): Promise<PaidProof> {
  const api = config.apiUrl;

  // 1. Cold call → 402 with HSP requirements.
  const cold = await fetch(`${api}/api/premium/zk/proof`);
  if (cold.status !== 402) throw new Error(`expected 402, got ${cold.status}`);
  const req = (await cold.json()).accepts[0];

  // 2. Build + sign the mandate.
  const nonce = BigInt(Date.now());
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 900);
  const typed = {
    payer: wallet.address, to: req.to, token: req.token, amount: BigInt(req.amount),
    chainId: BigInt(req.chainId), nonce, expiry, capabilities: req.capability,
  };
  const mandateSig = await wallet.signTypedData(domain(req.chainId), MANDATE_TYPES, typed);
  const paymentId = TypedDataEncoder.hash(domain(req.chainId), MANDATE_TYPES, typed);
  const mandate = {
    payer: wallet.address, to: req.to, token: req.token, amount: String(req.amount),
    chainId: req.chainId, nonce: nonce.toString(), expiry: expiry.toString(), capabilities: req.capability,
  };

  // 3. Settle on-chain (zero-custody ERC-20 transfer).
  const erc20 = new Contract(req.token, ["function transfer(address,uint256) returns (bool)"], wallet);
  const tx = await erc20.transfer(req.to, BigInt(req.amount));
  await tx.wait();

  // 4. Adapter observes + signs a receipt.
  const obs = await fetch(`${api}/api/hsp/observe`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mandate, mandateSig, txHash: tx.hash }),
  }).then((r) => r.json());

  // 5. Retry with the X-PAYMENT header → the proof.
  const xpayment = Buffer.from(JSON.stringify({
    mandate, mandateSig, receipt: obs.receipt, receiptSig: obs.receiptSig, adapter: obs.adapter,
  })).toString("base64");
  const res = await fetch(`${api}/api/premium/zk/proof`, { headers: { "x-payment": xpayment } });
  if (res.status !== 200) throw new Error(`paywall rejected payment: ${res.status}`);
  const proof = await res.json();

  return { proof, settlementTx: tx.hash, paymentId };
}
