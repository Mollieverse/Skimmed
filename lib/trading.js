// lib/trading.js — Trading Autopsy: behavioral analysis from swap history

const FOMO_THRESHOLD_HOURS = 1;       // bought within 1hr of token launch = FOMO
const REVENGE_THRESHOLD_HOURS = 24;   // re-bought same token within 24h of selling = revenge
const HODL_LOSER_THRESHOLD_DAYS = 7;  // held a losing trade > 7 days = bag holding
const QUICK_SELL_WINNER_HOURS = 2;    // sold a winner within 2h = paper hands

/**
 * Build trade lots from swap history
 * Each "lot" = a buy followed by a sell of the same token
 * Returns lots with realized PNL
 */
export function buildTradeLots(swaps, priceMap) {
  // Group swaps by token (the non-stablecoin/SOL side)
  const STABLE_OR_BASE = new Set([
    "So11111111111111111111111111111111111111112",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  ]);

  const tokenActions = {}; // mint → [{ type: 'buy'|'sell', amount, usdValue, timestamp }]

  for (const swap of swaps) {
    const { inputMint, outputMint, inputAmount, outputAmount, blockTime } = swap;
    const inputIsBase  = STABLE_OR_BASE.has(inputMint);
    const outputIsBase = STABLE_OR_BASE.has(outputMint);

    // Buy: paid base/stable for some other token
    if (inputIsBase && !outputIsBase) {
      const usdSpent = inputAmount * (priceMap[inputMint] || 0);
      if (usdSpent === 0 || !isFinite(usdSpent)) continue;
      if (!tokenActions[outputMint]) tokenActions[outputMint] = [];
      tokenActions[outputMint].push({
        type: "buy",
        amount: outputAmount,
        usdValue: usdSpent,
        timestamp: blockTime,
        pricePerToken: usdSpent / outputAmount,
      });
    }
    // Sell: traded some other token for base/stable
    else if (!inputIsBase && outputIsBase) {
      const usdReceived = outputAmount * (priceMap[outputMint] || 0);
      if (usdReceived === 0 || !isFinite(usdReceived)) continue;
      if (!tokenActions[inputMint]) tokenActions[inputMint] = [];
      tokenActions[inputMint].push({
        type: "sell",
        amount: inputAmount,
        usdValue: usdReceived,
        timestamp: blockTime,
        pricePerToken: usdReceived / inputAmount,
      });
    }
  }

  // Pair buys with sells (FIFO) to compute closed-out trade lots
  const lots = [];
  for (const [mint, actions] of Object.entries(tokenActions)) {
    actions.sort((a, b) => a.timestamp - b.timestamp);
    const buyQueue = [];
    for (const action of actions) {
      if (action.type === "buy") {
        buyQueue.push({ ...action });
      } else if (action.type === "sell" && buyQueue.length > 0) {
        let remainingSell = action.amount;
        const sellPrice  = action.pricePerToken;
        const sellTime   = action.timestamp;
        while (remainingSell > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0];
          const matched = Math.min(remainingSell, buy.amount);
          const costBasis = matched * buy.pricePerToken;
          const proceeds  = matched * sellPrice;
          const pnl       = proceeds - costBasis;
          const pnlPct    = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
          const holdMs    = (sellTime - buy.timestamp) * 1000; // assuming seconds
          lots.push({
            mint,
            amount: matched,
            buyTime:  buy.timestamp,
            sellTime,
            costBasis: parseFloat(costBasis.toFixed(2)),
            proceeds:  parseFloat(proceeds.toFixed(2)),
            pnl:       parseFloat(pnl.toFixed(2)),
            pnlPct:    parseFloat(pnlPct.toFixed(2)),
            holdHours: parseFloat((holdMs / 1000 / 3600).toFixed(2)),
            isWin:     pnl > 0,
          });
          buy.amount -= matched;
          remainingSell -= matched;
          if (buy.amount <= 0.000001) buyQueue.shift();
        }
      }
    }
  }
  return lots;
}

/**
 * Detect bad habits from trade lots
 */
