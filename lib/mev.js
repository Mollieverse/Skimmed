// lib/mev.js — Sandwich detection with Jupiter Quote verification + batch Helius

import { toUsd, MINT_SYMBOL } from "./prices.js";
import { batchVerifySandwiches } from "./helius.js";

const JUPITER_QUOTE = "https://quote-api.jup.ag/v6/quote";
const JUPITER  = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM  = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const ORCA     = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const DEX_SET  = new Set([JUPITER, RAYDIUM, ORCA]);

// Fallback slippage threshold if Jupiter quote unavailable
const SLIPPAGE_THRESHOLD = 1.2; // %

// Token decimals for converting raw amounts
const DECIMALS = {
  So11111111111111111111111111111111111111112:  9,  // SOL
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 6, // USDC
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:  6, // USDT
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 5, // BONK
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN:  6, // JUP
};

// ── Filter DEX swaps ──────────────────────────────────────────────────────────
export function filterSwapTransactions(txs) {
  return txs.filter(tx => {
    const meta = tx.raw_transaction?.meta;
    const msg  = tx.raw_transaction?.transaction?.message;
    if (!meta || !msg) return false;
    const accounts = msg.accountKeys || [];
    return accounts.some(k => DEX_SET.has(k)) &&
           meta.preTokenBalances?.length > 0 &&
           meta.postTokenBalances?.length > 0;
  });
}

// ── Parse swap delta from SIM transaction ────────────────────────────────────
export function parseSwapDelta(tx) {
  const pre  = tx.raw_transaction?.meta?.preTokenBalances  || [];
  const post = tx.raw_transaction?.meta?.postTokenBalances || [];
  const allMints = [...new Set([...pre.map(b => b.mint), ...post.map(b => b.mint)])];

  const deltas = allMints.map(mint => {
    const preAmt  = pre.find(b  => b.mint === mint)?.uiTokenAmount?.uiAmount  || 0;
    const postAmt = post.find(b => b.mint === mint)?.uiTokenAmount?.uiAmount || 0;
    return { mint, preAmt, postAmt, delta: postAmt - preAmt };
  }).filter(d => Math.abs(d.delta) > 0.000001);

  const sold   = deltas.find(d => d.delta < 0);
  const bought = deltas.find(d => d.delta > 0);
  if (!sold || !bought) return null;

  return {
    inputMint:    sold.mint,
    outputMint:   bought.mint,
    inputAmount:  Math.abs(sold.delta),
    outputAmount: bought.delta,
    blockSlot:    tx.block_slot,
    blockTime:    tx.block_time,
  };
}

// ── Jupiter Quote API — get expected output at time of swap ──────────────────
async function getExpectedOutput(inputMint, outputMint, inputAmount) {
  try {
    const decimals  = DECIMALS[inputMint] || 6;
    const rawAmount = Math.round(inputAmount * Math.pow(10, decimals));
    if (rawAmount <= 0) return null;

    const url = `${JUPITER_QUOTE}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rawAmount}&slippageBps=50`;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);

    const res  = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();

    const outDecimals    = DECIMALS[outputMint] || 6;
    const expectedOutput = parseInt(data.outAmount) / Math.pow(10, outDecimals);
    const priceImpactPct = parseFloat(data.priceImpactPct || 0);

    return { expectedOutput, priceImpactPct };
  } catch {
    return null;
  }
}

