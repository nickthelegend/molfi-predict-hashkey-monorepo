import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  clearWalletScopedQueries,
  invalidateWalletScopedQueries,
} from "@/lib/leverx/invalidate-queries";
import { suiClient } from "@/lib/sui/client";

/**
 * HashKey Chain wallet/identity layer, backed by wagmi + RainbowKit.
 *
 * `connect()` opens the RainbowKit modal (MetaMask / WalletConnect / Coinbase /
 * injected); account + chain state come from wagmi. The context keeps the same
 * interface shape so all existing UI keeps compiling. `client` is a read stub for
 * legacy balance hooks.
 */

export const READONLY_SENDER = "0x0000000000000000000000000000000000000000";

interface WalletContextValue {
  client: typeof suiClient;
  wallets: never[];
  wallet: null;
  account: { address: string } | null;
  address: string | null;
  isWalletConnected: boolean;
  simulationSender: string;
  connecting: boolean;
  connect: (wallet?: unknown) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshWallets: () => void;
  /** Sign a plain message with the connected wallet (EIP-191 personal_sign). */
  signTransaction: (message: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { address: wagmiAddress, isConnecting, isReconnecting } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { signMessageAsync } = useSignMessage();

  const address = wagmiAddress ?? null;
  const connecting = isConnecting || isReconnecting || connectModalOpen;

  const connect = useCallback(async () => {
    openConnectModal?.();
  }, [openConnectModal]);

  const disconnect = useCallback(async () => {
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  const signTransaction = useCallback(
    async (message: string) => {
      if (!address) throw new Error("Wallet not connected");
      return signMessageAsync({ message });
    },
    [address, signMessageAsync],
  );

  // Wallet-scoped query cache: clear/refresh on address change.
  useEffect(() => {
    if (address) void invalidateWalletScopedQueries(queryClient);
    else clearWalletScopedQueries(queryClient);
  }, [address, queryClient]);

  const value = useMemo<WalletContextValue>(
    () => ({
      client: suiClient,
      wallets: [],
      wallet: null,
      account: address ? { address } : null,
      address,
      isWalletConnected: Boolean(address),
      simulationSender: READONLY_SENDER,
      connecting,
      connect,
      disconnect,
      refreshWallets: () => {},
      signTransaction,
    }),
    [address, connecting, connect, disconnect, signTransaction],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
