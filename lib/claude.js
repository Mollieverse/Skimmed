// lib/claude.js — AI narration ONLY. No detection. No computation.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

/**
 * Generate forensic briefing from structured audit results.
 */
export async function generateBriefing(summary, tradingStats, badHabits) {
  const {
    walletAddress, attackCount, totalSwaps, exposureRate,
    riskScore, totalLossUsd,
  } = summary;

  // If nothing to report at all, give a neutral briefing
  if (attackCount === 0 && (!tradingStats || tradingStats.totalTrades === 0) && (!badHabits || badHabits.length === 0)) {
    return "No MEV patterns or behavioral red flags detected in the analyzed swap history. Transactions executed within expected slippage bounds and trading patterns appear disciplined. Continue routing through protected channels and monitoring regularly.";
  }

  const mevLossDisplay = `$${(totalLossUsd || 0).toFixed(2)}`;
  const tradingPnl = tradingStats?.totalPnl ?? 0;
  const tradingPnlDisplay = tradingPnl >= 0 ? `+$${tradingPnl.toFixed(2)}` : `-$${Math.abs(tradingPnl).toFixed(2)}`;
  const habitsList = (badHabits || []).map(h => `- ${h.title}: ${h.detail}`).join("\n");

  const prompt = `You are a forensic analyst writing a Solana wallet trading autopsy report.
A separate detection pipeline produced the structured data below.
Your job: summarize what the wallet's trading behavior reveals — both MEV exposure and behavioral patterns.
Do NOT invent numbers. Do NOT add certainty beyond what the data shows. Be honest, direct, almost therapy-like.

COMPUTED DATA (do not modify):
Wallet: ${walletAddress}
Total swaps analyzed: ${totalSwaps}
MEV pattern events: ${attackCount} (${exposureRate} of swaps), estimated extraction ${mevLossDisplay}
Risk score: ${riskScore}/100

Trading PNL stats:
- Closed trades: ${tradingStats?.totalTrades || 0}
- Win rate: ${tradingStats?.winRate || 0}%
- Realized PNL: ${tradingPnlDisplay}
- Best trade: ${tradingStats?.bestTrade ? `+$${tradingStats.bestTrade.pnl.toFixed(2)} (+${tradingStats.bestTrade.pnlPct.toFixed(0)}%)` : "N/A"}
- Worst trade: ${tradingStats?.worstTrade ? `$${tradingStats.worstTrade.pnl.toFixed(2)} (${tradingStats.worstTrade.pnlPct.toFixed(0)}%)` : "N/A"}

Bad habits detected:
${habitsList || "(none flagged)"}

Write a 3-4 sentence forensic narrative. Open with the headline finding (whichever is more dramatic — MEV losses OR a behavioral pattern). Connect MEV exposure to behavioral patterns where relevant. End with one specific corrective action tailored to the data. Use language like "pattern consistent with", "data shows", "you have a tendency toward". NEVER use "stole", "100%", or absolute claims. No markdown. Prose only.`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 280,
        messages: [{ role:"user", content:prompt }],
      }),
    });

    if (!res.ok) {
      console.error("[claude] briefing fetch error:", res.status);
      return `Forensic analysis detected ${attackCount} MEV pattern${attackCount !== 1 ? "s" : ""} across ${totalSwaps} swaps with an estimated ${lossDisplay} in execution slippage. Risk score: ${riskScore}/100. Route future swaps through Jupiter Ultra with Jito bundle protection to reduce exposure.`;
    }

    const data = await res.json();
    return data.content?.[0]?.text || "Unable to generate briefing.";
  } catch (err) {
    console.error("[claude] briefing error:", err.message);
    return `Forensic analysis detected ${attackCount} MEV pattern${attackCount !== 1 ? "s" : ""} across ${totalSwaps} swaps with an estimated ${lossDisplay} in execution slippage. Route future swaps through Jupiter Ultra with Jito bundle protection.`;
  }
}

/**
 * Generate protection recommendations.
 */
export async function generateProtectionPlan(summary) {
  const { attacks, topAttacker, riskScore } = summary;
  if (!attacks?.length) {
    return [
      "Continue routing swaps through Jupiter Ultra with Jito bundle protection.",
      "Keep slippage tolerance below 0.5% for stablecoins and 1% for volatile tokens.",
      "Re-audit regularly at skimmed.vercel.app.",
    ];
  }

  const recs = [];
  recs.push("Route all swaps through Jupiter Ultra with Jito bundle protection — this prevents front-running by submitting transactions as atomic bundles.");

  const hasHighSlippage = attacks.some(a => (a.slippagePct || 0) > 3);
  if (hasHighSlippage) recs.push("Reduce your slippage tolerance — high static slippage settings are the primary surface MEV strategies exploit. Cap at 0.5% for stables, 1% for volatile assets.");

  if (topAttacker?.count > 1) {
    recs.push(`A behavioral wallet cluster (${topAttacker.address}) appears in ${topAttacker.count} detected events. Breaking trade patterns — varying size and timing — reduces targeting probability.`);
  }

  recs.push("For trades over $500, use Helius Shield or a private RPC endpoint to prevent transaction visibility in the public mempool before execution.");

  if ((riskScore || 0) > 70) {
    recs.push("Your risk score is elevated. Avoid trading during peak congestion windows — MEV activity increases significantly during high-volume periods.");
  }

  return recs;
}

/**
 * Generate tweet text — adaptive based on what was found
 */
export function generateTweetText(summary, tradingStats, badHabits) {
  const lines = ["I just got the SKIMMED autopsy on my Solana wallet 🩸"];

  if (tradingStats?.totalTrades > 0) {
    const pnl = tradingStats.totalPnl;
    const sign = pnl >= 0 ? "+" : "−";
    lines.push(`Realized PNL: ${sign}$${Math.abs(pnl).toFixed(2)} across ${tradingStats.totalTrades} trades (${tradingStats.winRate}% win rate)`);
  }

  if (badHabits?.length > 0) {
    lines.push(`${badHabits.length} bad habit${badHabits.length !== 1 ? "s" : ""} flagged 🚩`);
  }

  if (summary?.attackCount > 0) {
    lines.push(`${summary.attackCount} MEV event${summary.attackCount !== 1 ? "s" : ""} · $${(summary.totalLossUsd || 0).toFixed(2)} extracted 🥪`);
  }

  // If nothing found, fallback
  if (lines.length === 1) {
    lines.push("Wallet ran clean. No MEV. No bad habits. No surprises.");
  }

  lines.push("");
  lines.push("Check yours: https://skimmed.vercel.app");

  let tweet = lines.join("\n");
  if (tweet.length > 280) {
    // shorter fallback
    const pnlPart = tradingStats?.totalPnl != null
      ? `${tradingStats.totalPnl >= 0 ? "+" : "−"}$${Math.abs(tradingStats.totalPnl).toFixed(2)} PNL`
      : "";
    const habitPart = badHabits?.length > 0 ? `${badHabits.length} bad habits 🚩` : "";
    const mevPart   = summary?.attackCount > 0 ? `${summary.attackCount} MEV 🥪` : "";
    const parts = [pnlPart, habitPart, mevPart].filter(Boolean).join(" · ");
    tweet = `SKIMMED autopsy on my Solana wallet 🩸\n${parts}\n\nCheck yours: https://skimmed.vercel.app`;
  }
  return tweet;
}
