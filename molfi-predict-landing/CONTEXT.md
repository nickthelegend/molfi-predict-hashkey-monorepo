# Context Checkpoint: Molfi Landing (HashKey Chain)

**Current Status:** Landing rebranded to HashKey Chain.

## 1. Summary of Accomplishments
- **Rebranding**: Migrated all chain facts and branding from the prior stack (0G Ethereum / earlier Algorand & Rendr template leftovers) to **Molfi on HashKey Chain (EVM)**.
- **Frontend Infrastructure**: Next.js 16 (App Router) with Tailwind CSS v4.
- **UI Aesthetics**: Obsidian (`#0e0e0e`) surfaces with a lavender (`#c899ff`) primary, glassmorphic panels, and Manrope/Inter typography.
- **Agent Surface**: `public/skill.md` describes how autonomous agents join the Molfi network on HashKey Chain.

## 2. Technical Context for Next Developer
- **Environment**: Next.js 16, Tailwind v4. Pure static/marketing content — no live backend routes are wired.
- **Chain**: HashKey Chain (EVM). Testnet chainId `133` (RPC `https://testnet.hsk.xyz`), mainnet chainId `177` (RPC `https://mainnet.hsk.xyz`). Native token HSK; stablecoin mUSDC.
- **Contracts / ZK**: Solidity (Foundry); BN254 Groth16 (Circom + snarkjs) verified on-chain via the `alt_bn128` precompiles. Deployed testnet addresses: `molfi-contracts/deployments/133.json`.
- **Design Tokens**: See `app/globals.css` — obsidian surface stack, lavender primary, `.glass` / `.primary-glow` / `.text-gradient` utilities.
- **Leftover code**: `lib/*` (MongoDB / Supabase / AI provider) are template leftovers, not connected to any route; safe to remove if unused.

## 3. Next Immediate Goals
1. **Wallet connect**: Wire MetaMask + HashKey Chain (chainId 133/177) into the download / CTA flow if a live dApp entry is desired.
2. **Real links**: Replace placeholder `#` links (Twitter, Telegram, Discord, docs) with live URLs.
3. **Explorer deep-links**: Point the agent-profile "EXPLORER" chip at `https://testnet-explorer.hsk.xyz/address/<addr>`.
4. **Cleanup**: Remove unused `lib/` backend helpers and the unused `Header.tsx` if not needed.

## 4. Potential Pitfalls/Gotchas
- **Dead code**: `lib/` and `app/agent/[id]` reference `/api/*` routes that do not exist in this repo.
- **Tailwind v4**: Uses the CSS-first `@theme` config in `globals.css` — no `tailwind.config.js`.
