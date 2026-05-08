import { useState, useRef } from "react";
import Head from "next/head";

const MINT = {
  So11111111111111111111111111111111111111112:  "SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:  "USDT",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN:  "JUP",
};

const SEV = {
  critical: { bg:"rgba(196,32,32,.12)",  bd:"rgba(196,32,32,.3)",   tx:"#e04040" },
  high:     { bg:"rgba(196,32,32,.08)",  bd:"rgba(196,32,32,.2)",   tx:"#c42020" },
  medium:   { bg:"rgba(200,134,10,.08)", bd:"rgba(200,134,10,.2)",  tx:"#c8860a" },
  low:      { bg:"rgba(74,74,74,.10)",   bd:"rgba(74,74,74,.25)",   tx:"#6b7280" },
};

// ── Ticker (live prices from Jupiter Price API) ───────────────────────────────
function Ticker() {
  const [prices, setPrices] = useState(null);

  useState(() => {
    fetch("/api/prices")
      .then(r => r.json())
      .then(d => setPrices(d.prices))
      .catch(() => {});
  }, []);

  const priceStr = prices
    ? prices.map(p => `${p.symbol} ${p.display}`).join(" &nbsp;·&nbsp; ")
    : "SOL — &nbsp;·&nbsp; Loading live prices…";

  const static_info = " &nbsp;·&nbsp; $370M+ extracted via MEV &nbsp;·&nbsp; SKIMMED — Dune SIM &nbsp;·&nbsp; Every swap is a target &nbsp;·&nbsp; ";
  const content = priceStr + static_info + priceStr + static_info;

  return (
    <div style={{ overflow:"hidden", whiteSpace:"nowrap", borderBottom:"1px solid var(--border)", padding:"5px 0", background:"var(--card)" }}>
      <span
        style={{ display:"inline-block", animation:"ticker 32s linear infinite", fontFamily:"var(--mono)", fontSize:9, color:"var(--muted)", letterSpacing:"0.08em" }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}

// ── Exposure ring ─────────────────────────────────────────────────────────────
function Ring({ score }) {
  const r = 34, circ = 2 * Math.PI * r;
  const c   = score >= 70 ? "#c42020" : score >= 40 ? "#c8860a" : "#2d7a3a";
  const lbl = score >= 70 ? "CRITICAL"  : score >= 40 ? "ELEVATED"  : "SAFE";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <svg width={84} height={84} viewBox="0 0 84 84" style={{ transform:"rotate(-90deg)" }}>
        <circle cx={42} cy={42} r={r} fill="none" stroke="#1e1a15" strokeWidth={5}/>
        <circle cx={42} cy={42} r={r} fill="none" stroke={c} strokeWidth={5}
          strokeDasharray={`${circ*(score/100)} ${circ}`} strokeLinecap="butt"
          style={{ transition:"stroke-dasharray 1s ease-out" }}/>
      </svg>
      <div style={{ marginTop:-72, display:"flex", flexDirection:"column", alignItems:"center" }}>
        <span style={{ fontFamily:"var(--mono)", fontSize:20, fontWeight:700, color:c, lineHeight:1 }}>{score}</span>
        <span style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--muted)", letterSpacing:"0.1em" }}>/100</span>
      </div>
      <div style={{ marginTop:32, fontFamily:"var(--mono)", fontSize:8, letterSpacing:"0.14em", textTransform:"uppercase",
        padding:"2px 8px", color:c,
        background:`rgba(${score>=70?"196,32,32":score>=40?"200,134,10":"45,122,58"},.08)`,
        border:`1px solid rgba(${score>=70?"196,32,32":score>=40?"200,134,10":"45,122,58"},.22)` }}>
        {lbl}
      </div>
    </div>
  );
}

