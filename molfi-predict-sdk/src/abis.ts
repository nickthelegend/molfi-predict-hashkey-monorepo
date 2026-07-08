/**
 * Self-contained ABI fragments for the Molfi contracts the SDK talks to.
 *
 * These are human-readable ethers v6 fragments covering only the functions the
 * SDK calls — a hand-copied subset of molfi-contracts/out/<Name>.sol/<Name>.json.
 * Keeping them here means the published SDK never depends on the contracts build
 * dir at runtime.
 */

/** MockUSDC (mUSDC) — 6-decimal ERC-20 with an open testnet faucet. */
export const MUSDC_ABI = [
  "function faucet(address to) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
] as const;

/** PredictEscrow — pari-mutuel YES/NO betting with real mUSDC at stake. */
export const ESCROW_ABI = [
  "function bet(bytes32 marketId, uint32 outcome, uint256 amount) external",
  "function betZk(bytes32 marketId, uint32 outcome, uint256 amount, uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[2] pubSignals) external",
  "function redeem(bytes32 marketId) external returns (uint256)",
  "function total(bytes32 marketId) external view returns (uint256)",
  "function pool(bytes32 marketId, uint32 outcome) external view returns (uint256)",
  "function position(bytes32 marketId, uint32 outcome, address bettor) external view returns (uint256)",
  "function redeemed(bytes32 marketId, address bettor) external view returns (bool)",
  "event Bet(bytes32 indexed marketId, address indexed bettor, uint32 outcome, uint256 amount)",
  "event Redeemed(bytes32 indexed marketId, address indexed bettor, uint256 net)",
] as const;

/** ConfidentialBet — hidden-side betting via commitment notes + ZK claim. */
export const CONFIDENTIAL_ABI = [
  "function commit(bytes32 commitment) external returns (uint256 index)",
  "function claim(bytes32 marketId, uint256[2] a, uint256[2][2] b, uint256[2] c, bytes32 nullifierHash, bytes32 root, address recipient) external returns (uint256)",
  "function denom() external view returns (uint256)",
  "function pot() external view returns (uint256)",
  "function isNullifierUsed(bytes32 nullifierHash) external view returns (bool)",
  "function isRootKnown(bytes32 root) external view returns (bool)",
  "event Commit(bytes32 indexed commitment, uint256 index)",
  "event Claim(address indexed recipient, uint256 payout)",
] as const;

/** Market — binary market lifecycle + resolution source of truth. */
export const MARKET_ABI = [
  "function isResolved(bytes32 id) external view returns (bool)",
  "function winningOutcome(bytes32 id) external view returns (uint32)",
  "function resolveFromOracle(bytes32 id) external returns (uint32)",
  "function markets() external view returns (bytes32[])",
  "function marketCount() external view returns (uint256)",
] as const;
