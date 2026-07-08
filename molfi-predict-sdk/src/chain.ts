/**
 * The on-chain layer: real ethers v6 calls to Molfi's HashKey Chain contracts,
 * signed by an EVM key (so an autonomous agent can transact without a browser
 * wallet). Reads are view calls; writes are sent and awaited (1 confirmation).
 *
 *   chain.faucet()                          → claim test mUSDC
 *   chain.musdcBalance()                    → read mUSDC balance
 *   chain.approve(spender, amount)          → ERC-20 approval
 *   chain.bet(marketId, "YES", 100)         → escrow real mUSDC on an outcome
 *   chain.betZk(marketId, "YES", 100, ...)  → bet gated by an on-chain Groth16 proof
 *   chain.redeem(marketId)                  → claim winnings after resolution
 *   chain.commit(commitment)                → hidden-side confidential note
 *   chain.claim(...)                        → ZK claim of a confidential winning note
 */
import { Contract, MaxUint256, type Wallet } from "ethers";
import { CONFIDENTIAL_ABI, ESCROW_ABI, MARKET_ABI, MUSDC_ABI } from "./abis.js";
import { TESTNET, toBaseUnits, txUrl, type MolfiConfig } from "./config.js";
import { toOutcome, type Groth16Calldata, type SideInput, type TxResult } from "./types.js";

export interface ChainOptions {
  config?: MolfiConfig;
  /** A connected ethers Wallet used to sign and send transactions. */
  wallet: Wallet;
}

export class MolfiChain {
  readonly config: MolfiConfig;
  readonly wallet: Wallet;
  readonly musdc: Contract;
  readonly escrow: Contract;
  readonly confidential: Contract;
  readonly market: Contract;

  constructor(opts: ChainOptions) {
    this.config = opts.config ?? TESTNET;
    this.wallet = opts.wallet;
    const c = this.config.contracts;
    this.musdc = new Contract(c.mUSDC, MUSDC_ABI, this.wallet);
    this.escrow = new Contract(c.predictEscrow, ESCROW_ABI, this.wallet);
    this.confidential = new Contract(c.confidentialBet, CONFIDENTIAL_ABI, this.wallet);
    this.market = new Contract(c.market, MARKET_ABI, this.wallet);
  }

  get address(): string {
    return this.wallet.address;
  }

  /** Send a populated contract transaction, wait 1 confirmation, return hash + link. */
  private async send(tx: Promise<{ hash: string; wait: () => Promise<unknown> }>): Promise<TxResult> {
    const sent = await tx;
    await sent.wait();
    return { hash: sent.hash, explorerUrl: txUrl(this.config, sent.hash) };
  }

  // ── mUSDC ──────────────────────────────────────────────────────────────────

  /** Claim 10,000 test mUSDC from the open faucet (defaults to the signer). */
  faucet(to?: string): Promise<TxResult> {
    return this.send(this.musdc.faucet(to ?? this.address));
  }

  /** mUSDC balance in base units (6 decimals). */
  async musdcBalance(who?: string): Promise<bigint> {
    return this.musdc.balanceOf(who ?? this.address);
  }

  /** Approve `spender` to pull mUSDC. `amount` in base units; defaults to max. */
  approve(spender: string, amount: bigint = MaxUint256): Promise<TxResult> {
    return this.send(this.musdc.approve(spender, amount));
  }

  /** Current mUSDC allowance (base units) from the signer to `spender`. */
  allowance(spender: string, owner?: string): Promise<bigint> {
    return this.musdc.allowance(owner ?? this.address, spender);
  }

  // ── Betting (PredictEscrow) ──────────────────────────────────────────────────

  /** Escrow `amount` mUSDC (human number) on a side. Requires prior approval. */
  bet(marketId: string, side: SideInput, amount: number): Promise<TxResult> {
    return this.send(
      this.escrow.bet(marketId, toOutcome(side), toBaseUnits(amount, this.config.musdcDecimals)),
    );
  }

  /**
   * Privacy bet: escrow gated by an on-chain Groth16 solvency proof. The proof
   * is verified inside this transaction and its domain is burned as a single-use
   * nullifier. `proof` is the calldata from the backend `/api/zk/proof`.
   */
  betZk(marketId: string, side: SideInput, amount: number, proof: Groth16Calldata): Promise<TxResult> {
    return this.send(
      this.escrow.betZk(
        marketId,
        toOutcome(side),
        toBaseUnits(amount, this.config.musdcDecimals),
        proof.a,
        proof.b,
        proof.c,
        proof.pubSignals,
      ),
    );
  }

  /** Claim winnings after the market resolves. */
  redeem(marketId: string): Promise<TxResult> {
    return this.send(this.escrow.redeem(marketId));
  }

  async escrowTotal(marketId: string): Promise<bigint> {
    return this.escrow.total(marketId);
  }
  async escrowPosition(marketId: string, side: SideInput, who?: string): Promise<bigint> {
    return this.escrow.position(marketId, toOutcome(side), who ?? this.address);
  }

  // ── Confidential betting (ConfidentialBet) ───────────────────────────────────

  /** The fixed confidential denomination in base units. */
  confidentialDenom(): Promise<bigint> {
    return this.confidential.denom();
  }

  /** Escrow one fixed-denomination hidden-side note (bytes32 commitment). */
  commit(commitment: string): Promise<TxResult> {
    return this.send(this.confidential.commit(commitment));
  }

  /**
   * Claim a confidential winning note. Verifies the ZK proof on-chain, burns the
   * nullifier, and pays the recipient. Args come from the backend prepare-claim.
   */
  claim(
    marketId: string,
    proof: { a: [string, string]; b: [[string, string], [string, string]]; c: [string, string] },
    nullifierHash: string,
    root: string,
    recipient: string,
  ): Promise<TxResult> {
    return this.send(
      this.confidential.claim(marketId, proof.a, proof.b, proof.c, nullifierHash, root, recipient),
    );
  }

  // ── Market resolution (read) ─────────────────────────────────────────────────

  isResolved(marketId: string): Promise<boolean> {
    return this.market.isResolved(marketId);
  }
  /** 0=YES, 1=NO, 2=INVALID. Reverts if the market isn't resolved. */
  async winningOutcome(marketId: string): Promise<number> {
    return Number(await this.market.winningOutcome(marketId));
  }
  /** Permissionlessly settle an oracle market after its close time. */
  resolveFromOracle(marketId: string): Promise<TxResult> {
    return this.send(this.market.resolveFromOracle(marketId));
  }
}
