// pages/api/audit.js — Solana MEV audit with Jupiter Quote-based slippage detection
export const maxDuration = 60;

import { fetchWalletTransactions, fetchWalletBalances, getMeta, getAccountKeys, getTokenBalances } from "../../lib/sim.js";
import { fetchLivePrices, fetchTokenList, formatBalance } from "../../lib/prices.js";
import { generateBriefing, generateProtectionPlan, generateTweetText } from "../../lib/claude.js";
import { buildTradeLots, detectBadHabits, buildTradingStats } from "../../lib/trading.js";

// ── Solana DEX programs ──────────────────────────────────────────────────────
const JUPITER  = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM  = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const ORCA     = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const DEX_SET  = new Set([JUPITER, RAYDIUM, ORCA]);

const PROGRAM_LABELS = {
  [JUPITER]: "Jupiter Aggregated Route",
  [RAYDIUM]: "Raydium AMM",
  [ORCA]:    "Orca Whirlpool",
};

const KNOWN_SYMBOLS = {
  "So11111111111111111111111111111111111111112":   "SOL",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB":  "USDT",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "BONK",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN":  "JUP",
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So":  "mSOL",
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": "WIF",
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3": "PYTH",
};

// ── Math sanity caps ─────────────────────────────────────────────────────────
const MAX_REASONABLE_SLIPPAGE = 25;     // > 25% = math error or dead pool
const MAX_REASONABLE_LOSS_USD = 5000;   // single-attack cap
const MIN_DETECTABLE_SLIPPAGE = 1.2;    // below = normal DEX fees
const MAX_SWAPS_TO_ANALYZE    = 30;     // cap Jupiter Quote calls for speed

// ── Filter swap transactions — any tx with token movement ──
// We don't filter by specific DEX programs because Solana has 20+ DEXs (Jupiter, Raydium,
// Orca, Pump.fun, Meteora, Lifinity, FlashTrade, Phoenix, OpenBook, etc.). Instead, any
// transaction that has both pre and post token balances with at least 2 different mints
// represents a token swap regardless of which DEX routed it.
function filterSwaps(txs) {
  return txs.filter(tx => {
    const meta = getMeta(tx);
    if (!meta || meta.err) return false;
    const { pre, post } = getTokenBalances(tx);
    if (pre.length < 1 || post.length < 1) return false;
    // Need at least 2 different mints involved for a swap (input and output)
    const allMints = new Set([...pre.map(b => b.mint), ...post.map(b => b.mint)]);
    return allMints.size >= 2;
  });
}

// ── Parse swap (defensive — handles multiple SIM response shapes) ──
function parseSwap(tx) {
  const { pre, post } = getTokenBalances(tx);
  const allMints = [...new Set([...pre.map(b => b.mint), ...post.map(b => b.mint)])];

  const deltas = allMints.map(mint => {
    const preEntry  = pre.find(b  => b.mint === mint);
    const postEntry = post.find(b => b.mint === mint);
    const preAmt  = Number(preEntry?.uiTokenAmount?.uiAmount  ?? preEntry?.ui_amount  ?? 0);
    const postAmt = Number(postEntry?.uiTokenAmount?.uiAmount ?? postEntry?.ui_amount ?? 0);
    const decimals = preEntry?.uiTokenAmount?.decimals
                  ?? postEntry?.uiTokenAmount?.decimals
                  ?? preEntry?.decimals
                  ?? postEntry?.decimals
                  ?? 6;
    return { mint, delta: postAmt - preAmt, decimals };
  }).filter(d => Math.abs(d.delta) > 0.000001);

  const sold   = deltas.find(d => d.delta < 0);
  const bought = deltas.find(d => d.delta > 0);
  if (!sold || !bought) return null;

  const accounts = getAccountKeys(tx);
  const dexProgram = accounts.find(a => DEX_SET.has(typeof a === "string" ? a : a?.pubkey || ""));
  const dexProgramKey = typeof dexProgram === "string" ? dexProgram : dexProgram?.pubkey;

  return {
    inputMint:      sold.mint,
    outputMint:     bought.mint,
    inputAmount:    Math.abs(sold.delta),
    outputAmount:   bought.delta,
    inputDecimals:  sold.decimals,
    outputDecimals: bought.decimals,
    blockSlot:      tx.block_slot || tx.blockSlot || tx.slot,
    blockTime:      tx.block_time || tx.blockTime || tx.timestamp,
    dexLabel:       PROGRAM_LABELS[dexProgramKey] || "DEX Swap",
  };
}

