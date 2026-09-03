import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Satellite, Radio, Upload, Play,
  CheckCircle2, Circle, Download, GitCompare, Eye, Loader2,
  FileStack, Crosshair, Activity, AlertTriangle,
  X, ImagePlus, RadarIcon, Brain, Cpu, Search, Merge, BarChart3, Zap,
  RefreshCw, MapPin, Clock,
} from "lucide-react";
import { classifyInput, validateImages, runSpecialistModel, generateSummary } from "./gemini.js";
import MarkdownRenderer from "./components/MarkdownRenderer.jsx";

const C = {
  bg: "#0B0F18", surface: "#0E1520", panel: "#111827", panelAlt: "#0D1320",
  raised: "#151F2E", border: "#1C2A3A", borderLit: "#243444",
  text: "#EDF2F7", dim: "#8899AA", faint: "#3D5068",
  optical: "#F0A847", sar: "#38BDF8", change: "#F472B6",
  good: "#4ADE80", warn: "#FBBF24", err: "#F87171",
};
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const sans = { fontFamily: "'Inter', 'Space Grotesk', sans-serif" };

const TASK_META = {
  SINGLE_VQA:        { label: "Single-Image VQA",      color: C.optical, icon: Eye,        specialist: "RS-VQA",             inputBadge: "SINGLE · OPTICAL/SAR" },
  SINGLE_CAPTION:    { label: "Scene Captioning",       color: C.optical, icon: Eye,        specialist: "RS-Captioning",      inputBadge: "SINGLE · OPTICAL/SAR" },
  SINGLE_GROUNDING:  { label: "Region Grounding",       color: C.sar,     icon: Crosshair,  specialist: "Grounding Model",    inputBadge: "SINGLE · OPTICAL/SAR" },
  CROSS_MODAL:       { label: "Optical–SAR Fusion",     color: C.sar,     icon: Radio,      specialist: "Optical–SAR Fusion", inputBadge: "PAIR · OPTICAL + SAR" },
  BITEMPORAL_CHANGE: { label: "Bi-temporal Change VQA", color: C.change,  icon: GitCompare, specialist: "Change-VQA",         inputBadge: "BI-TEMPORAL · T1/T2" },
};

const INPUT_TYPE_META = {
  "single":      { label: "Single Image",       color: C.optical, icon: Eye },
  "cross-modal": { label: "Optical + SAR Pair", color: C.sar,     icon: Radio },
  "bi-temporal": { label: "Bi-temporal Pair",   color: C.change,  icon: GitCompare },
};

function buildSteps(taskType) {
  const icons  = [Brain, CheckCircle2, Search, Cpu, Merge, BarChart3];
  const labels = ["Parse query & classify task","Validate input images","Select specialist model","Execute specialist workflow","Fuse outputs & score confidence","Return evidence-grounded response"];
  const details = {
    SINGLE_VQA:        ["Intent → single-image VQA","1 image · format OK · bands validated","Routing to RS-VQA (BigEarthNet-adapted)","Running vision-language inference","Aligning answer with pixel evidence","Answer + confidence ready"],
    SINGLE_CAPTION:    ["Intent → scene description","1 image · format OK","Routing to RS-Captioning model","Generating scene description","Scoring land-cover evidence","Caption + confidence ready"],
    SINGLE_GROUNDING:  ["Intent → region grounding","1 image · format OK","Routing to Grounding Model (VRSBench)","Localising named region","Computing bounding evidence","Grounded region + confidence ready"],
    CROSS_MODAL:       ["Intent → optical–SAR fusion","2 images · co-registered · footprint OK","Routing to Optical–SAR Fusion model","Extracting per-modality features","Reconciling optical vs SAR evidence","Fused answer ready"],
    BITEMPORAL_CHANGE: ["Intent → change-based VQA","2 images · T1/T2 · co-registered","Routing to Change-VQA (CDVQA-adapted)","Running change inference","Combining spatial + textual evidence","Change map + answer ready"],
  };
  const d = details[taskType] || details.SINGLE_VQA;
  return labels.map((label, i) => ({ id: i, icon: icons[i], label, detail: d[i] }));
}

