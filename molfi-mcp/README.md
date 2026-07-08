# molfi-mcp — Molfi agentic MCP server (HashKey Chain)

An MCP server that lets an LLM agent trade **private prediction markets on HashKey
Chain**. It wraps the [`molfi-predict-sdk`](../molfi-predict-sdk) `MolfiAgent` and
drives the deployed Molfi contracts with real transactions.

## Tools

| Tool | What it does |
|---|---|
| `create_wallet` | fresh EVM agent wallet (address + secret) |
| `import_wallet` | restore a wallet from its secret |
| `wallet_status` | address, mUSDC + HSK balances |
| `fund_wallet` | drip HSK for gas from the treasury, faucet 10,000 mUSDC, approve contracts |
| `list_markets` | live on-chain markets (backend odds, or on-chain fallback) |
| `get_prices` | recent spot series for a symbol |
| `place_bet` | REAL on-chain bet (escrow mUSDC on YES/NO) |
| `place_zk_bet` | privacy-gated bet — solvency ZK proof verified on-chain + nullifier |
| `place_bet_via_hsp` | pay for the ZK proof via **HSP**, then bet (x402 settlement loop) |
| `market_status` | resolved? winning outcome |
| `get_position` | the agent's YES/NO escrowed position |
| `claim_rewards` | redeem winnings after resolution |

## Run / connect

```bash
( cd ../molfi-predict-sdk && npm install && npm run build )   # build the agent SDK first
npm install
cp .env.example .env    # set MOLFI_TREASURY_KEY (+ network)
node server.js          # stdio MCP server
```

Connect it to Claude Code / Claude Desktop (`.mcp.json` / config):

```json
{
  "mcpServers": {
    "molfi": {
      "command": "node",
      "args": ["/ABS/PATH/molfi-predict-hashkey/molfi-mcp/server.js"],
      "env": {
        "MOLFI_NETWORK": "testnet",
        "MOLFI_TREASURY_KEY": "0x...",
        "MOLFI_API_URL": "http://localhost:4000"
      }
    }
  }
}
```

## Verify end-to-end

```bash
node verify.mjs   # spawns the server, runs create → fund → bet → resolve → claim with real txs
```

Proven on HashKey testnet: an agent created a wallet, funded itself (HSK drip + mUSDC
faucet), placed a 100 mUSDC bet, and redeemed its winnings — all via MCP tool calls.

> **Gas:** fresh agents need a little HSK. On testnet the treasury drips it
> automatically. On **mainnet**, fund the treasury address with HSK first; then
> `fund_wallet` drips to each agent.
