import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Satellite, Radio, Layers, Upload, Play, ChevronRight,
  CheckCircle2, Circle, Download, GitCompare, Eye, Loader2,
  ScanLine, FileStack, Crosshair, Activity, AlertTriangle,
  X, ImagePlus, RadarIcon, Brain, Cpu, Search, Merge, BarChart3, Zap,
} from "lucide-react";
import { classifyInput, validateImages, runSpecialistModel, generateSummary } from "./gemini.js";

const C = {
  bg: "#0D1520", panel: "#111C28", panelAlt: "#0C1520",
  raised: "#16202E", border: "#1E2A36", borderLit: "#2C3D4C",
  text: "#E7EDF3", dim: "#8996A6", faint: "#4C5A68",
  optical: "#F2A93B", sar: "#4FD1C5", change: "#EF5DA8",
  good: "#6EE7A0", warn: "#FBBF24",
};
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const disp = { fontFamily: "'Space Grotesk', sans-serif" };

const TASK_META = {
  SINGLE_VQA:        { label: "Single-Image VQA",       color: C.optical, icon: Eye,        specialist: "RS-VQA",             inputBadge: "SINGLE Â· OPTICAL/SAR" },
  SINGLE_CAPTION:    { label: "Scene Captioning",        color: C.optical, icon: Eye,        specialist: "RS-Captioning",      inputBadge: "SINGLE Â· OPTICAL/SAR" },
  SINGLE_GROUNDING:  { label: "Region Grounding",        color: C.sar,     icon: Crosshair,  specialist: "Grounding Model",    inputBadge: "SINGLE Â· OPTICAL/SAR" },
  CROSS_MODAL:       { label: "Opticalâ€“SAR Fusion",      color: C.sar,     icon: Radio,      specialist: "Opticalâ€“SAR Fusion", inputBadge: "PAIR Â· OPTICAL + SAR" },
  BITEMPORAL_CHANGE: { label: "Bi-temporal Change VQA",  color: C.change,  icon: GitCompare, specialist: "Change-VQA",         inputBadge: "BI-TEMPORAL Â· T1 / T2" },
};

const INPUT_TYPE_META = {
  "single":      { label: "Single Image",       color: C.optical, icon: Eye },
  "cross-modal": { label: "Optical + SAR Pair", color: C.sar,     icon: Radio },
  "bi-temporal": { label: "Bi-temporal Pair",   color: C.change,  icon: GitCompare },
};

function buildSteps(taskType) {
  const icons   = [Brain, CheckCircle2, Search, Cpu, Merge, BarChart3];
  const labels  = ["Parse query & classify task","Validate input images","Select specialist model","Execute specialist workflow","Fuse outputs & score confidence","Return evidence-grounded response"];
  const details = {
    SINGLE_VQA:        ["Intent â†’ single-image VQA","1 image Â· format OK Â· bands validated","Routing to RS-VQA (BigEarthNet-adapted)","Running vision-language inference","Aligning answer with pixel evidence","Answer + confidence ready"],
    SINGLE_CAPTION:    ["Intent â†’ scene description","1 image Â· format OK","Routing to RS-Captioning model","Generating scene description","Scoring land-cover evidence","Caption + confidence ready"],
    SINGLE_GROUNDING:  ["Intent â†’ region grounding","1 image Â· format OK","Routing to Grounding Model (VRSBench)","Localising named region","Computing bounding evidence","Grounded region + confidence ready"],
    CROSS_MODAL:       ["Intent â†’ opticalâ€“SAR fusion","2 images Â· co-registered Â· footprint OK","Routing to Opticalâ€“SAR Fusion model","Extracting per-modality features","Reconciling optical vs SAR evidence","Fused answer ready"],
    BITEMPORAL_CHANGE: ["Intent â†’ change-based VQA","2 images Â· T1/T2 Â· co-registered","Routing to Change-VQA (CDVQA-adapted)","Running change inference","Combining spatial + textual evidence","Change map + answer ready"],
  };
  const d = details[taskType] || details.SINGLE_VQA;
  return labels.map((label, i) => ({ id: i, icon: icons[i], label, detail: d[i] }));
}

function Panel({ title, icon: Icon, children, flush, style = {} }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column", ...style }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", borderBottom:`1px solid ${C.border}`, background: C.panelAlt }}>
        <Icon size={13} color={C.dim} />
        <span style={{ fontSize:11.5, ...mono, color: C.dim, letterSpacing: 0.3 }}>{title}</span>
      </div>
      <div style={{ padding: flush ? 0 : 14, flex: 1, overflowY:"auto" }}>{children}</div>
    </div>
  );
}

