import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Satellite, Radio, Upload, Play,
  CheckCircle2, Circle, Download, GitCompare, Eye, Loader2,
  FileStack, Crosshair, Activity, AlertTriangle,
  X, ImagePlus, RadarIcon, Brain, Cpu, Search, Merge, BarChart3, Zap,
  RefreshCw, MapPin, Clock, PlusCircle
} from "lucide-react";
import MarkdownRenderer from "./components/MarkdownRenderer.jsx";

const BACKEND_URL = "http://localhost:8000";

export function generateSummary(taskType, specialist, query, answer, validationResult) {
  const datasetMap = {
    SINGLE_VQA: ["BigEarthNet (adaptation)", "RSVQA (evaluation)"],
    SINGLE_CAPTION: ["BigEarthNet (adaptation)", "VRSBench (evaluation)"],
    SINGLE_GROUNDING: ["BigEarthNet (adaptation)", "VRSBench (grounding)"],
    CROSS_MODAL: ["BigEarthNet (adaptation)", "RSVQA", "CDVQA"],
    BITEMPORAL_CHANGE: ["BigEarthNet (adaptation)", "CDVQA (change VQA)"],
  };
  const outputMap = {
    SINGLE_VQA: ["textual answer", "land-cover evidence", "confidence score"],
    SINGLE_CAPTION: ["scene caption", "land-cover breakdown", "confidence score"],
    SINGLE_GROUNDING: ["spatial localisation", "region description", "bounding evidence"],
    CROSS_MODAL: ["per-modality analysis", "fused answer", "cross-modal agreement"],
    BITEMPORAL_CHANGE: ["change description", "spatial analysis", "magnitude estimate"],
  };
  return {
    taskSelected: taskType,
    specialist,
    modelUsed: answer.modelUsed || "VLM",
    datasetsUsed: datasetMap[taskType] || ["BigEarthNet"],
    inputFiles: validationResult?.file_infos?.map(f => f.filename) || validationResult?.files?.map(f => f.name) || [],
    queryIntent: query.length > 80 ? query.slice(0, 80) + "..." : query,
    outputTypes: outputMap[taskType] || ["textual answer"],
    confidence: answer.confidence,
    timestamp: new Date().toISOString(),
  };
}

const C = {
  bg:        "var(--bg)",
  bgAlt:     "var(--bgAlt)",
  surface:   "var(--surface)",
  panel:     "var(--panel)",
  panelAlt:  "var(--panelAlt)",
  border:    "var(--border)",
  borderLit: "var(--borderLit)",
  text:      "var(--text)",
  dim:       "var(--dim)",
  faint:     "var(--faint)",
  accent:    "var(--accent)",
  accentLt:  "var(--accentLt)",
  optical:   "var(--optical)",
  opticalLt: "var(--opticalLt)",
  sar:       "var(--sar)",
  sarLt:     "var(--sarLt)",
  change:    "var(--change)",
  changeLt:  "var(--changeLt)",
  good:      "var(--good)",
  goodLt:    "var(--goodLt)",
  err:       "var(--err)",
  warn:      "var(--warn)",
  raised:    "var(--raised)",
};
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const sans = { fontFamily: "'Inter', 'Space Grotesk', sans-serif" };

const TASK_META = {
  SINGLE_VQA: { label: "Single-Image VQA", color: C.optical, icon: Eye, specialist: "RS-VQA", inputBadge: "SINGLE · OPTICAL/SAR" },
  SINGLE_CAPTION: { label: "Scene Captioning", color: C.optical, icon: Eye, specialist: "RS-Captioning", inputBadge: "SINGLE · OPTICAL/SAR" },
  SINGLE_GROUNDING: { label: "Region Grounding", color: C.sar, icon: Crosshair, specialist: "Grounding Model", inputBadge: "SINGLE · OPTICAL/SAR" },
  CROSS_MODAL: { label: "Optical–SAR Fusion", color: C.sar, icon: Radio, specialist: "Optical–SAR Fusion", inputBadge: "PAIR · OPTICAL + SAR" },
  BITEMPORAL_CHANGE: { label: "Bi-temporal Change VQA", color: C.change, icon: GitCompare, specialist: "Change-VQA", inputBadge: "BI-TEMPORAL · T1/T2" },
};

