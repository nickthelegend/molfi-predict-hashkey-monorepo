/**
 * Read the Molfi backend REST API — the live index of on-chain markets, the ZK
 * solvency-proof service, and the confidential-bet prepare endpoints. Pure
 * fetch; works in Node and the browser.
 */
import { TESTNET, type MolfiConfig } from "./config.js";
import type { Groth16Calldata, PrepareClaim, PrepareCommit, Side } from "./types.js";

/** An open (or resolved) on-chain market an agent can bet on. */
export interface OnChainMarket {
  /** bytes32 market id — the value passed to bet/betZk/redeem. */
  marketId: string;
  symbol: string;
  icon?: string;
  question: string;
  closeTs: number;
  cadenceMins?: number;
  oracle?: string;
  resolved: boolean;
  outcome: number | null;
  strike: number | null;
  spot: number | null;
  /** Implied YES probability in [0,1]. */
  yesPrice: number;
  oi?: number;
  bets?: number;
}

async function getJson<T>(config: MolfiConfig, path: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(`${config.apiUrl}${path}`);
    if (!r.ok) return fallback;
    return (await r.json()) as T;
  } catch {
    return fallback;
  }
}

async function postJson<T>(config: MolfiConfig, path: string, body: unknown): Promise<T> {
  const r = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} → HTTP ${r.status}: ${await r.text().catch(() => "")}`);
  return (await r.json()) as T;
}

/** List open on-chain markets (or resolved ones with status="closed"). */
export const fetchOnChainMarkets = (config = TESTNET, status: "open" | "closed" = "open") =>
  getJson<OnChainMarket[]>(config, `/api/onchain/markets${status === "closed" ? "?status=closed" : ""}`, []);

/** Fetch a single on-chain market by id. */
export const fetchOnChainMarket = (id: string, config = TESTNET) =>
  getJson<OnChainMarket | null>(config, `/api/onchain/markets/${encodeURIComponent(id)}`, null);

/**
 * Fetch a fresh Groth16 solvency proof for a ZK-gated bet. The backend proves
 * "hidden collateral >= threshold" and returns snarkjs calldata plus the domain
 * (public signal 0), which becomes a single-use on-chain nullifier.
 */
export const fetchSolvencyProof = (config = TESTNET) =>
  getJson<Groth16Calldata | { error: string }>(config, `/api/zk/proof`, { error: "proof service unavailable" });

/** Prepare a confidential note + commitment for a hidden-side bet. */
export const prepareCommit = (side: Side, config = TESTNET) =>
  postJson<PrepareCommit>(config, `/api/confidential/prepare-commit`, { side });

/** Prepare a confidential claim (ZK proof + root + nullifier) for a resolved market. */
export const prepareClaim = (
  note: PrepareCommit["note"],
  marketId: string,
  recipient: string,
  config = TESTNET,
) => postJson<PrepareClaim>(config, `/api/confidential/prepare-claim`, { note, marketId, recipient });
