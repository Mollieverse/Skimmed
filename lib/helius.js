// lib/helius.js — Helius block-level sandwich verification with rate limiting

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const JUPITER  = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM  = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const ORCA     = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const DEX_SET  = new Set([JUPITER, RAYDIUM, ORCA]);

const BLOCK_FETCH_TIMEOUT_MS = 8000;  // 8s per block fetch
const MAX_VERIFICATIONS      = 10;    // max blocks to fetch per audit
const RATE_LIMIT_DELAY_MS    = 120;   // ~8 req/s — stays under free tier limit

// ── Rate-limited fetch ────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function getBlock(slot) {
  const res = await fetchWithTimeout(
    HELIUS_RPC,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getBlock",
        params: [slot, {
          encoding: "jsonParsed",
          transactionDetails: "full",
          maxSupportedTransactionVersion: 0,
        }],
      }),
    },
    BLOCK_FETCH_TIMEOUT_MS
  );

  if (!res.ok) throw new Error(`Helius getBlock HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`getBlock RPC: ${data.error.message}`);
  return data.result?.transactions || [];
}

function extractBlockSwaps(blockTxs) {
  const swaps = [];
  for (let i = 0; i < blockTxs.length; i++) {
    const tx   = blockTxs[i];
    const meta = tx.meta;
    const msg  = tx.transaction?.message;
    if (!meta || !msg) continue;

    const accounts = msg.accountKeys?.map(k =>
      typeof k === "string" ? k : k.pubkey
    ) || [];

    const isDex = accounts.some(a => DEX_SET.has(a));
    const hasTokenMovement = meta.preTokenBalances?.length > 0 &&
                             meta.postTokenBalances?.length > 0;
    if (!isDex || !hasTokenMovement) continue;

    swaps.push({
      txIndex: i,
      signer:  accounts[0],
      accounts,
      pre:  meta.preTokenBalances,
      post: meta.postTokenBalances,
      err:  meta.err,
    });
  }
  return swaps;
}

function getSwapPair(pre, post) {
  const allMints = [...new Set([...pre.map(b => b.mint), ...post.map(b => b.mint)])];
  const deltas   = allMints.map(mint => {
    const preAmt  = pre.find(b  => b.mint === mint)?.uiTokenAmount?.uiAmount  || 0;
    const postAmt = post.find(b => b.mint === mint)?.uiTokenAmount?.uiAmount || 0;
    return { mint, delta: postAmt - preAmt };
  }).filter(d => d.delta !== 0);

  const sold   = deltas.find(d => d.delta < 0);
  const bought = deltas.find(d => d.delta > 0);
  if (!sold || !bought) return null;
  return { inputMint: sold.mint, outputMint: bought.mint };
}

function findSandwichPattern(blockSwaps, victimIndex, victimPair) {
  if (!victimPair) return null;
  const { inputMint, outputMint } = victimPair;

  const frontRun = blockSwaps.find(s => {
    if (s.txIndex >= victimIndex || s.err) return false;
    const pair = getSwapPair(s.pre, s.post);
    if (!pair) return false;
    return pair.outputMint === outputMint || pair.inputMint === inputMint;
  });
  if (!frontRun) return null;

  const backRun = blockSwaps.find(s => {
    if (s.txIndex <= victimIndex || s.err) return false;
    if (s.signer !== frontRun.signer) return false;
    const pair = getSwapPair(s.pre, s.post);
    if (!pair) return false;
    return pair.inputMint === outputMint || pair.outputMint === inputMint;
  });
  if (!backRun) return null;

  return {
    confirmed:      true,
    botWallet:      frontRun.signer,  // real on-chain wallet address
    frontRunIndex:  frontRun.txIndex,
    backRunIndex:   backRun.txIndex,
  };
}

/**
 * Verify a single swap — returns verification result
 */
export async function verifySandwich(slot, victimWallet, victimPair) {
  try {
    const blockTxs   = await getBlock(slot);
    const blockSwaps = extractBlockSwaps(blockTxs);
    const victimEntry = blockSwaps.find(s => s.signer === victimWallet);

    if (!victimEntry) {
      return { confirmed: false, botWallet: null, reason: "Victim tx not found in block", slot };
    }

    const pattern = findSandwichPattern(blockSwaps, victimEntry.txIndex, victimPair);

    if (pattern) {
      return {
        confirmed:      true,
        botWallet:      pattern.botWallet,   // always a real address when confirmed
        frontRunIndex:  pattern.frontRunIndex,
        backRunIndex:   pattern.backRunIndex,
        victimIndex:    victimEntry.txIndex,
        slot,
        totalBlockSwaps: blockSwaps.length,
      };
    }

    return {
      confirmed: false,
      botWallet: null,
      reason:    "No front-run/back-run pattern found in block",
      slot,
      totalBlockSwaps: blockSwaps.length,
    };

  } catch (err) {
    return {
      confirmed: false,
      botWallet: null,
      reason:    `Block fetch failed: ${err.message}`,
      slot,
      error:     true,
    };
  }
}

/**
 * Batch verify multiple swaps with rate limiting
 * Caps at MAX_VERIFICATIONS to protect free tier
 */
export async function batchVerifySandwiches(candidates, walletAddress) {
  const limited = candidates.slice(0, MAX_VERIFICATIONS);
  const results = [];

  for (let i = 0; i < limited.length; i++) {
    const { blockSlot, victimPair } = limited[i];
    const result = await verifySandwich(blockSlot, walletAddress, victimPair);
    results.push({ blockSlot, ...result });
    // Rate limit delay between requests
    if (i < limited.length - 1) await sleep(RATE_LIMIT_DELAY_MS);
  }

  return results;
}

