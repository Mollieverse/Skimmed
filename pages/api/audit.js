// pages/api/audit.js — Main audit pipeline. Strict data integrity.

import { fetchWalletTransactions, fetchWalletBalances, filterSwapTransactions, parseSwapDelta } from "../../lib/sim.js";
import { detectMEVAttacks, buildAuditSummary } from "../../lib/mev.js";
import { generateBriefing, generateProtectionPlan, generateTweetText } from "../../lib/claude.js";
import { fetchLivePrices, fetchTokenList, formatBalance } from "../../lib/prices.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

  const { address } = req.body;
  if (!address || address.length < 32 || address.length > 44) {
    return res.status(400).json({ error:"Invalid Solana wallet address" });
  }

  try {
    // ── 1. Live prices + token metadata ───────────────────────────────────────
    const [priceMap, tokenList] = await Promise.all([
      fetchLivePrices(),
      fetchTokenList(),
    ]);

    // ── 2. Dune SIM — validation + analytics source ───────────────────────────
    if (!process.env.DUNE_SIM_API_KEY) {
      return res.status(500).json({ error:"DUNE_SIM_API_KEY not configured" });
    }

    const [simData, balancesData] = await Promise.allSettled([
      fetchWalletTransactions(address, 150),
      fetchWalletBalances(address),
    ]);

    if (simData.status === "rejected") {
      console.error("[audit] Dune SIM error:", simData.reason);
      return res.status(502).json({ error:`Dune SIM: ${simData.reason?.message}` });
    }

    const rawTransactions = simData.value?.transactions || [];
    console.log(`[audit] SIM: ${rawTransactions.length} txs for ${address}`);

    // ── 3. Filter + parse swaps ───────────────────────────────────────────────
    const swapTxs    = filterSwapTransactions(rawTransactions);
    const swapDeltas = swapTxs.map(parseSwapDelta);

    // ── 4. MEV detection with timeout guard ───────────────────────────────────
    let attacks = [], cleanSwaps = 0, totalSwaps = 0;
    try {
      const detection = await Promise.race([
        detectMEVAttacks(swapDeltas, rawTransactions, priceMap, address),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Detection timeout")), 45000)),
      ]);
      attacks    = detection.attacks;
      cleanSwaps = detection.cleanSwaps;
      totalSwaps = detection.totalSwaps;
    } catch (e) {
      console.error("[audit] detection:", e.message);
    }

    // ── 5. Build summary — data integrity enforced here ───────────────────────
    const summary = buildAuditSummary(attacks, address, totalSwaps, cleanSwaps);

    // ── 6. Validate reconciliation — swap-level must match monthly must match total ──
    const swapLevelTotal  = parseFloat(attacks.reduce((s,a) => s + (a.lossRange?.midpoint||0), 0).toFixed(2));
    const monthlyTotal    = parseFloat(summary.timeline.reduce((s,t) => s + (t.lossMid||0), 0).toFixed(2));
    const summaryTotal    = summary.totalLoss.midpoint;
    const reconciled      = Math.abs(swapLevelTotal - monthlyTotal) < 0.02 &&
                            Math.abs(swapLevelTotal - summaryTotal) < 0.02;

    if (!reconciled) {
      console.warn("[audit] Reconciliation warning:", { swapLevelTotal, monthlyTotal, summaryTotal });
    }

    // ── 7. Portfolio snapshot ─────────────────────────────────────────────────
    let portfolio = [], portfolioTotal = 0;
    if (balancesData.status === "fulfilled" && balancesData.value?.balances) {
      portfolio = balancesData.value.balances
        .map(b => {
          const mint    = b.address || b.mint;
          const amount  = b.amount  || b.ui_amount || 0;
          const meta    = tokenList[mint] || {};
          const price   = priceMap[mint]  || 0;
          const valueUsd = amount * price;
          return {
            mint,
            symbol:   meta.symbol  || b.symbol  || mint.slice(0,4),
            name:     meta.name    || b.name    || "Unknown",
            logoURI:  meta.logoURI || null,
            amount:   parseFloat(amount.toFixed(6)),
            display:  formatBalance(amount),
            price,
            valueUsd: parseFloat(valueUsd.toFixed(2)),
          };
        })
        .filter(t => t.amount > 0 && t.valueUsd > 0.01)
        .sort((a,b) => b.valueUsd - a.valueUsd)
        .slice(0, 20);
      portfolioTotal = parseFloat(portfolio.reduce((s,t) => s+t.valueUsd, 0).toFixed(2));
    }

    // ── 8. AI narration — receives only structured data ───────────────────────
    const [briefing, protectionPlan] = await Promise.all([
      generateBriefing(summary),
      generateProtectionPlan(summary),
    ]);

    const tweetText = generateTweetText(summary);

    // ── 9. SIM response for dev panel ────────────────────────────────────────
    const simRawResponse = {
      endpoint:           `https://api.sim.dune.com/v1/svm/transactions/${address}`,
      status:             200,
      transactions_count: rawTransactions.length,
      swaps_detected:     swapTxs.length,
      mev_flagged:        attacks.length,
      reconciled,
      transactions:       rawTransactions.slice(0,10),
    };

    return res.status(200).json({
      success:        true,
      wallet:         address,
      summary,
      briefing,
      protectionPlan,
      tweetText,
      portfolio,
      portfolioTotal,
      reconciled,
      simRawResponse,
      generatedAt:    new Date().toISOString(),
    });

  } catch (err) {
    console.error("[audit]", err);
    return res.status(500).json({ error: err.message || "Audit failed" });
  }
}
