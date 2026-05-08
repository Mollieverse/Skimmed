// lib/prices.js — Real-time Solana token prices via Jupiter Price API
// No API key required. Updates on every audit run.

const JUPITER_PRICE_API = "https://price.jup.ag/v6/price";

// Canonical mint addresses
export const MINTS = {
  SOL:  "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JUP:  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  MSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  WIF:  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
};

// Reverse map: mint → symbol
export const MINT_SYMBOL = Object.fromEntries(Object.entries(MINTS).map(([k,v]) => [v,k]));

/**
 * Fetch live prices for all known tokens from Jupiter
 * Returns: { mint: priceUsd, ... }
 */
export async function fetchLivePrices() {
  const ids = Object.values(MINTS).join(",");
  const url  = `${JUPITER_PRICE_API}?ids=${ids}`;

  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    next: { revalidate: 30 }, // cache 30s in Next.js
  });

  if (!res.ok) throw new Error(`Jupiter price API error: ${res.status}`);

  const data = await res.json();
  // data.data = { [mint]: { id, mintSymbol, price, ... } }

  const priceMap = {};
  for (const [mint, info] of Object.entries(data.data || {})) {
    priceMap[mint] = info.price || 0;
  }

  // Stablecoins always $1 as fallback
  priceMap[MINTS.USDC] = priceMap[MINTS.USDC] || 1.0;
  priceMap[MINTS.USDT] = priceMap[MINTS.USDT] || 1.0;

  return priceMap;
}

/**
 * Get USD value of a token amount
 */
export function toUsd(amount, mint, priceMap) {
  const price = priceMap[mint] || 0;
  return amount * price;
}

/**
 * Fetch just SOL price — used for ticker
 */
export async function fetchSolPrice() {
  try {
    const url = `${JUPITER_PRICE_API}?ids=${MINTS.SOL}`;
    const res  = await fetch(url);
    const data = await res.json();
    return data.data?.[MINTS.SOL]?.price || null;
  } catch {
    return null;
  }
}

/**
 * Fetch Jupiter token list — logos + verified names
 * Cached aggressively since it rarely changes
 */
export async function fetchTokenList() {
  const res = await fetch("https://token.jup.ag/all");
  if (!res.ok) throw new Error("Jupiter token list error");
  const tokens = await res.json();
  // Build mint → { symbol, name, logoURI } map
  const map = {};
  for (const t of tokens) {
    map[t.address] = {
      symbol:   t.symbol,
      name:     t.name,
      logoURI:  t.logoURI || null,
      decimals: t.decimals,
    };
  }
  return map;
}

/**
 * Format a token balance for display
 */
export function formatBalance(amount, decimals = 6) {
  if (amount === 0) return "0";
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000)     return `${(amount / 1_000).toFixed(2)}K`;
  if (amount >= 1)         return amount.toFixed(2);
  if (amount >= 0.0001)    return amount.toFixed(4);
  return amount.toExponential(2);
}

