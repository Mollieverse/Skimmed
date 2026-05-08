import { useState, useRef, useCallback, useEffect } from "react";
import Head from "next/head";

// ── Constants ──────────────────────────────────────────────────────────────
const CONF_STYLES = {
  HIGH:   { bg:"rgba(196,32,32,.12)",  bd:"rgba(196,32,32,.3)",   tx:"#e04040", dot:"#c42020" },
  MEDIUM: { bg:"rgba(200,134,10,.1)",  bd:"rgba(200,134,10,.25)", tx:"#c8860a", dot:"#c8860a" },
  LOW:    { bg:"rgba(74,74,74,.1)",    bd:"rgba(74,74,74,.25)",   tx:"#6b7280", dot:"#444" },
};

const SEV_STYLES = {
  critical: { bg:"rgba(196,32,32,.12)",  bd:"rgba(196,32,32,.3)", tx:"#e04040" },
  high:     { bg:"rgba(196,32,32,.08)",  bd:"rgba(196,32,32,.2)", tx:"#c42020" },
  medium:   { bg:"rgba(200,134,10,.08)", bd:"rgba(200,134,10,.2)", tx:"#c8860a" },
};

// ── Ticker ────────────────────────────────────────────────────────────────
function Ticker() {
  const [priceStr, setPriceStr] = useState("Loading live prices…");

  useEffect(() => {
    fetch("https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263,JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN")
      .then(r => r.json())
      .then(d => {
        const data = d.data || {};
        const fmt = p => p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(6)}`;

        const parts = [
          data["So11111111111111111111111111111111111111112"] &&
          `SOL ${fmt(data["So11111111111111111111111111111111111111112"].price)}`,

          data["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"] &&
          `USDC ${fmt(data["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"].price)}`,

          data["DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"] &&
          `BONK ${fmt(data["DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"].price)}`,

          data["JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"] &&
          `JUP ${fmt(data["JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"].price)}`
        ].filter(Boolean);

        if (parts.length) setPriceStr(parts.join(" · "));
      })
      .catch(() => setPriceStr("SOL · USDC · BONK · JUP"));
  }, []);

  return (
    <div style={{
      overflow:"hidden",
      whiteSpace:"nowrap",
      borderBottom:"1px solid var(--border)",
      padding:"6px 0",
      background:"var(--card)"
    }}>
      <span style={{
        display:"inline-block",
        animation:"ticker 32s linear infinite",
        fontFamily:"var(--mono)",
        fontSize:13,
        color:"var(--muted)",
        letterSpacing:"0.06em"
      }}>
        {priceStr} · $370M+ MEV extracted on Solana · SKIMMED — Forensic MEV Intelligence · {priceStr}
      </span>
    </div>
  );
}

// ── Loading Screen ─────────────────────────────────────────────────────────
function LoadingScreen({ wallet }) {
  const [step, setStep] = useState(0);

  const steps = [
    {label:"Connecting to Dune SIM…", tag:"SIM"},
    {label:"Fetching Solana swap history…", tag:"SIM"},
    {label:"Running MEV rule engine…", tag:"MEV"},
    {label:"Verifying block patterns…", tag:"HELIUS"},
    {label:"Generating forensic briefing…", tag:"AI"},
  ];

  useEffect(() => {
    const t = setInterval(() => {
      setStep(s => Math.min(s + 1, steps.length - 1));
    }, 700);

    return () => clearInterval(t);
  }, []);

  return (
    <div style={{textAlign:"center",padding:"70px 20px"}}>
      <div style={{fontFamily:"var(--serif)",fontSize:16,fontStyle:"italic",color:"var(--muted)",marginBottom:28}}>
        Auditing {wallet.slice(0,8)}…{wallet.slice(-6)}
      </div>

      <div style={{display:"flex",gap:3,justifyContent:"center",marginBottom:32}}>
        {steps.map((_,i)=>(
          <div key={i} style={{
            width:3,
            height:24,
            background:i<=step?"var(--gold)":"var(--dim)"
          }}/>
        ))}
      </div>

      {steps.map((s,i)=>(
        <div key={i} style={{fontFamily:"var(--mono)",fontSize:13,marginBottom:10}}>
          <span>{i<step?"✓":i===step?"→":"○"}</span> {s.label}
        </div>
      ))}
    </div>
  );
}

// ── Share Card (safe SSR) ───────────────────────────────────────────────────
function generateShareCard(summary) {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#060504";
  ctx.fillRect(0,0,1200,630);

  ctx.fillStyle = "#c8860a";
  ctx.fillRect(0,0,1200,4);

  ctx.fillStyle = "#c42020";
  ctx.font = "110px serif";
  ctx.fillText(summary?.totalLoss?.display || "$0", 80, 300);

  return canvas.toDataURL("image/png");
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function Skimmed() {
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const runAudit = async (demo=false) => {
    const addr = demo
      ? "HHDnDH9BUb3oEgGQ5bXjJXVDtusuF9jhLQ8qgpkSWLSV"
      : wallet.trim();

    if (!addr) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch("/api/audit", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({address: addr})
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed");

      setReport(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (!report) return;
    const img = generateShareCard(report.summary);
    const a = document.createElement("a");
    a.href = img;
    a.download = "skimmed-report.png";
    a.click();
  };

  return (
    <>
      <Head>
        <title>SKIMMED — MEV Intelligence</title>
      </Head>

      <div style={{minHeight:"100vh",background:"#060504",color:"#fff"}}>

        <Ticker />

        <div style={{padding:40, maxWidth:800, margin:"0 auto"}}>

          <h1 style={{fontFamily:"serif",fontSize:48}}>
            SKIMMED
          </h1>

          <input
            value={wallet}
            onChange={e=>setWallet(e.target.value)}
            placeholder="Enter wallet"
            style={{padding:12,width:"100%",marginTop:20}}
          />

          <button onClick={()=>runAudit(false)} style={{marginTop:10}}>
            Run Audit
          </button>

          <button onClick={()=>runAudit(true)} style={{marginLeft:10}}>
            Demo
          </button>

          {error && <p style={{color:"red"}}>{error}</p>}

          {loading && <LoadingScreen wallet={wallet} />}

          {report && (
            <div style={{marginTop:40}}>
              <h2>Report</h2>
              <p>{report.briefing}</p>

              <button onClick={handleShare}>
                Download Share Card
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
                   }
