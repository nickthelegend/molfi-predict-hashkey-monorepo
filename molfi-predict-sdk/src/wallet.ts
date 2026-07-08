/**
 * Wallet helpers for HashKey Chain (EVM). An agent calls `createWallet()` to
 * mint a fresh random EVM key, or `walletFromPrivateKey()` to restore one, then
 * connects it to a HashKey JSON-RPC provider for signing transactions.
 *
 * Note: a fresh wallet has zero HSK, so it cannot pay gas yet. Fund its
 * `address` with a little testnet HSK before calling any write (onboard/bet).
 */
import { JsonRpcProvider, Wallet } from "ethers";
import { TESTNET, type MolfiConfig } from "./config.js";

export interface MolfiWallet {
  address: string;
  /** 0x-prefixed private key. Keep secret — this is the signing key. */
  privateKey: string;
}

/** Build a HashKey Chain JSON-RPC provider from config. */
export function makeProvider(config: MolfiConfig = TESTNET): JsonRpcProvider {
  return new JsonRpcProvider(config.rpcUrl, {
    chainId: config.chainId,
    name: `hashkey-${config.network}`,
  });
}

/** Create a brand-new random EVM wallet connected to the given provider. */
export function createWallet(provider: JsonRpcProvider): Wallet {
  return new Wallet(Wallet.createRandom().privateKey, provider);
}

/** Restore a signing wallet from a private key, connected to the provider. */
export function walletFromPrivateKey(privateKey: string, provider: JsonRpcProvider): Wallet {
  return new Wallet(privateKey, provider);
}

/** Plain {address, privateKey} snapshot of a wallet (for persistence). */
export function walletInfo(wallet: Wallet): MolfiWallet {
  return { address: wallet.address, privateKey: wallet.privateKey };
}
