/**
 * Molfi on-chain service — HashKey Chain (EVM).
 *
 * Reads go through a JSON-RPC provider; writes are signed by the connected
 * wallet's ethers signer (from `useWallet().getSigner()`). Wraps the deployed
 * MockUSDC / Market / PredictEscrow / ConfidentialBet contracts and the ZK /
 * confidential backend endpoints.
 *
 * EVM contract service (ethers); page-facing helpers keep familiar names.
 */
import { Contract, JsonRpcProvider, type Signer } from "ethers";
import { API_URL, CONTRACTS, DENOM, RPC_URL } from "@/config/molfi";
import {
  MockUSDCAbi,
  MarketAbi,
  PredictEscrowAbi,
  ConfidentialBetAbi,
} from "@/config/abis";

// ─── Providers / contract factories ────────────────────────────────────────────

let _provider: JsonRpcProvider | null = null;
export function getProvider(): JsonRpcProvider {
  if (!_provider) _provider = new JsonRpcProvider(RPC_URL);
  return _provider;
}

const musdcRead = () =>
  new Contract(CONTRACTS.mUSDC, MockUSDCAbi as never, getProvider());
const marketRead = () =>
  new Contract(CONTRACTS.market, MarketAbi as never, getProvider());
const escrowRead = () =>
  new Contract(CONTRACTS.predictEscrow, PredictEscrowAbi as never, getProvider());

const musdcWrite = (signer: Signer) =>
  new Contract(CONTRACTS.mUSDC, MockUSDCAbi as never, signer);
const escrowWrite = (signer: Signer) =>
  new Contract(CONTRACTS.predictEscrow, PredictEscrowAbi as never, signer);
const confWrite = (signer: Signer) =>
  new Contract(CONTRACTS.confidentialBet, ConfidentialBetAbi as never, signer);

// ─── Outcome constants ─────────────────────────────────────────────────────────

export const OUTCOME_YES = 0;
export const OUTCOME_NO = 1;

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface OnChainMarket {
  id: string; // 0x-prefixed bytes32
  question: string;
  closeTs: number;
  status: number; // 0 Trading, 1 Resolving, 2 Resolved
  outcome: number; // 0 YES, 1 NO, 2 INVALID
}

/** mUSDC balance (raw, 6 decimals). */
export async function musdcBalance(address: string): Promise<bigint> {
  return (await musdcRead().balanceOf(address)) as bigint;
}

/** mUSDC allowance for a spender (raw, 6 decimals). */
export async function musdcAllowance(
  owner: string,
  spender: string,
): Promise<bigint> {
  return (await musdcRead().allowance(owner, spender)) as bigint;
}

/** Read a single market's on-chain state. */
export async function getMarketInfo(id: string): Promise<OnChainMarket> {
  const m = await marketRead().getMarket(id);
  return {
    id: m.id ?? id,
    question: m.question,
    closeTs: Number(m.closeTs),
    status: Number(m.status),
    outcome: Number(m.outcome),
  };
}

/** The resolved winning outcome for a market (0 YES, 1 NO, 2 INVALID). */
export async function winningOutcome(id: string): Promise<number> {
  return Number(await marketRead().winningOutcome(id));
}

/** Total pooled collateral for a market outcome (raw, 6 decimals). */
export async function outcomePool(
  marketId: string,
  outcome: number,
): Promise<bigint> {
  return (await escrowRead().pool(marketId, outcome)) as bigint;
}

/** Enumerate every market and read its state. */
export async function listMarkets(): Promise<OnChainMarket[]> {
  const ids = (await marketRead().markets()) as string[];
  const out: OnChainMarket[] = [];
  for (const id of ids ?? []) {
    try {
      out.push(await getMarketInfo(id));
    } catch {
      /* skip unreadable market */
    }
  }
  return out;
}

// ─── Writes ────────────────────────────────────────────────────────────────────

/** Mint test mUSDC to `to` via the faucet. Returns tx hash. */
export async function faucet(signer: Signer, to: string): Promise<string> {
  const tx = await musdcWrite(signer).faucet(to);
  await tx.wait();
  return tx.hash;
}

