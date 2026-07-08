---
format: 1920x1080
message: "Bet in private on Stellar — and let AI agents trade it for you."
arc: Hook/Problem → Brand turn → Bet & hide → ZK claim → On-chain venue → Agent turn → Agent lifecycle → Proof → CTA
audience: crypto-native traders, ZK + AI-agent builders, the Stellar ecosystem
music: minimal electronic, premium, confident, restrained — a low pulse bed, not a drop
---

## Video direction

- **Look:** near-black canvas (#0e0e0e), cards #191919/#1f1f1f, ONE accent — purple #c899ff (brand gradient #c899ff→#6d4aff), crisp white **Barlow**; **JetBrains Mono** for code/tx/terminal. Green #34d399 = YES/up only; pink #f87171 = NO/down. Premium, clean, kinetic — restraint over flash. No gradient-for-its-own-sake slop.
- **Two acts, one flow:** Frames 1–5 are the *human* story; Frame 6 is the natural hinge ("not just people"); 6–9 are the *agent* story. Never hard-cut between acts — F5's "runs itself" sets up F6.
- **Audio mix (locked):** BGM **5%** (subtle bed). SFX **20%**, and the ONLY SFX is a soft click on each frame transition — no clock/tick, no per-beat whooshes. Narrator sits on top, calm, unhurried.
- **Captions (karaoke, locked):** active word = **dark ink #0e0e0e on a solid #c899ff block** (readable), inactive words muted-white ~60%. Bottom-center in the keep-out band; never over a number/logo the frame needs.
- **UI:** the app UI (markets grid, trade terminal, ticket, claim, terminal) is **recreated in-frame from the real captured tokens/fonts** (pixel-faithful; not raster screenshots). molfi-logo.svg is the one real asset (F2, F9).
- **Camera/motion doctrine:** one idea moving at a time; ease-out entrances, slow drifts on holds; the accent leads the eye. Reveals paced to the spoken word — content keeps arriving, never front-loaded then frozen.

---

## Frame 1 — Your bets are public

- type: pain_point
- duration: 6.293s
- transition_in: cut
- src: compositions/frames/01-public.html
- scene: A public bet feed scrolls; every row exposes a wallet + YES/NO side; one row spotlights as "you".
- blueprint: overwhelm-surround (adapt)
- asset_candidates: public bet-feed (in-frame), stellar-stamp
- voiceover: "Every prediction market has the same flaw. It's public. Everyone can see which side you took."
- status: outline

Shot sequence:
- Scene 1 (0–2.5s): cold open on black; 5–6 mono rows fade-up in staggered cascade — each `0x9f…a2 · BTC↑ · YES` / `0x71… · NO`, sides colored green/pink. Layout: centered ledger column. Motion: rows type/slide in on the beat under "public".
- Scene 2 (2.5–5s): the feed keeps filling and subtly accelerates (density builds); a faint grid lights behind. Motion: continuous upward drift, no reset.
- Scene 3 (5–7s): a purple ring snaps around ONE row and a small "you" tag pops — held, slightly claustrophobic. Motion: spring-pop ring on "you took"; freeze.

## Frame 2 — Molfi

- type: product_intro
- duration: 3.883s
- transition_in: wipe
- src: compositions/frames/02-molfi.html
- sfx: soft click
- scene: The exposed rows rush inward and compress into the Molfi mark; wordmark + one line.
- blueprint: logo-assemble-lockup
- asset_candidates: molfi-logo.svg
- voiceover: "Molfi fixes that. Private prediction markets, on Stellar."
- status: outline

Shot sequence:
- Scene 1 (0–2s): all F1 rows collapse toward center (converge + shrink) into a single point. Motion: fast ease-in implosion on the cut.
- Scene 2 (2–4.5s): the molfi-logo.svg mark assembles at center (badge draws, "M" chart-peaks stroke on, spark pops on the rising peak). Motion: draw-on + spring spark.
- Scene 3 (4.5–7s): wordmark "molfi" fades up beneath; then the line "Private prediction markets on Stellar." settles. Layout: centered lockup. Motion: fade-up, calm hold with a slow 1–2% scale drift.

## Frame 3 — Take your side. Then hide it.

- type: feature_showcase
- duration: 7.147s
- transition_in: crossfade
- src: compositions/frames/03-bet-hide.html
- sfx: soft click
- scene: Recreated trade terminal; a cursor picks YES, flips the Private tab, the side collapses into one commitment tile.
- blueprint: cursor-ui-demo
- asset_candidates: trade-terminal (in-frame), private-toggle (in-frame), commitment-lock (in-frame)
- voiceover: "Pick a market. Take your side. Then flip on Private — and on-chain, your side disappears behind a commitment."
- status: outline

Shot sequence:
- Scene 1 (0–2.5s): the trade terminal builds — chart with dashed strike line (left), bet ticket (right) with Standard|Private tabs, YES/NO, amount. Layout: two-column terminal in a floating window. Motion: window fade-up; chart line draws on.
- Scene 2 (2.5–5s): a purple cursor glides in, clicks **YES** (green fill pulses), then clicks the **Private** tab. Motion: cursor move → click feedback ring; camera nudges toward the ticket.
- Scene 3 (5–8s): on "disappears," the YES/NO row collapses into ONE uniform purple commitment tile (lock/hash glyph); ticket now reads "Private · 100 mUSDC · side hidden". Motion: collapse-merge into the tile + a soft lock snap; hold.

## Frame 4 — Claim with a proof

- type: feature_showcase
- duration: 7.403s
- transition_in: cut
- src: compositions/frames/04-claim.html
- sfx: soft click
- scene: Market resolves; a proof → verifier → ✓ motif; nullifier burns; payout lands.
- blueprint: video-text-pivot (adapt)
- asset_candidates: claim-panel (in-frame), zk-proof-verify (in-frame)
- voiceover: "When it settles, you claim with a zero-knowledge proof, verified on-chain. You get paid — and your bet stays private."
- status: outline

Shot sequence:
- Scene 1 (0–2.5s): the claim panel holds — "Your private bet · resolved" + a purple **Claim** button; cursor presses it. Motion: press feedback; panel slides left to hand weight rightward.
- Scene 2 (2.5–5.5s): a proof glyph travels into a verifier block and stamps a green **✓ verified on-chain**; a nullifier mark ignites and burns out. Motion: glyph travel on the beat "verified on-chain"; ember burn on "stays private".
- Scene 3 (5.5–8s): a payout figure counts up (`+ mUSDC`) beside a small "side never revealed" line. Motion: count-up; calm hold.

## Frame 5 — A real on-chain venue

- type: benefit_highlight
- duration: 6.848s
- transition_in: cut
- src: compositions/frames/05-venue.html
- sfx: soft click
- scene: The live crypto markets grid self-assembles; an "on Stellar · Reflector" chip stamps in.
- blueprint: grid-card-assemble
- asset_candidates: markets-grid (in-frame), stellar-stamp (in-frame)
- voiceover: "Real markets. Real money on Stellar, settled by a live oracle — a venue that runs itself."
- status: outline

Shot sequence:
- Scene 1 (0–3s): market cards cascade into a 2×3 grid — "BTC / ETH / SOL … above its price at close? · Reflector · 15m", each with a green/pink sentiment bar + odds. Layout: centered grid. Motion: staggered card assemble.
- Scene 2 (3–5s): a small "on Stellar · Soroban · settled by Reflector" chip stamps in bottom-center. Motion: chip spring-pop.
- Scene 3 (5–7s): a slow camera zoom-OUT reveals more cards at the edges (a bigger venue), holding on the phrase "runs itself" — the bridge into Act 2. Motion: gentle zoom-out drift.

## Frame 6 — Not just for people

- type: product_intro
- duration: 4.437s
- transition_in: cut
- src: compositions/frames/06-agent-turn.html
- sfx: soft click
- scene: The grid recedes to one line; a terminal caret blinks awake — the hinge into Act 2.
- blueprint: typewriter-reveal
- asset_candidates: agent-terminal (in-frame)
- voiceover: "Which is perfect — because Molfi is built for agents, not just people."
- status: outline

Shot sequence:
- Scene 1 (0–2.5s): the F5 grid dims and slides back/out of focus; canvas returns to near-black. Motion: recede + blur.
- Scene 2 (2.5–5s): a single line types on the beat — "Built for agents." — in Barlow, with a blinking caret. Motion: type-on + caret blink.
- Scene 3 (5–7s): a JetBrains-Mono terminal window frame fades up empty, caret waiting — poised for Act 2. Motion: window fade-up; hold on the blink.

## Frame 7 — An agent trades it. No human.

- type: feature_showcase
- duration: 12.245s
- transition_in: crossfade
- src: compositions/frames/07-agent-run.html
- sfx: soft click
- scene: A dark terminal streams the agent's autonomous run, one line per beat, ending on the ZK bet + redeem.
- blueprint: device-surface-showcase (adapt)
- asset_candidates: agent-terminal (in-frame)
- voiceover: "An AI agent reads one skill file, and trades on its own. It funds a wallet, places a zero-knowledge bet, settles it, and redeems the winnings. No human touched a key."
- status: outline

Shot sequence:
- Scene 1 (0–2s): terminal header `molfi-agent · SKILL.md`; line 1 types `create wallet ✓  GD7Z…IH7MJ`. Motion: type-on, held terminal as hero.
- Scene 2 (2–5s): lines stream on each phrase — `faucet mUSDC ✓`, then `bet_zk ✓` which **glows purple** with `proof verified on-chain · nullifier burned`. Motion: each line slides up; the bet_zk line pulses on "zero-knowledge bet".
- Scene 3 (5–9s): `resolve ✓` then `redeem  +96 mUSDC ✓` (green) land on "redeems the winnings"; three short tx hashes flick in at the right edge; "No human" beat holds. Motion: count/settle; camera holds tight on the terminal.

## Frame 8 — Every step, real

- type: social_proof
- duration: 2.816s
- transition_in: cut
- src: compositions/frames/08-proof.html
- sfx: soft click
- scene: A hero "+96 mUSDC" stat with three tx-hash chips + a "Stellar testnet" tag.
- blueprint: dataviz-countup
- asset_candidates: zk-proof-verify (in-frame), stellar-stamp (in-frame)
- voiceover: "Every step — a real transaction on Stellar."
- status: outline

Shot sequence:
- Scene 1 (0–2s): "+96 mUSDC" counts up big in green, center. Motion: count-up with a settle overshoot.
- Scene 2 (2–4s): three truncated tx-hash chips (`bet_zk 0e9bca76…`, `resolve d1eb6e7c…`, `redeem 09f89119…`) chip in below a small "Stellar testnet" tag. Motion: staggered chip pop; hold.

## Frame 9 — Trade now

- type: cta
- duration: 4.693s
- transition_in: crossfade
- src: compositions/frames/09-cta.html
- sfx: soft click
- scene: The Molfi mark condenses to the CTA lockup; "Bet in private, on Stellar," then a "Trade now" pill + molfi.fun.
- blueprint: cta-morph-press
- asset_candidates: molfi-logo.svg
- voiceover: "Molfi. Bet in private, on Stellar. Trade now — at molfi.fun."
- status: outline

Shot sequence:
- Scene 1 (0–2s): the molfi-logo.svg mark resolves center; wordmark settles beneath. Motion: condense-in from the previous frame.
- Scene 2 (2–3.5s): the line "Bet in private, on Stellar." fades up. Motion: fade-up.
- Scene 3 (3.5–5s): a purple **Trade now** pill spring-pops with **molfi.fun** beneath it; a cursor lands one soft click on the pill. Motion: spring-pop pill + click feedback; hold on brand + CTA.
