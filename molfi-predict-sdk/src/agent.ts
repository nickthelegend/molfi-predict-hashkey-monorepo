/**
 * MolfiAgent — the one-class API for an autonomous trader on HashKey Chain.
 *
 *   const agent = MolfiAgent.create();          // fresh random EVM wallet
 *   // → fund agent.address with a little testnet HSK for gas, then:
 *   await agent.onboard();                       // mUSDC faucet + approvals
 *   const markets = await agent.markets();       // live on-chain markets + odds
 *   await agent.bet(markets[0].marketId, "YES", 100);  // escrow 100 mUSDC on YES
 *   await agent.redeem(markets[0].marketId);     // claim winnings after resolution
 *
 * Data (markets, odds, ZK proofs, confidential notes) comes from the Molfi
 * backend; money movement (faucet, bet, redeem, claim) is real on-chain EVM,
 * signed by the agent's own key. Every write returns { hash, explorerUrl }.
 */
import { formatUnits, type Wallet } from "ethers";
import { MolfiChain } from "./chain.js";
import { resolveConfig, txUrl, type MolfiConfig } from "./config.js";
import {
  fetchOnChainMarket,
  fetchOnChainMarkets,
  fetchSolvencyProof,
  prepareClaim,
  prepareCommit,
  type OnChainMarket,
} from "./data.js";
import type { ConfidentialNote, Groth16Calldata, SideInput, TxResult } from "./types.js";
import { createWallet, makeProvider, walletFromPrivateKey, walletInfo, type MolfiWallet } from "./wallet.js";
import { payForProof } from "./hsp.js";

export interface CreateOptions {
  /** Restore an existing agent from a private key instead of a fresh wallet. */
  privateKey?: string;
  /** Config overrides (rpcUrl, apiUrl, contract addresses, chainId, …). */
  config?: Partial<MolfiConfig>;
}

export interface OnboardResult {
  address: string;
  /** mUSDC balance after onboarding (human number). */
  musdc: number;
  faucet: TxResult;
  approveEscrow: TxResult;
  approveConfidential: TxResult;
}

/** Result of a confidential (hidden-side) bet. Persist `note` to claim later. */
export interface ConfidentialBetResult extends TxResult {
  note: ConfidentialNote;
  commitment: string;
}

export class MolfiAgent {
  readonly config: MolfiConfig;
  readonly wallet: Wallet;
  readonly chain: MolfiChain;

  constructor(wallet: Wallet, config: MolfiConfig) {
    this.config = config;
    this.wallet = wallet;
    this.chain = new MolfiChain({ config, wallet });
  }

  /**
   * Spin up an agent. With no options, mints a brand-new random EVM wallet —
   * save `agent.secret()` to reuse it. Pass `{ privateKey }` to restore one.
   */
  static create(opts: CreateOptions = {}): MolfiAgent {
    const config = resolveConfig(opts.config);
    const provider = makeProvider(config);
    const wallet = opts.privateKey
      ? walletFromPrivateKey(opts.privateKey, provider)
      : createWallet(provider);
    return new MolfiAgent(wallet, config);
  }

  get address(): string {
    return this.wallet.address;
  }

  /** The agent's {address, privateKey}. Persist to reuse this wallet. */
  secret(): MolfiWallet {
    return walletInfo(this.wallet);
  }

  /** Explorer URL for this agent's address. */
  get explorerUrl(): string {
    return `${this.config.explorerUrl}/address/${this.address}`;
  }

  /** Native HSK gas balance (base units, 18 decimals). */
  async hskBalance(): Promise<bigint> {
    const provider = this.wallet.provider;
    if (!provider) throw new Error("wallet is not connected to a provider");
    return provider.getBalance(this.address);
  }

  /**
   * Claim test mUSDC and approve the escrow + confidential contracts so bets can
   * pull funds. Requires a little testnet HSK in `this.address` for gas — fund
   * it first (a fresh wallet has zero HSK and cannot pay gas).
   */
  async onboard(): Promise<OnboardResult> {
    const faucet = await this.chain.faucet();
    const approveEscrow = await this.chain.approve(this.config.contracts.predictEscrow);
    const approveConfidential = await this.chain.approve(this.config.contracts.confidentialBet);
    return {
      address: this.address,
      musdc: await this.musdc(),
      faucet,
      approveEscrow,
      approveConfidential,
    };
  }