// ── Main detection — async, uses Jupiter quotes + batch Helius verify ─────────
export async function detectMEVAttacks(swapDeltas, rawTxs, priceMap, walletAddress) {
  const flagged = [];
  const clean   = [];

  // Step 1 — flag swaps with high slippage using Jupiter Quote for precision
  for (const swap of swapDeltas) {
    if (!swap) continue;

    const { inputMint, outputMint, inputAmount, outputAmount, blockSlot, blockTime } = swap;

    // Get precise expected output from Jupiter Quote API
    const quote = await getExpectedOutput(inputMint, outputMint, inputAmount);

    let slippagePct;
    let expectedOutput;

    if (quote) {
      // Use Jupiter's actual expected output — most accurate
      expectedOutput = quote.expectedOutput;
      const rawSlippage = ((expectedOutput - outputAmount) / expectedOutput) * 100;
      // Subtract price impact — that's legitimate, not MEV
      slippagePct = Math.max(0, rawSlippage - quote.priceImpactPct);
    } else {
      // Fallback: use 0.3% DEX fee heuristic
      expectedOutput = inputAmount * 0.997;
      slippagePct    = Math.max(0, ((expectedOutput - outputAmount) / expectedOutput) * 100);
    }

    slippagePct = parseFloat(slippagePct.toFixed(4));

    if (slippagePct >= SLIPPAGE_THRESHOLD) {
      flagged.push({ swap, slippagePct, expectedOutput, quote });
    } else {
      clean.push(swap);
    }
  }

  // Step 2 — batch verify all flagged swaps against block data via Helius
  const verificationCandidates = flagged.map(f => ({
    blockSlot:  f.swap.blockSlot,
    victimPair: { inputMint: f.swap.inputMint, outputMint: f.swap.outputMint },
  }));

  const verifications = walletAddress
    ? await batchVerifySandwiches(verificationCandidates, walletAddress)
    : [];

  const verifyMap = {};
  for (const v of verifications) verifyMap[v.blockSlot] = v;

  // Step 3 — build attack objects
  const attacks = flagged.map(({ swap, slippagePct, expectedOutput }) => {
    const { inputMint, outputMint, inputAmount, outputAmount, blockSlot, blockTime } = swap;

    const lossInToken = Math.max(0, expectedOutput - outputAmount);
    const lossUsd     = Math.abs(toUsd(lossInToken, outputMint, priceMap));
    const inputUsd    = toUsd(inputAmount, inputMint, priceMap);

    const v          = verifyMap[blockSlot] || {};
    const confirmed  = v.confirmed === true;

    // Only show real bot wallet when on-chain confirmed — never fake
    const attacker   = confirmed && v.botWallet ? v.botWallet : null;

    return {
      type:       "sandwich_victim",
      confirmed,
      verificationStatus: confirmed
        ? "confirmed"
        : v.error
          ? "unverified"
          : "suspected",
      verificationNote: confirmed
        ? `Front-run at tx #${v.frontRunIndex}, back-run at tx #${v.backRunIndex} in block ${blockSlot}`
        : v.reason || "Block pattern inconclusive",
      slippagePct,
      lossInToken:  parseFloat(lossInToken.toFixed(6)),
      lossUsd:      parseFloat(lossUsd.toFixed(2)),
      inputUsd:     parseFloat(inputUsd.toFixed(2)),
      inputMint,
      outputMint,
      inputAmount:  parseFloat(inputAmount.toFixed(4)),
      blockSlot,
      blockTime,
      date:         formatDate(blockTime),
      pair:         `${MINT_SYMBOL[inputMint] || inputMint.slice(0,4)} → ${MINT_SYMBOL[outputMint] || outputMint.slice(0,4)}`,
      // attacker is null unless confirmed — shown as "Unknown" in UI
      attacker,
      frontRunIndex: v.frontRunIndex || null,
      backRunIndex:  v.backRunIndex  || null,
      severity:      getSeverity(slippagePct),
    };
  });

  return {
    attacks,
    cleanSwaps: clean.length,
    totalSwaps: swapDeltas.filter(Boolean).length,
  };
}

// ── Summary builder ───────────────────────────────────────────────────────────
export function buildAuditSummary(attacks, walletAddress) {
  if (!attacks.length) {
    return { walletAddress, totalLossUsd:0, attackCount:0, exposureScore:0, topAttacker:null, worstHit:null, attacksByBot:[], timeline:[] };
  }

  const totalLossUsd = parseFloat(attacks.reduce((s,a) => s + a.lossUsd, 0).toFixed(2));

  // Only build bot leaderboard from confirmed attacks with real wallets
  const botMap = {};
  for (const a of attacks) {
    if (!a.attacker) continue; // skip unconfirmed — no real wallet known
    if (!botMap[a.attacker]) botMap[a.attacker] = { address:a.attacker, count:0, totalLoss:0 };
    botMap[a.attacker].count++;
    botMap[a.attacker].totalLoss = parseFloat((botMap[a.attacker].totalLoss + a.lossUsd).toFixed(2));
  }
  const attacksByBot = Object.values(botMap).sort((a,b) => b.totalLoss - a.totalLoss);
  const topAttacker  = attacksByBot[0] || null;
  const worstHit     = attacks.reduce((m,a) => (!m || a.lossUsd > m.lossUsd ? a : m), null);
  const confirmedCount = attacks.filter(a => a.confirmed).length;

  const exposureScore = Math.min(100, Math.round(
    (attacks.length / Math.max(attacks.length+1,1))*40 +
    Math.min(totalLossUsd/2,40) +
    (confirmedCount / Math.max(attacks.length,1))*20
  ));

  return {
    walletAddress, totalLossUsd, attackCount:attacks.length,
    confirmedCount, suspectedCount: attacks.length - confirmedCount,
    exposureScore, topAttacker, worstHit, attacksByBot,
    timeline: buildTimeline(attacks), attacks,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSeverity(pct) {
  if (pct >= 5)   return "critical";
  if (pct >= 2.5) return "high";
  if (pct >= 1.2) return "medium";
  return "low";
}

function formatDate(blockTime) {
  if (!blockTime) return "Unknown";
  const ms = blockTime > 1e15 ? blockTime/1000 : blockTime*1000;
  return new Date(ms).toLocaleDateString("en-US", { month:"short", day:"numeric" });
}

function buildTimeline(attacks) {
  const months = {};
  for (const a of attacks) {
    const ms  = a.blockTime > 1e15 ? a.blockTime/1000 : a.blockTime*1000;
    const d   = new Date(ms);
    // Key by year-month so ordering is correct across year boundaries
    const sortKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label   = d.toLocaleDateString("en-US", { month:"long", year:"numeric" });
    if (!months[sortKey]) months[sortKey] = { sortKey, label, count:0, loss:0 };
    months[sortKey].count++;
    months[sortKey].loss = parseFloat((months[sortKey].loss + a.lossUsd).toFixed(2));
  }
  // Sort chronologically
  return Object.values(months).sort((a,b) => a.sortKey.localeCompare(b.sortKey));
}
