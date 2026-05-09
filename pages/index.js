import { useState, useRef } from "react";
import Head from "next/head";

const SEV = {
  critical: { bg:"rgba(239,68,68,.12)",  bd:"rgba(239,68,68,.3)",  tx:"#f87171" },
  high:     { bg:"rgba(239,68,68,.08)",  bd:"rgba(239,68,68,.2)",  tx:"#ef4444" },
  medium:   { bg:"rgba(232,160,32,.08)", bd:"rgba(232,160,32,.2)", tx:"#e8a020" },
};
const CONF = {
  HIGH:   { bg:"rgba(239,68,68,.1)",   bd:"rgba(239,68,68,.25)",  tx:"#f87171" },
  MEDIUM: { bg:"rgba(232,160,32,.08)", bd:"rgba(232,160,32,.22)", tx:"#e8a020" },
  LOW:    { bg:"rgba(168,158,140,.1)", bd:"rgba(168,158,140,.25)",tx:"#a89e8c" },
};

function Logo({ size=28 }) {
  return (
    <img src="/skimmed-logo.png" alt="SKIMMED" width={size} height={size}
      style={{ display:"inline-block", verticalAlign:"middle" }}/>
  );
}

// ── Ticker ────────────────────────────────────────────────────────────────────
function Ticker() {
  const [priceStr, setPriceStr] = useState("Loading live prices…");
  useState(() => {
    fetch("https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263,JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN")
      .then(r=>r.json()).then(d=>{
        const fmt = p => p>=1?`$${p.toFixed(2)}`:`$${p.toFixed(6)}`;
        const parts=[
          d["So11111111111111111111111111111111111111112"]?.usdPrice && `SOL ${fmt(d["So11111111111111111111111111111111111111112"].usdPrice)}`,
          d["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"]?.usdPrice && `USDC ${fmt(d["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"].usdPrice)}`,
          d["DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"]?.usdPrice && `BONK ${fmt(d["DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"].usdPrice)}`,
          d["JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"]?.usdPrice && `JUP ${fmt(d["JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"].usdPrice)}`,
        ].filter(Boolean);
        if(parts.length) setPriceStr(parts.join(" · "));
      }).catch(()=>setPriceStr("SOL · USDC · BONK · JUP"));
  },[]);
  const content=`${priceStr} &nbsp;·&nbsp; $370M+ MEV extracted on Solana &nbsp;·&nbsp; SKIMMED — Forensic MEV Intelligence &nbsp;·&nbsp; ${priceStr}`;
  return (
    <div style={{overflow:"hidden",whiteSpace:"nowrap",borderBottom:"1px solid var(--border)",padding:"7px 0",background:"var(--card)"}}>
      <span style={{display:"inline-block",animation:"ticker 32s linear infinite",fontFamily:"var(--mono)",fontSize:13,color:"var(--muted)",letterSpacing:"0.06em"}}
        dangerouslySetInnerHTML={{__html:content+" &nbsp;·&nbsp; "+content}}/>
    </div>
  );
}