// ── Monthly Bar chart ────────────────────────────────────────────────────────
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.loss), 1);
  const total = data.reduce((s,d) => s + d.loss, 0);

  return (
    <div style={{ padding:"18px 20px 18px" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:20 }}>
        <span style={{ fontFamily:"var(--mono)", fontSize:9, letterSpacing:"0.14em", color:"var(--muted)", textTransform:"uppercase" }}>
          Monthly Loss Timeline
        </span>
        <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--red)", fontWeight:600 }}>
          ${total.toFixed(2)} total
        </span>
      </div>

      {/* Bars */}
      <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:80, marginBottom:12 }}>
        {data.map((d,i) => {
          const barHeight = Math.max(4, (d.loss / max) * 64);
          const isMax = d.loss === max;
          return (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
              <span style={{ fontFamily:"var(--mono)", fontSize:8, color: isMax ? "var(--red)" : "var(--muted)", fontWeight: isMax ? 600 : 400 }}>
                ${d.loss}
              </span>
              <div style={{ position:"relative", width:"100%", height:`${barHeight}px`,
                background: isMax
                  ? "linear-gradient(to top,#c42020,rgba(196,32,32,.5))"
                  : "linear-gradient(to top,rgba(196,32,32,.7),rgba(196,32,32,.2))",
                transition:"height .6s ease-out"
              }}>
                {isMax && (
                  <div style={{ position:"absolute", top:-1, left:0, right:0, height:2, background:"var(--red)" }}/>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Month labels */}
      <div style={{ display:"flex", gap:8 }}>
        {data.map((d,i) => (
          <div key={i} style={{ flex:1, textAlign:"center" }}>
            <div style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--dim)", lineHeight:1.4 }}>
              {/* Show abbreviated month name */}
              {d.label.split(" ")[0].slice(0,3)}
            </div>
            <div style={{ fontFamily:"var(--mono)", fontSize:7, color:"var(--border)" }}>
              {d.count} hit{d.count !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>

      {/* Month list for clarity when many months */}
      {data.length > 1 && (
        <div style={{ marginTop:16, borderTop:"1px solid var(--b2)", paddingTop:14, display:"flex", flexDirection:"column", gap:8 }}>
          {data.map((d,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:8, height:8, background: d.loss === max ? "var(--red)" : "rgba(196,32,32,.4)" }}/>
                <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text)" }}>{d.label}</span>
              </div>
              <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--muted)" }}>{d.count} attack{d.count!==1?"s":""}</span>
                <span style={{ fontFamily:"var(--mono)", fontSize:11, fontWeight:600, color: d.loss === max ? "var(--red)" : "var(--text)" }}>
                  −${d.loss.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SIM Integration strip (always visible — satisfies submission requirement) ──
function SimStrip({ endpoint }) {
  return (
    <div style={{ border:"1px solid rgba(90,144,240,.22)", background:"rgba(30,77,183,.05)", padding:"14px 18px", marginBottom:2 }}>
      <div style={{ fontFamily:"var(--mono)", fontSize:8, letterSpacing:"0.18em", color:"var(--blue-l)", textTransform:"uppercase", marginBottom:12 }}>
        ◈ Dune SIM — How It Powers This Report
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:12 }}>
        {[
          { step:"01", label:"Wallet Input",    desc:"Address sent to SIM API" },
          { step:"02", label:"SIM Fetches TXs", desc:"GET /v1/svm/transactions" },
          { step:"03", label:"Swaps Filtered",  desc:"DEX programs identified" },
          { step:"04", label:"MEV Flagged",     desc:"Excess slippage detected" },
        ].map((s,i) => (
          <div key={i} style={{ background:"rgba(30,77,183,.06)", border:"1px solid rgba(90,144,240,.1)", padding:"9px 11px" }}>
            <div style={{ fontFamily:"var(--mono)", fontSize:7, color:"var(--blue-l)", marginBottom:3, letterSpacing:"0.1em" }}>{s.step} · {s.label}</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--muted)" }}>{s.desc}</div>
          </div>
        ))}
      </div>
      {endpoint && (
        <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"rgba(90,144,240,.45)", wordBreak:"break-all" }}>
          <span style={{ color:"var(--gold)" }}>GET</span>{" "}
          <span style={{ color:"var(--blue-l)" }}>{endpoint}</span>
        </div>
      )}
    </div>
  );
}

// ── Dev Panel (open by default) ────────────────────────────────────────────────
function DevPanel({ simRaw }) {
  const [open, setOpen] = useState(true);
  const json = JSON.stringify(simRaw, null, 2);

  const isMev = l => l.includes("_mev_analysis") || l.includes("sandwich") ||
    l.includes("detected") || l.includes("estimated_loss") || l.includes("excess_slippage");

  const colorize = l => l
    .replace(/"([^"]+)":/g, (_, k) => `<span style="color:#86efac">"${k}"</span>:`)
    .replace(/: "([^"]*)"/g, (_, v) => `: <span style="color:#fbbf24">"${v}"</span>`)
    .replace(/: (true|false)/g, (_, v) => `: <span style="color:#f472b6">${v}</span>`)
    .replace(/: null/g, `: <span style="color:#6b7280">null</span>`)
    .replace(/: (-?\d+\.?\d*)/g, (_, n) => `: <span style="color:#60a5fa">${n}</span>`);

  return (
    <div style={{ border:"1px solid var(--border)" }}>
      <div onClick={() => setOpen(!open)} style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"11px 16px", background:"var(--card)",
        borderBottom: open ? "1px solid var(--b2)" : "none",
        cursor:"pointer", userSelect:"none",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, fontFamily:"var(--mono)", fontSize:9, letterSpacing:"0.14em", color:"var(--blue-l)", textTransform:"uppercase" }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--blue-l)", animation:"pulse 2s ease-in-out infinite" }}/>
          Dune SIM · Raw API Response
          <span style={{ color:"var(--muted)", fontWeight:300 }}>· svm/transactions</span>
        </div>
        <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--dim)" }}>{open ? "[ collapse ]" : "[ expand ]"}</span>
      </div>

      {open && (
        <>
          <div style={{ padding:"9px 16px", background:"#080604", borderBottom:"1px solid var(--b2)", fontFamily:"var(--mono)", fontSize:10 }}>
            <span style={{ color:"var(--gold)" }}>GET</span>
            <span style={{ color:"var(--muted)", margin:"0 5px" }}>→</span>
            <span style={{ color:"var(--blue-l)" }}>{simRaw?.endpoint}</span>
            <span style={{ float:"right", color:"#2d7a3a" }}>200 OK</span>
          </div>
          <div style={{ padding:"12px 14px", background:"#050402", maxHeight:320, overflowY:"auto", fontFamily:"var(--mono)", fontSize:10, lineHeight:1.75 }}>
            {json.split("\n").map((line, i) => (
              <div key={i} style={{
                background: isMev(line) ? "rgba(196,32,32,.05)" : "transparent",
                borderLeft: isMev(line) ? "2px solid rgba(196,32,32,.3)" : "2px solid transparent",
                paddingLeft: 5,
              }} dangerouslySetInnerHTML={{ __html: colorize(line) }}/>
            ))}
          </div>
          <div style={{ padding:"7px 14px", background:"var(--card)", borderTop:"1px solid var(--b2)", display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--muted)", letterSpacing:"0.1em" }}>MEV-FLAGGED LINES HIGHLIGHTED IN RED</span>
            <span style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--dim)" }}>{simRaw?.transactions_count || 0} TXS RETURNED</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Loading screen ─────────────────────────────────────────────────────────────
function LoadingScreen({ wallet }) {
  const [step, setStep] = useState(0);
  const steps = [
    { label:"Connecting to Dune SIM…",        tag:"SIM" },
    { label:"Fetching Solana swap history…",   tag:"SIM" },
    { label:"Running sandwich detection…",     tag:"MEV" },
    { label:"Calculating dollar losses…",      tag:"MEV" },
    { label:"Generating AI intelligence briefing…", tag:"AI" },
  ];

  useState(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 700);
    return () => clearInterval(t);
  }, []);

  const tagColor = { SIM:"var(--blue-l)", MEV:"var(--red)", AI:"var(--gold)" };

  return (
    <div style={{ textAlign:"center", padding:"70px 20px" }}>
      <div style={{ fontFamily:"var(--serif)", fontSize:13, fontStyle:"italic", color:"var(--muted)", marginBottom:28 }}>
        Auditing {wallet.slice(0,8)}…{wallet.slice(-6)}
      </div>

      {/* Live SIM call indicator */}
      <div style={{ border:"1px solid rgba(90,144,240,.2)", background:"rgba(30,77,183,.05)", padding:"12px 16px", marginBottom:32, textAlign:"left" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--blue-l)", animation:"pulse 1s ease-in-out infinite" }}/>
          <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--blue-l)", letterSpacing:"0.12em", textTransform:"uppercase" }}>
            Dune SIM · Live Call
          </span>
        </div>
        <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--muted)", wordBreak:"break-all" }}>
          <span style={{ color:"var(--gold)" }}>GET</span>{" "}
          https://api.sim.dune.com/v1/svm/transactions/{wallet.slice(0,8)}…
        </div>
      </div>

      <div style={{ display:"flex", gap:3, justifyContent:"center", marginBottom:32 }}>
        {steps.map((_,i) => (
          <div key={i} style={{ width:3, height:22, background: i <= step ? "var(--gold)" : "var(--dim)", transition:"background .3s" }}/>
        ))}
      </div>

      {steps.map((s,i) => (
        <div key={i} style={{
          fontFamily:"var(--mono)", fontSize:10, letterSpacing:"0.08em", marginBottom:8,
          display:"flex", alignItems:"center", justifyContent:"center", gap:10,
          color: i < step ? "var(--green-l)" : i === step ? "var(--text)" : "var(--dim)",
          transition:"color .3s",
        }}>
          <span style={{ color: i < step ? "var(--green-l)" : i === step ? "var(--gold)" : "var(--dim)" }}>
            {i < step ? "✓" : i === step ? "→" : "○"}
          </span>
          {s.label}
          {i <= step && (
            <span style={{ fontFamily:"var(--mono)", fontSize:8, padding:"1px 6px",
              background:`rgba(${s.tag==="SIM"?"30,77,183":s.tag==="MEV"?"196,32,32":"200,134,10"},.1)`,
              color: tagColor[s.tag], letterSpacing:"0.1em" }}>
              {s.tag}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}


// ── Portfolio Snapshot ────────────────────────────────────────────────────────
function PortfolioSnapshot({ portfolio, total }) {
  const [imgErrors, setImgErrors] = useState({});

  if (!portfolio?.length) return (
    <div style={{ border:"1px solid var(--border)", borderTop:"none", marginBottom:2, padding:"24px 18px", textAlign:"center" }}>
      <div style={{ fontFamily:"var(--mono)", fontSize:9, letterSpacing:"0.14em", color:"var(--muted)", textTransform:"uppercase", marginBottom:8 }}>Portfolio Snapshot</div>
      <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--dim)" }}>No token balances returned for this wallet</div>
    </div>
  );

  return (
    <div style={{ border:"1px solid var(--border)", borderTop:"none", marginBottom:2 }}>
      <div style={{ padding:"9px 18px", background:"var(--card)", borderBottom:"1px solid var(--b2)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontFamily:"var(--mono)", fontSize:8, letterSpacing:"0.16em", color:"var(--muted)", textTransform:"uppercase" }}>
          Portfolio Snapshot
        </span>
        <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--gold)", fontWeight:600 }}>
          ${total?.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}
        </span>
      </div>

      {portfolio.map((token, i) => (
        <div key={i} style={{
          display:"flex", alignItems:"center", padding:"14px 18px",
          borderBottom: i < portfolio.length - 1 ? "1px solid #0d0b09" : "none",
          gap:14,
        }}>
          {/* Logo */}
          <div style={{ width:42, height:42, borderRadius:"50%", overflow:"hidden", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
            background: token.logoURI && !imgErrors[token.mint] ? "#1a1a1a" : "linear-gradient(135deg, #2a1f00, #1a1200)",
            border: token.logoURI && !imgErrors[token.mint] ? "1px solid var(--border)" : "1px solid rgba(200,134,10,.3)",
          }}>
            {token.logoURI && !imgErrors[token.mint] ? (
              <img
                src={token.logoURI}
                alt={token.symbol}
                width={42}
                height={42}
                style={{ objectFit:"cover", width:"100%", height:"100%" }}
                onError={() => setImgErrors(e => ({ ...e, [token.mint]: true }))}
              />
            ) : (
              <span style={{
                fontFamily:"var(--mono)",
                fontSize:9,
                fontWeight:700,
                color:"var(--gold)",
                textTransform:"uppercase",
                lineHeight:1,
                letterSpacing:"0.05em",
              }}>
                {token.symbol.slice(0,3)}
              </span>
            )}
          </div>

          {/* Name + symbol */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text)", fontWeight:500 }}>{token.symbol}</div>
            <div style={{ fontFamily:"var(--sans)", fontSize:10, color:"var(--muted)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{token.name}</div>
          </div>

          {/* Balance */}
          <div style={{ textAlign:"right", minWidth:80 }}>
            <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text)" }}>{token.display}</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--muted)" }}>
              @ ${token.price >= 1 ? token.price.toFixed(2) : token.price.toFixed(6)}
            </div>
          </div>

          {/* USD value */}
          <div style={{ textAlign:"right", minWidth:72 }}>
            <div style={{ fontFamily:"var(--mono)", fontSize:12, fontWeight:600, color: token.valueUsd > 100 ? "var(--gold)" : "var(--text)" }}>
              ${token.valueUsd.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}
            </div>
          </div>
        </div>
      ))}


    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Skimmed() {
  const [wallet,  setWallet]  = useState("");
  const [loading, setLoading] = useState(false);
  const [report,  setReport]  = useState(null);
  const [error,   setError]   = useState(null);
  const [copied,  setCopied]  = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const reportRef = useRef(null);

  const runAudit = async (demo = false) => {
    const addr = demo ? "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" : wallet.trim();
    if (!addr) return;
    if (demo) setWallet(addr);
    setLoading(true); setReport(null); setError(null); setTimedOut(false);
    try {
      // Show warning if taking too long
      const timeoutWarn = setTimeout(() => setTimedOut(true), 20000);
      const res  = await fetch("/api/audit", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ address:addr, demo }) });
      clearTimeout(timeoutWarn);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed");
      setReport(data);
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior:"smooth" }), 120);
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const share = () => {
    navigator.clipboard.writeText(`${window.location.origin}?wallet=${wallet}`).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  const tweet = () => {
    const s = report?.summary;
    const txt = `Ran my Solana wallet through SKIMMED and found ${s?.attackCount||0} sandwich attacks that stole $${s?.totalLossUsd||0} from my trades 🔴\n\nCheck yours:`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(window.location.origin)}`, "_blank");
  };

  const S = report?.summary;

  const btn = (label, onClick, style={}) => (
    <button onClick={onClick} style={{
      background:"none", border:"1px solid var(--border)", color:"var(--muted)",
      fontFamily:"var(--mono)", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase",
      padding:"7px 14px", cursor:"pointer", transition:"all .2s", ...style
    }}>{label}</button>
  );

  return (
    <>
      <Head>
        <title>SKIMMED — Solana MEV Damage Report</title>
        <meta name="description" content="See exactly how much sandwich bots have extracted from your Solana swaps. Powered by Dune SIM + Claude AI."/>
        <meta property="og:title" content="SKIMMED — Solana MEV Damage Report"/>
        <meta property="og:description" content="How much have bots stolen from you? Paste your wallet and find out."/>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔴</text></svg>"/>
      </Head>

      <div style={{ minHeight:"100vh", background:"var(--bg)", position:"relative", zIndex:1 }}>

        {/* ── Ticker ──────────────────────────────────────────────────────── */}
        <Ticker/>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header style={{
          borderBottom:"1px solid var(--border)", padding:"0 clamp(20px,4vw,48px)",
          display:"flex", alignItems:"center", justifyContent:"space-between", height:54,
          position:"sticky", top:0, background:"rgba(6,5,4,.97)", backdropFilter:"blur(12px)", zIndex:100,
        }}>
          <div style={{ fontFamily:"var(--serif)", fontSize:20, fontWeight:300, letterSpacing:"-0.02em" }}>SKIMMED</div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, fontFamily:"var(--mono)", fontSize:8, color:"var(--blue-l)", letterSpacing:"0.12em" }}>
              <div style={{ width:4, height:4, borderRadius:"50%", background:"var(--blue-l)", animation:"pulse 2s ease-in-out infinite" }}/>
              DUNE SIM
            </div>
            <div style={{ width:1, height:14, background:"var(--border)" }}/>
            <span style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--dim)", letterSpacing:"0.1em" }}>SOLANA · SVM</span>
          </div>
        </header>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section style={{ padding:"64px clamp(20px,4vw,48px) 48px", maxWidth:820, margin:"0 auto" }}>
          <div style={{ fontFamily:"var(--mono)", fontSize:9, letterSpacing:"0.22em", color:"var(--muted)", textTransform:"uppercase", marginBottom:14 }}>
            On-Chain MEV Intelligence · Solana Mainnet
          </div>

          <h1 style={{
            fontFamily:"var(--serif)", fontSize:"clamp(36px,8vw,64px)", fontWeight:300,
            lineHeight:1.05, letterSpacing:"-0.03em", marginBottom:16,
          }}>
            How much have<br/>
            <em style={{ fontStyle:"italic", color:"var(--gold)" }}>bots stolen</em><br/>
            from you?
          </h1>

          <p style={{ fontSize:14, color:"var(--muted)", fontWeight:300, maxWidth:500, lineHeight:1.8, marginBottom:36 }}>
            Paste your Solana wallet. We pull your full swap history via{" "}
            <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--blue-l)" }}>Dune SIM</span>,
            detect every sandwich attack, calculate dollar losses, and generate a forensic damage report narrated by Claude AI.
          </p>

          {/* Input */}
          <div style={{ border:"1px solid var(--border)", display:"flex", marginBottom:12 }}>
            <input
              type="text" value={wallet} placeholder="Enter Solana wallet address…"
              onChange={e => setWallet(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runAudit(false)}
              style={{ flex:1, background:"var(--input)", border:"none", color:"var(--text)", fontFamily:"var(--mono)", fontSize:11, padding:"15px 16px", outline:"none", letterSpacing:"0.03em" }}
            />
            <button
              onClick={() => runAudit(false)}
              disabled={loading || !wallet.trim()}
              style={{
                background: loading || !wallet.trim() ? "var(--dim)" : "var(--gold)",
                color: loading || !wallet.trim() ? "var(--muted)" : "#060504",
                border:"none", fontFamily:"var(--mono)", fontSize:10, fontWeight:700,
                letterSpacing:"0.12em", textTransform:"uppercase", padding:"15px 22px",
                cursor: loading || !wallet.trim() ? "not-allowed" : "pointer", whiteSpace:"nowrap",
              }}
            >{loading ? "Scanning…" : "Run Audit →"}</button>
          </div>

          <button onClick={() => runAudit(true)} disabled={loading} style={{
            background:"none", border:"1px solid var(--border)", color:"var(--muted)",
            fontFamily:"var(--mono)", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase",
            padding:"8px 16px", cursor:"pointer",
          }}>◈ Try demo wallet</button>

          {error && (
            <div style={{ marginTop:16, padding:"12px 16px", border:"1px solid var(--red-b)", background:"var(--red-d)", fontFamily:"var(--mono)", fontSize:10, color:"var(--red)" }}>
              ⚠ {error}
            </div>
          )}

          {/* Stats strip */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", borderTop:"1px solid var(--border)", marginTop:56, paddingTop:24 }}>
            {[
              { val:"$370M+", label:"Extracted from Solana users"  },
              { val:"0.72%",  label:"Of blocks contain sandwiches" },
              { val:"100%",   label:"Of your swaps are at risk"    },
            ].map((s,i) => (
              <div key={i} style={{ textAlign:"center", borderRight: i < 2 ? "1px solid var(--border)" : "none", padding:"0 12px" }}>
                <div style={{ fontFamily:"var(--serif)", fontSize:"clamp(22px,4vw,28px)", fontWeight:300, color:"var(--gold)", lineHeight:1, marginBottom:5 }}>{s.val}</div>
                <div style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--muted)", letterSpacing:"0.08em", lineHeight:1.5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {timedOut && loading && (
          <div style={{ maxWidth:820, margin:"0 auto", padding:"0 clamp(20px,4vw,48px)" }}>
            <div style={{ border:"1px solid rgba(200,134,10,.25)", background:"rgba(200,134,10,.05)", padding:"12px 18px", fontFamily:"var(--mono)", fontSize:10, color:"var(--gold)", letterSpacing:"0.08em", display:"flex", alignItems:"center", gap:10 }}>
              <span>⚠</span>
              Verification is taking longer than usual — fetching block data for multiple attacks. Hang tight, this is real on-chain verification.
            </div>
          </div>
        )}

        {loading && (
          <div style={{ maxWidth:820, margin:"0 auto", padding:"0 clamp(20px,4vw,48px)" }}>
            <LoadingScreen wallet={wallet}/>
          </div>
        )}

        {/* ── Report ──────────────────────────────────────────────────────── */}
        {report && !loading && (
          <section ref={reportRef} style={{ maxWidth:820, margin:"0 auto", padding:"0 clamp(20px,4vw,48px) 80px" }}>

            {/* Report meta bar */}
            <div className="au" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2, paddingBottom:16, borderBottom:"1px solid var(--border)" }}>
              <div>
                <div style={{ fontFamily:"var(--mono)", fontSize:8, letterSpacing:"0.18em", color:"var(--muted)", textTransform:"uppercase", marginBottom:3 }}>
                  Intelligence Report · {new Date(report.generatedAt).toUTCString()}
                </div>
                <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--dim)" }}>
                  {report.wallet}
                  {report.demo && <span style={{ marginLeft:10, color:"var(--gold)", fontSize:8, letterSpacing:"0.12em" }}>[ DEMO MODE ]</span>}
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                {btn(copied ? "✓ Copied" : "Share", share)}
                {btn("Post to X", tweet, { color:"var(--blue-l)", borderColor:"rgba(90,144,240,.3)" })}
              </div>
            </div>

            {S?.attackCount === 0 ? (
              /* Clean wallet */
              <div className="au au1" style={{ border:"1px solid #182418", background:"rgba(45,122,58,.06)", padding:32, textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:12 }}>✓</div>
                <div style={{ fontFamily:"var(--serif)", fontSize:24, color:"var(--green-l)", marginBottom:10 }}>No attacks detected</div>
                <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--muted)", maxWidth:420, margin:"0 auto", lineHeight:1.7 }}>{report.briefing}</div>
              </div>
            ) : (<>

              {/* Stats grid */}
              <div className="au au1" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", border:"1px solid var(--border)", marginBottom:2 }}>
                {[
                  { val:`$${S.totalLossUsd}`, label:"Total Extracted", color:"var(--red)"  },
                  { val: S.attackCount,        label:"Attacks Detected", color:"var(--gold)" },
                  { val:`${S.totalSwaps>0?Math.round((S.attackCount/S.totalSwaps)*100):0}%`, label:"Swaps Targeted", color:"var(--text)" },
                ].map((s,i) => (
                  <div key={i} style={{ padding:"22px 16px", borderRight:"1px solid var(--border)" }}>
                    <div style={{ fontFamily:"var(--serif)", fontSize:"clamp(26px,5vw,38px)", fontWeight:300, color:s.color, lineHeight:1, marginBottom:6 }}>{s.val}</div>
                    <div style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--muted)", letterSpacing:"0.12em", textTransform:"uppercase" }}>{s.label}</div>
                  </div>
                ))}
                <div style={{ padding:"18px 20px", display:"flex", alignItems:"center" }}>
                  <Ring score={S.exposureScore}/>
                </div>
              </div>

              {/* AI Briefing */}
              <div className="au au2" style={{ border:"1px solid var(--border)", borderTop:"none", marginBottom:2 }}>
                <div style={{ padding:"9px 18px", background:"var(--card)", borderBottom:"1px solid var(--b2)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontFamily:"var(--mono)", fontSize:8, letterSpacing:"0.16em", color:"var(--muted)", textTransform:"uppercase" }}>Intelligence Briefing — Claude AI</span>
                  <span style={{ fontFamily:"var(--mono)", fontSize:8, color:"rgba(200,134,10,.5)", letterSpacing:"0.1em" }}>AI</span>
                </div>
                <div style={{ padding:"20px 22px", fontFamily:"var(--serif)", fontSize:15, fontStyle:"italic", lineHeight:1.85, color:"#9a8f80" }}>
                  {report.briefing}
                </div>
              </div>

              {/* Timeline chart */}
              {S.timeline?.length > 0 && (
                <div className="au au2" style={{ border:"1px solid var(--border)", borderTop:"none", marginBottom:2 }}>
                  <BarChart data={S.timeline}/>
                </div>
              )}

              {/* Portfolio Snapshot */}
              <div className="au au2">
                <PortfolioSnapshot portfolio={report.portfolio} total={report.portfolioTotal}/>
              </div>

              {/* Attack table */}
              <div className="au au3" style={{ border:"1px solid var(--border)", borderTop:"none", marginBottom:2 }}>
                <div style={{ padding:"9px 18px", background:"var(--card)", borderBottom:"1px solid var(--b2)" }}>
                  <span style={{ fontFamily:"var(--mono)", fontSize:8, letterSpacing:"0.16em", color:"var(--muted)", textTransform:"uppercase" }}>Attack History</span>
                </div>
                {/* Mobile card layout — stacks on small screens */}
                <div>
                  {S.attacks.map((a,i) => {
                    const sv = SEV[a.severity] || SEV.low;
                    return (
                      <div key={i} style={{ padding:"14px 18px", borderBottom: i < S.attacks.length-1 ? "1px solid #0d0b09":"none" }}>
                        {/* Row 1: date + pair + loss */}
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--muted)" }}>{a.date}</span>
                            <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text)", fontWeight:500 }}>{a.pair}</span>
                          </div>
                          <span style={{ fontFamily:"var(--mono)", fontSize:13, fontWeight:700, color:"var(--red)" }}>−${a.lossUsd?.toFixed(2)}</span>
                        </div>
                        {/* Row 2: slippage + severity badge + verification badge */}
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--gold)" }}>{a.slippagePct?.toFixed(2)}% slippage</span>
                          <span style={{ fontFamily:"var(--mono)", fontSize:7, letterSpacing:"0.1em", textTransform:"uppercase", padding:"2px 7px", background:sv.bg, border:`1px solid ${sv.bd}`, color:sv.tx }}>{a.severity}</span>
                          {a.verificationStatus === "confirmed" && (
                            <span style={{ fontFamily:"var(--mono)", fontSize:7, letterSpacing:"0.1em", textTransform:"uppercase", padding:"2px 6px", background:"rgba(45,122,58,.1)", border:"1px solid rgba(45,122,58,.25)", color:"#5aad6a" }}>✓ confirmed</span>
                          )}
                          {a.verificationStatus === "suspected" && (
                            <span style={{ fontFamily:"var(--mono)", fontSize:7, letterSpacing:"0.1em", textTransform:"uppercase", padding:"2px 6px", background:"rgba(200,134,10,.08)", border:"1px solid rgba(200,134,10,.2)", color:"#c8860a" }}>~ suspected</span>
                          )}
                          {a.verificationStatus === "unverified" && (
                            <span style={{ fontFamily:"var(--mono)", fontSize:7, letterSpacing:"0.1em", textTransform:"uppercase", padding:"2px 6px", background:"rgba(74,74,74,.1)", border:"1px solid rgba(74,74,74,.2)", color:"var(--muted)" }}>? unverified</span>
                          )}
                        </div>
                        {/* Row 3: bot wallet (only if confirmed) */}
                        {a.attacker && (
                          <div style={{ marginTop:6, fontFamily:"var(--mono)", fontSize:9, color:"var(--dim)" }}>
                            Bot: {a.attacker}
                          </div>
                        )}
                        {a.verificationNote && a.confirmed && (
                          <div style={{ marginTop:4, fontFamily:"var(--mono)", fontSize:8, color:"var(--muted)", lineHeight:1.5 }}>{a.verificationNote}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bot leaderboard */}
              {S.attacksByBot?.length > 0 && (
                <div className="au au3" style={{ border:"1px solid var(--border)", borderTop:"none", marginBottom:2 }}>
                  <div style={{ padding:"9px 18px", background:"var(--card)", borderBottom:"1px solid var(--b2)" }}>
                    <span style={{ fontFamily:"var(--mono)", fontSize:8, letterSpacing:"0.16em", color:"var(--muted)", textTransform:"uppercase" }}>Bot Leaderboard</span>
                  </div>
                  {S.attacksByBot.map((b,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", padding:"13px 18px", borderBottom:"1px solid #0d0b09", gap:14 }}>
                      <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--dim)", minWidth:18 }}>#{i+1}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text)", marginBottom:4 }}>{b.address}</div>
                        <div style={{ height:2, background:"var(--border)", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${(b.totalLoss/S.totalLossUsd)*100}%`, background:"var(--red)", transition:"width .8s ease-out" }}/>
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--red)", fontWeight:600 }}>−${b.totalLoss?.toFixed(2)}</div>
                        <div style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--muted)" }}>{b.count} attack{b.count!==1?"s":""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protection plan */}
              <div className="au au4" style={{ border:"1px solid #182418", background:"rgba(7,13,7,.8)", marginBottom:2 }}>
                <div style={{ padding:"9px 18px", borderBottom:"1px solid #111a11" }}>
                  <span style={{ fontFamily:"var(--mono)", fontSize:8, letterSpacing:"0.16em", color:"var(--green-l)", textTransform:"uppercase" }}>◈ Your Protection Plan</span>
                </div>
                {report.protectionPlan?.map((rec,i) => (
                  <div key={i} style={{ display:"flex", gap:14, padding:"13px 18px", borderBottom: i < report.protectionPlan.length-1 ? "1px solid #0d150d" : "none" }}>
                    <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--green-l)", minWidth:18 }}>{String(i+1).padStart(2,"0")}</span>
                    <span style={{ fontSize:13, color:"#5a7a5a", lineHeight:1.65 }}>{rec}</span>
                  </div>
                ))}
              </div>

              {/* SIM Integration strip — always visible */}
              <div className="au au5">
                <SimStrip endpoint={report.simRawResponse?.endpoint}/>
              </div>

              {/* Dev panel — open by default */}
              <div className="au au6">
                <DevPanel simRaw={report.simRawResponse}/>
              </div>

            </>)}
          </section>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!report && !loading && (
          <div style={{ maxWidth:820, margin:"0 auto", padding:"0 clamp(20px,4vw,48px) 80px" }}>
            <div style={{ border:"1px solid var(--border)", padding:"60px 20px", textAlign:"center", color:"var(--dim)", fontFamily:"var(--mono)", fontSize:11, letterSpacing:"0.1em" }}>
              // enter wallet address to run audit
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer style={{ borderTop:"1px solid var(--border)", padding:"18px clamp(20px,4vw,48px)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <span style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--dim)", letterSpacing:"0.14em" }}>SKIMMED — COLOSSEUM FRONTIER 2026</span>
          <span style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--dim)", letterSpacing:"0.1em" }}>DATA: DUNE SIM · NARRATION: CLAUDE AI · CHAIN: SOLANA</span>
        </footer>
      </div>
    </>
  );
}

