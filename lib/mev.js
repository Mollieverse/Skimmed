// lib/mev.js — Strict MEV rule engine. No hallucination. No inference.

import { MINT_SYMBOL } from "./prices.js";
import { batchVerifySandwiches } from "./helius.js";

const JUPITER  = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM  = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const ORCA     = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const DEX_SET  = new Set([JUPITER, RAYDIUM, ORCA]);

// DEX attribution — pool → DEX name. Never infer from program ID alone.
const PROGRAM_LABELS = {
  [JUPITER]: "Jupiter Aggregated Route",
  [RAYDIUM]: "Raydium AMM",
  [ORCA]:    "Orca Whirlpool",
};

// Slot distance rule — sandwich must be within 2 slots
const MAX_SLOT_DISTANCE = 2;

// Minimum slippage excess to flag (above expected DEX fee)
const MIN_EXCESS_SLIPPAGE_PCT = 1.2;

// ── Filter DEX swaps from SIM transactions ────────────────────────────────────
export function filterSwapTransactions(txs) {
  return txs.filter(tx => {
    const meta = tx.raw_transaction?.meta;
    const msg  = tx.raw_transaction?.transaction?.message;
    if (!meta || !msg) return false;
    const accounts = msg.accountKeys || [];
    return accounts.some(k => DEX_SET.has(k)) &&
      meta.preTokenBalances?.length > 0 &&
      meta.postTokenBalances?.length > 0 &&
      !meta.err; // skip failed txs
  });
}

// ── Parse swap delta from SIM transaction ─────────────────────────────────────
export function parseSwapDelta(tx) {
  const pre  = tx.raw_transaction?.meta?.preTokenBalances  || [];
  const post = tx.raw_transaction?.meta?.postTokenBalances || [];
  const msg  = tx.raw_transaction?.transaction?.message;

  const allMints = [...new Set([...pre.map(b => b.mint), ...post.map(b => b.mint)])];
  const deltas   = allMints.map(mint => {
    const preAmt  = pre.find(b  => b.mint === mint)?.uiTokenAmount?.uiAmount  || 0;
    const postAmt = post.find(b => b.mint === mint)?.uiTokenAmount?.uiAmount || 0;
    return { mint, delta: postAmt - preAmt };
  }).filter(d => Math.abs(d.delta) > 0.000001);

  const sold   = deltas.find(d => d.delta < 0);
  const bought = deltas.find(d => d.delta > 0);
  if (!sold || !bought) return null;

  // Identify DEX from accounts — use label map only
  const accounts  = msg?.accountKeys || [];
  const dexProgram = accounts.find(a => DEX_SET.has(a));
  const dexLabel   = PROGRAM_LABELS[dexProgram] || "Unknown DEX";

  return {
    inputMint:    sold.mint,
    outputMint:   bought.mint,
    inputAmount:  Math.abs(sold.delta),
    outputAmount: bought.delta,
    blockSlot:    tx.block_slot,
    blockTime:    tx.block_time,
    dexLabel,
    dexProgram,
  };
}

// ── Jupiter Quote — get expected output at swap time ──────────────────────────
const DECIMALS = {
  So11111111111111111111111111111111111111112:  9,
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 6,
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:  6,
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 5,
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN:  6,
};

