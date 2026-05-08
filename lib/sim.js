// lib/sim.js — Dune SIM API client for Solana
// SVM endpoints live under /beta/ (not /v1/) since SVM is in beta

const SIM_BASE = "https://api.sim.dune.com/beta";
const SIM_KEY  = process.env.DUNE_SIM_API_KEY;

const JUPITER_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM_PROGRAM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const ORCA_PROGRAM    = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

const DEX_PROGRAMS = new Set([JUPITER_PROGRAM, RAYDIUM_PROGRAM, ORCA_PROGRAM]);

/**
 * Fetch wallet transaction history from Dune SIM
 * Endpoint: GET /beta/svm/transactions/{address}
 */
export async function fetchWalletTransactions(address, limit = 100) {
  if (!SIM_KEY) throw new Error("DUNE_SIM_API_KEY is not set");

  const url = `${SIM_BASE}/svm/transactions/${address}?limit=${limit}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Sim-Api-Key": SIM_KEY,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dune SIM error ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Fetch wallet balances from Dune SIM
 * Endpoint: GET /beta/svm/balances/{address}
 */
export async function fetchWalletBalances(address) {
  if (!SIM_KEY) throw new Error("DUNE_SIM_API_KEY is not set");

  const url = `${SIM_BASE}/svm/balances/${address}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Sim-Api-Key": SIM_KEY,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dune SIM balances error ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Filter DEX swap transactions
 */
export function filterSwapTransactions(simTransactions) {
  return simTransactions.filter((tx) => {
    const meta = tx.raw_transaction?.meta;
    const msg  = tx.raw_transaction?.transaction?.message;
    if (!meta || !msg) return false;

    const accounts = msg.accountKeys || [];
    const isDex = accounts.some((k) => DEX_PROGRAMS.has(k));
    const hasTokenMovement =
      meta.preTokenBalances?.length > 0 && meta.postTokenBalances?.length > 0;

    return isDex && hasTokenMovement;
  });
}

/**
 * Parse swap delta from a single SIM transaction
 */
export function parseSwapDelta(tx) {
  const pre  = tx.raw_transaction?.meta?.preTokenBalances  || [];
  const post = tx.raw_transaction?.meta?.postTokenBalances || [];

  const deltas = [];
  const allMints = [...new Set([...pre.map((b) => b.mint), ...post.map((b) => b.mint)])];

  for (const mint of allMints) {
    const preAmt  = pre.find((b)  => b.mint === mint)?.uiTokenAmount?.uiAmount  || 0;
    const postAmt = post.find((b) => b.mint === mint)?.uiTokenAmount?.uiAmount || 0;
    const delta   = postAmt - preAmt;
    if (delta !== 0) deltas.push({ mint, preAmt, postAmt, delta });
  }

  const sold   = deltas.find((d) => d.delta < 0);
  const bought = deltas.find((d) => d.delta > 0);

  if (!sold || !bought) return null;

  const expectedOutput  = Math.abs(sold.delta) * 0.997;
  const actualOutput    = bought.delta;
  const slippagePct     = Math.max(0, ((expectedOutput - actualOutput) / expectedOutput) * 100);

  return {
    inputMint:  sold.mint,
    outputMint: bought.mint,
    inputAmount:  Math.abs(sold.delta),
    outputAmount: actualOutput,
    expectedOutput,
    slippagePct: parseFloat(slippagePct.toFixed(4)),
    blockSlot:  tx.block_slot,
    blockTime:  tx.block_time,
  };
}

