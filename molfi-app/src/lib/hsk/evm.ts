/**
 * Molfi on-chain layer — HashKey Chain (EVM) contract calls via ethers v6.
 *
 * Reads use a JSON-RPC provider against the HashKey RPC; writes are signed by
 * the connected injected wallet (MetaMask). Contracts: Market (lifecycle),
 * PredictEscrow (real mUSDC pari-mutuel betting + on-chain ZK-gated bets),
 * MockUSDC (faucet token), ConfidentialBet (hidden-side commitment notes),
 * Vault (LP).
 *
 * (File path retains the legacy `hashkey/` name so existing imports keep working;
 * the contents target HashKey Chain / EVM only — no HashKey code remains.)
 */
import { BrowserProvider, JsonRpcProvider, JsonRpcSigner, Contract, parseUnits } from "ethers";
import { getConnectorClient } from "@wagmi/core";
import { HSK_RPC_URL, wagmiConfig } from "@/lib/hsk/chain";
import { CONTRACTS, ABIS, MUSDC_DECIMALS } from "@/lib/hsk/contracts";

// ---------------------------------------------------------------------------
// Providers / signers
// ---------------------------------------------------------------------------

let readProvider: JsonRpcProvider | null = null;
function reader(): JsonRpcProvider {
  if (!readProvider) readProvider = new JsonRpcProvider(HSK_RPC_URL);
  return readProvider;
}

/**
 * Signer for the ACTIVE wagmi connector — whatever RainbowKit connected
 * (MetaMask / WalletConnect / Coinbase / injected). Adapts the connector's viem
 * client to an ethers v6 signer so all writes go through the connected wallet,
 * not just `window.ethereum`.
 */
async function signer(): Promise<JsonRpcSigner> {
  let client;
  try {
    client = await getConnectorClient(wagmiConfig);
  } catch {
    throw new Error("Wallet not connected. Click Connect Wallet to continue.");
  }
  const { account, chain, transport } = client;
  const network = chain ? { chainId: chain.id, name: chain.name } : undefined;
  const provider = new BrowserProvider(transport as never, network);
  return new JsonRpcSigner(provider, account.address);
}

function readContract(address: string, abi: unknown): Contract {
  return new Contract(address, abi as never, reader());
}
async function writeContract(address: string, abi: unknown): Promise<Contract> {
  return new Contract(address, abi as never, await signer());
}

/** Normalize a 32-byte id to a 0x-prefixed bytes32 hex string. */
function bytes32(hex: string): string {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return `0x${h.padStart(64, "0")}`;
}

const toUnits = (usdc: number): bigint => parseUnits(String(usdc), MUSDC_DECIMALS);

async function sendAndWait(txPromise: Promise<{ hash: string; wait: () => Promise<unknown> }>) {
  const tx = await txPromise;
  await tx.wait();
  return tx.hash;
}

// ---------------------------------------------------------------------------
// Market contract (lifecycle + enumeration)
// ---------------------------------------------------------------------------

export interface OnChainMarket {
  id: string; // hex (0x…)
  question: string;
  closeTs: number; // seconds
  status: number; // 0 Trading, 1 Resolving, 2 Resolved
  outcome: number; // 0 YES, 1 NO, 2 INVALID
  // Enrichment from the backend market engine (undefined for pure on-chain reads).
  strikeUsd?: number | null; // the market's strike in USD
  spot?: number | null; // live spot price in USD
  yesPrice?: number | null; // implied YES probability 0..1
  symbol?: string; // e.g. BTC
  iconUrl?: string; // token icon
}

const API_URL: string =
  (import.meta.env.VITE_MOLFI_API_URL as string | undefined) || "http://localhost:4000";

