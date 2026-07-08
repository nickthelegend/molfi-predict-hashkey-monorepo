# System Specification: Molfi Landing (HashKey Chain)

**Status:** ACTIVE DEVELOPMENT

## 1. Vision
Molfi is an AI-powered agentic wallet and privacy-preserving prediction market on **HashKey Chain**. This repo is the landing / marketing site: it communicates the product, drives downloads, and onboards autonomous agents. It presents Molfi as the most profitable, agent-native way to research and trade on an EVM chain.

## 2. Core Pillars
- **Agentic Wallet**: Non-custodial, AI-powered wallet with smart automation and built-in safety checks.
- **Research AI**: Real-time analysis of on-chain data to inform decisions.
- **HashKey Native**: Purpose-built for HashKey Chain — low fees, fast finality, native HSK token.
- **Agent-first**: A public `skill.md` lets autonomous agents join the Molfi network and settle in HSK / mUSDC.

## 3. Technical Constraints
- **Frontend**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 (obsidian theme, lavender `#c899ff` primary)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Chain**: HashKey Chain (EVM) — testnet chainId `133`, mainnet chainId `177`
- **Wallet**: MetaMask
- **Contracts**: Solidity (Foundry); ZK via BN254 Groth16 (Circom + snarkjs), verified on-chain with the `alt_bn128` precompiles
- **Persistence (optional/legacy)**: MongoDB / Supabase helpers exist in `lib/` but are not wired to a live route

## 4. Feature Requirements
### 4.1. Landing / Hero
- Headline, chain badge ("Powered by HashKey Chain"), and a primary CTA to download.
- Feature grid: Molfi Extension, Mobile App, Agentic Wallet, Research AI, Built for Speed.
- Values row: Trustless Security, AI-First Engine, HashKey Native.

### 4.2. Download Flow (`/download`)
- Desktop app, Android beta (APK), and browser extension (waitlist email capture).

### 4.3. Agent Surface (`/agent/[id]`, `/create`, `public/skill.md`)
- Agent profile with reputation, wallet address, and an explorer link (HashKey explorer).
- Agent registration form and a machine-readable skill for autonomous onboarding.

### 4.4. Prediction Market (marketed capability)
- **ZK-gated bet**: prove hidden collateral ≥ threshold (solvency) plus a single-use nullifier.
- **Confidential bet**: your YES/NO side is hidden behind a commitment; claim with a ZK proof where the contract injects the winning outcome so losing notes can't prove.
- **Privacy pool**: Poseidon Merkle membership + nullifier withdraw.
- **Oracle**: a push price oracle (HashKey MockOracle / Chainlink-style feed).

## 5. Security & Privacy
- **Non-custodial** by design; keys never leave the user.
- **On-chain ZK verification** for solvency, side-secrecy, and pool membership.
- **Canonical addresses** for testnet live in `molfi-contracts/deployments/133.json`.
