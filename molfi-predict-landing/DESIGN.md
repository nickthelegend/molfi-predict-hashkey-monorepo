# Design System Specification: Molfi

## 1. Overview & Creative North Star
The Creative North Star for Molfi is **"The Digital Architect."** A high-end, cinematic environment built on deep obsidian surfaces and luminous lavender accents. It should feel authoritative, precise, and premium — the interface of a serious agentic-finance tool on HashKey Chain.

We achieve this by embracing **Obsidian Surfaces** and **tonal layering**: deep near-black backgrounds, glassmorphic panels, and soft lavender glows that guide the eye.

---

## 2. Colors & Surface Philosophy
The palette (see `app/globals.css`) is rooted in a deep obsidian black, complemented by a lavender primary and luminous highlights.

- **Background (Obsidian)**: `#0e0e0e`
- **Primary (Lavender)**: `#c899ff` (with `--primary-dim #bb83fd`, `--primary-container #be86ff`)
- **On-Primary**: `#44007f`
- **Primary Glow**: `rgba(200, 153, 255, 0.3)` — used for glowing shadows and borders

### The "Obsidian" Rule
Structural boundaries are defined by tonal shifts, not hard borders. Surfaces stack from `#000000` (lowest) through `#131313`, `#191919`, `#1f1f1f`, up to `#262626`, so content appears to float in deep space.

### Surface Hierarchy
- **Base Layer:** `#0e0e0e` (The Canvas)
- **Interactive Layers:** `#191919` (Cards/Sections)
- **Elevated Components:** `#1f1f1f`–`#262626` (Modals/Popovers)

---

## 3. Typography
- **Display (Manrope, `--font-headline`):** Headlines. `font-black` (900), tight tracking, occasional italic for emphasis words.
- **Body (Inter, `--font-body`):** High-legibility descriptions.
- **Labels (Inter):** All-caps, wide tracking for metadata like "POWERED BY HASHKEY CHAIN".
- **Gradient Text:** `linear-gradient(135deg, #ffffff 0%, #c899ff 100%)` via the `.text-gradient` utility.

---

## 4. Elevation & Depth
Depth is achieved via **Glassmorphism** and **Soft Glows**.

### Glassmorphic Containers (`.glass`)
`backdrop-filter: blur(12px)` over a near-transparent white (`rgba(255,255,255,0.03)`) with a subtle `rgba(72,72,72,0.2)` border.

### Dynamic Highlights (`.primary-glow`)
On primary actions and hover, apply a soft lavender radial glow (`box-shadow: 0 0 30px -5px rgba(200,153,255,0.3)`).

---

## 5. Components

### Buttons
- **Primary (Action):** Lavender (`--primary`) background, dark `--on-primary` text, `rounded-2xl`, `.primary-glow`. Used for "Download Molfi App".
- **Secondary:** Transparent with a subtle outline-variant border.

### Feature Cards
Large rounded (`2.5rem`) obsidian cards with a top gradient wash and an image placeholder region. On hover the border shifts toward the lavender primary.

### Chain Badge
A pill with `bg-primary/10`, a pulsing dot, and all-caps wide-tracked text — e.g. "Powered by HashKey Chain".

---

## 6. Do's and Don'ts

### Do
- **Do** use Manrope for primary headings and Inter for body.
- **Do** lean into deep obsidian surfaces and tonal layering.
- **Do** use fluid Framer Motion transitions for state changes.
- **Do** use the lavender primary sparingly, for emphasis and CTAs.

### Don't
- **Don't** use generic "SaaS Blue" or off-brand accent colors.
- **Don't** use hard, high-contrast 1px borders — prefer tonal shifts.
- **Don't** clutter the screen; let the product speak.
- **Don't** reintroduce prior-stack branding (0G, Algorand, Rendr).