interface BackendMarket {
  marketId: string; question: string; closeTs: number; resolved: boolean;
  outcome: number | null; strike: number | null; spot: number | null;
  yesPrice: number | null; symbol: string; icon: string;
}
function backendToMarket(r: BackendMarket): OnChainMarket {
  return {
    id: r.marketId,
    question: r.question,
    closeTs: Math.floor((r.closeTs ?? 0) / 1000), // backend ms → seconds
    status: r.resolved ? 2 : 0,
    outcome: r.outcome ?? 2,
    strikeUsd: r.strike ?? null,
    spot: r.spot ?? null,
    yesPrice: r.yesPrice ?? null,
    symbol: r.symbol,
    iconUrl: r.icon,
  };
}

/**
 * Live markets for the UI. Prefers the backend market engine (rich strike/spot/
 * odds + curated open+resolved set); falls back to raw on-chain enumeration when
 * the backend is unreachable.
 */
export async function listMarkets(): Promise<OnChainMarket[]> {
  try {
    const [open, closed] = await Promise.all([
      fetch(`${API_URL}/api/onchain/markets`).then((r) => r.json()),
      fetch(`${API_URL}/api/onchain/markets?status=closed`).then((r) => r.json()).catch(() => []),
    ]);
    const rows: BackendMarket[] = [
      ...(Array.isArray(open) ? open : []),
      ...(Array.isArray(closed) ? closed : []),
    ];
    if (rows.length) return rows.map(backendToMarket);
  } catch {
    /* backend down — fall back to on-chain */
  }
  const market = readContract(CONTRACTS.market, ABIS.market);
  const ids = (await market.markets()) as string[];
  const out: OnChainMarket[] = [];
  for (const id of ids ?? []) {
    const m = await getMarket(id).catch(() => null);
    if (m) out.push(m);
  }
  return out;
}

/** Fetch a single market's state by bytes32 id. */
export async function getMarket(idHex: string): Promise<OnChainMarket> {
  const market = readContract(CONTRACTS.market, ABIS.market);
  const m = await market.getMarket(bytes32(idHex));
  return {
    id: bytes32(idHex),
    question: m.question as string,
    closeTs: Number(m.closeTs),
    status: Number(m.status),
    outcome: Number(m.outcome),
  };
}

export async function isResolved(idHex: string): Promise<boolean> {
  const market = readContract(CONTRACTS.market, ABIS.market);
  return Boolean(await market.isResolved(bytes32(idHex)));
}

/** Winning outcome (0 YES / 1 NO / 2 INVALID) for a resolved market. */
export async function winningOutcome(idHex: string): Promise<number> {
  const market = readContract(CONTRACTS.market, ABIS.market);
  return Number(await market.winningOutcome(bytes32(idHex)));
}

// ---------------------------------------------------------------------------
// mUSDC token + faucet
// ---------------------------------------------------------------------------

/** Claim test mUSDC to `to` (open faucet, signed by the connected wallet). */
export async function faucet(to: string): Promise<string> {
  const musdc = await writeContract(CONTRACTS.musdc, ABIS.musdc);
  return sendAndWait(musdc.faucet(to));
}

/** mUSDC balance (base units) for an address. */
export async function musdcBalance(addr: string): Promise<bigint> {
  const musdc = readContract(CONTRACTS.musdc, ABIS.musdc);
  return BigInt((await musdc.balanceOf(addr)) ?? 0);
}

/** Ensure the escrow (or any spender) is approved for `amount` mUSDC. */
async function ensureApproval(owner: string, spender: string, amount: bigint): Promise<void> {
  const musdcRead = readContract(CONTRACTS.musdc, ABIS.musdc);
  const current = BigInt((await musdcRead.allowance(owner, spender)) ?? 0);
  if (current >= amount) return;
  const musdc = await writeContract(CONTRACTS.musdc, ABIS.musdc);
  await sendAndWait(musdc.approve(spender, amount));
}

// ---------------------------------------------------------------------------
// PredictEscrow (real mUSDC bet escrow + pari-mutuel payout)
// ---------------------------------------------------------------------------