const INPUT_TYPE_META = {
  "single": { label: "Single Image", color: C.optical, icon: Eye },
  "cross-modal": { label: "Optical + SAR Pair", color: C.sar, icon: Radio },
  "bi-temporal": { label: "Bi-temporal Pair", color: C.change, icon: GitCompare },
};

function buildSteps(taskType) {
  const icons = [Brain, CheckCircle2, Search, Cpu, Merge, BarChart3];
  const labels = ["Parse query & classify task", "Validate input images", "Select specialist model", "Execute specialist workflow", "Fuse outputs & score confidence", "Return evidence-grounded response"];
  const details = {
    SINGLE_VQA: ["Intent → single-image VQA", "1 image · format OK · bands validated", "Routing to RS-VQA (BigEarthNet-adapted)", "Running vision-language inference", "Aligning answer with pixel evidence", "Answer + confidence ready"],
    SINGLE_CAPTION: ["Intent → scene description", "1 image · format OK", "Routing to RS-Captioning model", "Generating scene description", "Scoring land-cover evidence", "Caption + confidence ready"],
    SINGLE_GROUNDING: ["Intent → region grounding", "1 image · format OK", "Routing to Grounding Model (VRSBench)", "Localising named region", "Computing bounding evidence", "Grounded region + confidence ready"],
    CROSS_MODAL: ["Intent → optical–SAR fusion", "2 images · co-registered · footprint OK", "Routing to Optical–SAR Fusion model", "Extracting per-modality features", "Reconciling optical vs SAR evidence", "Fused answer ready"],
    BITEMPORAL_CHANGE: ["Intent → change-based VQA", "2 images · T1/T2 · co-registered", "Routing to Change-VQA (CDVQA-adapted)", "Running change inference", "Combining spatial + textual evidence", "Change map + answer ready"],
  };
  const d = details[taskType] || details.SINGLE_VQA;
  return labels.map((label, i) => ({ id: i, icon: icons[i], label, detail: d[i] }));
}

