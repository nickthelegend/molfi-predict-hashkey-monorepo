/**
 * useRouterAccount — Phase-1 stub.
 * ================================
 * The original implementation managed a per-user `UserRouter` contract at a
 * deterministic CREATE2 address (silent deploy on connect, auto-sweep to the
 * pool). On HashKey Chain, user deposits flow directly through the
 * `PredictEscrow` / `ConfidentialBet` contracts via `services/molfi-chain.ts`,
 * so this hook returns inert state for consumers that still reference it.
 */
import { useMemo } from "react";

export interface RouterAccountState {
  /** Deposit address — null; deposits go direct to escrow on HashKey Chain. */
  routerAddress: string | null;
  isReady: boolean;
  isSettingUp: boolean;
  isSweeping: boolean;
  routerUsdcBalance: string;
  error: string | null;
  sweep: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRouterAccount(): RouterAccountState {
  return useMemo<RouterAccountState>(
    () => ({
      routerAddress: null,
      isReady: false,
      isSettingUp: false,
      isSweeping: false,
      routerUsdcBalance: "0",
      error: null,
      sweep: async () => {},
      refresh: async () => {},
    }),
    [],
  );
}
