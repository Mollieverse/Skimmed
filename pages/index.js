import { useState, useRef } from "react";
import Head from "next/head";

const SEV = {
  critical: { bg:"rgba(196,32,32,.12)",  bd:"rgba(196,32,32,.3)",   tx:"#e04040" },
  high:     { bg:"rgba(196,32,32,.08)",  bd:"rgba(196,32,32,.2)",   tx:"#c42020" },
  medium:   { bg:"rgba(200,134,10,.08)", bd:"rgba(200,134,10,.2)",  tx:"#c8860a" },
};
const CONF = {
  HIGH:   { bg:"rgba(196,32,32,.1)",   bd:"rgba(196,32,32,.25)",   tx:"#e04040" },
  MEDIUM: { bg:"rgba(200,134,10,.08)", bd:"rgba(200,134,10,.22)",  tx:"#c8860a" },
  LOW:    { bg:"rgba(74,74,74,.1)",    bd:"rgba(74,74,74,.25)",    tx:"#6b7280" },
};

// ── Ticker ────────────────────────────────────────────────────────────────────
function Ticker() {
  const [priceStr, setPriceStr] = useState("Loading live prices…");
  useState(() => {
    fetch("https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263,JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN")
      .then(r => r.json()).then(d => {
        const fmt  = p => p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(6)}`;
        const parts = [
          d["So11111111111111111111111111111111111111112"]?.usdPrice   && `SOL ${fmt(d["So11111111111111111111111111111111111111112"].usdPrice)}`,
          d["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"]?.usdPrice && `USDC ${fmt(d["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"].usdPrice)}`,
          d["DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"]?.usdPrice && `BONK ${fmt(d["DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"].usdPrice)}`,
          d["JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"]?.usdPrice  && `JUP ${fmt(d["JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"].usdPrice)}`,
        ].filter(Boolean);
        if (parts.length) setPriceStr(parts.join(" · "));
      }).catch(() => setPriceStr("SOL · USDC · BONK · JUP"));
  }, []);
  const content = `${priceStr} &nbsp;·&nbsp; $370M+ MEV extracted on Solana &nbsp;·&nbsp; SKIMMED — Forensic MEV Intelligence &nbsp;·&nbsp; ${priceStr} &nbsp;·&nbsp; $370M+ MEV extracted on Solana &nbsp;·&nbsp; SKIMMED`;
  return (
    <div style={{overflow:"hidden",whiteSpace:"nowrap",borderBottom:"1px solid var(--border)",padding:"6px 0",background:"var(--card)"}}>
      <span style={{display:"inline-block",animation:"ticker 32s linear infinite",fontFamily:"var(--mono)",fontSize:13,color:"var(--muted)",letterSpacing:"0.06em"}}
        dangerouslySetInnerHTML={{__html:content}}/>
    </div>
  );
}

// ── Risk Ring ─────────────────────────────────────────────────────────────────
function Ring({ score }) {
  const r=34, circ=2*Math.PI*r;
  const c   = score>=70?"#c42020":score>=40?"#c8860a":"#2d7a3a";
  const lbl = score>=70?"CRITICAL":score>=40?"ELEVATED":"LOW";
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <svg width={84} height={84} viewBox="0 0 84 84" style={{transform:"rotate(-90deg)"}}>
        <circle cx={42} cy={42} r={r} fill="none" stroke="#1e1a15" strokeWidth={5}/>
        <circle cx={42} cy={42} r={r} fill="none" stroke={c} strokeWidth={5}
          strokeDasharray={`${circ*(score/100)} ${circ}`} strokeLinecap="butt"
          style={{transition:"stroke-dasharray 1s ease-out"}}/>
      </svg>
      <div style={{marginTop:-72,display:"flex",flexDirection:"column",alignItems:"center"}}>
        <span style={{fontFamily:"var(--mono)",fontSize:20,fontWeight:700,color:c,lineHeight:1}}>{score}</span>
        <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--muted)",letterSpacing:"0.1em"}}>/100</span>
      </div>
      <div style={{marginTop:32,fontFamily:"var(--mono)",fontSize:9,letterSpacing:"0.12em",textTransform:"uppercase",
        padding:"2px 8px",color:c,
        background:`rgba(${score>=70?"196,32,32":score>=40?"200,134,10":"45,122,58"},.08)`,
        border:`1px solid rgba(${score>=70?"196,32,32":score>=40?"200,134,10":"45,122,58"},.22)`}}>
        {lbl}
      </div>
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ data }) {
  if (!data?.length) return null;
  const max   = Math.max(...data.map(d => d.loss), 1);
  const total = data.reduce((s,d) => s + d.loss, 0);
  return (
    <div style={{padding:"18px 20px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:20}}>
        <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>Monthly MEV Loss</span>
        <span style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--red)",fontWeight:600}}>${total.toFixed(2)} total</span>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:8,height:80,marginBottom:12}}>
        {data.map((d,i) => {
          const h = Math.max(4,(d.loss/max)*64);
          const isMax = d.loss === max;
          return (
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
              <span style={{fontFamily:"var(--mono)",fontSize:10,color:isMax?"var(--red)":"var(--muted)",fontWeight:isMax?600:400}}>${d.loss}</span>
              <div style={{width:"100%",minHeight:4,height:`${h}px`,
                background:isMax?"linear-gradient(to top,#c42020,rgba(196,32,32,.5))":"linear-gradient(to top,rgba(196,32,32,.65),rgba(196,32,32,.2))",
                position:"relative"}}>
                {isMax&&<div style={{position:"absolute",top:-1,left:0,right:0,height:2,background:"var(--red)"}}/>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {data.map((d,i)=>(
          <div key={i} style={{flex:1,textAlign:"center"}}>
            <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--dim)"}}>{d.label.split(" ")[0].slice(0,3)}</div>
            <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--border)"}}>{d.count}x</div>
          </div>
        ))}
      </div>
      <div style={{borderTop:"1px solid var(--b2)",paddingTop:14,display:"flex",flexDirection:"column",gap:10}}>
        {data.map((d,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:8,height:8,background:d.loss===max?"var(--red)":"rgba(196,32,32,.35)"}}/>
              <span style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--text)"}}>{d.label}</span>
            </div>
            <div style={{display:"flex",gap:16,alignItems:"center"}}>
              <span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)"}}>{d.count} event{d.count!==1?"s":""}</span>
              <span style={{fontFamily:"var(--mono)",fontSize:13,fontWeight:600,color:d.loss===max?"var(--red)":"var(--text)"}}>−${d.loss.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Portfolio ─────────────────────────────────────────────────────────────────
function Portfolio({ portfolio, total }) {
  const [imgErrors, setImgErrors] = useState({});
  if (!portfolio?.length) return (
    <div style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2,padding:"24px 18px",textAlign:"center"}}>
      <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Portfolio Snapshot</div>
      <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--dim)"}}>No token balances found for this wallet</div>
    </div>
  );
  return (
    <div style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2}}>
      <div style={{padding:"11px 18px",background:"var(--card)",borderBottom:"1px solid var(--b2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>Portfolio Snapshot</span>
        <span style={{fontFamily:"var(--mono)",fontSize:15,color:"var(--gold)",fontWeight:600}}>${total?.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>
      {portfolio.filter(Boolean).map((t,i)=>{
        const symbol  = t?.symbol  || "TOKEN";
        const name    = t?.name    || "Unknown";
        const display = t?.display ?? (t?.amount != null ? String(t.amount) : "0");
        const price   = Number(t?.price)    || 0;
        const value   = Number(t?.valueUsd) || 0;
        const mint    = t?.mint    || `unknown-${i}`;
        const logo    = t?.logoURI;
        return (
          <div key={mint+i} style={{display:"flex",alignItems:"center",padding:"14px 18px",borderBottom:i<portfolio.length-1?"1px solid #0d0b09":"none",gap:14}}>
            <div style={{width:44,height:44,borderRadius:"50%",overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
              background:logo&&!imgErrors[mint]?"#1a1a1a":"linear-gradient(135deg,#2a1f00,#1a1200)",
              border:logo&&!imgErrors[mint]?"1px solid var(--border)":"1px solid rgba(200,134,10,.3)"}}>
              {logo&&!imgErrors[mint]?(
                <img src={logo} alt={symbol} width={44} height={44} style={{objectFit:"cover",width:"100%",height:"100%"}}
                  onError={()=>setImgErrors(e=>({...e,[mint]:true}))}/>
              ):(
                <span style={{fontFamily:"var(--mono)",fontSize:11,fontWeight:700,color:"var(--gold)",textTransform:"uppercase",letterSpacing:"0.05em"}}>
                  {String(symbol).slice(0,3)}
                </span>
              )}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"var(--mono)",fontSize:15,color:"var(--text)",fontWeight:500}}>{symbol}</div>
              <div style={{fontFamily:"var(--sans)",fontSize:13,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
            </div>
            <div style={{textAlign:"right",minWidth:80}}>
              <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--text)"}}>{display}</div>
              <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)"}}>@ ${price>=1?price.toFixed(2):price.toFixed(6)}</div>
            </div>
            <div style={{textAlign:"right",minWidth:80}}>
              <div style={{fontFamily:"var(--mono)",fontSize:15,fontWeight:600,color:value>100?"var(--gold)":"var(--text)"}}>
                ${value.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Dev Panel ─────────────────────────────────────────────────────────────────
function DevPanel({ simRaw }) {
  const [open,setOpen] = useState(true);
  if (!simRaw) return null;
  const json = JSON.stringify(simRaw,null,2);
  const isMev = l => l.includes("mev_flagged")||l.includes("_mev");
  const colorize = l => l
    .replace(/"([^"]+)":/g,(_,k)=>`<span style="color:#86efac">"${k}"</span>:`)
    .replace(/: "([^"]*)"/g,(_,v)=>`: <span style="color:#fbbf24">"${v}"</span>`)
    .replace(/: (true|false)/g,(_,v)=>`: <span style="color:#f472b6">${v}</span>`)
    .replace(/: null/g,`: <span style="color:#6b7280">null</span>`)
    .replace(/: (-?\d+\.?\d*)/g,(_,n)=>`: <span style="color:#60a5fa">${n}</span>`);
  return (
    <div style={{border:"1px solid var(--border)",marginBottom:2}}>
      <div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"12px 16px",background:"var(--card)",borderBottom:open?"1px solid var(--b2)":"none",cursor:"pointer",userSelect:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--blue-l)",textTransform:"uppercase"}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"var(--blue-l)",animation:"pulse 2s ease-in-out infinite"}}/>
          Dune SIM · Raw API Response
        </div>
        <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--dim)"}}>{open?"[ collapse ]":"[ expand ]"}</span>
      </div>
      {open&&(<>
        <div style={{padding:"9px 16px",background:"#080604",borderBottom:"1px solid var(--b2)",fontFamily:"var(--mono)",fontSize:11}}>
          <span style={{color:"var(--gold)"}}>GET</span>
          <span style={{color:"var(--muted)",margin:"0 5px"}}>→</span>
          <span style={{color:"var(--blue-l)"}}>{simRaw?.endpoint}</span>
          <span style={{float:"right",color:"#2d7a3a"}}>200 OK</span>
        </div>
        <div style={{padding:"12px 14px",background:"#050402",maxHeight:320,overflowY:"auto",fontFamily:"var(--mono)",fontSize:11,lineHeight:1.75}}>
          {json.split("\n").map((line,i)=>(
            <div key={i} style={{background:isMev(line)?"rgba(196,32,32,.05)":"transparent",
              borderLeft:isMev(line)?"2px solid rgba(196,32,32,.3)":"2px solid transparent",paddingLeft:5}}
              dangerouslySetInnerHTML={{__html:colorize(line)}}/>
          ))}
        </div>
        <div style={{padding:"7px 14px",background:"var(--card)",borderTop:"1px solid var(--b2)",display:"flex",justifyContent:"space-between"}}>
          <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)"}}>MEV-FLAGGED FIELDS HIGHLIGHTED</span>
          <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--dim)"}}>{simRaw?.transactions_count||0} TXS · {simRaw?.mev_flagged||0} FLAGGED</span>
        </div>
      </>)}
    </div>
  );
}

// ── SIM Strip ─────────────────────────────────────────────────────────────────
function SimStrip({ endpoint }) {
  return (
    <div style={{border:"1px solid rgba(90,144,240,.22)",background:"rgba(30,77,183,.05)",padding:"14px 18px",marginBottom:2}}>
      <div style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--blue-l)",textTransform:"uppercase",marginBottom:12}}>
        ◈ Dune SIM — How It Powers This Report
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
        {[
          {step:"01",label:"Wallet Input",    desc:"Address sent to SIM API"},
          {step:"02",label:"SIM Fetches TXs", desc:"GET /v1/svm/transactions"},
          {step:"03",label:"Swaps Filtered",  desc:"DEX programs identified"},
          {step:"04",label:"MEV Flagged",     desc:"Excess slippage detected"},
        ].map((s,i)=>(
          <div key={i} style={{background:"rgba(30,77,183,.06)",border:"1px solid rgba(90,144,240,.1)",padding:"9px 11px"}}>
            <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--blue-l)",marginBottom:3,letterSpacing:"0.1em"}}>{s.step} · {s.label}</div>
            <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)"}}>{s.desc}</div>
          </div>
        ))}
      </div>
      {endpoint&&<div style={{fontFamily:"var(--mono)",fontSize:11,color:"rgba(90,144,240,.45)",wordBreak:"break-all"}}>
        <span style={{color:"var(--gold)"}}>GET</span> <span style={{color:"var(--blue-l)"}}>{endpoint}</span>
      </div>}
    </div>
  );
}

// ── Share Card (Canvas PNG) ───────────────────────────────────────────────────
function generateShareCard(summary, briefing) {
  const canvas  = document.createElement("canvas");
  canvas.width  = 1200;
  canvas.height = 630;
  const ctx     = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#060504";
  ctx.fillRect(0,0,1200,630);

  // Gold top line
  ctx.fillStyle = "#c8860a";
  ctx.fillRect(0,0,1200,4);

  // Red bottom line
  ctx.fillStyle = "#c42020";
  ctx.fillRect(0,626,1200,4);

  // SKIMMED wordmark
  ctx.fillStyle = "#e8dfd0";
  ctx.font = "300 64px Georgia,serif";
  ctx.fillText("SKIMMED",80,110);

  // Subtitle
  ctx.fillStyle = "#5a5248";
  ctx.font = "400 20px 'Courier New',monospace";
  ctx.fillText("MEV LOSS REPORT  ·  SOLANA WALLET ANALYSIS",80,148);

  // Divider
  ctx.fillStyle = "#1e1a15";
  ctx.fillRect(80,168,1040,1);

  // Total loss — dominant number
  const lossDisplay = `$${summary.totalLossUsd?.toFixed(2) || "0.00"}`;
  ctx.fillStyle = "#c42020";
  ctx.font = "300 108px Georgia,serif";
  ctx.fillText(lossDisplay,80,310);

  ctx.fillStyle = "#5a5248";
  ctx.font = "400 20px 'Courier New',monospace";
  ctx.fillText("ESTIMATED MEV EXTRACTION",80,348);

  // Stats
  const stats = [
    {label:"SANDWICH PATTERNS", value:String(summary.attackCount||0)},
    {label:"EXPOSURE RATE",     value:summary.exposureRate||"N/A"},
    {label:"RISK SCORE",        value:`${summary.riskScore||0}/100`},
    {label:"HIGH CONFIDENCE",   value:`${summary.confidenceBreakdown?.high||0}`},
  ];
  stats.forEach((s,i)=>{
    const x = 80 + i*280;
    ctx.fillStyle = "#e8dfd0";
    ctx.font = "700 36px 'Courier New',monospace";
    ctx.fillText(s.value,x,460);
    ctx.fillStyle = "#5a5248";
    ctx.font = "400 15px 'Courier New',monospace";
    ctx.fillText(s.label,x,488);
  });

  // Divider
  ctx.fillStyle = "#1e1a15";
  ctx.fillRect(80,510,1040,1);

  // Footer
  ctx.fillStyle = "#2a2520";
  ctx.font = "400 17px 'Courier New',monospace";
  ctx.fillText("Generated by SKIMMED  ·  skimmed.vercel.app  ·  Powered by Dune SIM + Claude AI",80,560);

  return canvas.toDataURL("image/png");
}

// ── Loading Screen ────────────────────────────────────────────────────────────
function LoadingScreen({ wallet }) {
  const [step,setStep] = useState(0);
  const steps = [
    {label:"Connecting to Dune SIM…",       tag:"SIM"},
    {label:"Fetching Solana swap history…",  tag:"SIM"},
    {label:"Running MEV detection engine…",  tag:"MEV"},
    {label:"Calculating losses…",            tag:"MEV"},
    {label:"Generating AI briefing…",        tag:"AI"},
  ];
  useState(()=>{
    const t=setInterval(()=>setStep(s=>Math.min(s+1,steps.length-1)),700);
    return()=>clearInterval(t);
  },[]);
  const tagColor={SIM:"var(--blue-l)",MEV:"var(--red)",AI:"var(--gold)"};
  return (
    <div style={{textAlign:"center",padding:"70px 20px"}}>
      <div style={{fontFamily:"var(--serif)",fontSize:16,fontStyle:"italic",color:"var(--muted)",marginBottom:28}}>
        Auditing {wallet.slice(0,8)}…{wallet.slice(-6)}
      </div>
      <div style={{border:"1px solid rgba(90,144,240,.2)",background:"rgba(30,77,183,.05)",padding:"12px 16px",marginBottom:32,textAlign:"left"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"var(--blue-l)",animation:"pulse 1s ease-in-out infinite"}}/>
          <span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--blue-l)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Dune SIM · Live Call</span>
        </div>
        <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)",wordBreak:"break-all"}}>
          <span style={{color:"var(--gold)"}}>GET</span> https://api.sim.dune.com/v1/svm/transactions/{wallet.slice(0,8)}…
        </div>
      </div>
      <div style={{display:"flex",gap:3,justifyContent:"center",marginBottom:32}}>
        {steps.map((_,i)=><div key={i} style={{width:3,height:24,background:i<=step?"var(--gold)":"var(--dim)",transition:"background .3s"}}/>)}
      </div>
      {steps.map((s,i)=>(
        <div key={i} style={{fontFamily:"var(--mono)",fontSize:13,letterSpacing:"0.06em",marginBottom:10,
          display:"flex",alignItems:"center",justifyContent:"center",gap:10,
          color:i<step?"var(--green-l)":i===step?"var(--text)":"var(--dim)",transition:"color .3s"}}>
          <span style={{color:i<step?"var(--green-l)":i===step?"var(--gold)":"var(--dim)"}}>{i<step?"✓":i===step?"→":"○"}</span>
          {s.label}
          {i<=step&&<span style={{fontFamily:"var(--mono)",fontSize:10,padding:"1px 7px",
            background:`rgba(${s.tag==="SIM"?"30,77,183":s.tag==="MEV"?"196,32,32":"200,134,10"},.1)`,
            color:tagColor[s.tag],letterSpacing:"0.08em"}}>{s.tag}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Skimmed() {
  const [wallet,   setWallet]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [report,   setReport]   = useState(null);
  const [error,    setError]    = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [sharing,  setSharing]  = useState(false);
  const reportRef = useRef(null);

  const runAudit = async (demo=false) => {
    const addr = demo ? "HHDnDH9BUb3oEgGQ5bXjJXVDtusuF9jhLQ8qgpkSWLSV" : wallet.trim();
    if (!addr) return;
    if (demo) setWallet(addr);
    setLoading(true); setReport(null); setError(null); setTimedOut(false);
    try {
      const warn = setTimeout(()=>setTimedOut(true),20000);
      const res  = await fetch("/api/audit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({address:addr})});
      clearTimeout(warn);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Audit failed");
      setReport(data);
      setTimeout(()=>reportRef.current?.scrollIntoView({behavior:"smooth"}),120);
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDownloadCard = () => {
    if (!report) return;
    setSharing(true);
    try {
      const dataUrl = generateShareCard(report.summary, report.briefing);
      const link    = document.createElement("a");
      link.download = "skimmed-mev-report.png";
      link.href     = dataUrl;
      link.click();
    } catch(e) { console.error(e); }
    finally { setSharing(false); }
  };

  const handleTweet = () => {
    const text = report?.tweetText || `Check your Solana wallet for MEV exposure: https://skimmed.vercel.app`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,"_blank");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?wallet=${wallet}`)
      .then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };

  const S = report?.summary;

  const outBtn = {background:"none",border:"1px solid var(--border)",color:"var(--muted)",
    fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",
    padding:"8px 14px",cursor:"pointer"};

  return (
    <>
      <Head>
        <title>SKIMMED — Solana MEV Damage Report</title>
        <meta name="description" content="See how much MEV bots have extracted from your Solana swaps. Powered by Dune SIM + Claude AI."/>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔴</text></svg>"/>
      </Head>

      <div style={{minHeight:"100vh",background:"var(--bg)",position:"relative",zIndex:1}}>
        <Ticker/>

        {/* Header */}
        <header style={{borderBottom:"1px solid var(--border)",padding:"0 clamp(16px,4vw,48px)",
          display:"flex",alignItems:"center",justifyContent:"space-between",height:56,
          position:"sticky",top:0,background:"rgba(6,5,4,.97)",backdropFilter:"blur(12px)",zIndex:100}}>
          <div style={{fontFamily:"var(--serif)",fontSize:24,fontWeight:300,letterSpacing:"-0.02em"}}>SKIMMED</div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontFamily:"var(--mono)",fontSize:11,color:"var(--blue-l)",letterSpacing:"0.1em"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"var(--blue-l)",animation:"pulse 2s ease-in-out infinite"}}/>
              DUNE SIM
            </div>
            <div style={{width:1,height:14,background:"var(--border)"}}/>
            <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--dim)",letterSpacing:"0.08em"}}>SOLANA · SVM</span>
          </div>
        </header>

        {/* Hero */}
        <section style={{padding:"64px clamp(16px,4vw,48px) 48px",maxWidth:820,margin:"0 auto"}}>
          <div style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.16em",color:"var(--muted)",textTransform:"uppercase",marginBottom:14}}>
            Forensic MEV Intelligence · Solana Mainnet
          </div>
          <h1 style={{fontFamily:"var(--serif)",fontSize:"clamp(36px,8vw,64px)",fontWeight:300,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:16}}>
            How much have<br/>
            <em style={{fontStyle:"italic",color:"var(--gold)"}}>bots extracted</em><br/>
            from you?
          </h1>
          <p style={{fontSize:16,color:"var(--muted)",fontWeight:300,maxWidth:500,lineHeight:1.8,marginBottom:36}}>
            Paste your Solana wallet. We pull your swap history via{" "}
            <span style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--blue-l)"}}>Dune SIM</span>,
            detect MEV patterns, calculate losses using live prices, and generate a forensic report narrated by Claude AI.
          </p>

          <div style={{border:"1px solid var(--border)",display:"flex",marginBottom:12}}>
            <input type="text" value={wallet} placeholder="Enter Solana wallet address…"
              onChange={e=>setWallet(e.target.value)} onKeyDown={e=>e.key==="Enter"&&runAudit(false)}
              style={{flex:1,background:"var(--input)",border:"none",color:"var(--text)",
                fontFamily:"var(--mono)",fontSize:14,padding:"16px 16px",outline:"none",letterSpacing:"0.03em"}}/>
            <button onClick={()=>runAudit(false)} disabled={loading||!wallet.trim()}
              style={{background:loading||!wallet.trim()?"var(--dim)":"var(--gold)",
                color:loading||!wallet.trim()?"var(--muted)":"#060504",border:"none",
                fontFamily:"var(--mono)",fontSize:13,fontWeight:700,letterSpacing:"0.1em",
                textTransform:"uppercase",padding:"16px 22px",
                cursor:loading||!wallet.trim()?"not-allowed":"pointer",whiteSpace:"nowrap"}}>
              {loading?"Scanning…":"Run Audit →"}
            </button>
          </div>

          <button onClick={()=>runAudit(true)} disabled={loading}
            style={{background:"none",border:"1px solid var(--border)",color:"var(--muted)",
              fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",
              padding:"10px 18px",cursor:"pointer"}}>
            ◈ Try demo wallet
          </button>

          {error&&(
            <div style={{marginTop:16,padding:"13px 16px",border:"1px solid var(--red-b)",background:"var(--red-d)",
              fontFamily:"var(--mono)",fontSize:13,color:"var(--red)"}}>⚠ {error}</div>
          )}

          {/* Stats strip */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderTop:"1px solid var(--border)",marginTop:56,paddingTop:24}}>
            {[
              {val:"$370M+", label:"MEV extracted from Solana users"},
              {val:"0.72%",  label:"Of blocks contain sandwich activity"},
              {val:"3-tier", label:"Confidence verification system"},
            ].map((s,i)=>(
              <div key={i} style={{textAlign:"center",borderRight:i<2?"1px solid var(--border)":"none",padding:"0 10px"}}>
                <div style={{fontFamily:"var(--serif)",fontSize:"clamp(20px,4vw,28px)",fontWeight:300,color:"var(--gold)",lineHeight:1,marginBottom:5}}>{s.val}</div>
                <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",letterSpacing:"0.06em",lineHeight:1.5}}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Timeout warning */}
        {timedOut&&loading&&(
          <div style={{maxWidth:820,margin:"0 auto",padding:"0 clamp(16px,4vw,48px)"}}>
            <div style={{border:"1px solid rgba(200,134,10,.25)",background:"rgba(200,134,10,.05)",padding:"13px 18px",
              fontFamily:"var(--mono)",fontSize:13,color:"var(--gold)",display:"flex",alignItems:"center",gap:10}}>
              <span>⚠</span> Taking longer than usual — fetching and analyzing your swap history. Please wait.
            </div>
          </div>
        )}

        {loading&&<div style={{maxWidth:820,margin:"0 auto",padding:"0 clamp(16px,4vw,48px)"}}><LoadingScreen wallet={wallet}/></div>}

        {/* Report */}
        {report&&!loading&&(
          <section ref={reportRef} style={{maxWidth:820,margin:"0 auto",padding:"0 clamp(16px,4vw,48px) 80px"}}>

            {/* Meta bar */}
            <div className="au" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:4,paddingBottom:16,borderBottom:"1px solid var(--border)",gap:12,flexWrap:"wrap"}}>
              <div>
                <div style={{fontFamily:"var(--mono)",fontSize:11,letterSpacing:"0.12em",color:"var(--muted)",textTransform:"uppercase",marginBottom:4}}>
                  Intelligence Report · {new Date(report.generatedAt).toUTCString()}
                </div>
                <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--dim)",wordBreak:"break-all"}}>{report.wallet}</div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={copyLink} style={outBtn}>{copied?"✓ Copied":"Copy Link"}</button>
                <button onClick={handleDownloadCard} disabled={sharing} style={{...outBtn,color:"var(--gold)",borderColor:"rgba(200,134,10,.3)"}}>
                  {sharing?"Generating…":"⬇ Share Card"}
                </button>
                <button onClick={handleTweet} style={{...outBtn,color:"var(--blue-l)",borderColor:"rgba(90,144,240,.3)"}}>Post to X</button>
              </div>
            </div>

            {S?.attackCount===0?(
              <div className="au au1" style={{border:"1px solid #182418",background:"rgba(45,122,58,.06)",padding:32,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:12}}>✓</div>
                <div style={{fontFamily:"var(--serif)",fontSize:24,color:"var(--green-l)",marginBottom:10}}>No MEV patterns detected</div>
                <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--muted)",maxWidth:440,margin:"0 auto",lineHeight:1.7}}>{report.briefing}</div>
              </div>
            ):(<>

              {/* KPI grid */}
              <div className="au au1" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",border:"1px solid var(--border)",marginBottom:2}}>
                {[
                  {val:`$${S.totalLossUsd?.toFixed(2)}`, label:"Total Extracted",   color:"var(--red)"},
                  {val:S.attackCount,                     label:"MEV Events",         color:"var(--gold)"},
                  {val:S.exposureRate,                    label:"Swaps Targeted",     color:"var(--text)"},
                ].map((s,i)=>(
                  <div key={i} style={{padding:"20px 16px",borderRight:"1px solid var(--border)"}}>
                    <div style={{fontFamily:"var(--serif)",fontSize:"clamp(24px,5vw,38px)",fontWeight:300,color:s.color,lineHeight:1,marginBottom:6}}>{s.val}</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",letterSpacing:"0.1em",textTransform:"uppercase"}}>{s.label}</div>
                  </div>
                ))}
                <div style={{padding:"18px 20px",display:"flex",alignItems:"center"}}><Ring score={S.riskScore}/></div>
              </div>

              {/* Confidence badges */}
              <div className="au au1" style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2,padding:"12px 18px",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Confidence:</span>
                {[
                  {key:"HIGH",   count:S.confidenceBreakdown?.high,   ...CONF.HIGH},
                  {key:"MEDIUM", count:S.confidenceBreakdown?.medium, ...CONF.MEDIUM},
                  {key:"LOW",    count:S.confidenceBreakdown?.low,    ...CONF.LOW},
                ].filter(c=>c.count>0).map(c=>(
                  <span key={c.key} style={{fontFamily:"var(--mono)",fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",
                    padding:"3px 10px",background:c.bg,border:`1px solid ${c.bd}`,color:c.tx}}>
                    {c.count} {c.key}
                  </span>
                ))}
              </div>

              {/* AI Briefing */}
              <div className="au au2" style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2}}>
                <div style={{padding:"10px 18px",background:"var(--card)",borderBottom:"1px solid var(--b2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>Intelligence Briefing — Claude AI</span>
                  <span style={{fontFamily:"var(--mono)",fontSize:10,color:"rgba(200,134,10,.5)"}}>AI</span>
                </div>
                <div style={{padding:"20px 22px",fontFamily:"var(--serif)",fontSize:16,fontStyle:"italic",lineHeight:1.85,color:"#9a8f80"}}>{report.briefing}</div>
              </div>

              {/* Monthly timeline */}
              {S.timeline?.length>0&&(
                <div className="au au2" style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2}}>
                  <BarChart data={S.timeline}/>
                </div>
              )}

              {/* Portfolio */}
              <div className="au au2">
                <Portfolio portfolio={report.portfolio} total={report.portfolioTotal}/>
              </div>

              {/* Attack cards */}
              <div className="au au3" style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2}}>
                <div style={{padding:"10px 18px",background:"var(--card)",borderBottom:"1px solid var(--b2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>Attack History</span>
                  <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--red)",padding:"2px 9px",background:"rgba(196,32,32,.08)",border:"1px solid rgba(196,32,32,.2)"}}>{S.attackCount} events</span>
                </div>
                {S.attacks?.map((a,i)=>{
                  const cs=CONF[a.confidence]||CONF.LOW;
                  const ss=SEV[a.severity]||SEV.medium;
                  return (
                    <div key={i} style={{padding:"16px 18px",borderBottom:i<S.attacks.length-1?"1px solid #0d0b09":"none"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                          <span style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--muted)"}}>{a.date}</span>
                          <span style={{fontFamily:"var(--mono)",fontSize:14,color:"var(--text)",fontWeight:500}}>{a.pair}</span>
                          <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--dim)"}}>{a.dexLabel}</span>
                        </div>
                        <span style={{fontFamily:"var(--mono)",fontSize:17,fontWeight:700,color:"var(--red)",whiteSpace:"nowrap"}}>−${a.lossUsd?.toFixed(2)}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                        <span style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",padding:"3px 9px",background:cs.bg,border:`1px solid ${cs.bd}`,color:cs.tx}}>
                          {a.confidence} CONFIDENCE
                        </span>
                        <span style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",padding:"3px 9px",background:ss.bg,border:`1px solid ${ss.bd}`,color:ss.tx}}>
                          {a.severity}
                        </span>
                        <span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--gold)"}}>{a.slippagePct?.toFixed(2)}% excess slippage</span>
                      </div>
                      <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--dim)",fontStyle:"italic"}}>{a.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Bot leaderboard */}
              {S.attacksByBot?.length>0&&(
                <div className="au au3" style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2}}>
                  <div style={{padding:"10px 18px",background:"var(--card)",borderBottom:"1px solid var(--b2)"}}>
                    <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>Bot Leaderboard</span>
                  </div>
                  {S.attacksByBot.map((b,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",padding:"14px 18px",borderBottom:"1px solid #0d0b09",gap:14}}>
                      <span style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--dim)",minWidth:22}}>#{i+1}</span>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--text)",marginBottom:4}}>{b.address}</div>
                        <div style={{height:2,background:"var(--border)",overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${(b.totalLoss/S.totalLossUsd)*100}%`,background:"var(--red)",transition:"width .8s ease-out"}}/>
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontFamily:"var(--mono)",fontSize:14,color:"var(--red)",fontWeight:600}}>−${b.totalLoss?.toFixed(2)}</div>
                        <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)"}}>{b.count} attack{b.count!==1?"s":""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protection plan */}
              <div className="au au4" style={{border:"1px solid #182418",background:"rgba(7,13,7,.8)",marginBottom:2}}>
                <div style={{padding:"10px 18px",borderBottom:"1px solid #111a11"}}>
                  <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--green-l)",textTransform:"uppercase"}}>◈ Your Protection Plan</span>
                </div>
                {report.protectionPlan?.map((rec,i)=>(
                  <div key={i} style={{display:"flex",gap:14,padding:"14px 18px",borderBottom:i<report.protectionPlan.length-1?"1px solid #0d150d":"none"}}>
                    <span style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--green-l)",minWidth:22}}>{String(i+1).padStart(2,"0")}</span>
                    <span style={{fontSize:15,color:"#5a7a5a",lineHeight:1.65}}>{rec}</span>
                  </div>
                ))}
              </div>

              {/* Share card section */}
              <div className="au au4" style={{border:"1px solid var(--border)",marginBottom:2,padding:"20px 18px"}}>
                <div style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase",marginBottom:14}}>
                  📤 Share Your Report
                </div>
                <div style={{background:"#0a0806",border:"1px solid var(--border)",padding:"16px 18px",marginBottom:14,
                  fontFamily:"var(--mono)",fontSize:13,color:"var(--text)",lineHeight:1.7,whiteSpace:"pre-line"}}>
                  {report.tweetText}
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={handleDownloadCard} disabled={sharing} style={{
                    flex:1,background:"var(--gold)",color:"#060504",border:"none",
                    fontFamily:"var(--mono)",fontSize:13,fontWeight:700,letterSpacing:"0.1em",
                    textTransform:"uppercase",padding:"14px",cursor:"pointer"}}>
                    {sharing?"Generating…":"⬇ Download Share Card"}
                  </button>
                  <button onClick={handleTweet} style={{
                    flex:1,background:"none",border:"1px solid rgba(90,144,240,.3)",color:"var(--blue-l)",
                    fontFamily:"var(--mono)",fontSize:13,fontWeight:700,letterSpacing:"0.1em",
                    textTransform:"uppercase",padding:"14px",cursor:"pointer"}}>
                    Post to X →
                  </button>
                </div>
              </div>

              {/* SIM strip */}
              <div className="au au5"><SimStrip endpoint={report.simRawResponse?.endpoint}/></div>

              {/* Dev panel */}
              <div className="au au6"><DevPanel simRaw={report.simRawResponse}/></div>

            </>)}
          </section>
        )}

        {!report&&!loading&&(
          <div style={{maxWidth:820,margin:"0 auto",padding:"0 clamp(16px,4vw,48px) 80px"}}>
            <div style={{border:"1px solid var(--border)",padding:"60px 20px",textAlign:"center",
              color:"var(--dim)",fontFamily:"var(--mono)",fontSize:13,letterSpacing:"0.1em"}}>
              // enter wallet address to run audit
            </div>
          </div>
        )}

        <footer style={{borderTop:"1px solid var(--border)",padding:"18px clamp(16px,4vw,48px)",
          display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--dim)",letterSpacing:"0.1em"}}>SKIMMED — COLOSSEUM FRONTIER 2026</span>
          <span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--dim)",letterSpacing:"0.06em"}}>DATA: DUNE SIM · PRICES: JUPITER · NARRATION: CLAUDE AI</span>
        </footer>
      </div>
    </>
  );
}