export function detectBadHabits(lots, swaps) {
  const habits = [];
  if (!lots.length) return habits;

  const wins   = lots.filter(l => l.isWin);
  const losses = lots.filter(l => !l.isWin);
  const winRate = (wins.length / lots.length) * 100;
  const avgHoldWin  = wins.length   ? wins.reduce((s,l)=>s+l.holdHours,0)/wins.length   : 0;
  const avgHoldLoss = losses.length ? losses.reduce((s,l)=>s+l.holdHours,0)/losses.length : 0;

  // 1. Bag holding: holding losers significantly longer than winners
  if (avgHoldLoss > avgHoldWin * 2 && losses.length >= 3) {
    habits.push({
      type: "bag_holding",
      severity: avgHoldLoss > avgHoldWin * 4 ? "critical" : "high",
      title: "You hold losers far longer than winners",
      detail: `Average hold time on losing trades: ${avgHoldLoss.toFixed(1)}h. On winners: ${avgHoldWin.toFixed(1)}h. You're holding ${(avgHoldLoss/avgHoldWin).toFixed(1)}x longer when you're losing.`,
      cost: parseFloat(losses.reduce((s,l)=>s+Math.abs(l.pnl),0).toFixed(2)),
    });
  }

  // 2. Paper hands: selling winners way too fast
  const quickWins = wins.filter(l => l.holdHours < QUICK_SELL_WINNER_HOURS);
  if (quickWins.length >= 3 && quickWins.length / Math.max(wins.length,1) > 0.4) {
    habits.push({
      type: "paper_hands",
      severity: "high",
      title: "You panic-sell winners too quickly",
      detail: `${quickWins.length} of your ${wins.length} winning trades were sold in under ${QUICK_SELL_WINNER_HOURS} hours. The avg gain on these was ${(quickWins.reduce((s,l)=>s+l.pnlPct,0)/quickWins.length).toFixed(1)}%. You may be leaving significant upside on the table.`,
      cost: null,
    });
  }

  // 3. Repeat losses on same token
  const lossesByMint = {};
  for (const l of losses) {
    if (!lossesByMint[l.mint]) lossesByMint[l.mint] = [];
    lossesByMint[l.mint].push(l);
  }
  const repeatLosers = Object.entries(lossesByMint)
    .filter(([_, ls]) => ls.length >= 2)
    .sort((a,b) => b[1].length - a[1].length);
  if (repeatLosers.length > 0) {
    const [mint, ls] = repeatLosers[0];
    habits.push({
      type: "repeat_loser",
      severity: ls.length >= 3 ? "critical" : "high",
      title: "You keep losing on the same token",
      detail: `You've lost on this token ${ls.length} separate times for a total of $${ls.reduce((s,l)=>s+Math.abs(l.pnl),0).toFixed(2)}. Pattern recognition: this isn't bad luck — it's a setup that doesn't work for you.`,
      cost: parseFloat(ls.reduce((s,l)=>s+Math.abs(l.pnl),0).toFixed(2)),
      mint,
    });
  }

  // 4. Low win rate
  if (lots.length >= 5 && winRate < 40) {
    habits.push({
      type: "low_winrate",
      severity: winRate < 25 ? "critical" : "high",
      title: `Your win rate is ${winRate.toFixed(0)}%`,
      detail: `Out of ${lots.length} closed trades, only ${wins.length} were profitable. The math gets brutal fast at this rate — even if your winners are 2x your losers, you're still bleeding.`,
      cost: null,
    });
  }

  // 5. Revenge trading (re-buying after selling at a loss within 24h)
  let revengeCount = 0;
  let revengeCost  = 0;
  for (const loss of losses) {
    const followUp = lots.find(l =>
      l.mint === loss.mint &&
      l.buyTime > loss.sellTime &&
      (l.buyTime - loss.sellTime) * 1000 < REVENGE_THRESHOLD_HOURS * 3600 * 1000
    );
    if (followUp) {
      revengeCount++;
      if (!followUp.isWin) revengeCost += Math.abs(followUp.pnl);
    }
  }
  if (revengeCount >= 2) {
    habits.push({
      type: "revenge_trading",
      severity: revengeCount >= 4 ? "critical" : "high",
      title: "Revenge trading detected",
      detail: `${revengeCount} times you sold at a loss and re-bought the same token within 24 hours. ${revengeCost > 0 ? `These re-entries cost an additional $${revengeCost.toFixed(2)}.` : ''} Emotional re-entries rarely fix the original mistake.`,
      cost: parseFloat(revengeCost.toFixed(2)),
    });
  }

  return habits;
}

/**
 * Build trading stats summary
 */
export function buildTradingStats(lots) {
  if (!lots.length) {
    return {
      totalTrades: 0,
      winRate: 0,
      totalPnl: 0,
      totalProfit: 0,
      totalLoss: 0,
      avgHoldTime: 0,
      bestTrade: null,
      worstTrade: null,
    };
  }
  const wins   = lots.filter(l => l.isWin);
  const losses = lots.filter(l => !l.isWin);
  const totalProfit = parseFloat(wins.reduce((s,l)=>s+l.pnl,0).toFixed(2));
  const totalLoss   = parseFloat(losses.reduce((s,l)=>s+l.pnl,0).toFixed(2));
  const totalPnl    = parseFloat((totalProfit + totalLoss).toFixed(2));
  const winRate     = parseFloat(((wins.length / lots.length) * 100).toFixed(1));
  const avgHoldTime = parseFloat((lots.reduce((s,l)=>s+l.holdHours,0)/lots.length).toFixed(1));
  const bestTrade   = wins.reduce((m,l)=>(!m||l.pnl>m.pnl?l:m), null);
  const worstTrade  = losses.reduce((m,l)=>(!m||l.pnl<m.pnl?l:m), null);

  // Top 3 of each
  const topWinners = [...wins].sort((a,b)=>b.pnl-a.pnl).slice(0,3);
  const topLosers  = [...losses].sort((a,b)=>a.pnl-b.pnl).slice(0,3);

  return {
    totalTrades: lots.length,
    winRate,
    winCount: wins.length,
    lossCount: losses.length,
    totalPnl,
    totalProfit,
    totalLoss,
    avgHoldTime,
    bestTrade,
    worstTrade,
    topWinners,
    topLosers,
  };
}

