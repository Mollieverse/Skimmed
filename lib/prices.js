// lib/prices.js — Real-time Solana token prices via Jupiter Lite API
// Uses the new lite-api.jup.ag endpoint (price.jup.ag was deprecated)

const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v3";
const JUPITER_TOKEN_API = "https://lite-api.jup.ag/tokens/v2/search";

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

export const MINT_SYMBOL = Object.fromEntries(
  Object.entries(MINTS).map(([k, v]) => [v, k])
);

/**
 * Fetch live prices from Jupiter Lite API
 * Returns: { mint: priceUsd, ... }
 */
export async function fetchLivePrices() {
  try {
    const ids = Object.values(MINTS).join(",");
    const url = `${JUPITER_PRICE_API}?ids=${ids}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      console.error("[prices] Jupiter API error:", res.status);
      return getFallbackPrices();
    }

    const data = await res.json();
    const priceMap = {};

    // New API returns { mint: { usdPrice, ... }, ... }
    for (const [mint, info] of Object.entries(data || {})) {
      if (info && typeof info.usdPrice === "number") {
        priceMap[mint] = info.usdPrice;
      }
    }

    // Stablecoins always $1 fallback
    priceMap[MINTS.USDC] = priceMap[MINTS.USDC] || 1.0;
    priceMap[MINTS.USDT] = priceMap[MINTS.USDT] || 1.0;

    return priceMap;
  } catch (err) {
    console.error("[prices] fetchLivePrices failed:", err.message);
    return getFallbackPrices();
  }
}

/**
 * Fallback prices if Jupiter is down — keeps app working
 */
function getFallbackPrices() {
  return {
    [MINTS.USDC]: 1.0,
    [MINTS.USDT]: 1.0,
  };
}

/**
 * Fetch Jupiter verified token list with logos
 * Uses new tokens/v2/search endpoint
 */
export async function fetchTokenList() {
  try {
    // New API: search returns verified tokens
    const res = await fetch(`${JUPITER_TOKEN_API}?query=verified&limit=200`, {
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      console.error("[prices] Token list error:", res.status);
      return {};
    }

    const tokens = await res.json();
    const map = {};
    if (Array.isArray(tokens)) {
      for (const t of tokens) {
        const mint = t.id || t.address;
        if (!mint) continue;
        map[mint] = {
          symbol:   t.symbol,
          name:     t.name,
          logoURI:  t.icon || t.logoURI || null,
          decimals: t.decimals,
        };
      }
    }
    return map;
  } catch (err) {
    console.error("[prices] fetchTokenList failed:", err.message);
    return {};
  }
}

/**
 * Convert token amount to USD
 */
export function toUsd(amount, mint, priceMap) {
  const price = priceMap[mint] || 0;
  return amount * price;
}

/**
 * Format token balance for display
 */
export function formatBalance(amount, decimals = 6) {
  if (amount === 0) return "0";
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000)     return `${(amount / 1_000).toFixed(2)}K`;
  if (amount >= 1)         return amount.toFixed(2);
  if (amount >= 0.0001)    return amount.toFixed(4);
  return amount.toExponential(2);
}
