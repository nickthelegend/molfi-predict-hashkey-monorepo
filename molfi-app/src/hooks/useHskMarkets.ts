import { useQuery } from "@tanstack/react-query";
import { listMarkets, type OnChainMarket } from "@/lib/hsk/evm";

/**
 * Live markets read straight from the Molfi `market` HashKey contract on
 * HashKey testnet (enumerate + per-market state via simulation). No indexer.
 */
export function useHskMarkets() {
  return useQuery<OnChainMarket[]>({
    queryKey: ["hashkey", "markets"],
    queryFn: listMarkets,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}
