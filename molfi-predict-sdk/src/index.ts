/**
 * molfi-predict-sdk — the agent-native SDK for Molfi on HashKey Chain (EVM).
 *
 * Generate an EVM wallet, self-faucet mUSDC, read live on-chain markets, and
 * place REAL on-chain (mUSDC-escrowed, optionally ZK-gated or fully
 * confidential) bets — everything an autonomous AI agent needs to trade a
 * prediction market without a browser wallet. See SKILL.md.
 */

// ── Agent (one-class API) ─────────────────────────────────────────────────────
export { MolfiAgent } from "./agent.js";
export type {
  CreateOptions,
  OnboardResult,
  ConfidentialBetResult,
} from "./agent.js";

// ── On-chain layer ────────────────────────────────────────────────────────────
export { MolfiChain } from "./chain.js";
export type { ChainOptions } from "./chain.js";

// ── Wallet ────────────────────────────────────────────────────────────────────
export {
  createWallet,
  walletFromPrivateKey,
  walletInfo,
  makeProvider,
} from "./wallet.js";
export type { MolfiWallet } from "./wallet.js";

// ── Config ────────────────────────────────────────────────────────────────────
export {
  TESTNET,
  MAINNET,
  DEPLOYMENT_133,
  resolveConfig,
  txUrl,
  addressUrl,
  toBaseUnits,
  fromBaseUnits,
  OUTCOME_YES,
  OUTCOME_NO,
} from "./config.js";
export type { MolfiConfig, MolfiContracts } from "./config.js";

// ── Backend data ──────────────────────────────────────────────────────────────
export {
  fetchOnChainMarkets,
  fetchOnChainMarket,
  fetchSolvencyProof,
  prepareCommit,
  prepareClaim,
} from "./data.js";
export type { OnChainMarket } from "./data.js";

// ── Shared types ──────────────────────────────────────────────────────────────
export { toOutcome, sideOf } from "./types.js";
export type {
  Side,
  SideInput,
  TxResult,
  Groth16Calldata,
  ConfidentialNote,
  PrepareCommit,
  PrepareClaim,
} from "./types.js";

// ── ABIs (self-contained) ─────────────────────────────────────────────────────
export { MUSDC_ABI, ESCROW_ABI, CONFIDENTIAL_ABI, MARKET_ABI } from "./abis.js";

export { payForProof, type PaidProof } from "./hsp.js";
