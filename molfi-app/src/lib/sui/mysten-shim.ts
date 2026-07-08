/**
 * Compatibility shim for the removed `@mysten/*` packages.
 *
 * The app migrated from Sui to HashKey Chain. A handful of legacy LeverX Sui
 * trading modules (leverx/*, sui/*, predict/manager) still reference the old
 * `@mysten/*` APIs but are NOT part of the HashKey market/bet flow. Rather than
 * delete that entire trading engine, vite aliases the `@mysten/*` specifiers to
 * this shim so the app compiles. These symbols are inert: any Sui-only trade
 * path invokes them and fails fast at runtime — HashKey betting does not use them.
 */

const NOT_SUPPORTED = "Sui functionality is not available on HashKey Chain.";

export function getJsonRpcFullnodeUrl(_network?: string): string {
  return "";
}

export class SuiJsonRpcClient {
  constructor(_opts?: unknown) {}
  async getBalance(_args?: unknown): Promise<{ totalBalance: string }> {
    return { totalBalance: "0" };
  }
  async getObject(): Promise<unknown> {
    return null;
  }
  async getCoins(): Promise<{ data: unknown[] }> {
    return { data: [] };
  }
  async multiGetObjects(): Promise<unknown[]> {
    return [];
  }
  async devInspectTransactionBlock(): Promise<unknown> {
    throw new Error(NOT_SUPPORTED);
  }
}

export class Transaction {
  static from(): Transaction {
    return new Transaction();
  }
  setSender(): void {}
  setGasBudget(): void {}
  moveCall(): unknown {
    return {};
  }
  splitCoins(): unknown {
    return [{}];
  }
  transferObjects(): void {}
  object(): unknown {
    return {};
  }
  pure(): unknown {
    return {};
  }
  get gas(): unknown {
    return {};
  }
  async build(): Promise<Uint8Array> {
    throw new Error(NOT_SUPPORTED);
  }
  serialize(): string {
    return "";
  }
}

export type TransactionObjectArgument = unknown;
export type WalletWithRequiredFeatures = unknown;

export function fromBase64(_s: string): Uint8Array {
  return new Uint8Array();
}
export function toBase64(_b: Uint8Array): string {
  return "";
}

export const SUI_TESTNET_CHAIN = "sui:testnet" as const;
export const SUI_MAINNET_CHAIN = "sui:mainnet" as const;
export const SuiSignTransaction = "sui:signTransaction" as const;
export const SuiSignPersonalMessage = "sui:signPersonalMessage" as const;
export const SUI_CLOCK_OBJECT_ID = "0x6" as const;

export async function signAndExecuteTransaction(..._args: unknown[]): Promise<never> {
  throw new Error(NOT_SUPPORTED);
}

export function getWallets(): { get: () => unknown[] } {
  return { get: () => [] };
}
export function isWalletWithRequiredFeatureSet(_w: unknown): boolean {
  return false;
}

export function isEnokiWallet(_w: unknown): boolean {
  return false;
}
export function isGoogleWallet(_w: unknown): boolean {
  return false;
}
export function isEnokiNetwork(_n: unknown): boolean {
  return false;
}
export function registerEnokiWallets(_opts: unknown): { unregister: () => void } {
  return { unregister: () => {} };
}
