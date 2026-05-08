// pages/api/audit.js — Main audit endpoint

import { fetchWalletTransactions, fetchWalletBalances, filterSwapTransactions, parseSwapDelta } from "../../lib/sim.js";
import { detectMEVAttacks, buildAuditSummary } from "../../lib/mev.js";
import { generateBriefing, generateProtectionPlan } from "../../lib/claude.js";
import { fetchLivePrices, fetchTokenList, formatBalance } from "../../lib/prices.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

  const { address, demo } = req.body;
  if (!address || address.length < 32 || address.length > 44) {
    return res.status(400).json({ error:"Invalid Solana wallet address" });
  }

  if (demo) return res.status(200).json(getDemoData(address));

  try {
    // ── 1. Fetch real-time prices + token list from Jupiter ───────────────────
    const [priceMap, tokenList] = await Promise.all([
      fetchLivePrices(),
      fetchTokenList(),
    ]);

    // ── 2. Fetch from Dune SIM ──────────────────────────────────────────────
    const [simData, balancesData] = await Promise.allSettled([
      fetchWalletTransactions(address, 150),
      fetchWalletBalances(address),
    ]);

    const rawTransactions = simData.status === "fulfilled" ? simData.value.transactions || [] : [];
    const balances        = balancesData.status === "fulfilled" ? balancesData.value : null;

    // ── 2b. Build portfolio snapshot from balances ─────────────────────────────
    let portfolio = [];
    if (balancesData.status === "fulfilled" && balancesData.value?.balances) {
      portfolio = balancesData.value.balances
        .map(b => {
          const mint     = b.address || b.mint;
          const amount   = b.amount  || b.ui_amount || 0;
          const meta     = tokenList[mint] || {};
          const price    = priceMap[mint]  || 0;
          const valueUsd = amount * price;
          return {
            mint,
            symbol:   meta.symbol || b.symbol || mint.slice(0,4),
            name:     meta.name   || b.name   || "Unknown",
            logoURI:  meta.logoURI || null,
            amount:   parseFloat(amount.toFixed(6)),
            display:  formatBalance(amount),
            price,
            valueUsd: parseFloat(valueUsd.toFixed(2)),
          };
        })
        .filter(t => t.amount > 0 && t.valueUsd > 0.01)
        .sort((a, b) => b.valueUsd - a.valueUsd)
        .slice(0, 20); // top 20 by value
    }

    const portfolioTotal = parseFloat(portfolio.reduce((s,t) => s + t.valueUsd, 0).toFixed(2));

    const simRawResponse = {
      endpoint: `https://api.sim.dune.com/v1/svm/transactions/${address}`,
      status: simData.status === "fulfilled" ? 200 : "error",
      transactions_count: rawTransactions.length,
      next_offset: simData.status === "fulfilled" ? simData.value.next_offset : null,
      transactions: rawTransactions.slice(0, 15),
    };

    // ── 3. Detect MEV — using real prices ───────────────────────────────────
    const swapTxs    = filterSwapTransactions(rawTransactions);
    const swapDeltas = swapTxs.map(parseSwapDelta);
    // ── 3. Detect MEV with timeout guard ──────────────────────────────────────
    let attacks = [], cleanSwaps = 0, totalSwaps = 0;
    try {
      const detection = await Promise.race([
        detectMEVAttacks(swapDeltas, rawTransactions, priceMap, address),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Detection timeout")), 45000)),
      ]);
      attacks    = detection.attacks;
      cleanSwaps = detection.cleanSwaps;
      totalSwaps = detection.totalSwaps;
    } catch (detectionErr) {
      console.error("[audit] detection error:", detectionErr.message);
      // Partial result — continue with empty attacks rather than failing whole audit
    }

    // ── 4. Build summary ────────────────────────────────────────────────────
    const summary = buildAuditSummary(attacks, address);
    summary.cleanSwaps = cleanSwaps;
    summary.totalSwaps = totalSwaps;

    // ── 5. Claude briefing ──────────────────────────────────────────────────
    const [briefing, protectionPlan] = await Promise.all([
      generateBriefing(summary),
      generateProtectionPlan(summary),
    ]);

    // ── 6. Include live prices in response (for UI display) ─────────────────
    const livePrices = Object.entries(priceMap)
      .map(([mint, price]) => ({ mint, price }))
      .filter(p => p.price > 0);

    return res.status(200).json({
      success: true,
      wallet: address,
      portfolio,
      portfolioTotal,
      summary,
      briefing,
      protectionPlan,
      balances,
      livePrices,
      simRawResponse,
      generatedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error("[audit]", err);
    return res.status(500).json({ error: err.message || "Audit failed" });
  }
}

// ── Demo data — uses realistic prices ────────────────────────────────────────
function getDemoData(address) {
  // These are approximate real prices — updated at build time
  // In production the real audit uses live Jupiter prices
  const DEMO_PRICES = { SOL: 175.42, USDC: 1.00, BONK: 0.0000142, JUP: 0.58 };

  const attacks = [
    {
      type:"sandwich_victim", confirmed:true, verificationStatus:"confirmed", verificationNote:"Front-run at tx #14, back-run at tx #16 in block 318201044", slippagePct:3.82, lossInToken:0.198, lossUsd:34.71,
      inputUsd:500, inputMint:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      outputMint:"So11111111111111111111111111111111111111112",
      inputAmount:500, blockSlot:318201044, blockTime:1715980110000000,
      date:"May 17", pair:"USDC → SOL", attacker:"e6yBotXv8mK2...Rqz", severity:"high",
    },
    {
      type:"sandwich_victim", confirmed:true, verificationStatus:"confirmed", verificationNote:"Front-run at tx #8, back-run at tx #10 in block 318456201", slippagePct:2.14, lossInToken:0.105, lossUsd:18.43,
      inputUsd:253.8, inputMint:"So11111111111111111111111111111111111111112",
      outputMint:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      inputAmount:1.447, blockSlot:318456201, blockTime:1716000420000000,
      date:"May 18", pair:"SOL → USDC", attacker:"Ai4zqY7gjyAP...kkt", severity:"medium",
    },
    {
      type:"sandwich_victim", confirmed:false, verificationStatus:"suspected", verificationNote:"High slippage detected but block pattern inconclusive", slippagePct:1.44, lossInToken:3412, lossUsd:9.22,
      inputUsd:34.08, inputMint:"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      outputMint:"So11111111111111111111111111111111111111112",
      inputAmount:240000, blockSlot:317700199, blockTime:1715940200000000,
      date:"May 15", pair:"BONK → SOL", attacker:"Ai4zqY7gjyAP...kkt", severity:"medium",
    },
  ];

  const demoPortfolio = [
    { mint:"So11111111111111111111111111111111111111112",  symbol:"SOL",  name:"Solana",     logoURI:"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png", amount:4.21,    display:"4.21",    price:175.42, valueUsd:738.52 },
    { mint:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol:"USDC", name:"USD Coin",  logoURI:"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png", amount:120.00,  display:"120.00",  price:1.00,   valueUsd:120.00 },
    { mint:"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",symbol:"BONK", name:"Bonk",      logoURI:"https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q89PD9aWCxhGE", amount:450000, display:"450K",    price:0.0000142,valueUsd:6.39 },
    { mint:"JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",  symbol:"JUP",  name:"Jupiter",  logoURI:"https://static.jup.ag/jup/icon.png", amount:2.5, display:"2.50", price:0.58, valueUsd:1.45 },
  ];

  return {
    success:true, wallet:address, demo:true,
    portfolio: demoPortfolio,
    portfolioTotal: parseFloat(demoPortfolio.reduce((s,t) => s + t.valueUsd, 0).toFixed(2)),
    summary:{
      walletAddress:address, totalLossUsd:62.36, attackCount:3,
      cleanSwaps:0, totalSwaps:3, exposureScore:87,
      topAttacker:{ address:"Ai4zqY7gjyAP...kkt", count:2, totalLoss:27.65 },
      worstHit:attacks[0],
      attacksByBot:[
        { address:"Ai4zqY7gjyAP...kkt", count:2, totalLoss:27.65 },
        { address:"e6yBotXv8mK2...Rqz",  count:1, totalLoss:34.71 },
      ],
      timeline:[
        { sortKey:"2026-03", label:"March 2026",  count:1, loss:12.40 },
        { sortKey:"2026-04", label:"April 2026",  count:3, loss:41.18 },
        { sortKey:"2026-05", label:"May 2026",    count:3, loss:62.36 },
      ],
      attacks,
    },
    briefing:"Forensic analysis of your swap history reveals 3 confirmed sandwich attacks extracting $62.36 from your wallet — 100% of your recent DEX activity was targeted. Your worst single exposure occurred on May 17 when bot e6yBotXv8mK2…Rqz inserted transactions around your $500 USDC swap, manufacturing $34.71 in artificial slippage. Bot Ai4zqY7gjyAP…kkt has flagged your wallet pattern and returned twice — switch to Jupiter Ultra with Jito protection before your next trade.",
    protectionPlan:[
      "Route all swaps through Jupiter Ultra with Jito bundle protection — sandwich resistance built in at no extra cost.",
      "Cap slippage tolerance at 0.5% for stables, 1% for volatile tokens. High static slippage is your biggest attack surface.",
      "Bot Ai4zqY7gjyAP...kkt has targeted you twice — split large trades across smaller chunks at different times.",
      "For trades over $500 use Helius Shield or a private RPC to prevent mempool visibility before execution.",
    ],
    livePrices: Object.entries(DEMO_PRICES).map(([symbol,price]) => ({ symbol, price })),
    simRawResponse:{
      endpoint:`https://api.sim.dune.com/v1/svm/transactions/${address}`,
      status:200, transactions_count:3,
      transactions:[
        {
          block_slot:318456201, block_time:1716000420000000, chain:"solana",
          raw_transaction:{
            meta:{
              fee:5000,
              preTokenBalances:[{mint:"So11111111111111111111111111111111111111112",uiTokenAmount:{uiAmount:1.447}}],
              postTokenBalances:[{mint:"So11111111111111111111111111111111111111112",uiTokenAmount:{uiAmount:1.342}}],
              logMessages:["Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 invoke [1]","Program log: Instruction: Route"],
            },
            transaction:{message:{accountKeys:["7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU","JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"]}}
          },
          _mev_analysis:{ detected:true, type:"sandwich_victim", excess_slippage_pct:2.14, estimated_loss_usd:18.43, attacker:"Ai4zqY7gjyAP...kkt" }
        }
      ]
    },
    generatedAt: new Date().toISOString(),
  };
}

