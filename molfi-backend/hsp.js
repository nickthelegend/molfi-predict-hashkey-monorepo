/**
 * HSP — HashKey Settlement Protocol integration for Molfi.
 *
 * Implements HSP's "verify the settlement, not the promise" model directly, so it
 * runs self-contained on HashKey Chain and drops into the official HSP Coordinator
 * when `HSP_COORDINATOR_URL` + `HSP_API_KEY` are set.
 *
 * The three HSP wire objects + one verification rule:
 *   - Mandate   — payer-signed EIP-712 intent to transfer (primaryType "Mandate", v1).
 *   - Receipt   — adapter-signed observation that settlement occurred on-chain.
 *   - (Attestation — optional issuer vouching for KYC/sanctions; not used here.)
 *   - Rule      — ACCEPT ⟺ requiredCapabilities ⊆ satisfiedCapabilities.
 *
 * Five moves: build & sign the mandate → register with the Coordinator → settle
 * on-chain from your own wallet (zero-custody ERC-20 transfer) → observe the tx →
 * verify independently.
 *
 * Molfi uses HSP as the DeFi payment rail: an AI agent pays a micro-fee via HSP to
 * unlock the ZK proof service (x402 paywall), then places a private bet. The
 * backend plays the HSP *adapter* (signs receipts) and *coordinator* (registers /
 * observes) locally, forwarding to the real Coordinator when configured.
 */
import { ethers } from "ethers";

// HSP chain registry (mirrors GET /chains). Stablecoin overridable per deployment.
export const HSP_CHAINS = {
  "hashkey-testnet": { chainId: 133, decimals: 6 },
  hashkey: { chainId: 177, decimals: 6 },
};

export const CAP_SETTLEMENT = "proves:settlement-verified:v1";

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

const RECEIPT_TYPES = {
  Receipt: [
    { name: "paymentId", type: "bytes32" },
    { name: "txHash", type: "bytes32" },
    { name: "chainId", type: "uint256" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "capability", type: "string" },
  ],
};

const domain = (chainId) => ({ name: "HSP", version: "1", chainId });

/** Build + sign a Mandate. `paymentId` = the mandate's EIP-712 hash (idempotent). */
export async function buildMandate(wallet, { to, token, amount, chainId, capabilities = CAP_SETTLEMENT, ttlSec = 900 }) {
  const nonce = BigInt(Date.now());
  const expiry = BigInt(Math.floor(Date.now() / 1000) + ttlSec);
  const body = {
    payer: wallet.address,
    to,
    token,
    amount: BigInt(amount),
    chainId: BigInt(chainId),
    nonce,
    expiry,
    capabilities,
  };
  const signature = await wallet.signTypedData(domain(chainId), MANDATE_TYPES, body);
  const paymentId = ethers.TypedDataEncoder.hash(domain(chainId), MANDATE_TYPES, body);
  const mandate = {
    payer: body.payer, to, token,
    amount: body.amount.toString(), chainId: Number(chainId),
    nonce: nonce.toString(), expiry: expiry.toString(), capabilities,
  };
  return { mandate, signature, paymentId };
}

/** Settle a mandate on-chain: a bare, zero-custody ERC-20 transfer payer → to. */
export async function settleMandate(wallet, token, to, amount) {
  const erc20 = new ethers.Contract(token, ["function transfer(address,uint256) returns (bool)"], wallet);
  const tx = await erc20.transfer(to, BigInt(amount));
  const rcpt = await tx.wait();
  return { txHash: tx.hash, blockNumber: rcpt.blockNumber };
}

/** Adapter observes an on-chain settlement and signs a Receipt vouching for it. */
export async function signReceipt(adapterWallet, { paymentId, txHash, chainId, to, amount }) {
  const body = {
    paymentId, txHash, chainId: BigInt(chainId), to,
    amount: BigInt(amount), capability: CAP_SETTLEMENT,
  };
  const signature = await adapterWallet.signTypedData(domain(chainId), RECEIPT_TYPES, body);
  const receipt = { paymentId, txHash, chainId: Number(chainId), to, amount: body.amount.toString(), capability: CAP_SETTLEMENT };
  return { receipt, signature, adapter: adapterWallet.address };
}

/**
 * Independent verification — the HSP rule. ACCEPT iff:
 *   1. mandate signature recovers to `mandate.payer`,
 *   2. receipt signature recovers to the pinned `adapter`,
 *   3. the on-chain tx actually moved ≥ amount of `token` to `mandate.to`,
 *   4. required capabilities ⊆ the receipt's capability set,
 *   5. the mandate hasn't expired.
 * The Coordinator can't move funds — if it lied, this fails on the cryptographic
 * evidence.
 */
