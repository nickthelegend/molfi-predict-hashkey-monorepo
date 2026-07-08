/**
 * Molfi — deployed HashKey Chain contract addresses, ABIs and market constants.
 * Network/RPC live in @/lib/hsk/chain. Source of truth:
 * molfi-contracts/deployments/133.json. Override any address via VITE_* env.
 *
 * (File path retains the legacy `hashkey/` name so existing imports keep working;
 * the contents target HashKey Chain / EVM only — no HashKey code remains.)
 */
import MockUSDCAbi from "@/lib/hsk/abis/MockUSDC.json";
import PredictEscrowAbi from "@/lib/hsk/abis/PredictEscrow.json";
import MarketAbi from "@/lib/hsk/abis/Market.json";
import ConfidentialBetAbi from "@/lib/hsk/abis/ConfidentialBet.json";
import PrivacyPoolAbi from "@/lib/hsk/abis/PrivacyPool.json";
import VaultAbi from "@/lib/hsk/abis/Vault.json";
import MockOracleAbi from "@/lib/hsk/abis/MockOracle.json";

export { HSK_EXPLORER as EXPLORER, contractUrl, txUrl } from "@/lib/hsk/chain";

const env = (name: string): string | undefined =>
  import.meta.env[name as keyof ImportMetaEnv] as string | undefined;

/** Live HashKey Chain testnet deployment (molfi-contracts/deployments/133.json). */
export const CONTRACTS = {
  musdc: env("VITE_MUSDC_ADDRESS") ?? "0x31630Ba71DB65aD05db90b54d79C0bFb7a16f126",
  market: env("VITE_MARKET_ADDRESS") ?? "0x44CC6C6AeBA3719B0af6157Dc8bB3db377B0D25d",
  predictEscrow:
    env("VITE_PREDICT_ESCROW_ADDRESS") ?? "0xE131941AC74AA6b530b882B6024AB978304F9dfB",
  vault: env("VITE_VAULT_ADDRESS") ?? "0x21fFA6ad3B8Cc287E35aF0aB6aE44b8d5D8568a5",
  oracle: env("VITE_ORACLE_ADDRESS") ?? "0x342cA0430bEC11Ef4236E4dC73B3b6DB0F8Db8bc",
  confidentialBet:
    env("VITE_CONF_BET_ADDRESS") ?? "0xa88750da91c66A65527bB3cEAB3B13D6e705187D",
  privacyPool: env("VITE_PRIVACY_POOL_ADDRESS") ?? "0xF67044241bE034d71B9157d2d912b4E9AD0F3eBD",
  confidentialBetVerifier: "0x4a6f403E3CF6A21F4262aFbC7D9c60fb92FFE5E9",
  solvencyVerifier: "0xFc094E4d7AE3027f5F6F9dD2b9B386Dc14aDc8cD",
  withdrawVerifier: "0x23E80b66B0ECF81F7A38B80Ab18397FD618c4B99",
  mulVerifier: "0xcB71dC6D5f4064cF259732019aD19394DFFdA027",
} as const;

export const ABIS = {
  musdc: MockUSDCAbi,
  predictEscrow: PredictEscrowAbi,
  market: MarketAbi,
  confidentialBet: ConfidentialBetAbi,
  privacyPool: PrivacyPoolAbi,
  vault: VaultAbi,
  oracle: MockOracleAbi,
} as const;

/** mUSDC has 6 decimals; one whole token = 1e6 base units. */
export const MUSDC_DECIMALS = 6;
export const MUSDC_UNIT = 1_000_000;

/** Pari-mutuel denominator used by the escrow pool math. */
export const DENOM = 100_000_000;

export const PREDICT_ESCROW = CONTRACTS.predictEscrow;

/** Outcome encoding shared by the market + predict-escrow contracts. */
export const OUTCOME = { YES: 0, NO: 1, INVALID: 2 } as const;

/** Market lifecycle status from the `Market` contract (enum Status). */
export const MARKET_STATUS = { TRADING: 0, RESOLVING: 1, RESOLVED: 2 } as const;
