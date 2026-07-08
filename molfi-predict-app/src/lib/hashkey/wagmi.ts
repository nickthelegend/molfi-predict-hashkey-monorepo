/**
 * HashKey Chain (EVM) wagmi + viem configuration.
 *
 * Replaces the former Stellar Wallets Kit stack. Defines the HashKey chain and
 * a wagmi config with an injected/MetaMask connector. "Connect Wallet" uses
 * these to connect MetaMask and prompt add/switch to HashKey Chain.
 */
import { defineChain } from "viem";
import { createConfig, http } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
import {
  CHAIN_ID,
  CHAIN_NAME,
  RPC_URL,
  EXPLORER,
  NATIVE_CURRENCY,
} from "@/config/molfi";

export const hashkeyChain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: NATIVE_CURRENCY,
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: "HashKey Explorer", url: EXPLORER },
  },
  testnet: CHAIN_ID !== 177,
});

export const wagmiConfig = createConfig({
  chains: [hashkeyChain],
  connectors: [injected(), metaMask()],
  transports: {
    [hashkeyChain.id]: http(RPC_URL),
  },
  ssr: false,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
