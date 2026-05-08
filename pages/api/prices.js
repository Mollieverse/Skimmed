// pages/api/prices.js — Real-time token prices for ticker + UI
// Called client-side on page load. Cached 30s.

import { fetchLivePrices, fetchSolPrice, MINT_SYMBOL } from "../../lib/prices.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const priceMap = await fetchLivePrices();

    // Format for display
    const prices = Object.entries(priceMap).map(([mint, price]) => ({
      mint,
      symbol: MINT_SYMBOL[mint] || mint.slice(0,4),
      price,
      display: formatPrice(price),
    })).filter(p => p.price > 0);

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ prices, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function formatPrice(price) {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  if (price >= 1)    return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
}

