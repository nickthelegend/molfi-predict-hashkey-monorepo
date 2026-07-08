#!/usr/bin/env node
/**
 * Molfi agentic MCP server — trade private prediction markets on HashKey Chain.
 *
 * An LLM agent uses these tools to spin up a wallet, fund itself, and place
 * REAL on-chain bets (standard, ZK-gated, or HSP-paid) against the deployed
 * Molfi contracts — the HashKey/EVM successor to the old Stellar molfi MCP.
 *
 * Env:
 *   MOLFI_NETWORK      testnet (default) | mainnet
 *   MOLFI_API_URL      Molfi backend (markets, ZK proofs) — default http://localhost:4000
 *   MOLFI_TREASURY_KEY funds fresh agents with a little HSK for gas (fund_wallet)
 *   MOLFI_AGENT_KEY    optional: restore a specific agent wallet on boot
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ethers } from "ethers";
import { MolfiAgent, TESTNET, MAINNET } from "../molfi-predict-sdk/dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NET = process.env.MOLFI_NETWORK === "mainnet" ? "mainnet" : "testnet";
const CONFIG = NET === "mainnet" ? MAINNET : TESTNET;
const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl, CONFIG.chainId);
const treasury = process.env.MOLFI_TREASURY_KEY ? new ethers.Wallet(process.env.MOLFI_TREASURY_KEY, provider) : null;

const MARKET_ABI = [
  "function markets() view returns (bytes32[])",
  "function getMarket(bytes32) view returns (tuple(bytes32 id,string question,uint64 closeTs,uint8 status,uint32 outcome))",
  "function isResolved(bytes32) view returns (bool)",
];
const ESCROW_ABI = [
  "function position(bytes32,uint32,address) view returns (uint256)",
  "function pool(bytes32,uint32) view returns (uint256)",
  "function total(bytes32) view returns (uint256)",
];
const market = new ethers.Contract(CONFIG.contracts.market, MARKET_ABI, provider);
const escrow = new ethers.Contract(CONFIG.contracts.predictEscrow, ESCROW_ABI, provider);
const U = (n) => Number(ethers.formatUnits(n, CONFIG.musdcDecimals));

// Single-wallet session (like the reference molfi MCP).
let agent = process.env.MOLFI_AGENT_KEY ? MolfiAgent.create({ privateKey: process.env.MOLFI_AGENT_KEY, config: CONFIG }) : null;
const needWallet = () => { if (!agent) throw new Error("no wallet — call create_wallet or import_wallet first"); };
const ok = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: `error: ${e.message || e}` }] });

const server = new McpServer({ name: "molfi-hashkey", version: "0.1.0" });

server.registerTool("create_wallet",
  { description: "Generate a fresh EVM wallet for the agent to trade with on HashKey Chain. Returns its address and secret — save the secret; later tools use this wallet.", inputSchema: {} },
  async () => { try { agent = MolfiAgent.create({ config: CONFIG }); const s = agent.secret(); return ok({ network: NET, chainId: CONFIG.chainId, address: s.address, secret: s.privateKey, note: "fund this address with a little HSK for gas (use fund_wallet if a treasury is configured)" }); } catch (e) { return fail(e); } });

server.registerTool("import_wallet",
  { description: "Restore an agent wallet from its secret (private key).", inputSchema: { secret: z.string().describe("0x-prefixed private key") } },
  async ({ secret }) => { try { agent = MolfiAgent.create({ privateKey: secret, config: CONFIG }); return ok({ address: agent.address, network: NET }); } catch (e) { return fail(e); } });

server.registerTool("wallet_status",
  { description: "The agent's current address, mUSDC balance, and HSK (gas) balance.", inputSchema: {} },
  async () => { try { needWallet(); return ok({ address: agent.address, network: NET, mUSDC: await agent.musdc(), HSK: ethers.formatEther(await agent.hskBalance()), explorer: agent.explorerUrl }); } catch (e) { return fail(e); } });

server.registerTool("fund_wallet",
  { description: "Onboard the wallet: drip a little HSK for gas from the treasury (if configured), then claim 10,000 test mUSDC from the faucet and approve the trading contracts. Do this once after create_wallet.", inputSchema: {} },
  async () => { try {
      needWallet();
      const out = { address: agent.address };
      const hsk = await agent.hskBalance();
      if (hsk < ethers.parseEther("0.005")) {
        if (!treasury) throw new Error("agent has no HSK for gas and no MOLFI_TREASURY_KEY is set to drip it — fund " + agent.address + " with HSK");
        const drip = await treasury.sendTransaction({ to: agent.address, value: ethers.parseEther("0.015") });
        await drip.wait();
        out.hskDrip = { hash: drip.hash, amount: "0.015" };
      }
      const ob = await agent.onboard();
      out.faucet = ob.faucet;
      out.mUSDC = await agent.musdc();
      out.HSK = ethers.formatEther(await agent.hskBalance());
      return ok(out);
    } catch (e) { return fail(e); } });

server.registerTool("list_markets",
  { description: "List the live on-chain prediction markets the agent can bet on (marketId, question, YES odds, close time, resolved). Bets escrow real mUSDC in the PredictEscrow contract, settled by the on-chain oracle.", inputSchema: {} },
  async () => { try {
      // Prefer the backend (rich odds); fall back to on-chain enumeration.
      try {
        const r = await fetch(`${CONFIG.apiUrl}/api/onchain/markets`);
        const list = await r.json();
        if (Array.isArray(list) && list.length) return ok({ source: "backend", markets: list.slice(0, 15) });
      } catch {}
      const ids = await market.markets();
      const out = [];
      for (const id of ids.slice(-15)) {
        const m = await market.getMarket(id);
        out.push({ marketId: id, question: m.question, closeTs: Number(m.closeTs) * 1000, resolved: Number(m.status) === 2, outcome: Number(m.status) === 2 ? Number(m.outcome) : null, total: U(await escrow.total(id)) });
      }
      return ok({ source: "onchain", markets: out });
    } catch (e) { return fail(e); } });

server.registerTool("get_prices",
  { description: "Recent spot price series for a symbol (e.g. BTC, ETH, SOL) from the market engine.", inputSchema: { symbol: z.string(), limit: z.number().optional() } },
  async ({ symbol, limit }) => { try { const r = await fetch(`${CONFIG.apiUrl}/api/prices/${symbol}?limit=${limit || 60}`); return ok({ symbol, prices: await r.json() }); } catch (e) { return fail(e); } });

server.registerTool("place_bet",
  { description: "Place a REAL on-chain bet: escrow `amount` mUSDC on an outcome. Signs a transaction from the agent's wallet.", inputSchema: { marketId: z.string(), outcome: z.enum(["YES", "NO"]), amount: z.number() } },
  async ({ marketId, outcome, amount }) => { try { needWallet(); const tx = await agent.bet(marketId, outcome, amount); return ok({ ...tx, position: U(await escrow.position(marketId, outcome === "YES" ? 0 : 1, agent.address)), mUSDC: await agent.musdc() }); } catch (e) { return fail(e); } });

server.registerTool("place_zk_bet",
  { description: "Place a privacy-gated bet: fetch a solvency ZK proof (prove hidden collateral >= threshold) from the backend and place a bet the escrow verifies on-chain, burning a single-use nullifier.", inputSchema: { marketId: z.string(), outcome: z.enum(["YES", "NO"]), amount: z.number() } },
  async ({ marketId, outcome, amount }) => { try { needWallet(); const tx = await agent.betZk(marketId, outcome, amount); return ok({ ...tx, mode: "zk-gated" }); } catch (e) { return fail(e); } });

server.registerTool("place_bet_via_hsp",
  { description: "Pay for the ZK proof via HSP (HashKey Settlement Protocol), then place the private bet. Runs the full x402 settlement loop and returns the bet tx + the HSP settlement tx.", inputSchema: { marketId: z.string(), outcome: z.enum(["YES", "NO"]), amount: z.number() } },
  async ({ marketId, outcome, amount }) => { try { needWallet(); const tx = await agent.betZkViaHSP(marketId, outcome, amount); return ok(tx); } catch (e) { return fail(e); } });

server.registerTool("market_status",
  { description: "Whether a market has resolved and, if so, the winning outcome (0=YES, 1=NO).", inputSchema: { marketId: z.string() } },
  async ({ marketId }) => { try { const resolved = await market.isResolved(marketId); return ok({ marketId, resolved, winningOutcome: resolved ? await agent?.winningOutcome(marketId) ?? Number((await market.getMarket(marketId)).outcome) : null }); } catch (e) { return fail(e); } });

server.registerTool("get_position",
  { description: "The agent's escrowed position (YES and NO mUSDC) on a market.", inputSchema: { marketId: z.string() } },
  async ({ marketId }) => { try { needWallet(); return ok({ marketId, YES: U(await escrow.position(marketId, 0, agent.address)), NO: U(await escrow.position(marketId, 1, agent.address)), poolYES: U(await escrow.pool(marketId, 0)), poolNO: U(await escrow.pool(marketId, 1)) }); } catch (e) { return fail(e); } });

server.registerTool("claim_rewards",
  { description: "Claim winnings after a market resolves — pays the agent's pro-rata share of the pot minus a 2% fee.", inputSchema: { marketId: z.string() } },
  async ({ marketId }) => { try { needWallet(); const tx = await agent.redeem(marketId); return ok({ ...tx, mUSDC: await agent.musdc() }); } catch (e) { return fail(e); } });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[molfi-mcp] ready on HashKey ${NET} (chain ${CONFIG.chainId}); treasury ${treasury ? treasury.address : "not set"}`);