/** Escrow `amountUsdc` mUSDC on an outcome (0=YES, 1=NO) of an on-chain market. */
export async function escrowBet(
  walletAddress: string,
  marketIdHex: string,
  outcome: number,
  amountUsdc: number,
): Promise<string> {
  const amount = toUnits(amountUsdc);
  await ensureApproval(walletAddress, CONTRACTS.predictEscrow, amount);
  const escrow = await writeContract(CONTRACTS.predictEscrow, ABIS.predictEscrow);
  return sendAndWait(escrow.bet(bytes32(marketIdHex), outcome, amount));
}

/**
 * Privacy bet: escrow `amountUsdc` on `outcome`, gated by a Groth16 proof the
 * escrow verifies ON-CHAIN before accepting. Proof arrays come from the backend
 * ZK service (`GET /api/zk/proof` → { a, b, c, pubSignals }).
 */
export async function escrowBetZk(
  walletAddress: string,
  marketIdHex: string,
  outcome: number,
  amountUsdc: number,
  a: unknown,
  b: unknown,
  pubSignals: unknown,
  c?: unknown,
): Promise<string> {
  const amount = toUnits(amountUsdc);
  await ensureApproval(walletAddress, CONTRACTS.predictEscrow, amount);
  const escrow = await writeContract(CONTRACTS.predictEscrow, ABIS.predictEscrow);
  // Callers historically pass (proof, publicInputs, domain). Support both shapes:
  const proof = a as { a?: unknown; b?: unknown; c?: unknown };
  const pa = proof?.a ?? a;
  const pb = proof?.b ?? b;
  const pc = proof?.c ?? c;
  const signals = pubSignals ?? b;
  return sendAndWait(
    escrow.betZk(bytes32(marketIdHex), outcome, amount, pa, pb, pc, signals),
  );
}

/** Claim winnings on a resolved on-chain market. */
export async function escrowRedeem(
  walletAddress: string,
  marketIdHex: string,
): Promise<string> {
  void walletAddress;
  const escrow = await writeContract(CONTRACTS.predictEscrow, ABIS.predictEscrow);
  return sendAndWait(escrow.redeem(bytes32(marketIdHex)));
}

/** A wallet's escrowed stake (base units) on (market, outcome). */
export async function escrowPosition(
  marketIdHex: string,
  outcome: number,
  who: string,
): Promise<bigint> {
  const escrow = readContract(CONTRACTS.predictEscrow, ABIS.predictEscrow);
  return BigInt((await escrow.position(bytes32(marketIdHex), outcome, who)) ?? 0);
}

/** Total mUSDC (base units) escrowed across both sides of a market. */
export async function escrowTotal(marketIdHex: string): Promise<bigint> {
  const escrow = readContract(CONTRACTS.predictEscrow, ABIS.predictEscrow);
  return BigInt((await escrow.total(bytes32(marketIdHex))) ?? 0);
}

/** Total mUSDC (base units) escrowed on one outcome (the real on-chain pool). */
export async function escrowPool(marketIdHex: string, outcome: number): Promise<bigint> {
  const escrow = readContract(CONTRACTS.predictEscrow, ABIS.predictEscrow);
  return BigInt((await escrow.pool(bytes32(marketIdHex), outcome)) ?? 0);
}

// ---------------------------------------------------------------------------
// Legacy settlement helpers (kept for API stability; map onto PredictEscrow)
// ---------------------------------------------------------------------------

export async function balance(trader: string): Promise<bigint> {
  return musdcBalance(trader);
}
export async function position(
  holder: string,
  marketHex: string,
  outcome: number,
): Promise<bigint> {
  return escrowPosition(marketHex, outcome, holder);
}
export async function escrow(marketHex: string): Promise<bigint> {
  return escrowTotal(marketHex);
}
export async function deposit(trader: string, amount: bigint): Promise<string> {
  return vaultDepositOnChain(trader, Number(amount) / 10 ** MUSDC_DECIMALS);
}
export async function redeem(
  holder: string,
  marketHex: string,
): Promise<string> {
  return escrowRedeem(holder, marketHex);
}

