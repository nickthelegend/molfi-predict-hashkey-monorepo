import { useMemo } from "react";
import { useHskMarkets } from "@/hooks/useHskMarkets";
import { hskMarketToRow } from "@/lib/hsk/market-adapter";
import { MARKET_STATUS } from "@/lib/hsk/contracts";
import type { LeverxMarketRow } from "@/lib/leverx/indexer-markets";
import type { MarketCategory } from "@/lib/leverx/predict-oracle-markets";

const isClosed = (r: LeverxMarketRow) => r.onchainStatus === MARKET_STATUS.RESOLVED;

/**
 * Drop-in replacement for `useMergedMarkets`, sourced from the Molfi `market`
 * HashKey contract instead of the Sui indexer. Returns the same shape so the
 * rich LeverX Markets grid/table render unchanged.
 */
export function useHskMarketRows(args: {
  category: MarketCategory;
  search?: string;
}) {
  const { data = [], isLoading, isError } = useHskMarkets();

  const allRows = useMemo(() => data.map(hskMarketToRow), [data]);

  const categoryCounts = useMemo(
    () => ({
      All: allRows.length,
      Live: allRows.filter((r) => !isClosed(r)).length,
      Closed: allRows.filter(isClosed).length,
    }),
    [allRows],
  );

  const markets = useMemo(() => {
    let rows = allRows;
    if (args.category === "Live") rows = rows.filter((r) => !isClosed(r));
    else if (args.category === "Closed") rows = rows.filter(isClosed);

    const q = (args.search ?? "").trim().toLowerCase();
    if (q) rows = rows.filter((r) => (r.question ?? "").toLowerCase().includes(q));
    return rows;
  }, [allRows, args.category, args.search]);

  return {
    markets,
    categoryCounts,
    oracles: [],
    catalog: [],
    loading: isLoading,
    offline: isError,
    catalogReady: !isLoading,
    oraclesFetched: !isLoading,
    catalogFetched: !isLoading,
  };
}