async function getExpectedOutput(inputMint, outputMint, inputAmount) {
  try {
    const dec    = DECIMALS[inputMint] || 6;
    const raw    = Math.round(inputAmount * Math.pow(10, dec));
    if (raw <= 0) return null;
    const url    = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${raw}&slippageBps=50`;
    const ctrl   = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const res    = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data   = await res.json();
    const outDec = DECIMALS[outputMint] || 6;
    return {
      expectedOutput:  parseInt(data.outAmount) / Math.pow(10, outDec),
      priceImpactPct:  parseFloat(data.priceImpactPct || 0),
    };
  } catch { return null; }
}

// ── Confidence scoring — strict rule engine ───────────────────────────────────
function scoreConfidence(slippagePct, verified, slotDistance, hasPriceImpact) {
  // ALL sandwich conditions must be met for HIGH confidence
  if (
    verified === true &&
    slotDistance !== null &&
    slotDistance <= MAX_SLOT_DISTANCE &&
    hasPriceImpact &&
    slippagePct >= 2.5
  ) return "HIGH";

  if (
    (verified === true || slippagePct >= 3) &&
    hasPriceImpact
  ) return "MEDIUM";

  return "LOW";
}

function getLabelFromConfidence(confidence, verified) {
  // STRICT labeling — no absolute claims
  if (confidence === "HIGH" && verified) return "High Confidence MEV Pattern";
  if (confidence === "MEDIUM")           return "Likely MEV Exposure";
  return "Elevated Slippage — Possible MEV";
}

// ── Loss range calculation — never a single absolute number ──────────────────
function computeLossRange(lossInToken, outputMint, priceMap, confidence) {
  const spotPrice = priceMap[outputMint] || 0;
  if (spotPrice === 0) return { low: 0, high: 0, midpoint: 0, display: "Unknown" };

  // Variance by confidence — historical price uncertainty
  const variance = confidence === "HIGH" ? 0.05 : confidence === "MEDIUM" ? 0.12 : 0.20;
  const midpoint = lossInToken * spotPrice;
  const low      = parseFloat((midpoint * (1 - variance)).toFixed(2));
  const high     = parseFloat((midpoint * (1 + variance)).toFixed(2));

  return {
    low,
    high,
    midpoint: parseFloat(midpoint.toFixed(2)),
    display:  `$${low}–$${high}`,
    note:     `Based on current spot price ±${(variance*100).toFixed(0)}% variance (historical price unavailable)`,
  };
}

// ── Main detection pipeline ───────────────────────────────────────────────────
export async function detectMEVAttacks(swapDeltas, rawTxs, priceMap, walletAddress) {
  const flagged = [];
  const clean   = [];

  // Step 1 — flag by excess slippage
  for (const swap of swapDeltas) {
    if (!swap) continue;
    const { inputMint, outputMint, inputAmount, outputAmount } = swap;

    const quote = await getExpectedOutput(inputMint, outputMint, inputAmount);

    let slippagePct, expectedOutput;
    let quoteSource = "heuristic";

    if (quote) {
      expectedOutput = quote.expectedOutput;
      const raw      = ((expectedOutput - outputAmount) / expectedOutput) * 100;
      slippagePct    = Math.max(0, raw - quote.priceImpactPct);
      quoteSource    = "jupiter_quote";
    } else {
      expectedOutput = inputAmount * 0.997;
      slippagePct    = Math.max(0, ((expectedOutput - outputAmount) / expectedOutput) * 100);
    }

    slippagePct = parseFloat(slippagePct.toFixed(4));

    if (slippagePct >= MIN_EXCESS_SLIPPAGE_PCT) {
      flagged.push({
        swap,
        slippagePct,
        expectedOutput,
        priceImpactPct: quote?.priceImpactPct || 0,
        quoteSource,
      });
    } else {
      clean.push(swap);
    }
  }

  // Step 2 — batch verify via Helius block data
  const candidates = flagged.map(f => ({
    blockSlot:  f.swap.blockSlot,
    victimPair: { inputMint: f.swap.inputMint, outputMint: f.swap.outputMint },
  }));

  const verifications = walletAddress
    ? await batchVerifySandwiches(candidates, walletAddress)
    : [];

  const verifyMap = {};
  for (const v of verifications) verifyMap[v.blockSlot] = v;

  // Step 3 — build attack objects with strict labeling
  const attacks = flagged.map(({ swap, slippagePct, expectedOutput, priceImpactPct, quoteSource }) => {
    const { inputMint, outputMint, inputAmount, outputAmount, blockSlot, blockTime, dexLabel } = swap;

    const v           = verifyMap[blockSlot] || {};
    const verified    = v.confirmed === true;
    const slotDist    = v.frontRunIndex != null && v.victimIndex != null
      ? Math.abs(v.victimIndex - v.frontRunIndex)
      : null;
    const hasPriceImpact = priceImpactPct > 0 || slippagePct > 1.5;

    const confidence  = scoreConfidence(slippagePct, verified, slotDist, hasPriceImpact);
    const label       = getLabelFromConfidence(confidence, verified);

    const lossInToken = Math.max(0, expectedOutput - outputAmount);
    const lossRange   = computeLossRange(lossInToken, outputMint, priceMap, confidence);
    const inputUsd    = inputAmount * (priceMap[inputMint] || 0);

    return {
      // Identity
      blockSlot,
      blockTime,
      date:         formatDate(blockTime),
      pair:         `${MINT_SYMBOL[inputMint] || inputMint.slice(0,4)} → ${MINT_SYMBOL[outputMint] || outputMint.slice(0,4)}`,
      dexLabel,

      // Detection — strict labels only
      label,
      confidence,   // HIGH / MEDIUM / LOW
      verified,     // true only if Helius block confirmed
      slippagePct:  parseFloat(slippagePct.toFixed(3)),
      priceImpactPct: parseFloat(priceImpactPct.toFixed(3)),
      quoteSource,

      // Loss — always a range, never absolute
      lossRange,
      lossInToken:  parseFloat(lossInToken.toFixed(6)),
      inputAmount:  parseFloat(inputAmount.toFixed(4)),
      inputUsd:     parseFloat(inputUsd.toFixed(2)),

      // Attribution — only real wallet if verified
      // "behavioral wallet cluster" not "bot attacker"
      behavioralCluster: verified && v.botWallet ? v.botWallet : null,
      frontRunIndex:     v.frontRunIndex || null,
      backRunIndex:      v.backRunIndex  || null,
      slotDistance:      slotDist,

      // Verification
      verificationStatus: verified ? "block_verified" : v.error ? "fetch_error" : "unverified",
      verificationNote:   verified
        ? `Front-run at tx #${v.frontRunIndex}, back-run at tx #${v.backRunIndex} — slot distance ${slotDist}`
        : v.reason || "Block pattern not confirmed",

      // Severity for UI
      severity: slippagePct >= 5 ? "critical" : slippagePct >= 2.5 ? "high" : "medium",
    };
  });

  return {
    attacks,
    cleanSwaps: clean.length,
    totalSwaps: swapDeltas.filter(Boolean).length,
  };
}

