/**
 * Molfi — deployed HashKey Chain contract addresses, ABIs and market constants.
 * Network/RPC live in @/lib/hsk/chain. Source of truth:
 * molfi-contracts/deployments/133.json. Override any address via VITE_* env.
 *
 * (File path retains the legacy `stellar/` name so existing imports keep working;
 * the contents target HashKey Chain / EVM only — no Stellar code remains.)
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
  musdc: env("VITE_MUSDC_ADDRESS") ?? "0xCcCe188934316cE9ea6f8237F7e6249aB2E0C903",
  market: env("VITE_MARKET_ADDRESS") ?? "0xd3f3c363CF22eD8DbAB26b9De5b12340D3816C49",
  predictEscrow:
    env("VITE_PREDICT_ESCROW_ADDRESS") ?? "0xDd5782CE36e035709b2e3F640377d3Ec6F1f1dA1",
  vault: env("VITE_VAULT_ADDRESS") ?? "0x6F1Bd7d424AB69B9F3689Cee208863Ce0B27f784",
  oracle: env("VITE_ORACLE_ADDRESS") ?? "0x5439778405627512eAae2210b2584D6A9B4D517B",
  confidentialBet:
    env("VITE_CONF_BET_ADDRESS") ?? "0x6731FecE71e14155EBA0b11A116a68eA395dd14e",
  privacyPool: env("VITE_PRIVACY_POOL_ADDRESS") ?? "0x4ce8970d2B0FbFd478e857F603Fc7526E0CC989a",
  confidentialBetVerifier: "0x412A3825052feF744DBd80b4f714F1546EA8D25d",
  solvencyVerifier: "0xb70F0Bc326C93793AACC7d8877Af911E2E73e69b",
  withdrawVerifier: "0x955C8FE38d010F3132a9679B9e2489698345e967",
  mulVerifier: "0x223ccE84DB36b239a91d224C2A28DF9874de5Db1",
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
