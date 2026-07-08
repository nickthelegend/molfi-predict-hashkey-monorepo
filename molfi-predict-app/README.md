# molfi-predict-app

The Molfi trading dApp — a React + Vite front-end for **private prediction
markets on HashKey Chain**. See the [project README](../README.md) for the full
architecture, live testnet deployment, and on-chain demo.

## Stack

- **React 18 + Vite + TypeScript**, Tailwind + shadcn/ui
- **wagmi + viem** — unified connect for MetaMask / injected wallets
- **ethers v6** for HashKey RPC + transaction building
- **[@molfi/predict-sdk](../molfi-predict-sdk/)** for contract-aligned CLOB order signing

The wallet layer funnels through a single reactive `useWallet`
([`src/hooks/useWallet.ts`](src/hooks/useWallet.ts)) backed by wagmi + viem
([`src/lib/hashkey/wagmi.ts`](src/lib/hashkey/wagmi.ts)) — no React provider needed.

## Develop

```bash
npm install
cp .env.template .env      # set VITE_HSK_CHAIN_ID, RPC, contract IDs
npm run dev                # http://localhost:8080
npm run build
```

Configure the deployed testnet contract IDs (see the project README) in `.env`
via the `VITE_*_CONTRACT_ID` keys.

## Status

Builds and connects a HashKey Chain wallet on testnet. Wiring the trading screens to
the deployed HashKey Chain contracts is in progress — the on-chain flows are currently
demonstrated directly against the contracts (see the project README's on-chain
transaction table).