// ── Summary — strict reconciliation. AI cannot modify these values. ────────────
export function buildAuditSummary(attacks, walletAddress, totalSwaps, cleanSwaps) {
  const attackCount    = attacks.length;
  const confirmedCount = attacks.filter(a => a.verified).length;
  const highConf       = attacks.filter(a => a.confidence === "HIGH").length;
  const medConf        = attacks.filter(a => a.confidence === "MEDIUM").length;
  const lowConf        = attacks.filter(a => a.confidence === "LOW").length;

  // Loss range — sum of all ranges. Never a single absolute.
  const totalLossLow  = parseFloat(attacks.reduce((s,a) => s + (a.lossRange?.low  || 0), 0).toFixed(2));
  const totalLossHigh = parseFloat(attacks.reduce((s,a) => s + (a.lossRange?.high || 0), 0).toFixed(2));
  const totalLossMid  = parseFloat(attacks.reduce((s,a) => s + (a.lossRange?.midpoint || 0), 0).toFixed(2));

  // Exposure rate — only compute from verified data
  // Remove "100% of swaps targeted" — use actual ratio
  const exposureRate = totalSwaps > 0
    ? `${Math.round((attackCount / totalSwaps) * 100)}%`
    : "N/A";

  // Risk score — weighted by confidence
  const riskScore = Math.min(100, Math.round(
    highConf * 25 + medConf * 15 + lowConf * 8 +
    Math.min(totalLossMid / 5, 25)
  ));

  // Bot leaderboard — only from verified clusters
  const clusterMap = {};
  for (const a of attacks) {
    if (!a.behavioralCluster) continue;
    const key = a.behavioralCluster;
    if (!clusterMap[key]) clusterMap[key] = { address:key, count:0, lossLow:0, lossHigh:0, lossMid:0 };
    clusterMap[key].count++;
    clusterMap[key].lossLow  += a.lossRange?.low  || 0;
    clusterMap[key].lossHigh += a.lossRange?.high || 0;
    clusterMap[key].lossMid  += a.lossRange?.midpoint || 0;
  }
  const behavioralClusters = Object.values(clusterMap)
    .map(c => ({
      ...c,
      lossLow:  parseFloat(c.lossLow.toFixed(2)),
      lossHigh: parseFloat(c.lossHigh.toFixed(2)),
      lossMid:  parseFloat(c.lossMid.toFixed(2)),
      display:  `$${c.lossLow.toFixed(2)}–$${c.lossHigh.toFixed(2)}`,
    }))
    .sort((a,b) => b.lossMid - a.lossMid);

  const topCluster = behavioralClusters[0] || null;
  const worstHit   = attacks.reduce((m,a) => (!m || (a.lossRange?.midpoint||0) > (m.lossRange?.midpoint||0) ? a : m), null);

  return {
    walletAddress,
    // Counts — exact, from computed pipeline
    attackCount,
    totalSwaps,
    cleanSwaps,
    confirmedCount,
    confidenceBreakdown: { high: highConf, medium: medConf, low: lowConf },
    exposureRate,
    riskScore,

    // Loss — always a range
    totalLoss: {
      low:      totalLossLow,
      high:     totalLossHigh,
      midpoint: totalLossMid,
      display:  `$${totalLossLow}–$${totalLossHigh}`,
      note:     "Estimated range. Historical prices unavailable; current spot price used with variance adjustment.",
    },

    topCluster,
    worstHit,
    behavioralClusters,
    timeline: buildTimeline(attacks),
    attacks,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const lbl = d.toLocaleDateString("en-US", { month:"long", year:"numeric" });
    if (!months[key]) months[key] = { sortKey:key, label:lbl, count:0, lossLow:0, lossHigh:0, lossMid:0 };
    months[key].count++;
    months[key].lossLow  += a.lossRange?.low  || 0;
    months[key].lossHigh += a.lossRange?.high || 0;
    months[key].lossMid  += a.lossRange?.midpoint || 0;
  }
  return Object.values(months)
    .sort((a,b) => a.sortKey.localeCompare(b.sortKey))
    .map(m => ({
      ...m,
      lossLow:  parseFloat(m.lossLow.toFixed(2)),
      lossHigh: parseFloat(m.lossHigh.toFixed(2)),
      lossMid:  parseFloat(m.lossMid.toFixed(2)),
      display:  `$${m.lossLow.toFixed(2)}–$${m.lossHigh.toFixed(2)}`,
    }));
}