export async function verifyPayment(provider, {
  mandate, mandateSig, receipt, receiptSig, adapter, pinnedAdapter, requiredCapabilities = [CAP_SETTLEMENT],
}) {
  const checks = {};
  const cid = mandate.chainId;

  // 1. mandate signer == payer
  const recoveredPayer = ethers.verifyTypedData(domain(cid), MANDATE_TYPES, {
    payer: mandate.payer, to: mandate.to, token: mandate.token,
    amount: BigInt(mandate.amount), chainId: BigInt(cid),
    nonce: BigInt(mandate.nonce), expiry: BigInt(mandate.expiry), capabilities: mandate.capabilities,
  }, mandateSig);
  checks.mandateSigner = recoveredPayer.toLowerCase() === mandate.payer.toLowerCase();

  // 2. receipt signer == adapter (and adapter == pinned adapter, if pinned)
  const recoveredAdapter = ethers.verifyTypedData(domain(cid), RECEIPT_TYPES, {
    paymentId: receipt.paymentId, txHash: receipt.txHash, chainId: BigInt(cid),
    to: receipt.to, amount: BigInt(receipt.amount), capability: receipt.capability,
  }, receiptSig);
  checks.receiptSigner = recoveredAdapter.toLowerCase() === adapter.toLowerCase();
  checks.adapterPinned = !pinnedAdapter || adapter.toLowerCase() === pinnedAdapter.toLowerCase();

  // 3. on-chain settlement actually happened (ERC-20 Transfer to `to` of ≥ amount)
  checks.onChain = await verifyTransfer(provider, receipt.txHash, mandate.token, mandate.to, BigInt(mandate.amount));

  // 4. capabilities satisfied
  const satisfied = new Set([receipt.capability]);
  checks.capabilities = requiredCapabilities.every((c) => satisfied.has(c));

  // 5. not expired
  checks.notExpired = BigInt(mandate.expiry) > BigInt(Math.floor(Date.now() / 1000));

  const ok = Object.values(checks).every(Boolean);
  return { ok, outcomeClass: ok ? "ACCEPT" : "REJECT", checks };
}

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
async function verifyTransfer(provider, txHash, token, to, minAmount) {
  try {
    const rcpt = await provider.getTransactionReceipt(txHash);
    if (!rcpt || rcpt.status !== 1) return false;
    const toTopic = ethers.zeroPadValue(to.toLowerCase(), 32);
    for (const log of rcpt.logs) {
      if (log.address.toLowerCase() !== token.toLowerCase()) continue;
      if (log.topics[0] !== TRANSFER_TOPIC) continue;
      if (log.topics[2].toLowerCase() !== toTopic.toLowerCase()) continue;
      if (BigInt(log.data) >= minAmount) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── Optional official-Coordinator forwarding (no-op if not configured) ──────────
export function coordinator() {
  const url = process.env.HSP_COORDINATOR_URL;
  const apiKey = process.env.HSP_API_KEY;
  if (!url) return null;
  const headers = { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) };
  return {
    register: (mandate, signature) =>
      fetch(`${url}/payments`, { method: "POST", headers, body: JSON.stringify({ mandate, signature }) }).then((r) => r.json()),
    observe: (id, txHash) =>
      fetch(`${url}/payments/${id}/observe`, { method: "POST", headers, body: JSON.stringify({ txHash }) }).then((r) => r.json()),
    status: (id) => fetch(`${url}/payments/${id}`, { headers }).then((r) => r.json()),
  };
}

/**
 * x402 paywall middleware. On no/invalid payment → HTTP 402 with the HSP payment
 * requirements. On a valid `X-PAYMENT` header (base64 JSON of the settled
 * mandate+receipt) → verifies and calls next(). This is how an agent pays a
 * micro-fee to unlock a premium endpoint (e.g. the ZK proof service).
 */
export function hspPaywall({ provider, chainId, token, to, amount, pinnedAdapter }) {
  const accepts = [{
    scheme: "hsp", protocol: "HSP/1", chainId, token, to,
    amount: amount.toString(), capability: CAP_SETTLEMENT,
    description: "HSP verifiable settlement — pay to unlock",
  }];
  return async (req, res, next) => {
    const header = req.headers["x-payment"];
    if (!header) return res.status(402).json({ error: "payment required", accepts });
    let payment;
    try {
      payment = JSON.parse(Buffer.from(String(header), "base64").toString("utf8"));
    } catch {
      return res.status(402).json({ error: "malformed X-PAYMENT header", accepts });
    }
    // The mandate must pay at least `amount` to the merchant `to`.
    if (payment?.mandate?.to?.toLowerCase() !== to.toLowerCase() || BigInt(payment.mandate.amount || 0) < BigInt(amount)) {
      return res.status(402).json({ error: "insufficient payment", accepts });
    }
    const v = await verifyPayment(provider, { ...payment, pinnedAdapter, requiredCapabilities: [CAP_SETTLEMENT] });
    if (!v.ok) return res.status(402).json({ error: "payment verification failed", checks: v.checks, accepts });
    req.hsp = { ...payment, verification: v };
    next();
  };
}
