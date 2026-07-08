// Verify the Molfi MCP server drives a REAL end-to-end agent trade on HashKey.
// Spawns the server over stdio, lists tools, then calls them as an LLM agent would:
//   create_wallet → fund_wallet → place_bet → get_position → (resolve) → claim_rewards.
// A market is opened by the treasury (admin action, out-of-band) for the agent to bet on.
import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { TESTNET } from "../molfi-predict-sdk/dist/index.js";

const env = Object.fromEntries(readFileSync("../molfi-contracts/.env", "utf8").split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const TREASURY_KEY = env.PRIVATE_KEY.trim();
const dep = JSON.parse(readFileSync("../molfi-contracts/deployments/133.json", "utf8"));
const provider = new ethers.JsonRpcProvider(TESTNET.rpcUrl, TESTNET.chainId);
const treasury = new ethers.Wallet(TREASURY_KEY, provider);
const marketAbi = JSON.parse(readFileSync("../molfi-contracts/out/Market.sol/Market.json", "utf8")).abi;
const market = new ethers.Contract(dep.market, marketAbi, treasury);

const call = async (client, name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content?.[0]?.text ?? "";
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  if (r.isError) throw new Error(`${name}: ${text}`);
  return parsed;
};

async function main() {
  const transport = new StdioClientTransport({
    command: "node", args: ["server.js"],
    env: { ...process.env, MOLFI_NETWORK: "testnet", MOLFI_TREASURY_KEY: TREASURY_KEY },
  });
  const client = new Client({ name: "molfi-mcp-verify", version: "1.0.0" });
  await client.connect(transport);
  console.log("=== connected to molfi-mcp ===");

  const { tools } = await client.listTools();
  console.log(`[tools] ${tools.length}:`, tools.map((t) => t.name).join(", "));

  console.log("\n[create_wallet]");
  const w = await call(client, "create_wallet");
  console.log("  agent:", w.address);

  console.log("\n[fund_wallet] (treasury drips HSK + faucet mUSDC)");
  const f = await call(client, "fund_wallet");
  console.log("  HSK:", f.HSK, "| mUSDC:", f.mUSDC, f.hskDrip ? `| drip ${f.hskDrip.hash.slice(0, 14)}…` : "");

  // Treasury opens a market for the agent to bet on.
  const marketId = ethers.keccak256(ethers.toUtf8Bytes(`mcp-verify-${Date.now()}`));
  const now = (await provider.getBlock("latest")).timestamp;
  await (await market.create(marketId, "MCP verify: will YES win?", now + 3600)).wait();
  console.log("\n[treasury] opened market", marketId.slice(0, 14) + "…");

  console.log("\n[list_markets]");
  const lm = await call(client, "list_markets");
  console.log("  source:", lm.source, "| count:", lm.markets.length);

  console.log("\n[place_bet] 100 mUSDC on YES");
  const bet = await call(client, "place_bet", { marketId, outcome: "YES", amount: 100 });
  console.log("  tx:", bet.hash, "| position:", bet.position, "mUSDC | balance:", bet.mUSDC);

  console.log("\n[get_position]");
  const pos = await call(client, "get_position", { marketId });
  console.log("  YES:", pos.YES, "NO:", pos.NO, "| poolYES:", pos.poolYES);

  // Treasury resolves YES.
  await (await market.resolve(marketId, 0)).wait();
  console.log("\n[treasury] resolved market → YES");

  console.log("\n[market_status]");
  console.log(" ", await call(client, "market_status", { marketId }));

  console.log("\n[claim_rewards]");
  const claim = await call(client, "claim_rewards", { marketId });
  console.log("  tx:", claim.hash, "| balance after:", claim.mUSDC);

  console.log("\n=== ✅ MCP DROVE A FULL AGENT TRADE ON HASHKEY (create → fund → bet → resolve → claim) ===");
  await client.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
