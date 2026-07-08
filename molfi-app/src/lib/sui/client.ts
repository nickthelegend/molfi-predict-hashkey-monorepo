/**
 * Legacy read-client stub. The app targets HashKey Chain (EVM); on-chain reads
 * go through ethers (see @/lib/hsk/evm). This retains the `suiClient`
 * export shape used by legacy balance hooks so they keep compiling. Coin-type
 * balances are not meaningful on EVM, so this returns a zero balance.
 */
export const SUI_NETWORK = "testnet" as const;

export const suiClient = {
  async getBalance(_args: { owner: string; coinType?: string }): Promise<{
    totalBalance: string;
  }> {
    void _args;
    return { totalBalance: "0" };
  },
};