function SectionLabel({ children }) {
  return <div style={{ ...mono, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: C.faint, marginBottom: 10, fontWeight: 600 }}>{children}</div>;
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
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (file) {
      const objUrl = URL.createObjectURL(file);
      setUrl(objUrl);
      return () => URL.revokeObjectURL(objUrl);
    }
  }, [file]);

  if (!url) return null;

  return (
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${color}33`, width: 120, flexShrink: 0 }}>
      <img src={url} alt={label} style={{ width: "100%", height: 88, objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.7))", padding: "4px 7px" }}>
        <span style={{ ...mono, fontSize: 9, color }}>{label}</span>
      </div>
    </div>
  );
}

export default function Console() {
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);

  // Chatbot state
  const [chats, setChats] = useState([]);
  const [busy, setBusy] = useState(false);

  const [reducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const fileInputRef = useRef();
  const chatScrollRef = useRef();

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chats]);

  // Fake progress for the agent trace
  useEffect(() => {
    const activeRunning = chats.find(c => c.status === "running");
    if (!activeRunning) return;

    const timer = setInterval(() => {
      setChats(prev => prev.map(c => {
        // Advance up to the second-to-last step (leaving the final step for 'done')
        if (c.id === activeRunning.id && c.status === "running" && c.activeStep < c.steps.length - 2) {
          return { ...c, activeStep: c.activeStep + 1 };
        }
        return c;
      }));
    }, 1500);
    return () => clearInterval(timer);
  }, [chats]);

  // Session management
  const createNewSession = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/sessions`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("satquery_session_id", data.id);
        setChats([]); // Clear chat history on new session
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  useEffect(() => {
    async function initSession() {
      let sid = localStorage.getItem("satquery_session_id");
      if (!sid) {
        await createNewSession();
      }
    }
    initSession();
  }, []);

  const addFiles = useCallback((newFiles) => {
    const ok = ["tif", "tiff", "png", "jpg", "jpeg"];
    const filtered = newFiles.filter(f => ok.includes(f.name.split(".").pop().toLowerCase()));
    setFiles(prev => [...prev, ...filtered].slice(0, 2));
  }, []);

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));
  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }, [addFiles]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runQuery();
    }
  };

  const updateChat = (id, updater) => {
    setChats(prev => prev.map(c => c.id === id ? { ...c, ...updater(c) } : c));
  };

  const runQuery = async () => {
    if (!query.trim() && files.length === 0) return;
    const sid = localStorage.getItem("satquery_session_id");
    if (!sid) { alert("No session ID found. Backend might be unreachable."); return; }

    const turnId = Date.now().toString();

    // Add new turn
    const newTurn = {
      id: turnId,
      query: query.trim(),
      files: [...files],
      status: "running",
      errorMsg: "",
      classification: null,
      validation: null,
      answer: null,
      summary: null,
      activeStep: 0,
      steps: buildSteps("SINGLE_VQA"),
      stepDetails: { 0: "Submitting request to backend…" }
    };

    setChats(prev => [...prev, newTurn]);
    setQuery("");
    setFiles([]); // clear input for next turn
    setBusy(true);

    try {
      const formData = new FormData();
      formData.append("session_id", sid);
      formData.append("query", newTurn.query);
      newTurn.files.forEach(f => formData.append("images", f));

      const res = await fetch(`${BACKEND_URL}/api/v1/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error: ${res.status} ${text}`);
      }

      const { run_id, stream_url } = await res.json();

      // Connect to SSE stream
      const evtSource = new EventSource(`${BACKEND_URL}${stream_url}`);

      let currentTaskType = "SINGLE_VQA";
      let currentSpecialist = "RS-VQA";
      let currentValidation = null;

      evtSource.onmessage = (e) => {
        const payload = JSON.parse(e.data);
        const { event, data } = payload;

        if (event === "node_end" && payload.step_index === 0) {
          // classify_intent
          const clf = {
            taskType: payload.payload.task_type,
            detectedInputType: payload.payload.detected_input_type,
            specialist: payload.payload.specialist,
            confidence: payload.payload.routing_confidence,
            reasoning: payload.payload.routing_reasoning,
            modelUsed: payload.payload.classification_model,
          };
          currentTaskType = clf.taskType;
          currentSpecialist = clf.specialist;
          updateChat(turnId, c => ({
            classification: clf,
            steps: buildSteps(clf.taskType),
            stepDetails: { ...c.stepDetails, 1: "Checking formats and compatibility…" }
          }));
        }
        else if (event === "node_end" && payload.step_index === 1) {
          // validate_images
          const val = payload.payload;
          currentValidation = val;
          updateChat(turnId, c => ({
            validation: val,
            stepDetails: { ...c.stepDetails, 2: "Routing to specialist…" }
          }));
        }
        else if (event === "routing") {
          updateChat(turnId, c => ({
            stepDetails: { ...c.stepDetails, 3: "Sending to vision model…" }
          }));
        }
        else if (event === "node_end" && payload.step_index === 3) {
          updateChat(turnId, c => ({
            stepDetails: { ...c.stepDetails, 4: "Fusing evidence and scoring confidence…" }
          }));
        }
        else if (event === "node_end" && payload.step_index === 4) {
          updateChat(turnId, c => ({
            stepDetails: { ...c.stepDetails, 5: "Finalizing response…" }
          }));
        }
        else if (event === "done") {
          // Final payload
          const ans = {
            text: data.answer,
            confidence: data.confidence,
            modelUsed: data.model_used,
          };
          const sum = generateSummary(currentTaskType, currentSpecialist, newTurn.query, ans, currentValidation);

          updateChat(turnId, c => ({
            answer: ans,
            summary: sum,
            status: "done",
            activeStep: c.steps.length // Force trace to finish
          }));
          evtSource.close();
          setBusy(false);
        }
        else if (event === "error") {
          updateChat(turnId, c => ({
            errorMsg: payload.message || "Unknown agent error.",
            status: "error"
          }));
          evtSource.close();
          setBusy(false);
        }
        else if (event === "__end__" || event === "timeout") {
          evtSource.close();
          setBusy(false);
        }
      };

      evtSource.onerror = () => {
        evtSource.close();
        updateChat(turnId, c => {
          if (c.status !== "done" && c.status !== "error") {
            setBusy(false);
            return { errorMsg: "Stream connection lost.", status: "error" };
          }
          return {};
        });
      };

    } catch (err) {
      console.error(err);
      updateChat(turnId, c => ({
        errorMsg: err.message || "Unknown error",
        status: "error"
      }));
      setBusy(false);
    }
  };

  // The latest chat determines what we show in the sidebar trace
  const activeChat = chats.length > 0 ? chats[chats.length - 1] : null;

  return (
    <div id="console" style={{ background: C.bg, ...sans, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        #console * { box-sizing: border-box; }
        #console textarea:focus { border-color: ${C.borderLit} !important; outline: none; }
        .cspin { animation: cspin 1s linear infinite; }
        @keyframes cspin { to { transform: rotate(360deg); } }
        .cfade { animation: cfade .35s ease forwards; }
        @keyframes cfade { from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)} }
        .cspulse { animation: ${reducedMotion ? "none" : "cspulse 1.1s ease-in-out infinite"}; }
        @keyframes cspulse { 0%,100%{box-shadow:0 0 0 0 ${C.accent}33}50%{box-shadow:0 0 0 6px ${C.accent}00} }
        @media(max-width:1180px){.cgrid{grid-template-columns:1fr!important}.cright{display:none!important}}
      `}</style>

      {/* top bar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: `${C.panelAlt}F0`, backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg,${C.accent},#1D4ED8)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${C.accent}25` }}>
              <Satellite size={14} color="#FFFFFF" strokeWidth={2} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>SatQuery AI</span>
            <span style={{ ...mono, fontSize: 9.5, color: C.faint, border: `1px solid ${C.border}`, padding: "2px 6px", borderRadius: 4 }}>console</span>
            <button onClick={createNewSession} disabled={busy} style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.panel, color: C.dim, fontSize: 11, cursor: busy ? "not-allowed" : "pointer" }}>
              <PlusCircle size={12} /> New Chat
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: busy ? C.optical : C.good, display: "inline-block" }} />
              <span style={{ ...mono, fontSize: 11, color: C.dim }}>{busy ? "processing" : "ready"}</span>
            </div>
            <MissionClock />
          </div>
        </div>
      </div>

      {/* grid */}
      <div className="cgrid" style={{ maxWidth: 1440, margin: "0 auto", flex: 1, width: "100%", padding: "20px 24px 40px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>

        {/* LEFT / CENTER: Chat Area */}
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", position: "relative" }}>

          {/* Scrollable Chat History */}
          <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", paddingRight: 12, paddingBottom: 120, display: "flex", flexDirection: "column", gap: 24 }}>
            {chats.length === 0 && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "48px 28px", textAlign: "center", marginTop: "10vh" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${C.optical}22,${C.accent}22)`, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                  <Satellite size={22} color={C.dim} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 8 }}>Upload imagery and ask a question</div>
                <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 24px" }}>
                  Start a conversation. The agent auto-detects single images or bi-temporal pairs and routes to the right specialist. You can ask follow-up questions at any time.
                </p>
              </div>
            )}

            {chats.map((chat) => (
              <div key={chat.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* User Message Bubble */}
                <div style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
                  <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: "12px 12px 0 12px", padding: "12px 16px", color: C.text, fontSize: 14, lineHeight: 1.6 }}>
                    {chat.query}
                    {chat.files.length > 0 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        {chat.files.map((f, i) => <ImageThumb key={i} file={f} label={chat.files.length === 2 ? (i === 0 ? "T1 / Optical" : "T2 / SAR") : "Input image"} color={i === 0 ? C.optical : C.sar} />)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Agent Response Bubble */}
                <div style={{ alignSelf: "flex-start", maxWidth: "85%", width: "100%" }}>
                  {chat.status === "running" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.dim, padding: "12px 16px", background: C.panel, borderRadius: "12px 12px 12px 0", border: `1px solid ${C.border}` }}>
                      <Loader2 size={15} className="cspin" color={C.accent} />
                      <span style={{ fontSize: 13 }}>Processing...</span>
                    </div>
                  )}

                  {chat.status === "error" && (
                    <div style={{ background: C.panel, border: `1px solid ${C.err}33`, borderRadius: "12px 12px 12px 0", padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <AlertTriangle size={16} color={C.err} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.err }}>Request failed</span>
                      </div>
                      <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: 0 }}>{chat.errorMsg}</p>
                    </div>
                  )}

                  {chat.status === "done" && chat.answer && (
                    <div className="cfade" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: "12px 12px 12px 0", overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: C.panelAlt, display: "flex", alignItems: "center", gap: 8 }}>
                        <Zap size={13} color={C.accent} />
                        <span style={{ ...mono, fontSize: 11, color: C.dim, letterSpacing: 0.4 }}>Specialist output</span>

                      </div>
                      <div style={{ padding: "16px 20px" }}>
                        <MarkdownRenderer text={chat.answer.text} />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>

          {/* Sticky Input Bar */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: C.bg, paddingTop: 16 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
              {/* File dropzone / preview area inside input bar */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                style={{ padding: files.length > 0 ? "10px 14px" : 0, background: dragging ? `${C.accent}08` : C.surface, transition: "background .2s", borderBottom: files.length > 0 ? `1px solid ${C.border}` : 'none' }}
              >
                {files.length > 0 && (
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                    {files.map((f, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <ImageThumb file={f} label={f.name} color={C.accent} />
                        <button onClick={() => removeFile(i)} style={{ position: "absolute", top: -6, right: -6, background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer", color: C.dim, padding: 2, display: "flex", borderRadius: "50%", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }} aria-label="Remove">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", padding: "10px 14px", gap: 12 }}>
                <button onClick={() => fileInputRef.current?.click()} style={{ background: "none", border: "none", padding: 8, cursor: "pointer", color: C.faint, borderRadius: 8, transition: "background .2s", flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.background = C.raised} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  <ImagePlus size={20} />
                </button>
                <input ref={fileInputRef} type="file" multiple accept=".tif,.tiff,.png,.jpg,.jpeg" style={{ display: "none" }} onChange={e => addFiles(Array.from(e.target.files))} />

                <textarea
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={Math.min(5, query.split('\n').length || 1)}
                  placeholder="Ask a question or upload images... (Press Enter to send)"
                  style={{ flex: 1, resize: "none", background: "transparent", border: "none", color: C.text, fontSize: 14, padding: "8px 0", fontFamily: "'Inter',sans-serif", lineHeight: 1.5, maxHeight: 120 }}
                />

                <button
                  onClick={runQuery}
                  disabled={busy || (!query.trim() && files.length === 0)}
                  style={{ background: busy || (!query.trim() && files.length === 0) ? C.raised : C.accent, border: "none", padding: "10px 14px", borderRadius: 8, cursor: busy || (!query.trim() && files.length === 0) ? "not-allowed" : "pointer", color: busy || (!query.trim() && files.length === 0) ? C.faint : "#FFF", transition: "all .2s", flexShrink: 0 }}
                >
                  <Play size={16} fill="currentColor" />
                </button>
              </div>
            </div>
            <div style={{ textAlign: "center", paddingTop: 8 }}>
              <span style={{ fontSize: 11, color: C.faint }}>Press Enter to send, Shift+Enter for new line</span>
            </div>
          </div>

        </div>

        {/* RIGHT: Agent Trace and Dashboards */}
        <div className="cright" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* 1. Request Analysis Dashboard */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: C.panelAlt }}>
              <Brain size={13} color={C.dim} />
              <span style={{ ...mono, fontSize: 11, color: C.dim, letterSpacing: 0.4 }}>Request analysis</span>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {!activeChat || !activeChat.classification ? (
                <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.7 }}>Waiting for request classification...</div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: C.dim }}>Task Type:</span>
                    <Pill label={activeChat.classification.taskType} color={TASK_META[activeChat.classification.taskType]?.color || C.accent} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: C.dim }}>Input Mode:</span>
                    <span style={{ fontSize: 12, color: C.text }}>{activeChat.classification.detectedInputType}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: C.dim }}>Specialist:</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{activeChat.classification.specialist}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2. Agent Trace */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: C.panelAlt }}>
              <Activity size={13} color={busy ? C.accent : C.dim} />
              <span style={{ ...mono, fontSize: 11, color: C.dim, letterSpacing: 0.4 }}>Agent execution trace</span>
            </div>
            <div style={{ padding: 14, overflowY: "auto", maxHeight: 440 }}>
              {!activeChat && <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.7 }}>Waiting for a query. The controller will log every step here.</div>}
              {activeChat && (
                <div>
                  {activeChat.steps.map((s, i) => {
                    const Icon = s.icon;
                    const isDone = activeChat.activeStep > i || activeChat.status === "done";
                    const isActive = activeChat.activeStep === i && activeChat.status !== "done";
                    const isPending = activeChat.activeStep < i && activeChat.status !== "done";
                    const detail = activeChat.stepDetails[i] || s.detail;
                    return (
                      <div key={s.id} style={{ display: "flex", gap: 12, position: "relative", paddingBottom: i === activeChat.steps.length - 1 ? 0 : 20 }}>
                        {i !== activeChat.steps.length - 1 && <div style={{ position: "absolute", left: 9, top: 22, bottom: 0, width: 1, background: isDone ? C.accent + "44" : C.border, transition: "background .3s ease" }} />}
                        <div className={isActive ? "cspulse" : ""} style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", background: isPending ? "transparent" : isActive ? C.accentLt || "#DBEAFE" : C.accent, border: `1.5px solid ${isPending ? C.border : C.accent}`, transition: "all .25s ease" }}>
                          {isDone && <CheckCircle2 size={11} color="#FFFFFF" />}
                          {isActive && <Circle size={7} color={C.accent} fill={C.accent} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 500, color: isPending ? C.faint : C.text, display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                            {!isPending && <Icon size={10} color={isActive ? C.accent : isDone ? C.good : C.faint} />}
                            {s.label}
                          </div>
                          {!isPending && <div style={{ fontSize: 10.5, color: C.dim, ...mono, lineHeight: 1.5 }}>{detail}</div>}
                          {isDone && i === 0 && activeChat.classification && <div style={{ marginTop: 6 }}><Pill label={`${activeChat.classification.taskType} · ${activeChat.classification.confidence}%`} color={C.accent} /></div>}
                          {isDone && i === 1 && activeChat.validation && <div style={{ marginTop: 6 }}><Pill label={activeChat.validation.compatible ? "compatible ✓" : (activeChat.validation.issues?.[0] || "invalid")} color={activeChat.validation.compatible ? C.good : C.warn} /></div>}
                          {isDone && i === 2 && activeChat.classification && <div style={{ marginTop: 6 }}><Pill label={activeChat.classification.specialist} color={TASK_META[activeChat.classification.taskType]?.color || C.optical} /></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3. Specialist Registry */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: C.panelAlt }}>
              <RadarIcon size={13} color={C.dim} />
              <span style={{ ...mono, fontSize: 11, color: C.dim, letterSpacing: 0.4 }}>Specialist registry</span>
            </div>
            <div style={{ padding: "6px 0" }}>
              {[
                { name: "RS-VQA", color: C.optical, tag: "single-image VQA" },
                { name: "RS-Captioning", color: C.optical, tag: "scene description" },
                { name: "Grounding Model", color: C.sar, tag: "region localisation" },
                { name: "Change-VQA", color: C.change, tag: "bi-temporal" },
                { name: "Optical–SAR Fusion", color: C.sar, tag: "cross-modal" },
              ].map((r, idx, arr) => {
                const isActive = activeChat?.classification?.specialist === r.name && activeChat?.status !== "idle";
                const isFaded = activeChat?.classification && !isActive;
                return (
                  <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: idx < arr.length - 1 ? `1px solid ${C.border}` : "none", opacity: isFaded ? 0.3 : 1, transition: "opacity .3s ease", background: isActive ? `${r.color}08` : "transparent" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 500, flex: 1, color: isActive ? r.color : C.text }}>{r.name}</span>
                    <span style={{ ...mono, fontSize: 10, color: r.color, opacity: 0.7 }}>{r.tag}</span>
                    {isActive && <span style={{ ...mono, fontSize: 9, background: `${r.color}22`, color: r.color, padding: "2px 6px", borderRadius: 3, border: `1px solid ${r.color}33` }}>ACTIVE</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