  // ── Market data ──────────────────────────────────────────────────────────────

  /** List open on-chain markets (or resolved with status="closed"). */
  markets(status: "open" | "closed" = "open"): Promise<OnChainMarket[]> {
    return fetchOnChainMarkets(this.config, status);
  }
  market(marketId: string): Promise<OnChainMarket | null> {
    return fetchOnChainMarket(marketId, this.config);
  }
  isResolved(marketId: string): Promise<boolean> {
    return this.chain.isResolved(marketId);
  }
  winningOutcome(marketId: string): Promise<number> {
    return this.chain.winningOutcome(marketId);
  }

  // ── Trading (real on-chain mUSDC) ─────────────────────────────────────────────

  /** mUSDC balance as a human number. */
  async musdc(): Promise<number> {
    return Number(formatUnits(await this.chain.musdcBalance(), this.config.musdcDecimals));
  }

  /** Escrow `amount` mUSDC on a side ("YES"|"NO") of an on-chain market. */
  bet(marketId: string, side: SideInput, amount: number): Promise<TxResult> {
    return this.chain.bet(marketId, side, amount);
  }

  /**
   * Solvency-gated ZK bet: fetches a fresh Groth16 proof from the backend and
   * places a bet the escrow verifies on-chain (proves collateral >= threshold
   * without revealing balance; the proof's domain is a single-use nullifier).
   */
  async betZk(marketId: string, side: SideInput, amount: number): Promise<TxResult> {
    const proof = await fetchSolvencyProof(this.config);
    if ("error" in proof) throw new Error(`ZK proof service: ${proof.error}`);
    return this.chain.betZk(marketId, side, amount, proof as Groth16Calldata);
  }

  /**
   * Solvency-gated ZK bet where the agent PAYS for its proof via HSP. Runs the
   * full HSP x402 loop (sign mandate → settle on-chain → adapter receipt →
   * unlock proof), then places the ZK bet. Returns the bet tx plus the HSP
   * settlement tx. This is the AI × DeFi × HSP path — an autonomous agent that
   * pays a verifiable micro-fee for the privacy primitive it needs.
   */
  async betZkViaHSP(
    marketId: string,
    side: SideInput,
    amount: number,
  ): Promise<TxResult & { settlementTx: string; paymentId: string }> {
    const { proof, settlementTx, paymentId } = await payForProof(this.wallet, this.config);
    const tx = await this.chain.betZk(marketId, side, amount, proof as Groth16Calldata);
    return { ...tx, settlementTx, paymentId };
  }

  /** Claim winnings after the market resolves. */
  redeem(marketId: string): Promise<TxResult> {
    return this.chain.redeem(marketId);
  }

  // ── Confidential betting (hidden side) ────────────────────────────────────────

  /**
   * Place a confidential bet whose side + owner are hidden. Prepares a
   * commitment note from the backend, escrows the fixed denomination, and
   * returns the note — SAVE IT; it's required to claim winnings later.
   */
  async confidentialBet(side: SideInput): Promise<ConfidentialBetResult> {
    const sideStr = side === "NO" || side === 1 ? "NO" : "YES";
    const prep = await prepareCommit(sideStr, this.config);
    const tx = await this.chain.commit(prep.commitment);
    return { ...tx, note: prep.note, commitment: prep.commitment };
  }

  /**
   * Claim a confidential winning note after the market resolves. Fetches the ZK
   * proof + Merkle root from the backend and submits the on-chain claim. Returns
   * null if the market isn't resolved yet or the note didn't win.
   */
  async confidentialClaim(note: ConfidentialNote, marketId: string): Promise<TxResult | null> {
    const claim = await prepareClaim(note, marketId, this.address, this.config);
    if (!claim.resolved || !claim.won) return null;
    if (!claim.a || !claim.b || !claim.c || !claim.root || !claim.nullifierHash || !claim.recipient) {
      throw new Error("prepare-claim returned an incomplete proof");
    }
    return this.chain.claim(
      marketId,
      { a: claim.a, b: claim.b, c: claim.c },
      claim.nullifierHash,
      claim.root,
      claim.recipient,
    );
  }

  /** Explorer URL for a tx hash under this agent's network. */
  txUrl(hash: string): string {
    return txUrl(this.config, hash);
  }
}