// ── Risk Ring ─────────────────────────────────────────────────────────────────
function Ring({ score }) {
  const r=34, circ=2*Math.PI*r;
  const c=score>=70?"#ef4444":score>=40?"#e8a020":"#4ade80";
  const lbl=score>=70?"CRITICAL":score>=40?"ELEVATED":"LOW";
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <svg width={84} height={84} viewBox="0 0 84 84" style={{transform:"rotate(-90deg)"}}>
        <circle cx={42} cy={42} r={r} fill="none" stroke="#1e1a15" strokeWidth={5}/>
        <circle cx={42} cy={42} r={r} fill="none" stroke={c} strokeWidth={5}
          strokeDasharray={`${circ*(score/100)} ${circ}`} strokeLinecap="butt"
          style={{transition:"stroke-dasharray 1s ease-out"}}/>
      </svg>
      <div style={{marginTop:-72,display:"flex",flexDirection:"column",alignItems:"center"}}>
        <span style={{fontFamily:"var(--mono)",fontSize:22,fontWeight:700,color:c,lineHeight:1}}>{score}</span>
        <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)",letterSpacing:"0.1em"}}>/100</span>
      </div>
      <div style={{marginTop:30,fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",
        padding:"3px 9px",color:c,
        background:`rgba(${score>=70?"239,68,68":score>=40?"232,160,32":"74,222,128"},.1)`,
        border:`1px solid rgba(${score>=70?"239,68,68":score>=40?"232,160,32":"74,222,128"},.25)`}}>
        {lbl}
      </div>
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ data }) {
  if (!data?.length) return null;
  const max=Math.max(...data.map(d=>d.loss),1);
  const total=data.reduce((s,d)=>s+d.loss,0);
  return (
    <div style={{padding:"20px 20px 18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:20}}>
        <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>Monthly MEV Loss</span>
        <span style={{fontFamily:"var(--mono)",fontSize:14,color:"var(--red)",fontWeight:600}}>${total.toFixed(2)} total</span>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:8,height:80,marginBottom:14}}>
        {data.map((d,i)=>{
          const h=Math.max(4,(d.loss/max)*64);
          const isMax=d.loss===max;
          return (
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
              <span style={{fontFamily:"var(--mono)",fontSize:11,color:isMax?"var(--red)":"var(--muted)",fontWeight:isMax?600:400}}>${d.loss.toFixed(2)}</span>
              <div style={{width:"100%",minHeight:4,height:`${h}px`,
                background:isMax?"linear-gradient(to top,#ef4444,rgba(239,68,68,.5))":"linear-gradient(to top,rgba(239,68,68,.65),rgba(239,68,68,.2))",
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
            <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)"}}>{d.label.split(" ")[0].slice(0,3)}</div>
            <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--dim)"}}>{d.count}x</div>
          </div>
        ))}
      </div>
      <div style={{borderTop:"1px solid var(--b2)",paddingTop:14,display:"flex",flexDirection:"column",gap:10}}>
        {data.map((d,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:8,height:8,background:d.loss===max?"var(--red)":"rgba(239,68,68,.35)"}}/>
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
      <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--muted)"}}>No token balances found for this wallet</div>
    </div>
  );
  return (
    <div style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2}}>
      <div style={{padding:"12px 18px",background:"var(--card)",borderBottom:"1px solid var(--b2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>Portfolio Snapshot</span>
        <span style={{fontFamily:"var(--mono)",fontSize:15,color:"var(--gold)",fontWeight:600}}>${total?.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>
      {portfolio.filter(Boolean).map((t,i)=>{
        const symbol=t?.symbol||"TOKEN";
        const name=t?.name||"Unknown";
        const display=t?.display??"0";
        const price=Number(t?.price)||0;
        const value=Number(t?.valueUsd)||0;
        const mint=t?.mint||`unk-${i}`;
        const logo=t?.logoURI;
        return (
          <div key={mint+i} style={{display:"flex",alignItems:"center",padding:"14px 18px",borderBottom:i<portfolio.length-1?"1px solid #0d0b09":"none",gap:14}}>
            <div style={{width:44,height:44,borderRadius:"50%",overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
              background:logo&&!imgErrors[mint]?"#1a1a1a":"linear-gradient(135deg,#3a2a05,#1a1200)",
              border:logo&&!imgErrors[mint]?"1px solid var(--border)":"1px solid rgba(232,160,32,.35)"}}>
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
  const [open,setOpen]=useState(true);
  if(!simRaw) return null;
  const json=JSON.stringify(simRaw,null,2);
  const isMev=l=>l.includes("mev_flagged")||l.includes("_mev");
  const colorize=l=>l
    .replace(/"([^"]+)":/g,(_,k)=>`<span style="color:#86efac">"${k}"</span>:`)
    .replace(/: "([^"]*)"/g,(_,v)=>`: <span style="color:#fbbf24">"${v}"</span>`)
    .replace(/: (true|false)/g,(_,v)=>`: <span style="color:#f472b6">${v}</span>`)
    .replace(/: null/g,`: <span style="color:#a89e8c">null</span>`)
    .replace(/: (-?\d+\.?\d*)/g,(_,n)=>`: <span style="color:#60a5fa">${n}</span>`);
  return (
    <div style={{border:"1px solid var(--border)",marginBottom:2}}>
      <div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"12px 16px",background:"var(--card)",borderBottom:open?"1px solid var(--b2)":"none",cursor:"pointer",userSelect:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--blue-l)",textTransform:"uppercase"}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"var(--blue-l)",animation:"pulse 2s ease-in-out infinite"}}/>
          Dune SIM · Raw API
        </div>
        <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)"}}>{open?"[ collapse ]":"[ expand ]"}</span>
      </div>
      {open&&(<>
        <div style={{padding:"9px 16px",background:"#080604",borderBottom:"1px solid var(--b2)",fontFamily:"var(--mono)",fontSize:11,display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:0,wordBreak:"break-all"}}>
            <span style={{color:"var(--gold)"}}>GET</span>{" "}
            <span style={{color:"var(--blue-l)"}}>{simRaw?.endpoint}</span>
          </div>
          <span style={{color:"#4ade80",flexShrink:0}}>200 OK</span>
        </div>
        <div style={{padding:"12px 14px",background:"#050402",maxHeight:320,overflow:"auto",fontFamily:"var(--mono)",fontSize:11,lineHeight:1.75,whiteSpace:"pre",wordBreak:"break-all"}}>
          {json.split("\n").map((line,i)=>(
            <div key={i} style={{background:isMev(line)?"rgba(239,68,68,.05)":"transparent",
              borderLeft:isMev(line)?"2px solid rgba(239,68,68,.3)":"2px solid transparent",paddingLeft:5}}
              dangerouslySetInnerHTML={{__html:colorize(line)}}/>
          ))}
        </div>
      </>)}
    </div>
  );
}

// ── SIM Strip ─────────────────────────────────────────────────────────────────
function SimStrip({ endpoint }) {
  return (
    <div style={{border:"1px solid rgba(96,165,250,.22)",background:"rgba(30,77,183,.05)",padding:"14px 18px",marginBottom:2}}>
      <div style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--blue-l)",textTransform:"uppercase",marginBottom:12}}>◈ Dune SIM — How It Powers This Report</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
        {[
          {step:"01",label:"Wallet Input",     desc:"Address sent to SIM API"},
          {step:"02",label:"SIM Fetches TXs",  desc:"GET /beta/svm/transactions"},
          {step:"03",label:"Verified Filter",  desc:"Major DEX tokens only"},
          {step:"04",label:"MEV Detection",    desc:"Slippage analysis applied"},
        ].map((s,i)=>(
          <div key={i} style={{background:"rgba(30,77,183,.06)",border:"1px solid rgba(96,165,250,.1)",padding:"9px 11px"}}>
            <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--blue-l)",marginBottom:3,letterSpacing:"0.1em"}}>{s.step} · {s.label}</div>
            <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)"}}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Share Card Generator (Adaptive — leads with most dramatic finding) ────────
async function generateShareCard(report) {
  const summary = report.summary || {};
  const stats   = report.tradingStats || {};
  const habits  = report.badHabits || [];
  const wallet  = report.wallet || "";

  const mevLoss     = Number(summary.totalLossUsd) || 0;
  const tradingPnl  = Number(stats.totalPnl) || 0;
  const tradingLoss = tradingPnl < 0 ? Math.abs(tradingPnl) : 0;
  const totalDamage = mevLoss + tradingLoss;
  const worstHabit  = habits[0] || null;

  // Decide headline framing
  let headline, headlineLabel;
  if (totalDamage > 0) {
    headline      = `-$${totalDamage.toFixed(2)}`;
    headlineLabel = mevLoss > tradingLoss
      ? "ESTIMATED MEV EXTRACTION"
      : tradingLoss > 0
        ? "TOTAL TRADING DAMAGE"
        : "ESTIMATED LOSSES";
  } else if (worstHabit) {
    headline      = worstHabit.title.length > 28 ? worstHabit.title.slice(0,28)+"…" : worstHabit.title;
    headlineLabel = "BEHAVIORAL PATTERN DETECTED";
  } else {
    headline      = "CLEAN";
    headlineLabel = "NO DAMAGE DETECTED";
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#060504";
  ctx.fillRect(0, 0, 1200, 630);

  // Top + bottom accent lines
  ctx.fillStyle = "#e8a020"; ctx.fillRect(0, 0, 1200, 4);
  ctx.fillStyle = totalDamage > 0 ? "#ef4444" : "#4ade80";
  ctx.fillRect(0, 626, 1200, 4);

  // Subtle grain
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.random()*1200, Math.random()*630, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Load logo
  const logo = new Image();
  logo.crossOrigin = "anonymous";
  await new Promise((res) => {
    logo.onload = res; logo.onerror = res;
    logo.src = "/skimmed-logo.png";
  });
  if (logo.complete && logo.naturalWidth) {
    ctx.drawImage(logo, 80, 60, 90, 90);
  }

  // Wordmark + subtitle
  ctx.fillStyle = "#f0e8d8";
  ctx.font = "300 60px Georgia, serif";
  ctx.fillText("SKIMMED", 195, 128);

  ctx.fillStyle = "#a89e8c";
  ctx.font = "400 18px 'Courier New', monospace";
  ctx.fillText("TRADING AUTOPSY · SOLANA WALLET ANALYSIS", 195, 158);

  // Divider
  ctx.fillStyle = "#1e1a15";
  ctx.fillRect(80, 200, 1040, 1);

  // Wallet (truncated)
  ctx.fillStyle = "#a89e8c";
  ctx.font = "400 16px 'Courier New', monospace";
  ctx.fillText(`Wallet: ${wallet.slice(0, 8)}…${wallet.slice(-8)}`, 80, 235);

  // Headline — dynamic color based on what's being shown
  const headlineColor = totalDamage > 0 ? "#ef4444" : worstHabit ? "#e8a020" : "#4ade80";
  ctx.fillStyle = headlineColor;
  ctx.font = totalDamage > 0 ? "300 110px Georgia, serif" : "italic 60px Georgia, serif";
  ctx.fillText(headline, 80, 360);

  ctx.fillStyle = "#a89e8c";
  ctx.font = "400 18px 'Courier New', monospace";
  ctx.fillText(headlineLabel, 80, 393);

  // Stats row — adaptive based on what data exists
  const statsRow = [];

  if (stats.totalTrades > 0) {
    statsRow.push({ label: "CLOSED TRADES", value: String(stats.totalTrades) });
    statsRow.push({ label: "WIN RATE",      value: `${stats.winRate}%`,    color: stats.winRate >= 50 ? "#4ade80" : "#ef4444" });
  }
  if (habits.length > 0) {
    statsRow.push({ label: "BAD HABITS", value: String(habits.length), color: "#ef4444" });
  }
  if (summary.attackCount > 0) {
    statsRow.push({ label: "MEV EVENTS", value: String(summary.attackCount), color: "#ef4444" });
  }
  if (summary.riskScore != null) {
    const riskColor = summary.riskScore >= 70 ? "#ef4444" : summary.riskScore >= 40 ? "#e8a020" : "#4ade80";
    statsRow.push({ label: "RISK SCORE", value: `${summary.riskScore}/100`, color: riskColor });
  }
  // Pad if we have <4 stats
  while (statsRow.length < 4) {
    statsRow.push({ label: "—", value: "—", color: "#5a5248" });
  }
  // Cap at 4
  const display = statsRow.slice(0, 4);

  display.forEach((s, i) => {
    const x = 80 + i * 280;
    ctx.fillStyle = s.color || "#f0e8d8";
    ctx.font = "700 38px 'Courier New', monospace";
    ctx.fillText(s.value, x, 490);
    ctx.fillStyle = "#a89e8c";
    ctx.font = "400 14px 'Courier New', monospace";
    ctx.fillText(s.label, x, 518);
  });

  // Bottom divider
  ctx.fillStyle = "#1e1a15";
  ctx.fillRect(80, 545, 1040, 1);

  // Footer
  ctx.fillStyle = "#5a5248";
  ctx.font = "400 16px 'Courier New', monospace";
  ctx.fillText("Generated by SKIMMED  ·  skimmed.vercel.app  ·  Powered by Dune SIM + Claude AI", 80, 580);

  return canvas.toDataURL("image/png");
}

// ── Loading Screen ────────────────────────────────────────────────────────────
function LoadingScreen({ wallet }) {
  const [step,setStep]=useState(0);
  const steps=[
    {label:"Connecting to Dune SIM…",       tag:"SIM"},
    {label:"Fetching Solana swap history…",  tag:"SIM"},
    {label:"Filtering verified tokens…",     tag:"MEV"},
    {label:"Calculating MEV losses…",        tag:"MEV"},
    {label:"Generating AI briefing…",        tag:"AI"},
  ];
  useState(()=>{
    const t=setInterval(()=>setStep(s=>Math.min(s+1,steps.length-1)),700);
    return()=>clearInterval(t);
  },[]);
  const tagColor={SIM:"var(--blue-l)",MEV:"var(--red)",AI:"var(--gold)"};
  return (
    <div style={{textAlign:"center",padding:"70px 20px"}}>
      <div style={{fontFamily:"var(--serif)",fontSize:17,fontStyle:"italic",color:"var(--muted)",marginBottom:28}}>
        Auditing {wallet.slice(0,8)}…{wallet.slice(-6)}
      </div>
      <div style={{border:"1px solid rgba(96,165,250,.2)",background:"rgba(30,77,183,.05)",padding:"12px 16px",marginBottom:32,textAlign:"left"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"var(--blue-l)",animation:"pulse 1s ease-in-out infinite"}}/>
          <span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--blue-l)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Dune SIM · Live Call</span>
        </div>
        <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)",wordBreak:"break-all",overflow:"hidden"}}>
          <span style={{color:"var(--gold)"}}>GET</span> https://api.sim.dune.com/beta/svm/transactions/{wallet.slice(0,8)}…
        </div>
      </div>
      {steps.map((s,i)=>(
        <div key={i} style={{fontFamily:"var(--mono)",fontSize:13,letterSpacing:"0.06em",marginBottom:10,
          display:"flex",alignItems:"center",justifyContent:"center",gap:10,
          color:i<step?"var(--green-l)":i===step?"var(--text)":"var(--dim)",transition:"color .3s"}}>
          <span style={{color:i<step?"var(--green-l)":i===step?"var(--gold)":"var(--dim)"}}>{i<step?"✓":i===step?"→":"○"}</span>
          {s.label}
          {i<=step&&<span style={{fontFamily:"var(--mono)",fontSize:10,padding:"1px 7px",
            background:`rgba(${s.tag==="SIM"?"96,165,250":s.tag==="MEV"?"239,68,68":"232,160,32"},.1)`,
            color:tagColor[s.tag],letterSpacing:"0.08em"}}>{s.tag}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Skimmed() {
  const [wallet,setWallet]=useState("");
  const [loading,setLoading]=useState(false);
  const [report,setReport]=useState(null);
  const [error,setError]=useState(null);
  const [timedOut,setTimedOut]=useState(false);
  const [copied,setCopied]=useState(false);
  const [sharing,setSharing]=useState(false);
  const reportRef=useRef(null);

  const runAudit=async(demo=false)=>{
    const addr=demo?"AVAZvHLR2PcWpDf8BXY4rVxNHYRBytycHkcB5z5QNXYm":wallet.trim();
    if(!addr) return;
    if(demo) setWallet(addr);
    setLoading(true); setReport(null); setError(null); setTimedOut(false);
    try{
      const warn=setTimeout(()=>setTimedOut(true),20000);
      const res=await fetch("/api/audit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({address:addr})});
      clearTimeout(warn);
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Audit failed");
      setReport(data);
      setTimeout(()=>reportRef.current?.scrollIntoView({behavior:"smooth"}),120);
    }catch(err){ setError(err.message); }
    finally{ setLoading(false); }
  };

  const handleDownloadCard=async()=>{
    if(!report) return;
    setSharing(true);
    try{
      const dataUrl=await generateShareCard(report);
      const link=document.createElement("a");
      link.download="skimmed-mev-report.png";
      link.href=dataUrl;
      link.click();
    }catch(e){ console.error(e); }
    finally{ setSharing(false); }
  };

  const handleTweet=()=>{
    const text=report?.tweetText||`Check your Solana wallet for MEV exposure: https://skimmed.vercel.app`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,"_blank");
  };

  const copyLink=()=>{
    navigator.clipboard.writeText(`${window.location.origin}?wallet=${wallet}`)
      .then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };

  const S=report?.summary;
  const outBtn={background:"none",border:"1px solid var(--border)",color:"var(--muted)",
    fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",
    padding:"9px 15px",cursor:"pointer"};

  return (
    <>
      <Head>
        <title>SKIMMED — Solana MEV Damage Report</title>
        <meta name="description" content="See how much MEV bots have extracted from your Solana swaps. Powered by Dune SIM + Claude AI."/>
        <link rel="icon" href="/skimmed-logo.png"/>
      </Head>

      <div style={{minHeight:"100vh",background:"var(--bg)",position:"relative",zIndex:1,width:"100%",maxWidth:"100vw",overflowX:"hidden"}}>
        <Ticker/>

        <header style={{borderBottom:"1px solid var(--border)",padding:"0 clamp(16px,4vw,48px)",
          display:"flex",alignItems:"center",justifyContent:"space-between",height:60,
          position:"sticky",top:0,background:"rgba(6,5,4,.97)",backdropFilter:"blur(12px)",zIndex:100}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Logo size={32}/>
            <span style={{fontFamily:"var(--serif)",fontSize:24,fontWeight:300,letterSpacing:"-0.02em"}}>SKIMMED</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontFamily:"var(--mono)",fontSize:11,color:"var(--blue-l)",letterSpacing:"0.1em"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"var(--blue-l)",animation:"pulse 2s ease-in-out infinite"}}/>
              DUNE SIM
            </div>
            <div style={{width:1,height:14,background:"var(--border)"}}/>
            <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",letterSpacing:"0.08em"}}>SOLANA · SVM</span>
          </div>
        </header>

        <section style={{padding:"64px clamp(16px,4vw,48px) 48px",maxWidth:820,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
          <div style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.16em",color:"var(--muted)",textTransform:"uppercase",marginBottom:14}}>
            Forensic MEV Intelligence · Solana Mainnet
          </div>
          <h1 style={{fontFamily:"var(--serif)",fontSize:"clamp(40px,8vw,68px)",fontWeight:300,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:18}}>
            How much value gets<br/>
            <em style={{fontStyle:"italic",color:"var(--gold)"}}>skimmed</em>{" "}from your wallet —<br/>
            by bots, and by yourself?
          </h1>
          <p style={{fontSize:17,color:"var(--text)",fontWeight:300,maxWidth:540,lineHeight:1.75,marginBottom:36,opacity:0.9}}>
            Forensic audit of your Solana trading damage.{" "}
            <span style={{fontFamily:"var(--mono)",fontSize:14,color:"var(--blue-l)"}}>Dune SIM</span>{" "}
            pulls your swap history. We detect MEV patterns, calculate PNL, expose bad habits, and Claude AI delivers the autopsy.
          </p>

          <div style={{border:"1px solid var(--border)",display:"flex",marginBottom:12}}>
            <input type="text" value={wallet} placeholder="Enter Solana wallet address…"
              onChange={e=>setWallet(e.target.value)} onKeyDown={e=>e.key==="Enter"&&runAudit(false)}
              style={{flex:1,background:"var(--input)",border:"none",color:"var(--text)",
                fontFamily:"var(--mono)",fontSize:14,padding:"17px 16px",outline:"none",letterSpacing:"0.03em"}}/>
            <button onClick={()=>runAudit(false)} disabled={loading||!wallet.trim()}
              style={{background:loading||!wallet.trim()?"var(--dim)":"var(--gold)",
                color:loading||!wallet.trim()?"var(--muted)":"#060504",border:"none",
                fontFamily:"var(--mono)",fontSize:13,fontWeight:700,letterSpacing:"0.1em",
                textTransform:"uppercase",padding:"17px 22px",
                cursor:loading||!wallet.trim()?"not-allowed":"pointer",whiteSpace:"nowrap"}}>
              {loading?"Scanning…":"Run Audit →"}
            </button>
          </div>

          <button onClick={()=>runAudit(true)} disabled={loading}
            style={{background:"none",border:"1px solid var(--border)",color:"var(--text)",
              fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",
              padding:"11px 18px",cursor:"pointer",opacity:0.8}}>
            ◈ Try demo wallet (Ansem)
          </button>

          {error&&(
            <div style={{marginTop:16,padding:"14px 16px",border:"1px solid var(--red-b)",background:"var(--red-d)",
              fontFamily:"var(--mono)",fontSize:13,color:"var(--red)"}}>⚠ {error}</div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderTop:"1px solid var(--border)",marginTop:56,paddingTop:28}}>
            {[
              {val:"$370M+", label:"MEV extracted from Solana users"},
              {val:"0.72%",  label:"Of blocks contain sandwich activity"},
              {val:"3-tier", label:"Confidence verification system"},
            ].map((s,i)=>(
              <div key={i} style={{textAlign:"center",borderRight:i<2?"1px solid var(--border)":"none",padding:"0 10px"}}>
                <div style={{fontFamily:"var(--serif)",fontSize:"clamp(22px,4vw,32px)",fontWeight:300,color:"var(--gold)",lineHeight:1,marginBottom:6}}>{s.val}</div>
                <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",letterSpacing:"0.06em",lineHeight:1.5}}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {timedOut&&loading&&(
          <div style={{maxWidth:820,margin:"0 auto",padding:"0 clamp(16px,4vw,48px)"}}>
            <div style={{border:"1px solid rgba(232,160,32,.25)",background:"rgba(232,160,32,.05)",padding:"13px 18px",
              fontFamily:"var(--mono)",fontSize:13,color:"var(--gold)",display:"flex",alignItems:"center",gap:10}}>
              <span>⚠</span> Taking longer than usual — fetching swap history. Hang tight.
            </div>
          </div>
        )}

        {loading&&<div style={{maxWidth:820,margin:"0 auto",padding:"0 clamp(16px,4vw,48px)"}}><LoadingScreen wallet={wallet}/></div>}

        {report&&!loading&&(
          <section ref={reportRef} style={{maxWidth:820,margin:"0 auto",padding:"0 clamp(16px,4vw,48px) 80px",width:"100%",boxSizing:"border-box"}}>

            <div className="au" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6,paddingBottom:18,borderBottom:"1px solid var(--border)",gap:12,flexWrap:"wrap"}}>
              <div>
                <div style={{fontFamily:"var(--mono)",fontSize:11,letterSpacing:"0.12em",color:"var(--muted)",textTransform:"uppercase",marginBottom:5}}>
                  Intelligence Report · {new Date(report.generatedAt).toUTCString()}
                </div>
                <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--text)",wordBreak:"break-all",opacity:0.7,maxWidth:"100%"}}>{report.wallet}</div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={copyLink} style={outBtn}>{copied?"✓ Copied":"Copy Link"}</button>
                <button onClick={handleDownloadCard} disabled={sharing} style={{...outBtn,color:"var(--gold)",borderColor:"rgba(232,160,32,.35)"}}>
                  {sharing?"Generating…":"⬇ Share Card"}
                </button>
                <button onClick={handleTweet} style={{...outBtn,color:"var(--blue-l)",borderColor:"rgba(96,165,250,.35)"}}>Post to X</button>
              </div>
            </div>

            {S?.attackCount === 0 && (
              <div className="au au1" style={{border:"1px solid #182418",background:"rgba(74,222,128,.06)",padding:"24px 18px",marginBottom:16,textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:10}}>✓</div>
                <div style={{fontFamily:"var(--serif)",fontSize:22,color:"var(--green-l)",marginBottom:8}}>No MEV patterns detected</div>
                <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--muted)",maxWidth:480,margin:"0 auto",lineHeight:1.7}}>Your swap history shows no MEV exposure. Portfolio and historical data still shown below.</div>
              </div>
            )}

              <div className="au au1" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",border:"1px solid var(--border)",marginBottom:2}}>
                {[
                  {val:`$${S.totalLossUsd?.toFixed(2)}`, label:"Total Extracted",   color:"var(--red)"},
                  {val:S.attackCount,                     label:"MEV Events",         color:"var(--gold)"},
                  {val:S.exposureRate,                    label:"Swaps Targeted",     color:"var(--text)"},
                ].map((s,i)=>(
                  <div key={i} style={{padding:"22px 16px",borderRight:"1px solid var(--border)"}}>
                    <div style={{fontFamily:"var(--serif)",fontSize:"clamp(26px,5vw,40px)",fontWeight:300,color:s.color,lineHeight:1,marginBottom:8}}>{s.val}</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",letterSpacing:"0.1em",textTransform:"uppercase"}}>{s.label}</div>
                  </div>
                ))}
                <div style={{padding:"20px 22px",display:"flex",alignItems:"center"}}><Ring score={S.riskScore}/></div>
              </div>

              <div className="au au1" style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2,padding:"13px 18px",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
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

              <div className="au au2" style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2}}>
                <div style={{padding:"11px 18px",background:"var(--card)",borderBottom:"1px solid var(--b2)"}}>
                  <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>Intelligence Briefing — Claude AI</span>
                </div>
                <div style={{padding:"22px 22px",fontFamily:"var(--serif)",fontSize:18,fontStyle:"italic",lineHeight:1.85,color:"#c8b89a"}}>{report.briefing}</div>
              </div>

              {/* Trading Stats */}
              {report.tradingStats?.totalTrades > 0 && (
                <div className="au au2" style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2}}>
                  <div style={{padding:"11px 18px",background:"var(--card)",borderBottom:"1px solid var(--b2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>Trading Performance</span>
                    <span style={{fontFamily:"var(--mono)",fontSize:12,color:report.tradingStats.totalPnl>=0?"var(--green-l)":"var(--red)",padding:"4px 10px",
                      background:report.tradingStats.totalPnl>=0?"rgba(74,222,128,.08)":"rgba(239,68,68,.08)",
                      border:`1px solid ${report.tradingStats.totalPnl>=0?"rgba(74,222,128,.25)":"rgba(239,68,68,.25)"}`}}>
                      {report.tradingStats.totalPnl>=0?"+":""}${report.tradingStats.totalPnl.toFixed(2)} REALIZED
                    </span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",borderBottom:"1px solid var(--b2)"}}>
                    {[
                      {val:report.tradingStats.totalTrades, label:"Closed Trades"},
                      {val:`${report.tradingStats.winRate}%`, label:"Win Rate", color:report.tradingStats.winRate>=50?"var(--green-l)":"var(--red)"},
                      {val:`${report.tradingStats.avgHoldTime.toFixed(1)}h`, label:"Avg Hold"},
                      {val:`${report.tradingStats.winCount}/${report.tradingStats.lossCount}`, label:"W / L"},
                    ].map((s,i)=>(
                      <div key={i} style={{padding:"18px 10px",borderRight:i<3?"1px solid var(--border)":"none",textAlign:"center"}}>
                        <div style={{fontFamily:"var(--serif)",fontSize:"clamp(22px,5vw,32px)",fontWeight:300,color:s.color||"var(--text)",lineHeight:1.05,marginBottom:8}}>{s.val}</div>
                        <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",letterSpacing:"0.08em",textTransform:"uppercase"}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Best/Worst trades inline */}
                  {(report.tradingStats.bestTrade || report.tradingStats.worstTrade) && (
                    <div style={{display:"grid",gridTemplateColumns:report.tradingStats.bestTrade&&report.tradingStats.worstTrade?"1fr 1fr":"1fr"}}>
                      {report.tradingStats.bestTrade && (
                        <div style={{padding:"14px 18px",borderRight:report.tradingStats.worstTrade?"1px solid var(--border)":"none"}}>
                          <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--green-l)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>◢ Best Trade</div>
                          <div style={{fontFamily:"var(--mono)",fontSize:18,fontWeight:600,color:"var(--green-l)"}}>+${report.tradingStats.bestTrade.pnl.toFixed(2)}</div>
                          <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)",marginTop:4}}>+{report.tradingStats.bestTrade.pnlPct.toFixed(0)}% · held {report.tradingStats.bestTrade.holdHours.toFixed(1)}h</div>
                        </div>
                      )}
                      {report.tradingStats.worstTrade && (
                        <div style={{padding:"14px 18px"}}>
                          <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--red)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>◤ Worst Trade</div>
                          <div style={{fontFamily:"var(--mono)",fontSize:18,fontWeight:600,color:"var(--red)"}}>${report.tradingStats.worstTrade.pnl.toFixed(2)}</div>
                          <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)",marginTop:4}}>{report.tradingStats.worstTrade.pnlPct.toFixed(0)}% · held {report.tradingStats.worstTrade.holdHours.toFixed(1)}h</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Bad Habits */}
              {report.badHabits?.length > 0 && (
                <div className="au au2" style={{border:"1px solid rgba(239,68,68,.25)",borderTop:"none",marginBottom:2,background:"rgba(239,68,68,.03)"}}>
                  <div style={{padding:"11px 18px",background:"rgba(239,68,68,.05)",borderBottom:"1px solid rgba(239,68,68,.2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--red)",textTransform:"uppercase"}}>⚠ Bad Habits Detected</span>
                    <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--red)"}}>{report.badHabits.length} pattern{report.badHabits.length!==1?"s":""}</span>
                  </div>
                  {report.badHabits.map((h,i)=>(
                    <div key={i} style={{padding:"16px 18px",borderBottom:i<report.badHabits.length-1?"1px solid rgba(239,68,68,.1)":"none"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10,flexWrap:"wrap"}}>
                        <div style={{fontFamily:"var(--serif)",fontSize:20,fontStyle:"italic",color:"var(--text)",lineHeight:1.3}}>{h.title}</div>
                        {h.cost!=null && h.cost > 0 && (
                          <span style={{fontFamily:"var(--mono)",fontSize:16,fontWeight:600,color:"var(--red)",whiteSpace:"nowrap"}}>−${h.cost.toFixed(2)}</span>
                        )}
                      </div>
                      <div style={{fontFamily:"var(--mono)",fontSize:13,color:"#c8b89a",lineHeight:1.7,marginBottom:8}}>{h.detail}</div>
                      <span style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",padding:"3px 9px",
                        background:h.severity==="critical"?"rgba(239,68,68,.12)":"rgba(232,160,32,.1)",
                        border:h.severity==="critical"?"1px solid rgba(239,68,68,.3)":"1px solid rgba(232,160,32,.25)",
                        color:h.severity==="critical"?"var(--red)":"var(--gold)"}}>
                        {h.severity}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {S.timeline?.length>0&&(
                <div className="au au2" style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2}}>
                  <BarChart data={S.timeline}/>
                </div>
              )}

              <div className="au au2"><Portfolio portfolio={report.portfolio} total={report.portfolioTotal}/></div>

              {S.attackCount > 0 && <div className="au au3" style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2}}>
                <div style={{padding:"11px 18px",background:"var(--card)",borderBottom:"1px solid var(--b2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>Attack History</span>
                  <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--red)",padding:"3px 9px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)"}}>{S.attackCount} events</span>
                </div>
                {S.attacks?.map((a,i)=>{
                  const cs=CONF[a.confidence]||CONF.LOW;
                  const ss=SEV[a.severity]||SEV.medium;
                  return (
                    <div key={i} style={{padding:"16px 18px",borderBottom:i<S.attacks.length-1?"1px solid #0d0b09":"none"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:8,flexWrap:"wrap"}}>
                        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                          <span style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--muted)"}}>{a.date}</span>
                          <span style={{fontFamily:"var(--mono)",fontSize:14,color:"var(--text)",fontWeight:500}}>{a.pair}</span>
                          <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",opacity:0.75}}>{a.dexLabel}</span>
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
                      <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)",fontStyle:"italic"}}>{a.label}</div>
                    </div>
                  );
                })}
              </div>}

              {S.attacksByBot?.length>0&&(
                <div className="au au3" style={{border:"1px solid var(--border)",borderTop:"none",marginBottom:2}}>
                  <div style={{padding:"11px 18px",background:"var(--card)",borderBottom:"1px solid var(--b2)"}}>
                    <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>Bot Leaderboard</span>
                  </div>
                  {S.attacksByBot.map((b,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",padding:"14px 18px",borderBottom:"1px solid #0d0b09",gap:14}}>
                      <span style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--muted)",minWidth:24}}>#{i+1}</span>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--text)",marginBottom:5}}>{b.address}</div>
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

              <div className="au au4" style={{border:"1px solid #182418",background:"rgba(7,13,7,.8)",marginBottom:2}}>
                <div style={{padding:"11px 18px",borderBottom:"1px solid #111a11"}}>
                  <span style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--green-l)",textTransform:"uppercase"}}>◈ Your Protection Plan</span>
                </div>
                {report.protectionPlan?.map((rec,i)=>(
                  <div key={i} style={{display:"flex",gap:14,padding:"14px 18px",borderBottom:i<report.protectionPlan.length-1?"1px solid #0d150d":"none"}}>
                    <span style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--green-l)",minWidth:22}}>{String(i+1).padStart(2,"0")}</span>
                    <span style={{fontSize:15,color:"#9ec5a3",lineHeight:1.65}}>{rec}</span>
                  </div>
                ))}
              </div>

              <div className="au au4" style={{border:"1px solid var(--border)",marginBottom:2,padding:"20px 18px"}}>
                <div style={{fontFamily:"var(--mono)",fontSize:12,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase",marginBottom:14}}>📤 Share Your Report</div>
                <div style={{background:"#0a0806",border:"1px solid var(--border)",padding:"16px 18px",marginBottom:14,
                  fontFamily:"var(--mono)",fontSize:13,color:"var(--text)",lineHeight:1.7,whiteSpace:"pre-line",opacity:0.9}}>
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
                    flex:1,background:"none",border:"1px solid rgba(96,165,250,.35)",color:"var(--blue-l)",
                    fontFamily:"var(--mono)",fontSize:13,fontWeight:700,letterSpacing:"0.1em",
                    textTransform:"uppercase",padding:"14px",cursor:"pointer"}}>
                    Post to X →
                  </button>
                </div>
              </div>

              <div className="au au5"><SimStrip endpoint={report.simRawResponse?.endpoint}/></div>
              <div className="au au6"><DevPanel simRaw={report.simRawResponse}/></div>

          </section>
        )}

        {!report&&!loading&&(
          <div style={{maxWidth:820,margin:"0 auto",padding:"0 clamp(16px,4vw,48px) 80px"}}>
            <div style={{border:"1px solid var(--border)",padding:"60px 20px",textAlign:"center",
              color:"var(--muted)",fontFamily:"var(--mono)",fontSize:13,letterSpacing:"0.1em"}}>
              // enter wallet address to run audit
            </div>
          </div>
        )}

        <footer style={{borderTop:"1px solid var(--border)",padding:"20px clamp(16px,4vw,48px)",
          display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Logo size={20}/>
            <span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)",letterSpacing:"0.1em"}}>SKIMMED — COLOSSEUM FRONTIER 2026</span>
          </div>
          <span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--muted)",letterSpacing:"0.06em",opacity:0.7}}>DATA: DUNE SIM · PRICES: JUPITER · NARRATION: CLAUDE AI</span>
        </footer>
      </div>
    </>
  );
}

