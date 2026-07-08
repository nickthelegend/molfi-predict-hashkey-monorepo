/**
 * HashKey Chain wallet constants (migrated from HashKey Wallets Kit).
 *
 * The wallet/identity layer is now MetaMask / injected (EIP-1193) on HashKey
 * Chain — see @/context/WalletContext and @/lib/hsk/chain. This module only
 * re-exports network constants for backwards-compatible imports.
 */
export {
  HSK_CHAIN_ID,
  HSK_RPC_URL,
  HSK_RPC_URL as RPC_URL,
  HSK_CHAIN_NAME as NETWORK_PASSPHRASE,
  hashkeyChain,
  wagmiConfig,
} from "@/lib/hsk/chain";
