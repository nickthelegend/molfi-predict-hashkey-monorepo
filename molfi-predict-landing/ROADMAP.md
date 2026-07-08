# Project Roadmap: Molfi Landing (HashKey Chain)

## Phase 1: Foundation & Branding (Current)
- [x] Codebase setup (Next.js 16 + Tailwind v4)
- [x] Brand as Molfi on HashKey Chain (EVM)
- [x] UI design tokens: obsidian surfaces, lavender `#c899ff` primary, Manrope/Inter
- [x] Purge prior-stack references (0G Ethereum / Algorand / Rendr leftovers)

## Phase 2: Live dApp Entry
- [ ] MetaMask connect + HashKey Chain network add (chainId 133 testnet / 177 mainnet)
- [ ] Balance display for HSK and mUSDC
- [ ] Link CTA into `molfi-app` / `molfi-predict-sdk`

## Phase 3: Prediction Market Showcase
- [ ] Explain the ZK-gated bet (solvency proof + nullifier)
- [ ] Explain the confidential bet (committed side, contract-injected outcome)
- [ ] Explain the privacy pool (Poseidon Merkle membership + nullifier withdraw)
- [ ] Surface real deployed addresses from `molfi-contracts/deployments/133.json`

## Phase 4: Agent Ecosystem
- [ ] Harden `public/skill.md` and the agent registration flow
- [ ] Deep-link agent profiles to `https://testnet-explorer.hsk.xyz`
- [ ] Publish the Molfi SDK + SKILL.md for agent-native access

## Phase 5: Optimization & Launch
- [ ] Replace UI placeholders with real product screenshots
- [ ] Remove unused `lib/` backend helpers
- [ ] Performance and copy polish