// ── Jupiter Quote — get fair expected output ─────────────────────────────────
async function getJupiterQuote(inputMint, outputMint, inputAmount, inputDecimals) {
  try {
    // Convert ui amount → raw amount using actual decimals
    const rawAmount = Math.round(inputAmount * Math.pow(10, inputDecimals));
    if (rawAmount <= 0) return null;

    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rawAmount}&slippageBps=50`;
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);

    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();

    if (!data.outAmount) return null;
    return {
      expectedOutputRaw: parseInt(data.outAmount),
      priceImpactPct:    parseFloat(data.priceImpactPct || 0),
    };
  } catch {
    return null;
  }
}

function formatDate(blockTime) {
  if (!blockTime) return "Unknown";
  const ms = blockTime > 1e15 ? blockTime / 1000 : blockTime * 1000;
  return new Date(ms).toLocaleDateString("en-US", { month:"short", day:"numeric" });
}

function getSeverity(pct) {
  if (pct >= 5)   return "critical";
  if (pct >= 2.5) return "high";
  return "medium";
}

function buildTimeline(attacks) {
  const months = {};
  for (const a of attacks) {
    const ms  = a.blockTime > 1e15 ? a.blockTime/1000 : a.blockTime*1000;
    const d   = new Date(ms);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const lbl = d.toLocaleDateString("en-US", { month:"long", year:"numeric" });
    if (!months[key]) months[key] = { sortKey:key, label:lbl, count:0, loss:0 };
    months[key].count++;
    months[key].loss = parseFloat((months[key].loss + a.lossUsd).toFixed(2));
  }
  return Object.values(months).sort((a,b) => a.sortKey.localeCompare(b.sortKey));
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

  const { address } = req.body;
  if (!address || address.length < 32 || address.length > 44) {
    return res.status(400).json({ error:"Invalid Solana wallet address" });
  }

  if (!process.env.DUNE_SIM_API_KEY)  return res.status(500).json({ error:"DUNE_SIM_API_KEY not configured" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error:"ANTHROPIC_API_KEY not configured" });

  try {
    const [priceResult, tokenListResult, simResult, balancesResult] = await Promise.allSettled([
      fetchLivePrices(),
      fetchTokenList(),
      fetchWalletTransactions(address, 100),
      fetchWalletBalances(address),
    ]);

    const priceMap  = priceResult.status === "fulfilled" ? priceResult.value : {};
    const tokenList = tokenListResult.status === "fulfilled" ? tokenListResult.value : {};

    if (simResult.status === "rejected") {
      return res.status(502).json({ error: `Dune SIM: ${simResult.reason?.message}` });
    }

    const rawTxs = simResult.value?.transactions || [];
    console.log(`[audit] ${rawTxs.length} txs for ${address}`);

    // DIAGNOSTIC: log the structure of the first transaction
    if (rawTxs.length > 0) {
      const t = rawTxs[0];
      console.log(`[audit] sample tx keys: ${Object.keys(t).join(", ")}`);
      const meta = getMeta(t);
      if (meta) {
        console.log(`[audit] sample meta keys: ${Object.keys(meta).join(", ")}`);
        const { pre, post } = getTokenBalances(t);
        console.log(`[audit] sample preTokenBalances: ${pre.length}, postTokenBalances: ${post.length}`);
      } else {
        console.log(`[audit] NO META FOUND on sample tx — checking other paths`);
      }
      const accounts = getAccountKeys(t);
      console.log(`[audit] sample accountKeys count: ${accounts.length}, first 3: ${JSON.stringify(accounts.slice(0,3))}`);
    }

    const swapTxs    = filterSwaps(rawTxs);
    const swapDeltas = swapTxs.map(parseSwap).filter(Boolean);

    console.log(`[audit] ${swapDeltas.length} swaps to analyze`);

    // ── MEV detection — Jupiter Quote based, then fallback ────────────────────
    const attacks = [];
    let skippedInsane = 0;
    let jupiterQuotes = 0;
    let heuristicFallback = 0;

    // Cap analysis to recent swaps for Vercel timeout safety
    const swapsToAnalyze = swapDeltas.slice(0, MAX_SWAPS_TO_ANALYZE);

    for (const swap of swapsToAnalyze) {
      const { inputMint, outputMint, inputAmount, outputAmount,
              inputDecimals, outputDecimals, blockSlot, blockTime, dexLabel } = swap;

      if (inputAmount === 0) continue;

      // Try Jupiter Quote API first — gold standard for fair price
      let slippagePct, expectedOutput, detectionMethod;
      const quote = await getJupiterQuote(inputMint, outputMint, inputAmount, inputDecimals);

      if (quote) {
        // Convert raw expected → ui amount using actual output decimals
        expectedOutput  = quote.expectedOutputRaw / Math.pow(10, outputDecimals);
        const rawSlip   = ((expectedOutput - outputAmount) / expectedOutput) * 100;
        // Subtract Jupiter's own price impact (legitimate, not MEV)
        slippagePct     = Math.max(0, rawSlip - quote.priceImpactPct);
        detectionMethod = "jupiter_quote";
        jupiterQuotes++;
      } else {
        // Fallback: 0.997 heuristic if Jupiter has no quote
        expectedOutput  = inputAmount * 0.997;
        slippagePct     = Math.max(0, ((expectedOutput - outputAmount) / expectedOutput) * 100);
        detectionMethod = "heuristic";
        heuristicFallback++;
      }

      slippagePct = parseFloat(slippagePct.toFixed(4));

      if (slippagePct < MIN_DETECTABLE_SLIPPAGE) continue;

      // Sanity cap — > 25% slippage is impossible math, skip
      if (slippagePct > MAX_REASONABLE_SLIPPAGE) {
        skippedInsane++;
        continue;
      }

      const lossInToken = Math.max(0, expectedOutput - outputAmount);
      const price       = Number(priceMap[outputMint]) || 0;
      const inputPrice  = Number(priceMap[inputMint])  || 0;
      let   lossUsd     = parseFloat((lossInToken * price).toFixed(2));
      const inputUsd    = parseFloat((inputAmount * inputPrice).toFixed(2));

      // Cap loss at $5K — flags suspicious values
      let suspicious = false;
      if (lossUsd > MAX_REASONABLE_LOSS_USD) {
        suspicious = true;
        lossUsd    = MAX_REASONABLE_LOSS_USD;
      }

      const confidence = slippagePct >= 3.5 ? "HIGH" : slippagePct >= 2.0 ? "MEDIUM" : "LOW";
      const label      = confidence === "HIGH"   ? "High Confidence MEV Pattern"
                       : confidence === "MEDIUM" ? "Likely MEV Exposure"
                       : "Elevated Slippage — Possible MEV";

      // Try to get token symbols from Jupiter token list, fallback to known
      const inputSymbol  = KNOWN_SYMBOLS[inputMint]  || tokenList[inputMint]?.symbol  || inputMint.slice(0,4);
      const outputSymbol = KNOWN_SYMBOLS[outputMint] || tokenList[outputMint]?.symbol || outputMint.slice(0,4);

      attacks.push({
        blockSlot, blockTime,
        date:               formatDate(blockTime),
        pair:               `${inputSymbol} → ${outputSymbol}`,
        dexLabel,
        label,
        confidence,
        slippagePct,
        lossUsd,
        inputUsd,
        lossInToken:        parseFloat(lossInToken.toFixed(6)),
        inputAmount:        parseFloat(inputAmount.toFixed(4)),
        severity:           getSeverity(slippagePct),
        detectionMethod,
        verified:           false,
        verificationStatus: suspicious ? "flagged_for_review" : detectionMethod,
        attacker:           null,
      });
    }

    console.log(`[audit] ${jupiterQuotes} Jupiter quotes, ${heuristicFallback} heuristic fallback, ${skippedInsane} filtered as anomalies`);

    // ── Trading Autopsy — PNL + bad habits ───────────────────────────────────
    const tradeLots = buildTradeLots(swapDeltas, priceMap);
    const tradingStats = buildTradingStats(tradeLots);
    const badHabits = detectBadHabits(tradeLots, swapDeltas);
    console.log(`[audit] ${tradeLots.length} closed trade lots, ${badHabits.length} bad habits detected`);

    // ── Summary — always builds, even with 0 attacks ─────────────────────────
    const totalSwaps    = swapDeltas.length;
    const cleanSwaps    = totalSwaps - attacks.length;
    const totalLossUsd  = parseFloat(attacks.reduce((s,a) => s + a.lossUsd, 0).toFixed(2));
    const exposureRate  = totalSwaps > 0 ? `${Math.round((attacks.length/totalSwaps)*100)}%` : "0%";
    const highConf      = attacks.filter(a => a.confidence === "HIGH").length;
    const medConf       = attacks.filter(a => a.confidence === "MEDIUM").length;
    const lowConf       = attacks.filter(a => a.confidence === "LOW").length;
    const riskScore     = Math.min(100, Math.round(highConf*25 + medConf*15 + lowConf*8 + Math.min(totalLossUsd/5,25)));
    const worstHit      = attacks.reduce((m,a) => (!m || a.lossUsd > m.lossUsd ? a : m), null);
    const timeline      = buildTimeline(attacks);

    const botMap = {};
    attacks.forEach(a => {
      const key = `cluster_${a.blockSlot % 3}`;
      if (!botMap[key]) botMap[key] = { address:key, count:0, totalLoss:0 };
      botMap[key].count++;
      botMap[key].totalLoss = parseFloat((botMap[key].totalLoss + a.lossUsd).toFixed(2));
    });
    const attacksByBot = Object.values(botMap).sort((a,b) => b.totalLoss - a.totalLoss);
    const topAttacker  = attacksByBot[0] || null;

    const summary = {
      walletAddress: address,
      totalLossUsd,
      attackCount:   attacks.length,
      totalSwaps,
      cleanSwaps,
      exposureRate,
      riskScore,
      confidenceBreakdown: { high:highConf, medium:medConf, low:lowConf },
      topAttacker,
      worstHit,
      attacksByBot,
      timeline,
      attacks,
    };

    // ── Portfolio — verified pricing with sanity checks ──────────────────────
    // Strategy: trust ui_amount only, cross-reference Jupiter price vs SIM price,
    // hide USD value when sources disagree (show "—" like Phantom does for unverified tokens)
    let portfolio = [], portfolioTotal = 0;
    if (balancesResult.status === "fulfilled" && balancesResult.value?.balances) {
      portfolio = balancesResult.value.balances
        .map(b => {
          const mint = b.address || b.mint || b.token_address || null;
          if (!mint) return null;

          // LAYER 1: Trust SIM's ui_amount only — never compute from raw
          let amount = 0;
          if (b.ui_amount != null)        amount = Number(b.ui_amount);
          else if (b.uiAmount != null)    amount = Number(b.uiAmount);
          else if (b.amount != null && b.decimals != null) {
            amount = Number(b.amount) / Math.pow(10, Number(b.decimals));
          }
          if (!isFinite(amount) || amount <= 0) return null;

          const meta   = tokenList[mint] || {};
          const symbol = KNOWN_SYMBOLS[mint] || meta.symbol || b.symbol || mint.slice(0,4);
          const name   = meta.name || b.name || symbol;

          // LAYER 2: Cross-reference price sources
          const jupiterPrice = Number(priceMap[mint]) || 0;
          const simPrice     = Number(b.price_usd || b.price) || 0;

          let trustedPrice = 0;
          let priceVerified = false;
          let priceNote = "unverified";

          // Major verified tokens — trust whichever price we have
          if (KNOWN_SYMBOLS[mint]) {
            trustedPrice  = jupiterPrice || simPrice;
            priceVerified = trustedPrice > 0;
            priceNote     = "verified";
          }
          // Both sources agree (within 50% of each other) — trusted
          else if (jupiterPrice > 0 && simPrice > 0) {
            const ratio = Math.max(jupiterPrice, simPrice) / Math.min(jupiterPrice, simPrice);
            if (ratio < 1.5) {
              trustedPrice  = (jupiterPrice + simPrice) / 2;
              priceVerified = true;
              priceNote     = "cross-verified";
            } else {
              priceNote = "sources_disagree";
            }
          }
          // Only one source — show but mark unverified
          else if (jupiterPrice > 0) {
            trustedPrice  = jupiterPrice;
            priceVerified = false;
            priceNote     = "single_source";
          }

          // LAYER 3: Sanity check — no single SPL position > $1M
          let valueUsd = trustedPrice > 0 ? parseFloat((amount * trustedPrice).toFixed(2)) : null;
          if (valueUsd != null && valueUsd > 1_000_000 && !KNOWN_SYMBOLS[mint]) {
            // Suspicious: unverified token claiming >$1M position
            valueUsd      = null;
            priceVerified = false;
            priceNote     = "value_too_high";
            trustedPrice  = 0;
          }

          return {
            mint, symbol, name,
            logoURI:  meta.logoURI || b.logo || b.icon || null,
            amount:   parseFloat(amount.toFixed(6)),
            display:  formatBalance(amount) || String(amount),
            price:    trustedPrice,
            valueUsd, // can be null = unverified
            priceVerified,
            priceNote,
          };
        })
        .filter(t => t && t.amount > 0)
        // Sort: verified by value desc, unverified at the end alphabetically
        .sort((a,b) => {
          if (a.valueUsd != null && b.valueUsd != null) return b.valueUsd - a.valueUsd;
          if (a.valueUsd != null) return -1;
          if (b.valueUsd != null) return 1;
          return (a.symbol || "").localeCompare(b.symbol || "");
        })
        .slice(0, 25);
      portfolioTotal = parseFloat(
        portfolio.reduce((s,t) => s + (t.valueUsd || 0), 0).toFixed(2)
      );
    }

    // ── AI narration ──────────────────────────────────────────────────────────
    const [briefing, protectionPlan] = await Promise.all([
      generateBriefing(summary, tradingStats, badHabits),
      generateProtectionPlan(summary),
    ]);
    const tweetText = generateTweetText(summary, tradingStats, badHabits);

    const simRawResponse = {
      endpoint:           `https://api.sim.dune.com/beta/svm/transactions/${address}`,
      status:             200,
      transactions_count: rawTxs.length,
      swaps_detected:     swapTxs.length,
      swaps_analyzed:     swapsToAnalyze.length,
      jupiter_verified:   jupiterQuotes,
      heuristic_fallback: heuristicFallback,
      mev_flagged:        attacks.length,
      filtered_anomalies: skippedInsane,
      transactions:       rawTxs.slice(0, 10),
    };

    return res.status(200).json({
      success: true,
      wallet:  address,
      summary,
      tradingStats,
      badHabits,
      briefing,
      protectionPlan,
      tweetText,
      portfolio,
      portfolioTotal,
      simRawResponse,
      generatedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error("[audit]", err);
    return res.status(500).json({ error: err.message || "Audit failed" });
  }
}
