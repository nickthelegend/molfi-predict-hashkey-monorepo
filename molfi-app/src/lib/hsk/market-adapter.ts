import type { OnChainMarket } from "@/lib/hsk/evm";
import type { LeverxMarketRow } from "@/lib/leverx/indexer-markets";
import { MARKET_STATUS } from "@/lib/hsk/contracts";

/** Best-effort asset symbol from a market question, for the card's asset badge. */
function assetFromQuestion(question: string): string {
  const m = question
    .toUpperCase()
    .match(/\b(BTC|ETH|HSK|SOL|USDC|BITCOIN|ETHEREUM|HASHKEY|SOLANA)\b/);
  if (!m) return "HSK";
  const canon: Record<string, string> = {
    BITCOIN: "BTC",
    ETHEREUM: "ETH",
    HASHKEY: "HSK",
    SOLANA: "SOL",
  };
  return canon[m[1]] ?? m[1];
}

/**
 * Map an on-chain Molfi market into the LeverX catalog row the rich Markets
 * grid/table already render. `strikeRaw: 0` makes `marketRowToKey` return
 * undefined, which disables the Sui ask/premium fetch (so cards render straight
 * away instead of sitting in skeletons). The binary-market specifics
 * (question / status / outcome) ride along on the row and surface in the card.
 */
export function hskMarketToRow(m: OnChainMarket): LeverxMarketRow {
  return {
    id: m.id,
    oracleId: m.id,
    asset: m.symbol ?? assetFromQuestion(m.question),
    // Strike in USD → the card reads `strikeRaw / 1e9`, so scale by 1e9.
    strike: m.strikeUsd ?? 0,
    strikeRaw: m.strikeUsd && m.strikeUsd > 0 ? Math.round(m.strikeUsd * 1e9) : 0,
    higherStrikeRaw: 0,
    expiry: m.closeTs * 1000,
    isUp: true,
    isRange: false,
    lastAskPremium: null,
    quotePaused: false,
    volume: 0,
    // Live oracle spot (USD) from the backend engine → the card's "Current price".
    spotPrice: m.spot ?? null,
    iconUrl: m.iconUrl,
    status: m.status === MARKET_STATUS.RESOLVED ? "resolved" : "active",
    question: m.question,
    onchainStatus: m.status,
    onchainOutcome: m.outcome,
  };
}