function SectionLabel({ children }) {
  return <div style={{ ...mono, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: C.faint, marginBottom: 10 }}>{children}</div>;
}

function Pill({ label, color }) {
  return (
    <span style={{ ...mono, fontSize: 10, color, background: `${color}14`, border: `1px solid ${color}33`, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function ConfidenceMeter({ value }) {
  const color = value >= 85 ? C.good : value >= 70 ? C.optical : C.warn;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
      <div style={{ flex: 1, height: 4, background: C.raised, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 2, transition: "width .6s ease" }} />
      </div>
      <span style={{ ...mono, fontSize: 12, color, fontWeight: 600, minWidth: 36 }}>{value}%</span>
    </div>
  );
}

function MissionClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  const p = (n) => String(n).padStart(2, "0");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <Clock size={11} color={C.faint} />
      <span style={{ ...mono, color: C.dim, fontSize: 11 }}>{p(t.getUTCHours())}:{p(t.getUTCMinutes())}:{p(t.getUTCSeconds())} UTC</span>
    </div>
  );
}

function ImageThumb({ file, label, color }) {
  const url = URL.createObjectURL(file);
  return (
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${color}33`, flex: 1, minWidth: 0 }}>
      <img src={url} alt={label} style={{ width: "100%", height: 88, objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.7))", padding: "4px 7px" }}>
        <span style={{ ...mono, fontSize: 9, color }}>{label}</span>
      </div>
    </div>
  );
}

export default function Console() {
  const [files, setFiles]                   = useState([]);
  const [query, setQuery]                   = useState("");
  const [dragging, setDragging]             = useState(false);
  const [phase, setPhase]                   = useState("idle");
  const [activeStep, setActiveStep]         = useState(-1);
  const [steps, setSteps]                   = useState(buildSteps("SINGLE_VQA"));
  const [classification, setClassification] = useState(null);
  const [validation, setValidation]         = useState(null);
  const [answer, setAnswer]                 = useState(null);
  const [summary, setSummary]               = useState(null);
  const [errorMsg, setErrorMsg]             = useState("");
  const [stepDetails, setStepDetails]       = useState({});
  const [reducedMotion]                     = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const fileInputRef = useRef();

  const addFiles = useCallback((newFiles) => {
    const ok = ["tif","tiff","png","jpg","jpeg"];
    const filtered = newFiles.filter(f => ok.includes(f.name.split(".").pop().toLowerCase()));
    setFiles(prev => [...prev, ...filtered].slice(0, 2));
  }, []);

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));
  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }, [addFiles]);

  const reset = () => {
    setPhase("idle"); setActiveStep(-1); setClassification(null);
    setValidation(null); setAnswer(null); setSummary(null);
    setErrorMsg(""); setStepDetails({});
    setSteps(buildSteps("SINGLE_VQA"));
  };

  const runQuery = async () => {
    if (!query.trim() || files.length === 0) return;
    if (!import.meta.env.VITE_GEMINI_API_KEY) { setErrorMsg("No VITE_GEMINI_API_KEY found in .env"); setPhase("error"); return; }
    reset();
    await new Promise(r => setTimeout(r, 50));
    setPhase("classifying"); setActiveStep(0);
    try {
      setStepDetails(d => ({ ...d, 0: "Analysing query intent and image count…" }));
      const clf = await classifyInput(query, files.length);
      setClassification(clf);
      const builtSteps = buildSteps(clf.taskType);
      setSteps(builtSteps);
      setStepDetails(d => ({ ...d, 0: builtSteps[0].detail }));

      setActiveStep(1);
      setStepDetails(d => ({ ...d, 1: "Checking formats and compatibility…" }));
      await new Promise(r => setTimeout(r, 400));
      const val = await validateImages(files, clf.taskType);
      setValidation(val);
      setStepDetails(d => ({ ...d, 1: builtSteps[1].detail }));

      setActiveStep(2);
      setStepDetails(d => ({ ...d, 2: builtSteps[2].detail }));
      await new Promise(r => setTimeout(r, 500));

      setPhase("running"); setActiveStep(3);
      setStepDetails(d => ({ ...d, 3: "Sending to vision model…" }));
      const ans = await runSpecialistModel(query, files, clf.taskType, (msg) => { setStepDetails(d => ({ ...d, 3: msg })); });
      setAnswer(ans);
      setStepDetails(d => ({ ...d, 3: builtSteps[3].detail }));

      setActiveStep(4); setStepDetails(d => ({ ...d, 4: builtSteps[4].detail }));
      await new Promise(r => setTimeout(r, 500));
      setActiveStep(5); setStepDetails(d => ({ ...d, 5: builtSteps[5].detail }));
      await new Promise(r => setTimeout(r, 400));

      const sum = await generateSummary(clf.taskType, clf.specialist, query, ans, val);
      setSummary(sum); setPhase("done");
    } catch (err) { console.error(err); setErrorMsg((err.message || "Unknown error").replace(/gemini|google|generative.?ai/gi, "VLM")); setPhase("error"); }
  };

  const taskMeta   = classification ? TASK_META[classification.taskType] : null;
  const inputColor = classification ? (INPUT_TYPE_META[classification.detectedInputType]?.color || C.optical) : C.dim;
  const busy       = phase === "classifying" || phase === "running";

  return (
    <div id="console" style={{ background: C.bg, ...sans, minHeight: "100vh" }}>
      <style>{`
        #console * { box-sizing: border-box; }
        #console textarea:focus { border-color: ${C.borderLit} !important; outline: none; }
        .cspin { animation: cspin 1s linear infinite; }
        @keyframes cspin { to { transform: rotate(360deg); } }
        .cfade { animation: cfade .35s ease forwards; }
        @keyframes cfade { from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)} }
        .cspulse { animation: ${reducedMotion ? "none" : "cspulse 1.1s ease-in-out infinite"}; }
        @keyframes cspulse { 0%,100%{box-shadow:0 0 0 0 ${C.change}33}50%{box-shadow:0 0 0 6px ${C.change}00} }
        @media(max-width:1180px){.cgrid{grid-template-columns:300px 1fr!important}.cright{display:none!important}}
        @media(max-width:800px){.cgrid{grid-template-columns:1fr!important}}
      `}</style>

      {/* top bar */}
      <div style={{ borderBottom:`1px solid ${C.border}`, background:`${C.panelAlt}F0`, backdropFilter:"blur(10px)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:1440, margin:"0 auto", padding:"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:7, background:`linear-gradient(135deg,${C.optical},${C.change})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Satellite size={14} color="#0B0F18" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight:700, fontSize:14, color:C.text }}>SatQuery AI</span>
            <span style={{ ...mono, fontSize:9.5, color:C.faint, border:`1px solid ${C.border}`, padding:"2px 6px", borderRadius:4 }}>console</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background: phase==="error"?C.err:phase==="done"?C.good:busy?C.optical:C.good, display:"inline-block" }} />
              <span style={{ ...mono, fontSize:11, color:C.dim }}>{phase==="error"?"error":phase==="idle"?"ready":phase==="done"?"complete":"processing"}</span>
            </div>
            <MissionClock />
          </div>
        </div>
      </div>

      {/* grid */}
      <div className="cgrid" style={{ maxWidth:1440, margin:"0 auto", padding:"20px 24px 40px", display:"grid", gridTemplateColumns:"320px 1fr 320px", gap:16, alignItems:"start" }}>

        {/* LEFT */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* upload */}
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderBottom:`1px solid ${C.border}`, background:C.panelAlt }}>
              <Upload size={13} color={C.dim} />
              <span style={{ ...mono, fontSize:11, color:C.dim, letterSpacing:0.4 }}>Image input</span>
            </div>
            <div style={{ padding:14 }}>
              <div
                onDragOver={e=>{e.preventDefault();setDragging(true);}}
                onDragLeave={()=>setDragging(false)}
                onDrop={onDrop}
                onClick={()=>fileInputRef.current?.click()}
                style={{ border:`1.5px dashed ${dragging?C.change:files.length?C.borderLit:C.border}`, borderRadius:10, padding:"18px 14px", textAlign:"center", cursor:"pointer", background:dragging?`${C.change}08`:C.panelAlt, marginBottom:10, transition:"border-color .15s ease, background .15s ease" }}
              >
                <ImagePlus size={20} color={C.faint} style={{ margin:"0 auto 8px", display:"block" }} />
                <div style={{ fontSize:12.5, color:C.dim, fontWeight:500 }}>{files.length===0?"Drop images or click to browse":"Drop more or click to add"}</div>
                <div style={{ ...mono, fontSize:10, color:C.faint, marginTop:5 }}>GeoTIFF · TIFF · PNG · JPEG · max 2</div>
                <input ref={fileInputRef} type="file" multiple accept=".tif,.tiff,.png,.jpg,.jpeg" style={{ display:"none" }} onChange={e=>addFiles(Array.from(e.target.files))} />
              </div>
              {files.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                  {files.map((f,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:C.raised, border:`1px solid ${C.border}`, borderRadius:8 }}>
                      <FileStack size={12} color={i===0?C.optical:C.sar} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:11.5, ...mono, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:C.text }}>{f.name}</div>
                        <div style={{ fontSize:10, color:C.faint, marginTop:1 }}>{(f.size/1024).toFixed(0)} KB · {i===0?"Primary":"Secondary"}</div>
                      </div>
                      <button onClick={()=>removeFile(i)} style={{ background:"none", border:"none", cursor:"pointer", color:C.faint, padding:2, display:"flex", borderRadius:4 }} aria-label="Remove">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {files.length > 0 && (
                <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                  {files.map((f,i) => <ImageThumb key={i} file={f} label={files.length===2?(i===0?"T1 / Optical":"T2 / SAR"):"Input image"} color={i===0?C.optical:C.sar} />)}
                </div>
              )}
            </div>
          </div>

          {/* query */}
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderBottom:`1px solid ${C.border}`, background:C.panelAlt }}>
              <Search size={13} color={C.dim} />
              <span style={{ ...mono, fontSize:11, color:C.dim, letterSpacing:0.4 }}>Natural language query</span>
            </div>
            <div style={{ padding:14 }}>
              <textarea value={query} onChange={e=>setQuery(e.target.value)} rows={4}
                placeholder="Describe the land-cover visible in this image, or what changed between T1 and T2?"
                style={{ width:"100%", resize:"none", background:C.panelAlt, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:13, padding:"10px 12px", fontFamily:"'Inter',sans-serif", lineHeight:1.65 }}
              />
              <button onClick={runQuery} disabled={busy||!query.trim()||files.length===0}
                style={{ width:"100%", marginTop:10, padding:"11px 0", borderRadius:8, border:"none", background:busy||!query.trim()||files.length===0?C.raised:C.change, color:busy||!query.trim()||files.length===0?C.faint:"#1a0a14", fontWeight:700, fontSize:13, cursor:busy||!query.trim()||files.length===0?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"background .15s ease", letterSpacing:0.2 }}>
                {busy?<><Loader2 size={14} className="cspin" />Processing…</>:<><Play size={14} fill="currentColor" />Analyse image</>}
              </button>
              {phase==="done" && (
                <button onClick={reset} style={{ width:"100%", marginTop:8, padding:"9px 0", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.dim, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.borderLit} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                  <RefreshCw size={11} /> New query
                </button>
              )}
            </div>
          </div>

          {/* datasets */}
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px" }}>
            <SectionLabel>Training datasets</SectionLabel>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {[["BigEarthNet","domain adapt."],["VRSBench","captioning"],["RSVQA","single-image VQA"],["CDVQA","change VQA"]].map(([n,r]) => (
                <span key={n} title={r} style={{ ...mono, fontSize:10.5, color:C.dim, border:`1px solid ${C.border}`, padding:"4px 9px", borderRadius:5 }}>{n}</span>
              ))}
            </div>
          </div>
        </div>

        {/* CENTRE */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

          {phase==="idle" && (
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:"48px 28px", textAlign:"center" }}>
              <div style={{ width:52, height:52, borderRadius:14, background:`linear-gradient(135deg,${C.optical}22,${C.change}22)`, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px" }}>
                <Satellite size={22} color={C.dim} />
              </div>
              <div style={{ fontSize:17, fontWeight:600, color:C.text, marginBottom:8 }}>Upload imagery and enter a query</div>
              <p style={{ fontSize:13, color:C.dim, lineHeight:1.7, maxWidth:380, margin:"0 auto 24px" }}>
                The agent auto-detects single image, optical+SAR pair, or bi-temporal pair and routes to the right specialist.
              </p>
              <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                {Object.entries(INPUT_TYPE_META).map(([k,v]) => <Pill key={k} label={v.label} color={v.color} />)}
              </div>
            </div>
          )}

          {(classification||phase==="classifying") && (
            <div className="cfade" style={{ background:C.panel, border:`1px solid ${classification?inputColor+"33":C.border}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderBottom:`1px solid ${C.border}`, background:C.panelAlt }}>
                {React.createElement(classification?INPUT_TYPE_META[classification.detectedInputType]?.icon||Eye:Brain, { size:13, color:inputColor })}
                <span style={{ ...mono, fontSize:11, color:C.dim, letterSpacing:0.4 }}>Input type detected</span>
              </div>
              <div style={{ padding:"14px 16px" }}>
                {phase==="classifying"&&!classification && (
                  <div style={{ display:"flex", alignItems:"center", gap:10, color:C.dim, padding:"8px 0" }}>
                    <Loader2 size={15} className="cspin" color={C.change} />
                    <span style={{ fontSize:13 }}>Classifying query and images…</span>
                  </div>
                )}
                {classification && (
                  <div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        {React.createElement(INPUT_TYPE_META[classification.detectedInputType]?.icon||Eye, { size:18, color:inputColor })}
                        <span style={{ fontSize:17, fontWeight:700, color:inputColor }}>{INPUT_TYPE_META[classification.detectedInputType]?.label||classification.detectedInputType}</span>
                        <Pill label={taskMeta?.inputBadge||""} color={inputColor} />
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:24, fontWeight:700, color:inputColor, lineHeight:1 }}>{classification.confidence}%</div>
                        <div style={{ ...mono, fontSize:9.5, color:C.faint, marginTop:2 }}>routing conf.</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:C.raised, borderRadius:8, marginBottom:10 }}>
                      <span style={{ fontSize:12, color:C.dim }}>Task</span>
                      <span style={{ fontSize:12, fontWeight:600, color:taskMeta?.color||C.text }}>{taskMeta?.label}</span>
                      <span style={{ color:C.faint, fontSize:12 }}>→</span>
                      <span style={{ fontSize:12, color:C.dim }}>Specialist</span>
                      <span style={{ ...mono, fontSize:11, color:taskMeta?.color||C.text, fontWeight:600 }}>{classification.specialist}</span>
                    </div>
                    <p style={{ fontSize:12, color:C.dim, lineHeight:1.6, margin:0 }}>{classification.reasoning}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(phase==="running"||phase==="done") && (
            <div className="cfade" style={{ background:C.panel, border:`1px solid ${phase==="done"?C.change+"22":C.border}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, background:C.panelAlt, display:"flex", alignItems:"center", gap:8 }}>
                <Zap size={13} color={C.change} />
                <span style={{ ...mono, fontSize:11, color:C.dim, letterSpacing:0.4 }}>Specialist output</span>
                {phase==="done"&&answer?.modelUsed && (
                  <span style={{ marginLeft:"auto", ...mono, fontSize:10, color:C.sar }}>{answer.modelUsed}</span>
                )}
              </div>
              <div style={{ padding:"18px 20px" }}>
                {busy&&!answer && (
                  <div style={{ display:"flex", alignItems:"center", gap:10, color:C.dim, padding:"24px 0", justifyContent:"center" }}>
                    <Loader2 size={16} className="cspin" color={C.change} />
                    <span style={{ fontSize:13 }}>Running {taskMeta?.specialist||"specialist model"}…</span>
                  </div>
                )}
                {answer && (
                  <div className="cfade">
                    {/* confidence bar */}
                    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:C.raised, borderRadius:8, marginBottom:18 }}>
                      <span style={{ ...mono, fontSize:10.5, color:C.faint, whiteSpace:"nowrap" }}>Confidence</span>
                      <ConfidenceMeter value={answer.confidence} />
                    </div>
                    {/* MARKDOWN RENDERED ANSWER */}
                    <MarkdownRenderer text={answer.text} />
                    {phase==="done"&&summary && (
                      <div style={{ marginTop:20, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
                        <button
                          onClick={()=>{
                            const blob = new Blob([`SatQuery AI — Execution Report\n${"=".repeat(44)}\n\nTask: ${summary.taskSelected}\nSpecialist: ${summary.specialist}\nModel: ${summary.modelUsed||"—"}\nConfidence: ${summary.confidence}%\nTimestamp: ${summary.timestamp}\n\nQuery:\n${summary.queryIntent}\n\nAnswer:\n${answer.text}`],{type:"text/plain"});
                            const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="satquery_report.txt"; a.click();
                          }}
                          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:7, border:`1px solid ${C.border}`, background:C.raised, color:C.dim, fontSize:12, cursor:"pointer" }}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderLit;e.currentTarget.style.color=C.text;}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}
                        >
                          <Download size={12} /> Download report
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {phase==="error" && (
            <div className="cfade" style={{ background:C.panel, border:`1px solid ${C.err}33`, borderRadius:12, padding:"18px 20px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <AlertTriangle size={16} color={C.err} />
                <span style={{ fontSize:14, fontWeight:600, color:C.err }}>Request failed</span>
              </div>
              <p style={{ fontSize:13, color:C.dim, lineHeight:1.65, marginBottom:12 }}>{errorMsg}</p>
              <div style={{ fontSize:12, color:C.faint, lineHeight:1.6 }}>
                Check your API key in <code style={{ fontFamily:"monospace", background:C.raised, padding:"1px 5px", borderRadius:3, color:C.optical }}>.env</code>, or wait a moment — the model may be temporarily overloaded.
              </div>
            </div>
          )}

          {phase==="done"&&summary && (
            <div className="cfade" style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px" }}>
              <SectionLabel>Execution summary</SectionLabel>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                {[["Task",summary.taskSelected,C.optical],["Specialist",summary.specialist,C.sar],["Model",summary.modelUsed||"—",C.change],["Confidence",summary.confidence+"%",C.good],["Datasets",summary.datasetsUsed.length+" sources",C.dim],["Files",summary.inputFiles.length+" uploaded",C.dim]].map(([k,v,color])=>(
                  <div key={k} style={{ background:C.raised, borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ ...mono, fontSize:9.5, color:C.faint, marginBottom:4, textTransform:"uppercase", letterSpacing:0.8 }}>{k}</div>
                    <div style={{ fontSize:12.5, fontWeight:600, color }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...mono, fontSize:11, color:C.faint, lineHeight:1.6 }}><span style={{ color:C.dim }}>Query: </span>{summary.queryIntent}</div>
              <div style={{ ...mono, fontSize:11, color:C.faint, marginTop:4 }}>Outputs: {summary.outputTypes.join(" · ")}</div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="cright" style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderBottom:`1px solid ${C.border}`, background:C.panelAlt }}>
              <Activity size={13} color={busy?C.change:C.dim} />
              <span style={{ ...mono, fontSize:11, color:C.dim, letterSpacing:0.4 }}>Agent execution trace</span>
            </div>
            <div style={{ padding:14, overflowY:"auto", maxHeight:440 }}>
              {phase==="idle" && <div style={{ fontSize:12, color:C.faint, lineHeight:1.7 }}>Waiting for a query. The controller will log every step here.</div>}
              {phase!=="idle" && (
                <div>
                  {steps.map((s,i) => {
                    const Icon = s.icon;
                    const isDone   = activeStep>i||phase==="done";
                    const isActive = activeStep===i&&phase!=="done";
                    const isPending= activeStep<i&&phase!=="done";
                    const detail   = stepDetails[i]||s.detail;
                    return (
                      <div key={s.id} style={{ display:"flex", gap:12, position:"relative", paddingBottom:i===steps.length-1?0:20 }}>
                        {i!==steps.length-1 && <div style={{ position:"absolute", left:9, top:22, bottom:0, width:1, background:isDone?C.change+"66":C.border, transition:"background .3s ease" }} />}
                        <div className={isActive?"cspulse":""} style={{ width:20, height:20, borderRadius:"50%", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center", background:isPending?"transparent":isActive?C.raised:C.change, border:`1.5px solid ${isPending?C.border:C.change}`, transition:"all .25s ease" }}>
                          {isDone   && <CheckCircle2 size={11} color="#1a0a14" />}
                          {isActive && <Circle size={7} color={C.change} fill={C.change} />}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:isActive?600:500, color:isPending?C.faint:C.text, display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                            {!isPending && <Icon size={10} color={isActive?C.change:isDone?C.good:C.faint} />}
                            {s.label}
                          </div>
                          {!isPending && <div style={{ fontSize:10.5, color:C.dim, ...mono, lineHeight:1.5 }}>{detail}</div>}
                          {isDone&&i===0&&classification && <div style={{ marginTop:6 }}><Pill label={`${classification.taskType} · ${classification.confidence}%`} color={C.change} /></div>}
                          {isDone&&i===1&&validation && <div style={{ marginTop:6 }}><Pill label={validation.compatible?"compatible ✓":validation.issues[0]} color={validation.compatible?C.good:C.warn} /></div>}
                          {isDone&&i===2&&classification && <div style={{ marginTop:6 }}><Pill label={classification.specialist} color={taskMeta?.color||C.optical} /></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderBottom:`1px solid ${C.border}`, background:C.panelAlt }}>
              <RadarIcon size={13} color={C.dim} />
              <span style={{ ...mono, fontSize:11, color:C.dim, letterSpacing:0.4 }}>Specialist registry</span>
            </div>
            <div style={{ padding:"6px 0" }}>
              {[
                { name:"RS-VQA",            color:C.optical, tag:"single-image VQA" },
                { name:"RS-Captioning",      color:C.optical, tag:"scene description" },
                { name:"Grounding Model",    color:C.sar,     tag:"region localisation" },
                { name:"Change-VQA",         color:C.change,  tag:"bi-temporal" },
                { name:"Optical–SAR Fusion", color:C.sar,     tag:"cross-modal" },
              ].map((r,idx,arr) => {
                const isActive = classification?.specialist===r.name&&phase!=="idle";
                const isFaded  = classification&&!isActive;
                return (
                  <div key={r.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", borderBottom:idx<arr.length-1?`1px solid ${C.border}`:"none", opacity:isFaded?0.3:1, transition:"opacity .3s ease", background:isActive?`${r.color}08`:"transparent" }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:r.color, flexShrink:0 }} />
                    <span style={{ fontSize:12, fontWeight:500, flex:1, color:isActive?r.color:C.text }}>{r.name}</span>
                    <span style={{ ...mono, fontSize:10, color:r.color, opacity:0.7 }}>{r.tag}</span>
                    {isActive && <span style={{ ...mono, fontSize:9, background:`${r.color}22`, color:r.color, padding:"2px 6px", borderRadius:3, border:`1px solid ${r.color}33` }}>ACTIVE</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop:`1px solid ${C.border}`, background:C.panelAlt }}>
        <div style={{ maxWidth:1440, margin:"0 auto", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <MapPin size={12} color={C.faint} />
            <span style={{ fontSize:11, color:C.dim }}>BigEarthNet · VRSBench · RSVQA · CDVQA · ISRO/SAC Cartosat-2S + RISAT</span>
          </div>
          <span style={{ ...mono, fontSize:10.5, color:C.faint }}>SatQuery AI</span>
        </div>
      </div>
    </div>
  );
}

