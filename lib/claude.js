// lib/claude.js — Claude AI briefing + protection plan

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export async function generateBriefing(summary) {
  const { walletAddress, totalLossUsd, attackCount, totalSwaps, topAttacker, worstHit, attacks } = summary;

  if (attackCount === 0) {
    return "No sandwich attacks detected in your recent swap history. Your trades executed close to quoted prices — either you've been routing through protected channels, or you've been fortunate. Keep using Jito-protected swaps and dynamic slippage to hold this record.";
  }

  const attackPct = totalSwaps > 0 ? Math.round((attackCount / totalSwaps) * 100) : 0;

  const prompt = `You are an elite on-chain forensic analyst writing a personal MEV damage report for a Solana wallet holder. Tone: sharp, direct, alarming — like a financial investigator delivering bad news.

Wallet: ${walletAddress}
Total extracted by bots: $${totalLossUsd}
Attacks detected: ${attackCount} of ${totalSwaps} swaps (${attackPct}% hit rate)
Worst hit: $${worstHit?.lossUsd} on ${worstHit?.date} (${worstHit?.pair})
Top attacker: ${topAttacker?.address} — ${topAttacker?.count} attacks, $${topAttacker?.totalLoss} extracted
Recent attacks: ${JSON.stringify(attacks.slice(0, 4))}

Write exactly 3 sentences. Be specific with numbers. Reference the worst attack and top bot address. End with one immediate action the user must take. No markdown. No bullet points. Prose only.`;

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
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || "Unable to generate briefing.";
}

export async function generateProtectionPlan(summary) {
  const { attacks, topAttacker, exposureScore } = summary;

  if (!attacks?.length) {
    return [
      "Continue routing swaps through Jupiter Ultra with Jito bundle protection.",
      "Keep slippage tolerance below 0.5% for stablecoins and 1% for volatile tokens.",
      "Re-audit your wallet monthly at skimmed.vercel.app.",
    ];
  }

  const recs = [];
  recs.push("Switch to Jupiter Ultra with Jito bundle protection — sandwich resistance is built in at no extra cost.");

  if (attacks.some(a => a.slippagePct > 3)) {
    recs.push("Your slippage tolerance is too high. Cap it at 0.5% for stables, 1% for volatile tokens — high static slippage is the primary attack surface bots exploit.");
  }

  if (topAttacker?.count > 1) {
    recs.push(`Bot ${topAttacker.address} has targeted your wallet ${topAttacker.count} times. Split large trades into smaller chunks across different time windows to break the targeting pattern.`);
  }

  recs.push("For any trade over $500, use Helius Shield or Triton private RPC — this prevents your transaction from being visible in the public mempool before execution.");

  if (exposureScore > 70) {
    recs.push("Your exposure score is critical. Avoid trading during high-congestion periods — US market open and major token launches see 3–5x normal MEV activity.");
  }

  return recs;
}

