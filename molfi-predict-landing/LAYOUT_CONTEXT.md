# UI Design & Layout Context: Molfi (HashKey Chain)

This document is the source of truth for the design system and screen layouts of the Molfi landing site. It reflects the actual code in `app/` and `components/`.

## 1. Design System (Visual Language)

### 🎨 Color Palette
- **Background (Obsidian)**: `#0e0e0e`
- **Primary (Lavender)**: `#c899ff`
- **Primary Glow**: `rgba(200, 153, 255, 0.3)`
- **Glass Base**: `rgba(255, 255, 255, 0.03)`
- **Glass Border**: `rgba(72, 72, 72, 0.2)`

### 🖋️ Typography
- **Headline Font**: `Manrope` (`--font-headline`, via Google Fonts)
- **Body Font**: `Inter` (`--font-body`)
- **Hero Headings**: `5xl`–`5.5rem`, `font-black` (900), tight tracking, italic emphasis words.
- **Accents**: Uppercase, wide tracking, bold, for labels and metadata.
- **Gradient Text**: `linear-gradient(135deg, #ffffff 0%, #c899ff 100%)`

### ✨ Key Effects
- **Glassmorphism**: `.glass` — `backdrop-filter: blur(12px)` with semi-transparent border.
- **Micro-Animations**: Framer Motion fade/scale-ins on scroll (`whileInView`).
- **Ambient Glow**: A large lavender radial blur behind the hero.

---

## 2. Screen Layouts

### 🟢 Root Layout (`app/layout.tsx`)
- **Metadata**: title "Molfi | The Most Profitable Way to Trade for Degens"; description references HashKey Chain.
- **Fonts**: Manrope + Inter loaded via `next/font/google`; `<html class="dark">`.
- **Background**: obsidian `#0e0e0e`.

### 🏠 Landing Page (`app/page.tsx`)
- **Navbar**: fixed glassmorphic pill — logo, Products / Resources dropdowns, `$MOLFI` token menu, Download CTA.
- **Hero**: pulsing "Powered by HashKey Chain" badge, big headline, subheadline (trading on HashKey Chain), "Download Molfi App" CTA, ambient lavender glow.
- **Feature Grid**: Molfi Extension (large), Mobile App, Agentic Wallet, Research AI, Built for Speed.
- **Values Row**: Trustless Security, AI-First Engine, HashKey Native.
- **Footer**: logo, product/resources/community link columns, "Powered by HashKey Chain".

### ⬇️ Download Page (`app/download/page.tsx`)
- **Hero**: "Download Molfi" with a multi-platform badge and HashKey Chain subtext.
- **Cards**: Desktop app ("Powered by HashKey Chain"), Android beta (APK), Extension (waitlist email capture, coming soon).

### 🤖 Agent Profile (`app/agent/[id]/page.tsx`)
- **Header**: "Agent Profile" with a "Verified Worker" pill.
- **Agent Card**: name, "Autonomous Protocol Agent", description (Molfi protocol), reputation score, category, wallet address, and an "EXPLORER" chip (target: HashKey explorer).
- **Interaction Console**: prompt textarea + "Delegate Task to Agent" button; shows result / error states.

### 📝 Create Agent (`app/create/page.tsx`)
- Simple registration form (name, description, category) — currently a mock submit.

---

## 3. Notes
- **Chain**: HashKey Chain (EVM). Testnet chainId `133`, mainnet chainId `177`. Native token HSK; stablecoin mUSDC.
- **Leftover code**: `lib/*` and the `/api/*` fetches in `app/agent/[id]` are template leftovers with no live backend in this repo.
- **Agent skill**: `public/skill.md` describes joining the Molfi network on HashKey Chain.
