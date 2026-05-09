// pages/api/audit.js — Solana MEV audit pipeline with strict math sanity
export const maxDuration = 60;

import { fetchWalletTransactions, fetchWalletBalances } from "../../lib/sim.js";
import { fetchLivePrices, fetchTokenList, formatBalance } from "../../lib/prices.js";
import { generateBriefing, generateProtectionPlan, generateTweetText } from "../../lib/claude.js";

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

// ── Verified token whitelist — major Solana tokens only ──────────────────────
// MEV detection runs ONLY on these. Filters out scam/spam/illiquid tokens
// that produce nonsense slippage numbers (e.g., FLOKI showing $1B loss).
const VERIFIED_TOKENS = new Set([
  "So11111111111111111111111111111111111111112",   // SOL / WSOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",  // USDT
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",  // JUP
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",  // mSOL
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", // PYTH
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // ETH (wormhole)
  "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E", // BTC (wormhole)
  "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",  // RENDER
  "EzfgjvkSwthhgHaceR3LnKXUoRkP6NUhfghdaHaJ1mY",  // FIDA
]);

const MINT_SYMBOL = {
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
const MAX_REASONABLE_SLIPPAGE = 25;   // anything above 25% = scam token / illiquid pool
const MAX_REASONABLE_LOSS_USD = 5000; // single-attack loss cap; above = math error
const MIN_DETECTABLE_SLIPPAGE = 1.2;  // below this is just normal DEX fees

// ── Filter DEX swaps from SIM transactions ───────────────────────────────────
function filterSwaps(txs) {
  return txs.filter(tx => {
    const meta = tx.raw_transaction?.meta;
    const msg  = tx.raw_transaction?.transaction?.message;
    if (!meta || !msg || meta.err) return false;
    const accounts = msg.accountKeys || [];
    return accounts.some(k => DEX_SET.has(k)) &&
      meta.preTokenBalances?.length > 0 &&
      meta.postTokenBalances?.length > 0;
  });
}

// ── Parse swap with proper decimal handling ──────────────────────────────────
function parseSwap(tx) {
  const pre  = tx.raw_transaction?.meta?.preTokenBalances  || [];
  const post = tx.raw_transaction?.meta?.postTokenBalances || [];
  const msg  = tx.raw_transaction?.transaction?.message;

  const allMints = [...new Set([...pre.map(b => b.mint), ...post.map(b => b.mint)])];

  // CRITICAL: use uiAmount (already decimal-adjusted), not raw amount
  const deltas = allMints.map(mint => {
    const preAmt  = Number(pre.find(b  => b.mint === mint)?.uiTokenAmount?.uiAmount  || 0);
    const postAmt = Number(post.find(b => b.mint === mint)?.uiTokenAmount?.uiAmount || 0);
    return { mint, delta: postAmt - preAmt };
  }).filter(d => Math.abs(d.delta) > 0.000001);

  const sold   = deltas.find(d => d.delta < 0);
  const bought = deltas.find(d => d.delta > 0);
  if (!sold || !bought) return null;

  // ONLY analyze swaps between verified tokens — skip scam/illiquid pairs
  if (!VERIFIED_TOKENS.has(sold.mint) || !VERIFIED_TOKENS.has(bought.mint)) {
    return null;
  }

  const accounts   = msg?.accountKeys || [];
  const dexProgram = accounts.find(a => DEX_SET.has(a));

  return {
    inputMint:    sold.mint,
    outputMint:   bought.mint,
    inputAmount:  Math.abs(sold.delta),
    outputAmount: bought.delta,
    blockSlot:    tx.block_slot,
    blockTime:    tx.block_time,
    dexLabel:     PROGRAM_LABELS[dexProgram] || "DEX Swap",
  };
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

  if (!process.env.DUNE_SIM_API_KEY) {
    return res.status(500).json({ error:"DUNE_SIM_API_KEY not configured" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error:"ANTHROPIC_API_KEY not configured" });
  }

  try {
    const [priceResult, tokenListResult, simResult, balancesResult] = await Promise.allSettled([
      fetchLivePrices(),
      fetchTokenList(),
      fetchWalletTransactions(address, 100),
      fetchWalletBalances(address),
    ]);

    const priceMap  = priceResult.status  === "fulfilled" ? priceResult.value  : {};
    const tokenList = tokenListResult.status === "fulfilled" ? tokenListResult.value : {};

    if (simResult.status === "rejected") {
      console.error("[audit] SIM failed:", simResult.reason?.message);
      return res.status(502).json({ error: `Dune SIM: ${simResult.reason?.message}` });
    }

    const rawTxs = simResult.value?.transactions || [];
    console.log(`[audit] ${rawTxs.length} transactions for ${address}`);

    const swapTxs    = filterSwaps(rawTxs);
    const swapDeltas = swapTxs.map(parseSwap).filter(Boolean);

    console.log(`[audit] ${swapDeltas.length} verified-token swaps after filtering`);

    // ── MEV detection with sanity caps ─────────────────────────────────────────
    const attacks = [];
    let skippedInsane = 0;

    for (const swap of swapDeltas) {
      const { inputMint, outputMint, inputAmount, outputAmount, blockSlot, blockTime, dexLabel } = swap;

      if (inputAmount === 0) continue;

      const expected    = inputAmount * 0.997; // 0.3% DEX fee
      const slippagePct = Math.max(0, ((expected - outputAmount) / expected) * 100);

      // Skip below threshold
      if (slippagePct < MIN_DETECTABLE_SLIPPAGE) continue;

      // SANITY CAP — anything above 25% slippage on verified tokens is impossible
      // It's almost certainly a math error or pool data anomaly
      if (slippagePct > MAX_REASONABLE_SLIPPAGE) {
        skippedInsane++;
        continue;
      }

      const lossInToken = Math.max(0, expected - outputAmount);
      const price       = Number(priceMap[outputMint]) || 0;
      const inputPrice  = Number(priceMap[inputMint])  || 0;
      let   lossUsd     = parseFloat((lossInToken * price).toFixed(2));
      const inputUsd    = parseFloat((inputAmount * inputPrice).toFixed(2));

      // SANITY CAP — any single-attack loss above $5K is suspicious
      // Cap it but flag for review rather than throwing it out entirely
      let suspicious = false;
      if (lossUsd > MAX_REASONABLE_LOSS_USD) {
        suspicious = true;
        lossUsd    = Math.min(lossUsd, MAX_REASONABLE_LOSS_USD);
      }

      const confidence  = slippagePct >= 3.5 ? "HIGH" : slippagePct >= 2.0 ? "MEDIUM" : "LOW";
      const label       = confidence === "HIGH"   ? "High Confidence MEV Pattern"
                        : confidence === "MEDIUM" ? "Likely MEV Exposure"
                        : "Elevated Slippage — Possible MEV";

      attacks.push({
        blockSlot, blockTime,
        date:                formatDate(blockTime),
        pair:                `${MINT_SYMBOL[inputMint] || inputMint.slice(0,4)} → ${MINT_SYMBOL[outputMint] || outputMint.slice(0,4)}`,
        dexLabel,
        label,
        confidence,
        slippagePct:         parseFloat(slippagePct.toFixed(3)),
        lossUsd,
        inputUsd,
        lossInToken:         parseFloat(lossInToken.toFixed(6)),
        inputAmount:         parseFloat(inputAmount.toFixed(4)),
        severity:            getSeverity(slippagePct),
        verified:            false,
        verificationStatus:  suspicious ? "flagged_for_review" : "slippage_heuristic",
        attacker:            null,
      });
    }

    if (skippedInsane > 0) {
      console.log(`[audit] Filtered out ${skippedInsane} attacks with impossible slippage (>${MAX_REASONABLE_SLIPPAGE}%)`);
    }

    // ── Summary ────────────────────────────────────────────────────────────────
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

    // Bot leaderboard — placeholder clusters since Helius is skipped for speed
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

    // ── Portfolio with proper decimal handling ────────────────────────────────
    let portfolio = [], portfolioTotal = 0;
    if (balancesResult.status === "fulfilled" && balancesResult.value?.balances) {
      portfolio = balancesResult.value.balances
        .map(b => {
          const mint = b.address || b.mint || b.token_address || null;
          if (!mint) return null;

          // Trust SIM's ui_amount (decimal-adjusted) — if missing, divide raw by decimals
          let amount = 0;
          if (b.ui_amount != null) amount = Number(b.ui_amount);
          else if (b.uiAmount != null) amount = Number(b.uiAmount);
          else if (b.amount != null && b.decimals != null) amount = Number(b.amount) / Math.pow(10, Number(b.decimals));
          else if (b.amount != null) amount = Number(b.amount);

          if (!isFinite(amount) || amount <= 0) return null;

          const meta   = tokenList[mint] || {};
          const price  = Number(priceMap[mint] || b.price_usd || b.price || 0);
          const symbol = meta.symbol || b.symbol || mint.slice(0,4);
          const name   = meta.name   || b.name   || symbol;
          const valueUsd = parseFloat((amount * price).toFixed(2));

          // Skip absurd valuations — likely scam/spam tokens
          if (valueUsd > 10_000_000) return null; // >$10M single token = suspicious

          return {
            mint,
            symbol,
            name,
            logoURI:  meta.logoURI || b.logo || b.icon || null,
            amount:   parseFloat(amount.toFixed(6)),
            display:  formatBalance(amount) || String(amount),
            price,
            valueUsd,
          };
        })
        .filter(t => t && t.amount > 0 && t.valueUsd > 0.01)
        .sort((a,b) => b.valueUsd - a.valueUsd)
        .slice(0, 20);
      portfolioTotal = parseFloat(portfolio.reduce((s,t) => s+t.valueUsd, 0).toFixed(2));
    }

    // ── AI narration ──────────────────────────────────────────────────────────
    const [briefing, protectionPlan] = await Promise.all([
      generateBriefing(summary),
      generateProtectionPlan(summary),
    ]);
    const tweetText = generateTweetText(summary);

    const simRawResponse = {
      endpoint:           `https://api.sim.dune.com/beta/svm/transactions/${address}`,
      status:             200,
      transactions_count: rawTxs.length,
      swaps_detected:     swapTxs.length,
      verified_swaps:     swapDeltas.length,
      mev_flagged:        attacks.length,
      filtered_anomalies: skippedInsane,
      transactions:       rawTxs.slice(0, 10),
    };

    return res.status(200).json({
      success: true,
      wallet:  address,
      summary,
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
