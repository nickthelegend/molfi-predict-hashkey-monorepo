/**
 * Molfi — HashKey Chain (EVM) network + deployed contract configuration.
 *
 * Defaults target HashKey Chain testnet (chainId 133). Every value can be
 * overridden via VITE_* env keys (see .env.template). Contract addresses are
 * the live testnet deployment (molfi-contracts/deployments/133.json).
 */

export const CHAIN_ID = Number(import.meta.env.VITE_HSK_CHAIN_ID ?? 133);

export const RPC_URL =
  (import.meta.env.VITE_HSK_RPC_URL as string | undefined) ??
  (CHAIN_ID === 177 ? "https://mainnet.hsk.xyz" : "https://testnet.hsk.xyz");

export const EXPLORER =
  (import.meta.env.VITE_HSK_EXPLORER_URL as string | undefined) ??
  (CHAIN_ID === 177
    ? "https://hashkey.blockscout.com"
    : "https://testnet-explorer.hsk.xyz");

export const CHAIN_NAME =
  CHAIN_ID === 177 ? "HashKey Chain" : "HashKey Chain Testnet";

export const NATIVE_CURRENCY = {
  name: "HashKey",
  symbol: "HSK",
  decimals: 18,
} as const;

/** Off-chain Molfi backend API (markets, positions, proofs, prices). */
export const API_URL =
  (import.meta.env.VITE_MOLFI_API_URL as string | undefined) ??
  "http://localhost:4000";

/** mUSDC collateral uses 6 decimals. */
export const USDC_DECIMALS = 6;

/**
 * Live testnet deployment (molfi-contracts/deployments/133.json).
 * Override any address via the matching VITE_* env key.
 */
export const CONTRACTS = {
  mUSDC:
    import.meta.env.VITE_MUSDC_ADDRESS ??
    "0xCcCe188934316cE9ea6f8237F7e6249aB2E0C903",
  vault:
    import.meta.env.VITE_VAULT_ADDRESS ??
    "0x6F1Bd7d424AB69B9F3689Cee208863Ce0B27f784",
  oracle:
    import.meta.env.VITE_ORACLE_ADDRESS ??
    "0x5439778405627512eAae2210b2584D6A9B4D517B",
  market:
    import.meta.env.VITE_MARKET_ADDRESS ??
    "0xd3f3c363CF22eD8DbAB26b9De5b12340D3816C49",
  predictEscrow:
    import.meta.env.VITE_PREDICT_ESCROW_ADDRESS ??
    "0xDd5782CE36e035709b2e3F640377d3Ec6F1f1dA1",
  confidentialBet:
    import.meta.env.VITE_CONFIDENTIAL_BET_ADDRESS ??
    "0x6731FecE71e14155EBA0b11A116a68eA395dd14e",
  privacyPool:
    import.meta.env.VITE_PRIVACY_POOL_ADDRESS ??
    "0x4ce8970d2B0FbFd478e857F603Fc7526E0CC989a",
  confidentialBetVerifier:
    import.meta.env.VITE_CONFIDENTIAL_BET_VERIFIER_ADDRESS ??
    "0x412A3825052feF744DBd80b4f714F1546EA8D25d",
  solvencyVerifier:
    import.meta.env.VITE_SOLVENCY_VERIFIER_ADDRESS ??
    "0xb70F0Bc326C93793AACC7d8877Af911E2E73e69b",
  withdrawVerifier:
    import.meta.env.VITE_WITHDRAW_VERIFIER_ADDRESS ??
    "0x955C8FE38d010F3132a9679B9e2489698345e967",
  mulVerifier:
    import.meta.env.VITE_MUL_VERIFIER_ADDRESS ??
    "0x223ccE84DB36b239a91d224C2A28DF9874de5Db1",
} as const;

/** confidentialBet fixed denomination (wei of mUSDC, 6dp) = 100 mUSDC. */
export const DENOM = BigInt(import.meta.env.VITE_DENOM ?? "100000000");

/** A sample market id used by the /demo "read outcome" button. */
export const DEMO_MARKET_ID =
  (import.meta.env.VITE_DEMO_MARKET_ID as string | undefined) ??
  "0x0000000000000000000000000000000000000000000000000000000000000001";

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`;
/** Back-compat alias — contracts are addresses on EVM. */
export const contractUrl = (a: string) => addressUrl(a);
