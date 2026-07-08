import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  clearWalletScopedQueries,
  invalidateWalletScopedQueries,
} from "@/lib/leverx/invalidate-queries";
import { suiClient } from "@/lib/sui/client";
import { showError } from "@/lib/toast";
import { HSK_ADD_CHAIN_PARAMS, HSK_CHAIN_ID } from "@/lib/hsk/chain";

const STORAGE_KEY = "molfi:hsk-address";

/**
 * HashKey Chain wallet/identity layer (MetaMask / injected via EIP-1193).
 *
 * `connect()` prompts the injected wallet, ensures it is on HashKey Chain
 * (chainId 133), and exposes the connected `0x…` address. The context keeps the
 * original interface shape so existing UI keeps compiling. `client` is retained
 * as a read stub for legacy balance hooks.
 */

export const READONLY_SENDER = "0x0000000000000000000000000000000000000000";

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

function getInjected(): Eip1193Provider | null {
  return (globalThis as { ethereum?: Eip1193Provider }).ethereum ?? null;
}

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

async function ensureHashKeyChain(provider: Eip1193Provider): Promise<void> {
  const target = `0x${HSK_CHAIN_ID.toString(16)}`;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: target }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [HSK_ADD_CHAIN_PARAMS],
      });
    }
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [address, setAddress] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY),
  );
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    const provider = getInjected();
    if (!provider) {
      showError("No EVM wallet found. Install MetaMask to continue.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const addr = accounts?.[0];
      if (!addr) throw new Error("No account returned by wallet");
      await ensureHashKeyChain(provider);
      setAddress(addr);
      localStorage.setItem(STORAGE_KEY, addr);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Could not connect wallet");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setAddress(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const signTransaction = useCallback(
    async (message: string) => {
      const provider = getInjected();
      if (!provider || !address) throw new Error("Wallet not connected");
      const signature = (await provider.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;
      return signature;
    },
    [address],
  );

  // React to account/chain changes in the injected wallet.
  useEffect(() => {
    const provider = getInjected();
    if (!provider?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      const next = accounts?.[0] ?? null;
      setAddress(next);
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    };
    provider.on("accountsChanged", onAccounts);
    return () => provider.removeListener?.("accountsChanged", onAccounts);
  }, []);

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