/** Approve `spender` to move `amount` (raw 6dp) mUSDC. Returns tx hash. */
export async function approve(
  signer: Signer,
  spender: string,
  amount: bigint,
): Promise<string> {
  const tx = await musdcWrite(signer).approve(spender, amount);
  await tx.wait();
  return tx.hash;
}

/** Plain bet: approve escrow then place the bet. `outcome` 0=YES 1=NO. */
export async function bet(
  signer: Signer,
  marketId: string,
  outcome: number,
  amount: bigint,
): Promise<string> {
  await approve(signer, CONTRACTS.predictEscrow, amount);
  const tx = await escrowWrite(signer).bet(marketId, outcome, amount);
  await tx.wait();
  return tx.hash;
}

interface ZkProof {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  pubSignals: string[];
}

/** ZK bet: fetch a proof from the backend, approve, then betZk. */
export async function betZk(
  signer: Signer,
  marketId: string,
  outcome: number,
  amount: bigint,
): Promise<string> {
  const proof = await apiGet<ZkProof>(`/api/zk/proof`);
  await approve(signer, CONTRACTS.predictEscrow, amount);
  const tx = await escrowWrite(signer).betZk(
    marketId,
    outcome,
    amount,
    proof.a,
    proof.b,
    proof.c,
    proof.pubSignals,
  );
  await tx.wait();
  return tx.hash;
}

/** Redeem winnings for a resolved market. Returns tx hash. */
export async function redeem(
  signer: Signer,
  marketId: string,
): Promise<string> {
  const tx = await escrowWrite(signer).redeem(marketId);
  await tx.wait();
  return tx.hash;
}

// ─── Confidential bet (commit / claim) ──────────────────────────────────────────

interface PrepareCommitResponse {
  note: string;
  commitment: string;
  denom: number | string;
}

const NOTE_STORAGE_PREFIX = "molfi.confidential.note.";

/** Save a confidential note for later claiming. */
function saveNote(commitment: string, note: string) {
  try {
    localStorage.setItem(NOTE_STORAGE_PREFIX + commitment, note);
  } catch {
    /* storage unavailable */
  }
}

export function listSavedNotes(): { commitment: string; note: string }[] {
  const out: { commitment: string; note: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(NOTE_STORAGE_PREFIX)) {
      out.push({
        commitment: k.slice(NOTE_STORAGE_PREFIX.length),
        note: localStorage.getItem(k) ?? "",
      });
    }
  }
  return out;
}

/**
 * Confidential commit: ask backend to prepare a commitment for `side`, approve
 * the fixed denomination, commit on-chain, and persist the note locally.
 */
export async function confidentialCommit(
  signer: Signer,
  side: "yes" | "no",
): Promise<{ hash: string; note: string; commitment: string }> {
  const prep = await apiPost<PrepareCommitResponse>(
    `/api/confidential/prepare-commit`,
    { side },
  );
  const denom = BigInt(prep.denom ?? DENOM);
  await approve(signer, CONTRACTS.confidentialBet, denom);
  const tx = await confWrite(signer).commit(prep.commitment);
  await tx.wait();
  saveNote(prep.commitment, prep.note);
  return { hash: tx.hash, note: prep.note, commitment: prep.commitment };
}

interface PrepareClaimResponse {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  root: string;
  nullifierHash: string;
  recipient: string;
  won: boolean;
}

/**
 * Confidential claim: ask backend to prepare a claim proof for a saved note,
 * then submit the on-chain claim if the position won.
 */
export async function confidentialClaim(
  signer: Signer,
  note: string,
  marketId: string,
  recipient: string,
): Promise<{ hash: string | null; won: boolean }> {
  const prep = await apiPost<PrepareClaimResponse>(
    `/api/confidential/prepare-claim`,
    { note, marketId, recipient },
  );
  if (!prep.won) return { hash: null, won: false };
  const tx = await confWrite(signer).claim(
    marketId,
    prep.a,
    prep.b,
    prep.c,
    prep.nullifierHash,
    prep.root,
    prep.recipient,
  );
  await tx.wait();
  return { hash: tx.hash, won: true };
}

// ─── Backend helpers ────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
