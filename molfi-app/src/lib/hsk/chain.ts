/**
 * HashKey Chain (EVM) network definition + wagmi config.
 *
 * Molfi's on-chain layer targets HashKey Chain only. Testnet is chainId 133,
 * mainnet 177. Override via VITE_HSK_CHAIN_ID / VITE_HSK_RPC_URL.
 */
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { http } from "wagmi";

export const HSK_CHAIN_ID = Number(import.meta.env.VITE_HSK_CHAIN_ID ?? 133);

const IS_MAINNET = HSK_CHAIN_ID === 177;

export const HSK_RPC_URL: string =
  (import.meta.env.VITE_HSK_RPC_URL as string | undefined) ??
  (IS_MAINNET ? "https://mainnet.hsk.xyz" : "https://testnet.hsk.xyz");

export const HSK_EXPLORER: string = IS_MAINNET
  ? "https://hashkey.blockscout.com"
  : "https://testnet-explorer.hsk.xyz";

export const HSK_CHAIN_NAME = IS_MAINNET ? "HashKey Chain" : "HashKey Chain Testnet";

/** viem chain definition for HashKey Chain. */
export const hashkeyChain = defineChain({
  id: HSK_CHAIN_ID,
  name: HSK_CHAIN_NAME,
  nativeCurrency: { name: "HashKey", symbol: "HSK", decimals: 18 },
  rpcUrls: { default: { http: [HSK_RPC_URL] } },
  blockExplorers: { default: { name: "HashKey Explorer", url: HSK_EXPLORER } },
  testnet: !IS_MAINNET,
});

/**
 * wagmi + RainbowKit config for HashKey Chain. `getDefaultConfig` wires the
 * standard connector set (MetaMask, Rainbow, Coinbase, WalletConnect, injected).
 * Set VITE_WALLETCONNECT_PROJECT_ID (from https://cloud.walletconnect.com) to
 * enable the WalletConnect/mobile wallets; injected (MetaMask) works without it.
 */
// `||` (not `??`) so an empty env value also falls back — RainbowKit's
// getDefaultConfig throws if projectId is falsy. Set a real id from
// https://cloud.walletconnect.com to enable WalletConnect/mobile wallets.
const WALLETCONNECT_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) || "molfi_hashkey_dev";

export const wagmiConfig = getDefaultConfig({
  appName: "Molfi",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [hashkeyChain],
  transports: { [hashkeyChain.id]: http(HSK_RPC_URL) },
  ssr: false,
});

/** EIP-3085 `wallet_addEthereumChain` params for MetaMask. */
export const HSK_ADD_CHAIN_PARAMS = {
  chainId: `0x${HSK_CHAIN_ID.toString(16)}`,
  chainName: HSK_CHAIN_NAME,
  nativeCurrency: { name: "HashKey", symbol: "HSK", decimals: 18 },
  rpcUrls: [HSK_RPC_URL],
  blockExplorerUrls: [HSK_EXPLORER],
} as const;

export const EXPLORER = HSK_EXPLORER;
export const contractUrl = (addr: string): string => `${HSK_EXPLORER}/address/${addr}`;
export const txUrl = (hash: string): string => `${HSK_EXPLORER}/tx/${hash}`;