function ImageThumb({ file, label, color }) {
  const url = URL.createObjectURL(file);
  return (
    <div style={{ position:"relative", borderRadius:8, overflow:"hidden", border:`1px solid ${color}44`, flex:1, minWidth:0 }}>
      <img src={url} alt={label} style={{ width:"100%", height:100, objectFit:"cover", display:"block" }} />
      <div style={{ position:"absolute", bottom:6, left:6, ...mono, fontSize:9, background:`${color}22`, border:`1px solid ${color}55`, color, padding:"2px 6px", borderRadius:3 }}>{label}</div>
    </div>
  );
}

function MissionClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(()=>setT(new Date()),1000); return ()=>clearInterval(id); },[]);
  const p = (n) => String(n).padStart(2,"0");
  return <span style={{ ...mono, color:C.dim, fontSize:12 }}>{p(t.getUTCHours())}:{p(t.getUTCMinutes())}:{p(t.getUTCSeconds())} UTC</span>;
}

export default function Console() {
  const [files, setFiles]               = useState([]);
  const [query, setQuery]               = useState("");
  const [dragging, setDragging]         = useState(false);
  const [phase, setPhase]               = useState("idle");
  const [activeStep, setActiveStep]     = useState(-1);
  const [steps, setSteps]               = useState(buildSteps("SINGLE_VQA"));
  const [classification, setClassification] = useState(null);
  const [validation, setValidation]     = useState(null);
  const [answer, setAnswer]             = useState(null);
  const [summary, setSummary]           = useState(null);
  const [errorMsg, setErrorMsg]         = useState("");
  const [stepDetails, setStepDetails]   = useState({});
  const fileInputRef = useRef();

  const addFiles = useCallback((newFiles) => {
    const ok = ["tif","tiff","png","jpg","jpeg"];
    const filtered = newFiles.filter(f => ok.includes(f.name.split(".").pop().toLowerCase()));
    setFiles(prev => [...prev, ...filtered].slice(0,2));
  }, []);

  const removeFile = (i) => setFiles(prev => prev.filter((_,idx) => idx!==i));

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const reset = () => {
    setPhase("idle"); setActiveStep(-1); setClassification(null);
    setValidation(null); setAnswer(null); setSummary(null);
    setErrorMsg(""); setStepDetails({});
    setSteps(buildSteps("SINGLE_VQA"));
  };

  const runQuery = async () => {
    if (!query.trim() || files.length === 0) return;
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setErrorMsg("No VITE_GEMINI_API_KEY found in .env — add your API key there.");
      setPhase("error"); return;
    }
    reset();
    await new Promise(r => setTimeout(r, 50));
    setPhase("classifying"); setActiveStep(0);
    try {
      setStepDetails(d => ({...d, 0:"Analysing query intent and image countâ€¦"}));
      const clf = await classifyInput(query, files.length);
      setClassification(clf);
      const builtSteps = buildSteps(clf.taskType);
      setSteps(builtSteps);
      setStepDetails(d => ({...d, 0: builtSteps[0].detail}));

      setActiveStep(1);
      setStepDetails(d => ({...d, 1:"Checking formats and compatibilityâ€¦"}));
      await new Promise(r => setTimeout(r, 400));
      const val = await validateImages(files, clf.taskType);
      setValidation(val);
      setStepDetails(d => ({...d, 1: builtSteps[1].detail}));

      setActiveStep(2);
      setStepDetails(d => ({...d, 2: builtSteps[2].detail}));
      await new Promise(r => setTimeout(r, 500));

      setPhase("running"); setActiveStep(3);
      setStepDetails(d => ({...d, 3:"Sending to AI vision modelâ€¦"}));
      const ans = await runSpecialistModel(query, files, clf.taskType, (msg) => {
        setStepDetails(d => ({...d, 3: msg}));
      });
      setAnswer(ans);
      setStepDetails(d => ({...d, 3: builtSteps[3].detail}));

      setActiveStep(4);
      setStepDetails(d => ({...d, 4: builtSteps[4].detail}));
      await new Promise(r => setTimeout(r, 500));

      setActiveStep(5);
      setStepDetails(d => ({...d, 5: builtSteps[5].detail}));
      await new Promise(r => setTimeout(r, 400));

      const sum = await generateSummary(clf.taskType, clf.specialist, query, ans, val);
      setSummary(sum);
      setPhase("done");
    } catch(err) {
      console.error(err);
      setErrorMsg(err.message || "Unknown error");
      setPhase("error");
    }
  };

  const taskMeta = classification ? TASK_META[classification.taskType] : null;
  const inputColor = classification ? (INPUT_TYPE_META[classification.detectedInputType]?.color || C.optical) : C.dim;
  const busy = phase === "classifying" || phase === "running";

  return (
    <div id="console" style={{ background: C.bg, ...disp, minHeight: "100vh" }}>
      {/* console top bar */}
      <div style={{ borderBottom:`1px solid ${C.border}`, background:`${C.panelAlt}EE`, backdropFilter:"blur(8px)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:7, background:`linear-gradient(135deg, ${C.optical}, ${C.change})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Satellite size={16} color="#0A0E14" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight:700, fontSize:15 }}>SatQuery AI</span>
            <span style={{ ...mono, fontSize:10, color:C.faint, border:`1px solid ${C.border}`, padding:"2px 7px", borderRadius:4 }}>console Â· v1.0</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background: phase==="error" ? C.warn : C.good, display:"inline-block" }} />
              <span style={{ ...mono, fontSize:11, color:C.dim }}>
                {phase==="error" ? "error" : phase==="idle" ? "ready" : phase==="done" ? "complete" : "processing"}
              </span>
            </div>
            <MissionClock />
          </div>
        </div>
      </div>

      {/* console body */}
      <div style={{ maxWidth:1400, margin:"0 auto", padding:"20px 24px", display:"grid", gridTemplateColumns:"340px 1fr 340px", gap:16, alignItems:"start" }}>

        {/* â”€â”€ LEFT: upload + query â”€â”€ */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Panel title="Image Upload" icon={Upload}>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border:`2px dashed ${dragging ? C.change : files.length ? C.borderLit : C.border}`,
                borderRadius:10, padding:"20px 16px", textAlign:"center", cursor:"pointer",
                background: dragging ? `${C.change}08` : C.panelAlt, marginBottom:12,
                transition:"all .15s ease",
              }}
            >
              <ImagePlus size={22} color={C.faint} style={{ margin:"0 auto 8px" }} />
              <div style={{ fontSize:12.5, color:C.dim }}>
                {files.length === 0 ? "Drop images here or click to browse" : "Drop more or click to add"}
              </div>
              <div style={{ ...mono, fontSize:10, color:C.faint, marginTop:6 }}>GeoTIFF Â· TIFF Â· PNG Â· JPEG Â· max 2 images</div>
              <input ref={fileInputRef} type="file" multiple accept=".tif,.tiff,.png,.jpg,.jpeg" style={{ display:"none" }}
                onChange={e => addFiles(Array.from(e.target.files))} />
            </div>

            {files.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                {files.map((f,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:C.raised, border:`1px solid ${C.border}`, borderRadius:7 }}>
                    <FileStack size={13} color={i===0 ? C.optical : C.sar} />
                    <span style={{ fontSize:12, ...mono, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                    <span style={{ ...mono, fontSize:10, color:C.faint }}>{(f.size/1024).toFixed(0)}KB</span>
                    <button onClick={() => removeFile(i)} style={{ background:"none", border:"none", cursor:"pointer", color:C.faint, display:"flex" }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}

            {files.length > 0 && (
              <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                {files.map((f,i) => (
                  <ImageThumb key={i} file={f}
                    label={files.length===2 ? (i===0?"IMG 1":"IMG 2") : "INPUT"}
                    color={i===0 ? C.optical : C.sar}
                  />
                ))}
              </div>
            )}

            <div style={{ fontSize:11, color:C.faint, marginBottom:6, ...mono }}>natural language query</div>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              rows={4}
              placeholder="e.g. Describe land-cover, or What changed between T1 and T2?"
              style={{
                width:"100%", resize:"none", background:C.panelAlt,
                border:`1px solid ${C.border}`, borderRadius:8,
                color:C.text, fontSize:13, padding:"10px 12px",
                fontFamily:"'Space Grotesk', sans-serif", lineHeight:1.6,
              }}
            />

            <button
              onClick={runQuery}
              disabled={busy || !query.trim() || files.length===0}
              style={{
                width:"100%", marginTop:10, padding:"11px 0", borderRadius:8, border:"none",
                background: busy || !query.trim() || files.length===0 ? C.raised : C.change,
                color: busy || !query.trim() || files.length===0 ? C.faint : "#160A11",
                fontWeight:700, fontSize:13, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                transition:"all .15s ease",
              }}
            >
              {busy ? <><Loader2 size={14} className="spin" />Agent runningâ€¦</> : <><Play size={14} />Run query</>}
            </button>

            {phase==="done" && (
              <button onClick={reset} style={{ width:"100%", marginTop:8, padding:"9px 0", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.dim, fontSize:12, cursor:"pointer" }}>
                Reset
              </button>
            )}
          </Panel>

          {/* datasets */}
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:14 }}>
            <div style={{ fontSize:11, ...mono, color:C.faint, marginBottom:10 }}>adapted datasets</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {[["BigEarthNet","domain adapt."],["VRSBench","captioning/grounding"],["RSVQA","single-image VQA"],["CDVQA","change VQA"]].map(([n,r])=>(
                <div key={n} title={r} style={{ ...mono, fontSize:10, color:C.dim, border:`1px solid ${C.border}`, padding:"4px 8px", borderRadius:5 }}>{n}</div>
              ))}
            </div>
          </div>
        </div>

        {/* â”€â”€ CENTRE: detection + answer â”€â”€ */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* idle state */}
          {phase==="idle" && (
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"40px 24px", textAlign:"center" }}>
              <Satellite size={36} color={C.faint} style={{ margin:"0 auto 16px" }} />
              <div style={{ fontSize:18, fontWeight:600, marginBottom:8 }}>Upload imagery and enter a query</div>
              <p style={{ fontSize:13, color:C.dim, lineHeight:1.6, maxWidth:400, margin:"0 auto" }}>
                The agent auto-detects whether you've provided a single image, an optical+SAR pair, or a
                bi-temporal pair â€” and routes to the right specialist model.
              </p>
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:20, flexWrap:"wrap" }}>
                {Object.entries(INPUT_TYPE_META).map(([k,v]) => (
                  <div key={k} style={{ display:"flex", alignItems:"center", gap:6, ...mono, fontSize:10.5, color:v.color, border:`1px solid ${v.color}33`, padding:"5px 10px", borderRadius:6 }}>
                    {React.createElement(v.icon, { size:12 })} {v.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* classification badge */}
          {(classification || phase==="classifying") && (
            <div className="fade-in" style={{ background:C.panel, border:`1px solid ${classification ? inputColor+"55" : C.border}`, borderRadius:10, padding:"16px 20px" }}>
              <div style={{ fontSize:11, ...mono, color:C.faint, marginBottom:10 }}>input type detected</div>
              {phase==="classifying" && !classification && (
                <div style={{ display:"flex", alignItems:"center", gap:10, color:C.dim }}>
                  <Loader2 size={16} className="spin" color={C.change} />
                  <span style={{ fontSize:13 }}>Analysing query and imagesâ€¦</span>
                </div>
              )}
              {classification && (
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                      {React.createElement(INPUT_TYPE_META[classification.detectedInputType]?.icon || Eye, { size:20, color:inputColor })}
                      <span style={{ fontSize:18, fontWeight:700, color:inputColor }}>
                        {INPUT_TYPE_META[classification.detectedInputType]?.label || classification.detectedInputType}
                      </span>
                      <span style={{ ...mono, fontSize:10, background:`${inputColor}18`, border:`1px solid ${inputColor}44`, color:inputColor, padding:"3px 8px", borderRadius:5 }}>
                        {taskMeta?.inputBadge}
                      </span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontSize:13, color:C.dim }}>Task:</span>
                      <span style={{ fontSize:13, fontWeight:600, color:taskMeta?.color||C.text }}>{taskMeta?.label}</span>
                      <span style={{ fontSize:12, color:C.dim }}>â†’ Specialist:</span>
                      <span style={{ ...mono, fontSize:12, color:taskMeta?.color||C.text }}>{classification.specialist}</span>
                    </div>
                    <div style={{ fontSize:12, color:C.dim, marginTop:6, lineHeight:1.5 }}>{classification.reasoning}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:28, fontWeight:700, color:inputColor }}>{classification.confidence}%</div>
                    <div style={{ ...mono, fontSize:10, color:C.faint }}>routing confidence</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* answer */}
          {(phase==="running" || phase==="done") && (
            <div className="fade-in" style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
              <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, background:C.panelAlt, display:"flex", alignItems:"center", gap:8 }}>
                <Zap size={13} color={C.change} />
                <span style={{ fontSize:11.5, ...mono, color:C.dim }}>specialist output</span>
                {phase==="done" && answer && (
                  <span style={{ marginLeft:"auto", ...mono, fontSize:11, color:C.good }}>confidence {answer.confidence}%</span>
                )}
              </div>
              <div style={{ padding:"16px 20px" }}>
                {busy && !answer && (
                  <div style={{ display:"flex", alignItems:"center", gap:10, color:C.dim, padding:"20px 0" }}>
                    <Loader2 size={16} className="spin" color={C.change} />
                    <span>Running {taskMeta?.specialist || "specialist model"}â€¦</span>
                  </div>
                )}
                {answer && (
                  <div className="fade-in">
                    <pre style={{ fontSize:13.5, color:C.text, lineHeight:1.75, fontFamily:"'Space Grotesk', sans-serif", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                      {answer.text}
                    </pre>
                    {phase==="done" && summary && (
                      <div style={{ marginTop:16, display:"flex", gap:8, flexWrap:"wrap" }}>
                        <button
                          onClick={() => {
                            const blob = new Blob([
                              `SatQuery AI â€” Execution Report\n${"=".repeat(40)}\n\n` +
                              `Task: ${summary.taskSelected}\nSpecialist: ${summary.specialist}\n` +
                              `Confidence: ${summary.confidence}%\nTimestamp: ${summary.timestamp}\n\n` +
                              `Query: ${summary.queryIntent}\n\nAnswer:\n${answer.text}`
                            ], { type:"text/plain" });
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = "satquery_report.txt";
                            a.click();
                          }}
                          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:6, border:`1px solid ${C.border}`, background:"transparent", color:C.dim, fontSize:12, cursor:"pointer" }}
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

          {/* error */}
          {phase==="error" && (
            <div className="fade-in" style={{ background:C.panel, border:`1px solid ${C.warn}44`, borderRadius:10, padding:"16px 20px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <AlertTriangle size={16} color={C.warn} />
                <span style={{ fontSize:14, fontWeight:600, color:C.warn }}>Error</span>
              </div>
              <p style={{ fontSize:13, color:C.dim, lineHeight:1.6 }}>{errorMsg}</p>
            </div>
          )}

          {/* execution summary */}
          {phase==="done" && summary && (
            <div className="fade-in" style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 20px" }}>
              <div style={{ fontSize:11, ...mono, color:C.faint, marginBottom:12 }}>execution summary</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                {[["Task",summary.taskSelected],["Specialist",summary.specialist],["Model used",summary.modelUsed||"—"],["Confidence",summary.confidence+"%"],["Datasets",summary.datasetsUsed.length+" sources"]].map(([k,v])=>(
                  <div key={k} style={{ background:C.raised, borderRadius:7, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, ...mono, color:C.faint, marginBottom:3 }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:10, fontSize:10.5, ...mono, color:C.faint }}>
                Datasets: {summary.datasetsUsed.join(" Â· ")}
              </div>
              <div style={{ marginTop:4, fontSize:10.5, ...mono, color:C.faint }}>
                Outputs: {summary.outputTypes.join(" Â· ")}
              </div>
            </div>
          )}
        </div>

        {/* â”€â”€ RIGHT: agent trace â”€â”€ */}
        <div>
          <Panel title="Agent execution trace" icon={Activity} style={{ minHeight:400 }}>
            {phase==="idle" && (
              <div style={{ fontSize:12, color:C.faint, lineHeight:1.7 }}>
                Waiting for a query. The controller interprets it, validates inputs, picks a
                specialist model, and logs every step here.
              </div>
            )}
            {phase!=="idle" && (
              <div>
                {steps.map((s, i) => {
                  const Icon = s.icon;
                  const isDone = activeStep > i || phase==="done";
                  const isActive = activeStep===i && phase!=="done";
                  const isPending = activeStep < i && phase!=="done";
                  const detail = stepDetails[i] || s.detail;
                  return (
                    <div key={s.id} style={{ display:"flex", gap:12, position:"relative", paddingBottom: i===steps.length-1 ? 0 : 20 }}>
                      {i!==steps.length-1 && (
                        <div style={{ position:"absolute", left:8, top:20, bottom:0, width:1, background: isDone ? C.change : C.border }} />
                      )}
                      <div
                        className={isActive ? "step-pulse" : ""}
                        style={{
                          width:18, height:18, borderRadius:"50%", flexShrink:0, marginTop:1,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          background: isPending ? "transparent" : isActive ? C.raised : C.change,
                          border:`1.5px solid ${isPending ? C.border : C.change}`,
                        }}
                      >
                        {isDone && <CheckCircle2 size={11} color="#160A11" />}
                        {isActive && <Circle size={7} color={C.change} fill={C.change} />}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12.5, color: isPending ? C.faint : C.text, fontWeight: isActive ? 600 : 500, display:"flex", alignItems:"center", gap:6 }}>
                          {!isPending && <Icon size={11} color={isActive ? C.change : isDone ? C.good : C.faint} />}
                          {s.label}
                        </div>
                        {!isPending && (
                          <div style={{ fontSize:11, color:C.dim, marginTop:3, ...mono, lineHeight:1.5 }}>{detail}</div>
                        )}
                        {isDone && i===0 && classification && (
                          <div style={{ marginTop:5, fontSize:10.5, ...mono, color:C.change, background:`${C.change}0F`, border:`1px solid ${C.change}33`, borderRadius:5, padding:"4px 8px" }}>
                            â†’ {classification.taskType} ({classification.confidence}% conf.)
                          </div>
                        )}
                        {isDone && i===1 && validation && (
                          <div style={{ marginTop:5, fontSize:10.5, ...mono, color: validation.compatible ? C.good : C.warn, background:`${validation.compatible ? C.good : C.warn}0F`, border:`1px solid ${validation.compatible ? C.good : C.warn}33`, borderRadius:5, padding:"4px 8px" }}>
                            {validation.files.map(f=>f.name).join(" Â· ")} Â· {validation.compatible ? "compatible" : validation.issues[0]}
                          </div>
                        )}
                        {isDone && i===2 && classification && (
                          <div style={{ marginTop:5, fontSize:10.5, ...mono, color:taskMeta?.color||C.optical, background:`${taskMeta?.color||C.optical}0F`, border:`1px solid ${(taskMeta?.color||C.optical)}33`, borderRadius:5, padding:"4px 8px" }}>
                            {classification.specialist}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* specialist registry */}
          <div style={{ marginTop:14, background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:14 }}>
            <div style={{ fontSize:11, ...mono, color:C.faint, marginBottom:10 }}>specialist registry</div>
            {[
              { name:"RS-VQA",            color:C.optical, tag:"single-image VQA" },
              { name:"RS-Captioning",      color:C.optical, tag:"scene description" },
              { name:"Grounding Model",    color:C.sar,     tag:"region localisation" },
              { name:"Change-VQA",         color:C.change,  tag:"bi-temporal" },
              { name:"Opticalâ€“SAR Fusion", color:C.sar,     tag:"cross-modal" },
            ].map(r => (
              <div key={r.name} style={{
                display:"flex", alignItems:"center", gap:8, padding:"7px 0",
                borderBottom:`1px solid ${C.border}`,
                opacity: (!classification || classification.specialist===r.name) ? 1 : 0.35,
                transition:"opacity .3s ease",
              }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:r.color, flexShrink:0 }} />
                <span style={{ fontSize:12, fontWeight:500, flex:1 }}>{r.name}</span>
                <span style={{ ...mono, fontSize:10, color:r.color }}>{r.tag}</span>
                {classification?.specialist===r.name && phase!=="idle" && (
                  <span style={{ ...mono, fontSize:9, background:`${r.color}22`, color:r.color, padding:"2px 5px", borderRadius:3 }}>ACTIVE</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* footer */}
      <div style={{ borderTop:`1px solid ${C.border}`, background:C.panelAlt, marginTop:24 }}>
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <RadarIcon size={13} color={C.faint} />
            <span style={{ fontSize:11, color:C.dim }}>Adapted on BigEarthNet Â· evaluated on VRSBench, RSVQA, CDVQA Â· ISRO/SAC Cartosat-2S + RISAT</span>
          </div>
          <span style={{ ...mono, fontSize:10.5, color:C.faint }}>SatQuery AI â€” AI-powered</span>
        </div>
      </div>
    </div>
  );
}

