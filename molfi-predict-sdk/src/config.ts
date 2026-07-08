/**
 * Network + deployed-contract configuration for Molfi on HashKey Chain (EVM).
 *
 * Addresses are embedded (a copy of molfi-contracts/deployments/133.json) so the
 * published SDK is self-contained — it never reads the contracts build dir at
 * runtime. Every value is overridable via env or per-instance opts so the SDK
 * keeps working against a fresh deployment.
 */

/** Deployed Molfi contract addresses. */
export interface MolfiContracts {
  mUSDC: string;
  vault: string;
  oracle: string;
  market: string;
  predictEscrow: string;
  confidentialBet: string;
  privacyPool: string;
  solvencyVerifier: string;
  confidentialBetVerifier: string;
  withdrawVerifier: string;
  mulVerifier: string;
}

export interface MolfiConfig {
  /** Human-friendly network label. */
  network: "testnet" | "mainnet";
  /** EVM chain id (133 testnet, 177 mainnet). */
  chainId: number;
  /** HashKey Chain JSON-RPC endpoint. */
  rpcUrl: string;
  /** Block explorer base URL (no trailing slash). */
  explorerUrl: string;
  /** Molfi backend REST API (markets, ZK proofs, confidential prepare). */
  apiUrl: string;
  /** mUSDC has 6 decimals. */
  musdcDecimals: number;
  /** Fixed denomination (base units) for a confidential note. */
  confidentialDenom: bigint;
  contracts: MolfiContracts;
}

/**
 * Embedded copy of molfi-contracts/deployments/133.json (HashKey testnet).
 * Keeps the SDK self-contained; override any address via `MOLFI_*` env vars.
 */
export const DEPLOYMENT_133 = {
  confidentialBet: "0x6731FecE71e14155EBA0b11A116a68eA395dd14e",
  confidentialBetVerifier: "0x412A3825052feF744DBd80b4f714F1546EA8D25d",
  denom: 100000000,
  mUSDC: "0xCcCe188934316cE9ea6f8237F7e6249aB2E0C903",
  market: "0xd3f3c363CF22eD8DbAB26b9De5b12340D3816C49",
  mulVerifier: "0x223ccE84DB36b239a91d224C2A28DF9874de5Db1",
  oracle: "0x5439778405627512eAae2210b2584D6A9B4D517B",
  predictEscrow: "0xDd5782CE36e035709b2e3F640377d3Ec6F1f1dA1",
  privacyPool: "0x4ce8970d2B0FbFd478e857F603Fc7526E0CC989a",
  solvencyVerifier: "0xb70F0Bc326C93793AACC7d8877Af911E2E73e69b",
  vault: "0x6F1Bd7d424AB69B9F3689Cee208863Ce0B27f784",
  withdrawVerifier: "0x955C8FE38d010F3132a9679B9e2489698345e967",
} as const;

const env = (k: string, fallback: string): string =>
  (typeof process !== "undefined" && process.env && process.env[k]) || fallback;

const contractsFromEnv = (d: typeof DEPLOYMENT_133): MolfiContracts => ({
  mUSDC: env("MOLFI_MUSDC", d.mUSDC),
  vault: env("MOLFI_VAULT", d.vault),
  oracle: env("MOLFI_ORACLE", d.oracle),
  market: env("MOLFI_MARKET", d.market),
  predictEscrow: env("MOLFI_PREDICT_ESCROW", d.predictEscrow),
  confidentialBet: env("MOLFI_CONFIDENTIAL_BET", d.confidentialBet),
  privacyPool: env("MOLFI_PRIVACY_POOL", d.privacyPool),
  solvencyVerifier: env("MOLFI_SOLVENCY_VERIFIER", d.solvencyVerifier),
  confidentialBetVerifier: env("MOLFI_CONF_VERIFIER", d.confidentialBetVerifier),
  withdrawVerifier: env("MOLFI_WITHDRAW_VERIFIER", d.withdrawVerifier),
  mulVerifier: env("MOLFI_MUL_VERIFIER", d.mulVerifier),
});

/** Live Molfi configuration on HashKey testnet (chainId 133). */
export const TESTNET: MolfiConfig = {
  network: "testnet",
  chainId: Number(env("MOLFI_CHAIN_ID", "133")),
  rpcUrl: env("MOLFI_RPC_URL", "https://testnet.hsk.xyz"),
  explorerUrl: env("MOLFI_EXPLORER_URL", "https://testnet-explorer.hsk.xyz"),
  apiUrl: env("MOLFI_API_URL", "http://localhost:4000"),
  musdcDecimals: 6,
  confidentialDenom: BigInt(env("MOLFI_CONF_DENOM", String(DEPLOYMENT_133.denom))),
  contracts: contractsFromEnv(DEPLOYMENT_133),
};

/** HashKey mainnet (chainId 177). Contract addresses must be supplied via env. */
export const MAINNET: MolfiConfig = {
  network: "mainnet",
  chainId: Number(env("MOLFI_CHAIN_ID", "177")),
  rpcUrl: env("MOLFI_RPC_URL", "https://mainnet.hsk.xyz"),
  explorerUrl: env("MOLFI_EXPLORER_URL", "https://hashkey.blockscout.com"),
  apiUrl: env("MOLFI_API_URL", "http://localhost:4000"),
  musdcDecimals: 6,
  confidentialDenom: BigInt(env("MOLFI_CONF_DENOM", String(DEPLOYMENT_133.denom))),
  contracts: contractsFromEnv(DEPLOYMENT_133),
};

/** Build a config, merging overrides onto a base (defaults to testnet). */
export function resolveConfig(overrides: Partial<MolfiConfig> = {}, base: MolfiConfig = TESTNET): MolfiConfig {
  return {
    ...base,
    ...overrides,
    contracts: { ...base.contracts, ...(overrides.contracts ?? {}) },
  };
}

/** Explorer URL for a transaction hash. */
export const txUrl = (config: MolfiConfig, hash: string): string => `${config.explorerUrl}/tx/${hash}`;
/** Explorer URL for an address. */
export const addressUrl = (config: MolfiConfig, address: string): string => `${config.explorerUrl}/address/${address}`;

/** mUSDC base units ⇄ human amount (6 decimals). */
export const toBaseUnits = (amount: number, decimals = 6): bigint =>
  BigInt(Math.round(amount * 10 ** decimals));
export const fromBaseUnits = (units: bigint | number, decimals = 6): number =>
  Number(units) / 10 ** decimals;

export const OUTCOME_YES = 0;
export const OUTCOME_NO = 1;
