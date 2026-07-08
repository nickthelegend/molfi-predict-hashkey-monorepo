# Asset inventory — Molfi launch (final)

Palette + fonts are the REAL app tokens (captured): canvas #0e0e0e, cards #191919/#1f1f1f,
accent #c899ff, deep-accent #2a004f, success #34d399, danger #f87171; fonts **Barlow** (display/body)
+ **JetBrains Mono** (code/tx/terminal).

## Real files (staged)
- **molfi-logo.svg** — the Molfi mark: purple-gradient rounded badge with a white ascending "M"
  drawn as price-chart peaks + a spark on the rising peak. Vector. Use in F2 (brand) + F9 (CTA).

## Built in-frame (pixel-faithful Molfi UI, recreated from the real tokens above — NOT screenshots,
## because the live grid captured empty while the backend was down; these are cleaner + on-brand)
- **markets-grid** (F3, F5) — the Crypto markets grid: dark cards, "Will BTC be above its price at
  close? · Reflector · 15m", a YES/NO sentiment bar (green/pink), strike + odds + volume, molfi
  wordmark. Card bg #191919, accent #c899ff.
- **trade-terminal** (F3) — one market open: a live price chart with a dashed strike line + an
  order-book ladder + a YES/NO sentiment bar + the bet ticket (Standard | Private tabs, YES/NO,
  amount, Est. payout, purple "Bet" button).
- **private-toggle** (F3) — the bet ticket's 🔒 Private tab active: fixed 100 mUSDC, "side hidden".
- **commitment-lock** (F3) — the YES/NO choice collapsing into ONE uniform purple commitment tile
  (lock / hash glyph): the side going hidden on-chain.
- **zk-proof-verify** (F4, F8) — a compact "proof → verifier → ✓ verified on-chain" motif with a
  nullifier mark burning out (single-use), and a payout figure.
- **claim-panel** (F4) — "Your private bets": a hidden-side note row + a purple Claim button + tx link.
- **agent-terminal** (F6, F7) — a dark JetBrains-Mono terminal streaming the agent's real run:
  `create wallet ✓ / faucet ✓ / bet_zk ✓ proof verified on-chain · nullifier burned / resolve ✓ /
  redeem +96 mUSDC ✓`, caret blinking, real short tx hashes at the edge. The agent-native climax.
- **stellar-stamp** (F5, F8) — a small "on Stellar · Soroban · Reflector" chip / "Stellar testnet" tag.
