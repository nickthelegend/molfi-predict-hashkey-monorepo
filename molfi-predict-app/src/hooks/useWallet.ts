import { useCallback } from "react";
import { BrowserProvider, type Signer as EthersSigner } from "ethers";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import type { WalletClient } from "viem";
import { hashkeyChain } from "@/lib/hashkey/wagmi";
import { CHAIN_ID } from "@/config/molfi";

/**
 * Unified wallet hook — backed by wagmi + viem on HashKey Chain (EVM).
 *
 * `connect()` connects MetaMask / an injected wallet and prompts the user to
 * add / switch to HashKey Chain. `getSigner()` returns a real ethers v6 signer
 * (from `window.ethereum`) for contract writes. The return shape mirrors the
 * previous hook so existing consumers keep compiling.
 */
export function useWallet() {
  const { address, isConnected, connector, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const connect = useCallback(async () => {
    // Prefer an injected / MetaMask connector.
    const injected =
      connectors.find((c) => c.id === "injected") ??
      connectors.find((c) => c.type === "injected") ??
      connectors.find((c) => c.id === "metaMaskSDK" || c.id === "metaMask") ??
      connectors[0];
    if (!injected) throw new Error("No wallet connector available");

    if (!isConnected) {
      await connectAsync({ connector: injected, chainId: CHAIN_ID });
    }
    // Ensure we're on HashKey Chain (prompts add/switch in MetaMask).
    try {
      await switchChainAsync({ chainId: hashkeyChain.id });
    } catch {
      /* user may reject or the chain is already active */
    }
  }, [connectAsync, connectors, isConnected, switchChainAsync]);

  const disconnect = useCallback(async () => {
    try {
      await disconnectAsync();
    } catch {
      /* ignore */
    }
  }, [disconnectAsync]);

  /** Real ethers v6 signer from the injected provider. */
  const getSigner = useCallback(async (): Promise<EthersSigner | null> => {
    const eth = (window as unknown as { ethereum?: unknown }).ethereum;
    if (!eth) return null;
    try {
      const provider = new BrowserProvider(eth as never);
      return await provider.getSigner();
    } catch {
      return null;
    }
  }, []);

  /** Sign a plain message with the connected wallet. */
  const signMessage = useCallback(async (message: string): Promise<string> => {
    const signer = await getSigner();
    if (!signer) throw new Error("Wallet not connected");
    return signer.signMessage(message);
  }, [getSigner]);

  return {
    // User / account data
    address,
    email: undefined as string | undefined,
    isConnected,
    user: undefined,
    // Compat shim for code that reads `wallet.connector?.name`
    wallet: address
      ? { address, connector: { name: connector?.name ?? "injected" } }
      : undefined,

    // Chain data — string form for legacy consumers (e.g. ChainSwitcher).
    chain: chainId != null ? String(chainId) : undefined,
    chainId,

    // Actions
    connect,
    disconnect,
    getSigner,
    signMessage,
    walletClient: walletClient as WalletClient | undefined,
  };
}
