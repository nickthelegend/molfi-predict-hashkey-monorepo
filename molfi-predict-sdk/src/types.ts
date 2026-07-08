/** Core shared types for the Molfi HashKey Chain SDK. */

/** A market outcome side. YES maps to outcome 0, NO to outcome 1. */
export type Side = "YES" | "NO";

/** Anything the SDK accepts as a side: the string form or the raw outcome code. */
export type SideInput = Side | 0 | 1;

/** Normalize a side/outcome input to its on-chain outcome code (0=YES, 1=NO). */
export function toOutcome(side: SideInput): number {
  if (side === "YES" || side === 0) return 0;
  if (side === "NO" || side === 1) return 1;
  throw new Error(`invalid side: ${String(side)} (expected "YES" | "NO" | 0 | 1)`);
}

/** Human-readable side for an outcome code. */
export const sideOf = (outcome: number): Side => (outcome === 0 ? "YES" : "NO");

/** Result of any state-changing call: the tx hash plus an explorer link. */
export interface TxResult {
  hash: string;
  explorerUrl: string;
}

/**
 * Groth16 calldata as returned by the backend proof service (snarkjs
 * `exportSolidityCallData`). Values are decimal strings (uint256).
 */
export interface Groth16Calldata {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  /** `[domain, threshold]` for solvency proofs. */
  pubSignals: [string, string];
  /** Domain / nullifier scalar (decimal string). */
  domain: string;
}

/** Opaque confidential-bet note returned by the backend prepare-commit call. */
export interface ConfidentialNote {
  secret: string;
  nullifier: string;
  outcome: number;
}

/** Backend response for POST /api/confidential/prepare-commit. */
export interface PrepareCommit {
  note: ConfidentialNote;
  /** bytes32 commitment leaf to pass to `confidentialBet.commit`. */
  commitment: string;
  denom: number;
  side: Side;
}

/** Backend response for POST /api/confidential/prepare-claim. */
export interface PrepareClaim {
  resolved: boolean;
  won?: boolean;
  winningOutcome?: number;
  payout?: number;
  a?: [string, string];
  b?: [[string, string], [string, string]];
  c?: [string, string];
  root?: string;
  nullifierHash?: string;
  recipient?: string;
}
