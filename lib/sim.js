// lib/sim.js — Dune SIM API client (SVM beta) with defensive shape handling
const SIM_BASE = "https://api.sim.dune.com/beta";
const SIM_KEY  = process.env.DUNE_SIM_API_KEY;

const JUPITER_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM_PROGRAM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const ORCA_PROGRAM    = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const DEX_PROGRAMS = new Set([JUPITER_PROGRAM, RAYDIUM_PROGRAM, ORCA_PROGRAM]);

/**
 * Fetch wallet transactions
 */
export async function fetchWalletTransactions(address, limit = 100) {
  if (!SIM_KEY) throw new Error("DUNE_SIM_API_KEY is not set");
  const url = `${SIM_BASE}/svm/transactions/${address}?limit=${limit}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "X-Sim-Api-Key": SIM_KEY, "Accept": "application/json" },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dune SIM error ${res.status}: ${err}`);
  }
  const data = await res.json();

  // DIAGNOSTIC LOG — shows actual response shape on first call
  if (data?.transactions?.length > 0) {
    const sample = data.transactions[0];
    console.log("[sim] Top-level keys:", Object.keys(sample).join(", "));
    if (sample.raw_transaction) {
      console.log("[sim] raw_transaction keys:", Object.keys(sample.raw_transaction).join(", "));
    }
    if (sample.meta) {
      console.log("[sim] meta keys (top-level):", Object.keys(sample.meta).join(", "));
    }
    if (sample.transaction) {
      console.log("[sim] transaction keys:", Object.keys(sample.transaction).join(", "));
    }
  }

  return data;
}

/**
 * Fetch wallet balances
 */
export async function fetchWalletBalances(address) {
  if (!SIM_KEY) throw new Error("DUNE_SIM_API_KEY is not set");
  const url = `${SIM_BASE}/svm/balances/${address}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "X-Sim-Api-Key": SIM_KEY, "Accept": "application/json" },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dune SIM balances error ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Get meta object — handles multiple possible nesting paths
 */
export function getMeta(tx) {
  return tx?.raw_transaction?.meta
      || tx?.meta
      || tx?.transaction?.meta
      || null;
}

/**
 * Get account keys — handles multiple paths
 */
export function getAccountKeys(tx) {
  return tx?.raw_transaction?.transaction?.message?.accountKeys
      || tx?.transaction?.message?.accountKeys
      || tx?.message?.accountKeys
      || tx?.account_keys
      || tx?.accountKeys
      || [];
}

/**
 * Get pre/post token balances from any shape
 */
export function getTokenBalances(tx) {
  const meta = getMeta(tx);
  if (!meta) return { pre: [], post: [] };
  return {
    pre:  meta.preTokenBalances  || meta.pre_token_balances  || [],
    post: meta.postTokenBalances || meta.post_token_balances || [],
  };
}

/**
 * Filter DEX swap transactions (defensive)
 */
export function filterSwapTransactions(simTransactions) {
  return simTransactions.filter((tx) => {
    const meta = getMeta(tx);
    if (!meta) return false;
    if (meta.err) return false;

    const accounts = getAccountKeys(tx);
    const isDex = accounts.some((k) => DEX_PROGRAMS.has(typeof k === "string" ? k : k?.pubkey || ""));

    const { pre, post } = getTokenBalances(tx);
    const hasTokenMovement = pre.length > 0 && post.length > 0;

    return isDex && hasTokenMovement;
  });
}

/**
 * Parse swap from any shape
 */
export function parseSwapDelta(tx) {
  const { pre, post } = getTokenBalances(tx);
  const allMints = [...new Set([...pre.map((b) => b.mint), ...post.map((b) => b.mint)])];

  const deltas = [];
  for (const mint of allMints) {
    const preEntry  = pre.find((b)  => b.mint === mint);
    const postEntry = post.find((b) => b.mint === mint);
    const preAmt  = Number(preEntry?.uiTokenAmount?.uiAmount  ?? preEntry?.ui_amount  ?? 0);
    const postAmt = Number(postEntry?.uiTokenAmount?.uiAmount ?? postEntry?.ui_amount ?? 0);
    const decimals = preEntry?.uiTokenAmount?.decimals
                  ?? postEntry?.uiTokenAmount?.decimals
                  ?? preEntry?.decimals
                  ?? postEntry?.decimals
                  ?? 6;
    const delta = postAmt - preAmt;
    if (Math.abs(delta) > 0.000001) deltas.push({ mint, delta, decimals });
  }

  const sold   = deltas.find((d) => d.delta < 0);
  const bought = deltas.find((d) => d.delta > 0);
  if (!sold || !bought) return null;

  return {
    inputMint:      sold.mint,
    outputMint:     bought.mint,
    inputAmount:    Math.abs(sold.delta),
    outputAmount:   bought.delta,
    inputDecimals:  sold.decimals,
    outputDecimals: bought.decimals,
    blockSlot:      tx.block_slot,
    blockTime:      tx.block_time,
  };
}
