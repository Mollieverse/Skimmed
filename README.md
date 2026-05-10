# SKIMMED
### Why You Keep Losing Money on Solana
**Built for Colosseum Frontier 2026 · Powered by Dune SIM + Claude AI**

> *"90% of Solana memecoin traders lose money. Most have no idea why. SKIMMED reads your wallet and tells you exactly which patterns are killing your trades."*

SKIMMED is a forensic wallet autopsy tool for Solana memecoin traders. Paste your wallet address — we pull your full transaction history through **Dune SIM**, calculate your real PNL, detect the behavioral patterns silently bleeding your capital, and **Claude AI** delivers the verdict in plain English.

Live: **https://skimmed.vercel.app**

---

## The Problem

Solana memecoin trading is a meat grinder. 90% of traders lose money long-term, and most can't tell you why. They blame the market, the bots, the rugs — anything but the patterns hiding in their own transaction history.

The real damage is usually behavioral: revenge trades after losses, panic-selling winners within hours, holding losers 4x longer than winners, FOMO-buying tokens 30 minutes after launch, repeated losses on the same setup. These patterns are invisible to the trader living through them, but they're written clearly across every wallet's on-chain history.

**Existing tools — Cielo, Step Finance, BullX, Photon — show PNL numbers and a leaderboard.** None tell you *why* you're losing. None hold up an honest mirror to your behavior. That's the gap SKIMMED fills.

---

## What SKIMMED Does

| Feature | Description |
|---|---|
| 🔴 Realized PNL | Real profit/loss across all closed trade lots, computed from your transaction history |
| 📊 Trading Performance | Win rate, average hold time, W/L ratio, best/worst trades |
| ⚠️ Bad Habits Detected | AI-flagged behavioral patterns with severity and dollar cost |
| 🧠 Forensic Briefing | Claude AI writes a 3-4 sentence personalized autopsy |
| 🛡 Protection Plan | Specific corrective actions tailored to your patterns |
| 🥪 MEV Detection | Lightweight slippage analysis flags execution losses (bonus) |
| 📈 Monthly Damage Timeline | When your worst trading damage occurred |
| 🔵 Dune SIM Dev Panel | Raw API response surfaced for transparency |
| 📤 Share Card | Downloadable PNG for posting on X |
| 🎭 Demo Mode | Pre-loaded with Ansem's public wallet for instant testing |

---

## Behavioral Patterns Detected

| Pattern | Definition |
|---|---|
| **Bag Holding** | You hold losing trades 2x+ longer than winners (≥3 losses) |
| **Paper Hands** | 40%+ of your winners get sold within 2 hours of buying |
| **Repeat Losses** | You've lost on the same token 2+ separate times |
| **Low Win Rate** | Less than 40% of your trades close profitably (≥5 trades) |
| **Revenge Trading** | You re-buy a token within 24h of selling it at a loss |

Each pattern is scored as **HIGH** or **CRITICAL** severity, with a calculated dollar cost where measurable.

---

## How It Works

```
User pastes wallet address
       ↓
Dune SIM fetches Solana transaction history
       ↓
Swap transactions filtered (any DEX, any tokens)
       ↓
Trade lots paired (FIFO buy → sell matching)
       ↓
PNL calculated, win rate computed, hold times measured
       ↓
Behavioral pattern rule engine flags bad habits
       ↓
Jupiter Quote API validates fair execution prices
       ↓
MEV slippage flagged where actual < expected (sanity-capped)
       ↓
Live Jupiter prices used for USD calculations
       ↓
Claude AI generates forensic briefing + protection plan
       ↓
Report rendered: PNL, behavior, MEV, share card
```

A single Dune SIM call is the foundation. Without full SVM transaction history with decoded token movements, the entire autopsy is impossible.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 |
| Blockchain data | **Dune SIM API** — `/beta/svm/transactions`, `/beta/svm/balances` |
| Price validation | **Jupiter Quote API** — fair-output check per swap |
| Token prices | **Jupiter Lite Price API** — live, no key required |
| Token metadata | **Jupiter Token List** — verified logos and symbols |
| AI narration | **Claude API** (claude-sonnet-4) — briefing + protection plan |
| Deployment | Vercel |

---

## Why Dune SIM

SKIMMED is built around Dune SIM, not on top of it. Every metric in the report — PNL, win rate, behavioral patterns, MEV exposure — flows from a single SIM transactions call.

The core insight: **a single SIM call returns enough decoded SVM data to reconstruct a trader's complete behavioral fingerprint.** SIM removes the indexing burden — we don't need to maintain custom validators or scrape RPC endpoints — which is exactly why a solo builder on a phone could ship this in five days. SKIMMED is what becomes buildable when transaction-level wallet history is one API call away.

The integration is surfaced prominently in the UI — the dev panel shows the raw API response with MEV-flagged fields highlighted, and a 4-step "How Dune SIM Powers This Report" strip walks users through what SIM enables.

---

## Try It

**Demo:** click "Try Demo Wallet (Ansem)" on the live site
**Or paste any Solana wallet address** — we'll pull the data and run the autopsy

**Live:** https://skimmed.vercel.app

---

## What's Next

- Cross-reference price oracles (Birdeye + DexScreener) for memecoin pricing accuracy
- Pagination through SIM's full historical dataset (currently capped at most recent 100)
- Multi-hop trade lot pairing for tokens swapped without going through SOL/USDC
- Helius block-level verification for confirmed MEV attacks
- Premium tier with custom date ranges and exportable PDF reports

---

Built for **Colosseum Frontier 2026**

Data: Dune SIM · Validation: Jupiter Quote · Prices: Jupiter · Narration: Claude AI · Chain: Solana

Solo build by [@Mollieofweb3](https://x.com/Mollieofweb3) — mobile-only, from Akwa Ibom, Nigeria
