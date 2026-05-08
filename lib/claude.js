// lib/claude.js — AI narration ONLY. No detection. No computation. No number invention.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

/**
 * Generate forensic briefing from structured audit results.
 * AI receives computed data and summarizes it — nothing more.
 */
export async function generateBriefing(summary) {
  const {
    walletAddress, attackCount, totalSwaps, exposureRate,
    riskScore, totalLoss, confidenceBreakdown, worstHit, topCluster,
  } = summary;

  if (attackCount === 0) {
    return "No MEV patterns detected in the analyzed swap history. Transactions executed within expected slippage bounds. Continue routing through protected channels and monitoring regularly.";
  }

  // Pass ONLY computed values — AI summarizes, does not compute
  const prompt = `You are a forensic analyst summarizing a pre-computed Solana MEV audit report. 
You received structured data computed by a separate detection pipeline. 
Your ONLY job is to summarize these results clearly. 
Do NOT invent numbers. Do NOT add certainty beyond what the data shows. Do NOT claim anything was stolen.

COMPUTED AUDIT DATA (do not modify):
- Wallet: ${walletAddress}
- MEV pattern events detected: ${attackCount} out of ${totalSwaps} swaps (${exposureRate} exposure rate)
- Risk score: ${riskScore}/100
- Estimated loss range: ${totalLoss.display} (${totalLoss.note})
- Confidence breakdown: ${confidenceBreakdown.high} high, ${confidenceBreakdown.medium} medium, ${confidenceBreakdown.low} low confidence
- Worst event: ${worstHit ? `${worstHit.date} — ${worstHit.pair} — ${worstHit.lossRange?.display} estimated — ${worstHit.confidence} confidence` : "N/A"}
- Top behavioral cluster: ${topCluster ? `${topCluster.address} — ${topCluster.count} events — ${topCluster.display} estimated` : "None verified"}

Write a 3-sentence forensic summary. Use language like "patterns consistent with sandwich behavior", "estimated extraction", "behavioral cluster". Do NOT use "stole", "confirmed attack", "100%". End with one protective action. No markdown. Prose only.`;

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

  if (!res.ok) throw new Error(`Claude API error: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || "Unable to generate briefing.";
}

/**
 * Generate protection recommendations from structured results.
 * AI explains — does not detect or compute.
 */
export async function generateProtectionPlan(summary) {
  const { attacks, topCluster, riskScore, exposureRate } = summary;
  if (!attacks?.length) {
    return [
      "Continue routing swaps through Jupiter Ultra with Jito bundle protection.",
      "Keep slippage tolerance below 0.5% for stablecoins and 1% for volatile tokens.",
      "Re-audit regularly at skimmed.vercel.app.",
    ];
  }

  const recs = [];
  recs.push("Route all swaps through Jupiter Ultra with Jito bundle protection — this prevents front-running by submitting transactions as atomic bundles.");

  const hasHighSlippage = attacks.some(a => a.slippagePct > 3);
  if (hasHighSlippage) recs.push("Reduce your slippage tolerance — high static slippage settings are the primary surface MEV strategies exploit. Cap at 0.5% for stables, 1% for volatile assets.");

  if (topCluster?.count > 1) recs.push(`A behavioral wallet cluster (${topCluster.address}) appears in ${topCluster.count} detected events. Breaking trade patterns — varying size and timing — reduces targeting probability.`);

  recs.push("For trades over $500, use Helius Shield or a private RPC endpoint to prevent transaction visibility in the public mempool before execution.");

  if (riskScore > 70) recs.push("Your risk score is elevated. Avoid trading during peak congestion windows — MEV activity increases significantly during high-volume periods.");

  return recs;
}

/**
 * Generate tweet text — strict template, no "stole", under 280 chars.
 */
export function generateTweetText(summary) {
  const { attackCount, totalLoss, riskScore } = summary;
  const loss = totalLoss?.display || "$0";

  const tweet = `My Solana wallet shows ${attackCount} MEV sandwich pattern${attackCount !== 1 ? "s" : ""} 🥪\n~${loss} in MEV-related execution slippage 🔴\nRisk Score: ${riskScore}/100\n\nCheck yours: https://skimmed.vercel.app`;

  // Ensure under 280 chars
  if (tweet.length > 280) {
    return `My Solana wallet shows ${attackCount} MEV pattern${attackCount !== 1 ? "s" : ""} 🥪\n~${loss} in execution slippage 🔴\n\nCheck yours: https://skimmed.vercel.app`;
  }
  return tweet;
}