// ---------------------------------------------------------------------------
// LP vault (deposit mUSDC on-chain)
// ---------------------------------------------------------------------------

/**
 * Deposit `amountUsdc` mUSDC into the LP vault → mints vault shares at NAV. The
 * 2% protocol fee routed to the vault by PredictEscrow accrues to these shares,
 * so the LP earns real yield.
 */
export async function vaultDepositOnChain(
  walletAddress: string,
  amountUsdc: number,
): Promise<string> {
  const amount = toUnits(amountUsdc);
  await ensureApproval(walletAddress, CONTRACTS.vault, amount);
  const vault = await writeContract(CONTRACTS.vault, ABIS.vault);
  return sendAndWait(vault.deposit(amount));
}

/** Withdraw the LP's entire vault position (principal + accrued yield). */
export async function vaultWithdrawAll(): Promise<string> {
  const vault = await writeContract(CONTRACTS.vault, ABIS.vault);
  return sendAndWait(vault.withdrawAll());
}

/** Withdraw a specific number of shares (base units). */
export async function vaultWithdrawShares(shares: bigint): Promise<string> {
  const vault = await writeContract(CONTRACTS.vault, ABIS.vault);
  return sendAndWait(vault.withdraw(shares));
}

/** Vault-wide stats: TVL (mUSDC), NAV/share, total shares. */
export async function vaultStats(): Promise<{ tvl: number; sharePrice: number; totalShares: number }> {
  const v = readContract(CONTRACTS.vault, ABIS.vault);
  const [tvl, sp, ts] = await Promise.all([v.totalAssets(), v.sharePrice(), v.totalShares()]);
  return { tvl: Number(tvl) / 1e6, sharePrice: Number(sp) / 1e6, totalShares: Number(ts) / 1e6 };
}

/** An LP's position: shares, current value, accrued yield, net principal (mUSDC). */
export async function vaultPositionOf(
  addr: string,
): Promise<{ shares: bigint; value: number; earned: number; principal: number }> {
  const v = readContract(CONTRACTS.vault, ABIS.vault);
  const [shares, value, earned, principal] = await Promise.all([
    v.balanceOf(addr),
    v.assetsOf(addr),
    v.earnedOf(addr),
    v.principal(addr),
  ]);
  return {
    shares: shares as bigint,
    value: Number(value) / 1e6,
    earned: Number(earned) / 1e6,
    principal: Number(principal) / 1e6,
  };
}

// ---------------------------------------------------------------------------
// ConfidentialBet (hidden-side commitment notes + on-chain ZK claim)
// ---------------------------------------------------------------------------

/** Escrow one fixed-denomination commitment note (hides the chosen side). */
export async function confidentialCommit(
  walletAddress: string,
  commitmentHex: string,
): Promise<string> {
  const conf = readContract(CONTRACTS.confidentialBet, ABIS.confidentialBet);
  const denom = BigInt((await conf.denom()) ?? 0);
  await ensureApproval(walletAddress, CONTRACTS.confidentialBet, denom);
  const confW = await writeContract(CONTRACTS.confidentialBet, ABIS.confidentialBet);
  return sendAndWait(confW.commit(bytes32(commitmentHex)));
}

/**
 * Claim a winning confidential note. The Groth16 proof (from the backend) is
 * verified ON-CHAIN; the nullifier is burned and payout goes to the wallet.
 */
export async function confidentialClaim(
  walletAddress: string,
  marketIdHex: string,
  proof: { a: unknown; b: unknown; c: unknown },
  nullifierHashHex: string,
  _recipientFieldHex: string,
  rootHex: string,
): Promise<string> {
  void _recipientFieldHex;
  const conf = await writeContract(CONTRACTS.confidentialBet, ABIS.confidentialBet);
  return sendAndWait(
    conf.claim(
      bytes32(marketIdHex),
      proof.a,
      proof.b,
      proof.c,
      bytes32(nullifierHashHex),
      bytes32(rootHex),
      walletAddress,
    ),
  );
}
