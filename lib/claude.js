// lib/claude.js — AI narration ONLY. No detection. No computation.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

/**
 * Generate forensic briefing from structured audit results.
 */
export async function generateBriefing(summary) {
  const {
    walletAddress, attackCount, totalSwaps, exposureRate,
    riskScore, totalLossUsd, confidenceBreakdown, worstHit, topAttacker,
  } = summary;

  if (attackCount === 0) {
    return "No MEV patterns detected in the analyzed swap history. Transactions executed within expected slippage bounds. Continue routing through protected channels and monitoring regularly.";
  }

  const lossDisplay  = `$${(totalLossUsd || 0).toFixed(2)}`;
  const worstLoss    = worstHit ? `$${(worstHit.lossUsd || 0).toFixed(2)}` : "N/A";
  const topBotLoss   = topAttacker ? `$${(topAttacker.totalLoss || 0).toFixed(2)}` : "N/A";

  const prompt = `You are a forensic analyst summarizing a pre-computed Solana MEV audit report. 
You received structured data computed by a separate detection pipeline. 
Your ONLY job is to summarize these results clearly. 
Do NOT invent numbers. Do NOT add certainty beyond what the data shows. Do NOT claim anything was stolen.

COMPUTED AUDIT DATA (do not modify):
- Wallet: ${walletAddress}
- MEV pattern events detected: ${attackCount} out of ${totalSwaps} swaps (${exposureRate} exposure rate)
- Risk score: ${riskScore}/100
- Estimated loss: ${lossDisplay}
- Confidence breakdown: ${confidenceBreakdown?.high || 0} high, ${confidenceBreakdown?.medium || 0} medium, ${confidenceBreakdown?.low || 0} low confidence
- Worst event: ${worstHit ? `${worstHit.date} — ${worstHit.pair} — ${worstLoss} estimated — ${worstHit.confidence} confidence` : "N/A"}
- Top behavioral cluster: ${topAttacker ? `${topAttacker.address} — ${topAttacker.count} events — ${topBotLoss} estimated` : "None"}

Write a 3-sentence forensic summary. Use language like "patterns consistent with sandwich behavior", "estimated extraction", "behavioral cluster". Do NOT use "stole", "confirmed attack", "100%". End with one protective action. No markdown. Prose only.`;

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
 * Generate tweet text — strict template, no "stole", under 280 chars.
 */
export function generateTweetText(summary) {
  const attackCount = summary?.attackCount || 0;
  const lossUsd     = summary?.totalLossUsd || 0;
  const riskScore   = summary?.riskScore   || 0;
  const lossDisplay = `$${lossUsd.toFixed(2)}`;

  const tweet = `My Solana wallet shows ${attackCount} MEV sandwich pattern${attackCount !== 1 ? "s" : ""} 🥪\n~${lossDisplay} in MEV-related execution slippage 🔴\nRisk Score: ${riskScore}/100\n\nCheck yours: https://skimmed.vercel.app`;

  if (tweet.length > 280) {
    return `My Solana wallet shows ${attackCount} MEV pattern${attackCount !== 1 ? "s" : ""} 🥪\n~${lossDisplay} in execution slippage 🔴\n\nCheck yours: https://skimmed.vercel.app`;
  }
  return tweet;
}
