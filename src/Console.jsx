import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Satellite, Radio, Upload, Play,
  CheckCircle2, Circle, Download, GitCompare, Eye, Loader2,
  FileStack, Crosshair, Activity, AlertTriangle,
  X, ImagePlus, Radar as RadarIcon, Brain, Cpu, Search, Merge, BarChart3, Zap,
  RefreshCw, MapPin, Clock, PlusCircle, Copy, Check, Sparkles, Terminal,
  ShieldCheck, Layers, ArrowUpRight
} from "lucide-react";
import MarkdownRenderer from "./components/MarkdownRenderer.jsx";

// Sample satellite assets for 1-click loading
import sampleOptical from "./assets/optical.jpg";
import sampleSar from "./assets/sar.jpg";
import sampleBitemporal from "./assets/bi-temporal.jpg";

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
  bg:        "#05080f",
  bgAlt:     "#080c18",
  surface:   "rgba(12, 18, 34, 0.75)",
  panel:     "rgba(10, 15, 28, 0.85)",
  panelAlt:  "rgba(14, 21, 38, 0.9)",
  border:    "rgba(56, 189, 248, 0.15)",
  borderLit: "rgba(56, 189, 248, 0.4)",
  text:      "#f1f5f9",
  dim:       "#94a3b8",
  faint:     "#64748b",
  accent:    "#38bdf8",
  accentLt:  "rgba(56, 189, 248, 0.12)",
  optical:   "#fbbf24",
  opticalLt: "rgba(251, 191, 36, 0.12)",
  sar:       "#38bdf8",
  sarLt:     "rgba(56, 189, 248, 0.12)",
  change:    "#c084fc",
  changeLt:  "rgba(192, 132, 252, 0.12)",
  good:      "#34d399",
  goodLt:    "rgba(52, 211, 153, 0.12)",
  err:       "#f43f5e",
  warn:      "#fbbf24",
  raised:    "rgba(18, 27, 48, 0.65)",
};
const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const sans = { fontFamily: "'Inter', system-ui, sans-serif" };

const TASK_META = {
  SINGLE_VQA: { label: "Single-Image VQA", color: C.optical, icon: Eye, specialist: "RS-VQA", inputBadge: "SINGLE · OPTICAL/SAR" },
  SINGLE_CAPTION: { label: "Scene Captioning", color: C.optical, icon: Eye, specialist: "RS-Captioning", inputBadge: "SINGLE · OPTICAL/SAR" },
  SINGLE_GROUNDING: { label: "Region Grounding", color: C.sar, icon: Crosshair, specialist: "Grounding Model", inputBadge: "SINGLE · OPTICAL/SAR" },
  CROSS_MODAL: { label: "Optical–SAR Fusion", color: C.sar, icon: Radio, specialist: "Optical–SAR Fusion", inputBadge: "PAIR · OPTICAL + SAR" },
  BITEMPORAL_CHANGE: { label: "Bi-temporal Change VQA", color: C.change, icon: GitCompare, specialist: "Change-VQA", inputBadge: "BI-TEMPORAL · T1/T2" },
};

function buildSteps(taskType) {
  const icons = [Brain, CheckCircle2, Search, Cpu, Merge, BarChart3];
  const labels = [
    "Parse query & classify task",
    "Validate input images",
    "Select specialist model",
    "Execute specialist workflow",
    "Fuse outputs & score confidence",
    "Return evidence-grounded response"
  ];
  const details = {
    SINGLE_VQA: ["Intent → single-image VQA", "1 image · radiometric check · bands OK", "Routing to RS-VQA (BigEarthNet-adapted)", "Running vision-language inference", "Aligning answer with pixel evidence", "Answer + confidence ready"],
    SINGLE_CAPTION: ["Intent → scene description", "1 image · format OK", "Routing to RS-Captioning model", "Generating remote sensing scene description", "Scoring land-cover evidence", "Caption + confidence ready"],
    SINGLE_GROUNDING: ["Intent → region grounding", "1 image · format OK", "Routing to Grounding Model (VRSBench)", "Localising named features", "Computing bounding coordinates", "Grounded region + confidence ready"],
    CROSS_MODAL: ["Intent → optical–SAR fusion", "2 images · co-registered · footprint aligned", "Routing to Optical–SAR Fusion model", "Extracting optical & radar polarimetry features", "Reconciling optical vs SAR evidence", "Fused multi-sensor answer ready"],
    BITEMPORAL_CHANGE: ["Intent → change-based VQA", "2 images · T1/T2 · co-registered", "Routing to Change-VQA (CDVQA-adapted)", "Running differential change inference", "Combining spatial + temporal evidence", "Change map + analysis ready"],
  };
  const d = details[taskType] || details.SINGLE_VQA;
  return labels.map((label, i) => ({ id: i, icon: icons[i], label, detail: d[i] }));
}

function Pill({ label, color }) {
  return (
    <span style={{
      ...mono,
      fontSize: 10.5,
      color,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      padding: "3px 9px",
      borderRadius: 20,
      whiteSpace: "nowrap",
      fontWeight: 600,
      letterSpacing: 0.3,
    }}>
      {label}
    </span>
  );
}

function MissionClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const p = (n) => String(n).padStart(2, "0");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, ...mono, fontSize: 11, color: C.dim }}>
      <Clock size={12} color={C.accent} />
      <span>{p(t.getUTCHours())}:{p(t.getUTCMinutes())}:{p(t.getUTCSeconds())} UTC</span>
    </div>
  );
}

function ImageThumb({ file, label, color, onRemove }) {
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
    <div style={{
      position: "relative",
      borderRadius: 10,
      overflow: "hidden",
      border: `1px solid ${color}60`,
      width: 130,
      flexShrink: 0,
      boxShadow: `0 4px 16px ${color}20`,
      background: "#03060c",
    }}>
      <img src={url} alt={label} style={{ width: "100%", height: 92, objectFit: "cover", display: "block" }} />
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "linear-gradient(transparent, rgba(2, 4, 10, 0.95))",
        padding: "4px 8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ ...mono, fontSize: 9.5, color, fontWeight: 700, letterSpacing: 0.4 }}>{label}</span>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            background: "rgba(0, 0, 0, 0.75)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "50%",
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#f43f5e"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(0, 0, 0, 0.75)"}
          title="Remove image"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

// Convert asset URL to File object
async function urlToFile(assetUrl, filename) {
  const response = await fetch(assetUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: "image/jpeg" });
}

export default function Console() {
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Chatbot state
  const [chats, setChats] = useState([]);
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef();
  const chatScrollRef = useRef();

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chats]);

  // Simulated progress for agent execution trace
  useEffect(() => {
    const activeRunning = chats.find(c => c.status === "running");
    if (!activeRunning) return;

    const timer = setInterval(() => {
      setChats(prev => prev.map(c => {
        if (c.id === activeRunning.id && c.status === "running" && c.activeStep < c.steps.length - 2) {
          return { ...c, activeStep: c.activeStep + 1 };
        }
        return c;
      }));
    }, 1400);
    return () => clearInterval(timer);
  }, [chats]);

  // Session management
  const createNewSession = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/sessions`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("satquery_session_id", data.id);
        setChats([]);
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
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runQuery();
    }
  };

  const updateChat = (id, updater) => {
    setChats(prev => prev.map(c => c.id === id ? { ...c, ...updater(c) } : c));
  };

  // 1-Click Preset Scenario Loader
  const loadScenario = async (type) => {
    if (busy) return;
    try {
      if (type === "flood") {
        setQuery("Identify flood-inundated regions and submerged infrastructure by cross-referencing optical reflectance and SAR backscatter.");
        const f1 = await urlToFile(sampleOptical, "cartosat2s_optical_scene.jpg");
        const f2 = await urlToFile(sampleSar, "risat1_sar_polarized.jpg");
        setFiles([f1, f2]);
      } else if (type === "change") {
        setQuery("Analyze spatial and land-cover changes between baseline T1 and post-event T2 acquisitions. Quantify new construction.");
        const f1 = await urlToFile(sampleOptical, "baseline_t1_pre_event.jpg");
        const f2 = await urlToFile(sampleBitemporal, "satellite_t2_post_event.jpg");
        setFiles([f1, f2]);
      } else if (type === "grounding") {
        setQuery("Localize aircraft positions, primary runway corridors, and terminal taxiways.");
        const f1 = await urlToFile(sampleOptical, "highres_airfield_optical.jpg");
        setFiles([f1]);
      }
    } catch (e) {
      console.error("Error loading sample scenario:", e);
    }
  };

  // Copy to clipboard helper
  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export summary as JSON
  const handleExportJSON = (chat) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chat.summary || chat, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `satquery_telemetry_${chat.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const runQuery = async () => {
    if (!query.trim() && files.length === 0) return;
    const sid = localStorage.getItem("satquery_session_id");
    if (!sid) {
      alert("No active session ID found. Backend might be restarting.");
      return;
    }

    const turnId = Date.now().toString();

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
      stepDetails: { 0: "Submitting mission telemetry to agent controller..." },
      startTime: Date.now(),
    };

    setChats(prev => [...prev, newTurn]);
    setQuery("");
    setFiles([]);
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
        throw new Error(`Controller error (${res.status}): ${text}`);
      }

      const { run_id, stream_url } = await res.json();
      const evtSource = new EventSource(`${BACKEND_URL}${stream_url}`);

      let currentTaskType = "SINGLE_VQA";
      let currentSpecialist = "RS-VQA";
      let currentValidation = null;

      evtSource.onmessage = (e) => {
        const payload = JSON.parse(e.data);
        const { event, data } = payload;

        if (event === "node_end" && payload.step_index === 0) {
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
            stepDetails: { ...c.stepDetails, 1: "Checking radiometric bands & coordinate co-registration..." }
          }));
        }
        else if (event === "node_end" && payload.step_index === 1) {
          const val = payload.payload;
          currentValidation = val;
          updateChat(turnId, c => ({
            validation: val,
            stepDetails: { ...c.stepDetails, 2: `Dispatching task payload to ${currentSpecialist}...` }
          }));
        }
        else if (event === "routing") {
          updateChat(turnId, c => ({
            stepDetails: { ...c.stepDetails, 3: "Executing vision-language transformer inference..." }
          }));
        }
        else if (event === "node_end" && payload.step_index === 3) {
          updateChat(turnId, c => ({
            stepDetails: { ...c.stepDetails, 4: "Calibrating confidence and cross-referencing land features..." }
          }));
        }
        else if (event === "node_end" && payload.step_index === 4) {
          updateChat(turnId, c => ({
            stepDetails: { ...c.stepDetails, 5: "Formulating grounded geospatial intelligence response..." }
          }));
        }
        else if (event === "done") {
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
            activeStep: c.steps.length,
            duration: ((Date.now() - c.startTime) / 1000).toFixed(1),
          }));
          evtSource.close();
          setBusy(false);
        }
        else if (event === "error") {
          updateChat(turnId, c => ({
            errorMsg: payload.message || "Specialist inference encountered an error.",
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
            return { errorMsg: "Stream telemetry connection terminated.", status: "error" };
          }
          return {};
        });
      };

    } catch (err) {
      console.error(err);
      updateChat(turnId, c => ({
        errorMsg: err.message || "Unknown controller failure",
        status: "error"
      }));
      setBusy(false);
    }
  };

  const activeChat = chats.length > 0 ? chats[chats.length - 1] : null;

  return (
    <div
      id="console"
      style={{
        background: C.bg,
        ...sans,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <style>{`
        #console * { box-sizing: border-box; }
        #console textarea:focus { outline: none; }
        .cspin { animation: cspin 1s linear infinite; }
        @keyframes cspin { to { transform: rotate(360deg); } }
        .cfade { animation: cfade .35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes cfade { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
        .radar-scan {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, transparent 0%, rgba(56, 189, 248, 0.08) 50%, transparent 100%);
          animation: scanline 3s linear infinite;
          pointer-events: none;
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(1000%); }
        }
        .hud-glow {
          box-shadow: 0 0 25px -5px rgba(56, 189, 248, 0.15);
        }
        @media(max-width:1180px){.cgrid{grid-template-columns:1fr!important}.cright{display:none!important}}
      `}</style>

      {/* ── Mission Control Header HUD ── */}
      <div
        style={{
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(8, 12, 24, 0.88)",
          backdropFilter: "blur(16px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "0 24px",
            height: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo & Node telemetry */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #0284c7, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 12px rgba(56, 189, 248, 0.35)",
              }}
            >
              <Satellite size={16} color="#FFFFFF" strokeWidth={2.2} />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 14.5, color: "#ffffff", letterSpacing: -0.2 }}>
                  SatQuery AI
                </span>
                <span
                  style={{
                    ...mono,
                    fontSize: 10,
                    color: "#38bdf8",
                    background: "rgba(56, 189, 248, 0.1)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    padding: "2px 7px",
                    borderRadius: 4,
                  }}
                >
                  MISSION CONSOLE
                </span>
              </div>
            </div>

            <button
              onClick={createNewSession}
              disabled={busy}
              style={{
                marginLeft: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#cbd5e1",
                fontSize: 11.5,
                fontWeight: 500,
                cursor: busy ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { if (!busy) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = "#ffffff"; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)"; e.currentTarget.style.color = "#cbd5e1"; }}
            >
              <PlusCircle size={13} color={C.accent} /> New Mission Session
            </button>
          </div>

          {/* Telemetry Metrics */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Status indicator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                background: "rgba(15, 23, 42, 0.7)",
                border: `1px solid ${C.border}`,
                padding: "4px 10px",
                borderRadius: 6,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: busy ? "#f59e0b" : "#10b981",
                  boxShadow: busy ? "0 0 8px #f59e0b" : "0 0 8px #10b981",
                  display: "inline-block",
                }}
              />
              <span style={{ ...mono, fontSize: 11, color: busy ? "#f59e0b" : "#34d399", fontWeight: 600 }}>
                {busy ? "AGENT INFERENCE" : "SYSTEM: NOMINAL"}
              </span>
            </div>

            {/* Orbit specs */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, ...mono, fontSize: 11, color: C.dim }}>
              <span style={{ color: "#64748b" }}>ORBIT:</span>
              <span style={{ color: "#e2e8f0" }}>LEO 542 KM</span>
            </div>

            {/* UTC Mission clock */}
            <MissionClock />
          </div>
        </div>
      </div>

      {/* ── Main Workspace Grid ── */}
      <div
        className="cgrid"
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          flex: 1,
          width: "100%",
          padding: "20px 24px 30px",
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* ── LEFT / CENTER: Mission Feed & Interaction Area ── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 120px)", position: "relative" }}>

          {/* Chat / Mission Stream */}
          <div
            ref={chatScrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              paddingRight: 10,
              paddingBottom: 20,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {chats.length === 0 && (
              <div
                className="hud-glow"
                style={{
                  background: "linear-gradient(180deg, rgba(14, 22, 42, 0.75) 0%, rgba(9, 14, 28, 0.85) 100%)",
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  padding: "40px 32px",
                  textAlign: "center",
                  marginTop: "3vh",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Radar sweep animation */}
                <div className="radar-scan" />

                {/* Satellite Radar Reticle graphic */}
                <div
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)",
                    border: "1px dashed rgba(56, 189, 248, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                    boxShadow: "0 0 30px rgba(56, 189, 248, 0.2)",
                  }}
                >
                  <RadarIcon size={30} color={C.accent} />
                </div>

                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#ffffff",
                    marginBottom: 8,
                    letterSpacing: -0.3,
                  }}
                >
                  Autonomous Multi-Modal Earth Observation Console
                </h3>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "#94a3b8",
                    lineHeight: 1.6,
                    maxWidth: 500,
                    margin: "0 auto 28px",
                  }}
                >
                  Upload satellite imagery or launch a pre-configured ISRO benchmark scenario.
                  The controller classifies intent, verifies radiometric bands, and routes to specialized VLMs.
                </p>

                {/* 1-Click Interactive Test Scenarios */}
                <div style={{ maxWidth: 660, margin: "0 auto" }}>
                  <div
                    style={{
                      ...mono,
                      fontSize: 11,
                      color: "#64748b",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      marginBottom: 12,
                    }}
                  >
                    SELECT ONE-CLICK BENCHMARK SCENARIO TO TEST:
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {[
                      {
                        id: "flood",
                        tag: "OPTICAL + SAR FUSION",
                        title: "Assam Flood Impact",
                        desc: "Analyze optical reflectance & RISAT-1 SAR polarimetry",
                        color: "#38bdf8",
                        badge: "RS-VQA",
                      },
                      {
                        id: "change",
                        tag: "BI-TEMPORAL T1 / T2",
                        title: "Urban Encroachment",
                        desc: "Differential change map & land-cover displacement",
                        color: "#c084fc",
                        badge: "Change-VQA",
                      },
                      {
                        id: "grounding",
                        tag: "SPATIAL LOCALIZATION",
                        title: "Airbase & Runway Corr.",
                        desc: "Ground aircraft footprints & taxiway bounds",
                        color: "#fbbf24",
                        badge: "Grounding",
                      },
                    ].map(sc => (
                      <button
                        key={sc.id}
                        onClick={() => loadScenario(sc.id)}
                        disabled={busy}
                        style={{
                          background: "rgba(15, 23, 42, 0.6)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: 10,
                          padding: "14px 14px",
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "all 0.25s ease",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = sc.color;
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = `0 6px 20px -4px ${sc.color}30`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ ...mono, fontSize: 9.5, color: sc.color, fontWeight: 700 }}>
                            {sc.tag}
                          </span>
                          <span
                            style={{
                              ...mono,
                              fontSize: 9,
                              color: "#e2e8f0",
                              background: "rgba(255,255,255,0.08)",
                              padding: "2px 5px",
                              borderRadius: 3,
                            }}
                          >
                            {sc.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff" }}>
                          {sc.title}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                          {sc.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Conversation Bubbles */}
            {chats.map((chat) => (
              <div key={chat.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Operator Transmission Bubble */}
                <div style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(20, 32, 58, 0.9) 0%, rgba(15, 24, 46, 0.9) 100%)",
                      border: "1px solid rgba(56, 189, 248, 0.35)",
                      borderRadius: "14px 14px 0 14px",
                      padding: "14px 18px",
                      color: "#f8fafc",
                      fontSize: 14,
                      lineHeight: 1.6,
                      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, ...mono, fontSize: 10, color: "#38bdf8" }}>
                      <Terminal size={12} />
                      <span>OPERATOR TRANSMISSION</span>
                    </div>

                    <div>{chat.query}</div>

                    {chat.files.length > 0 && (
                      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                        {chat.files.map((f, i) => (
                          <ImageThumb
                            key={i}
                            file={f}
                            label={chat.files.length === 2 ? (i === 0 ? "T1 / Optical" : "T2 / SAR") : "Input Satellite Image"}
                            color={i === 0 ? C.optical : C.sar}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Specialist AI Response Bubble */}
                <div style={{ alignSelf: "flex-start", maxWidth: "90%", width: "100%" }}>
                  {chat.status === "running" && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        color: "#94a3b8",
                        padding: "14px 20px",
                        background: "rgba(11, 17, 32, 0.8)",
                        borderRadius: "14px 14px 14px 0",
                        border: `1px solid ${C.border}`,
                        backdropFilter: "blur(12px)",
                      }}
                    >
                      <Loader2 size={18} className="cspin" color={C.accent} />
                      <div>
                        <div style={{ fontSize: 13, color: "#ffffff", fontWeight: 600 }}>
                          Executing Remote-Sensing VLM Pipeline...
                        </div>
                        <div style={{ ...mono, fontSize: 11, color: "#38bdf8", marginTop: 2 }}>
                          {chat.stepDetails[chat.activeStep] || "Processing satellite layers..."}
                        </div>
                      </div>
                    </div>
                  )}

                  {chat.status === "error" && (
                    <div
                      style={{
                        background: "rgba(244, 63, 94, 0.08)",
                        border: "1px solid rgba(244, 63, 94, 0.35)",
                        borderRadius: "14px 14px 14px 0",
                        padding: "18px 22px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <AlertTriangle size={18} color={C.err} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.err }}>Pipeline Error</span>
                      </div>
                      <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
                        {chat.errorMsg}
                      </p>
                    </div>
                  )}

                  {chat.status === "done" && chat.answer && (
                    <div
                      className="cfade hud-glow"
                      style={{
                        background: "rgba(11, 17, 32, 0.9)",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        borderRadius: "14px 14px 14px 0",
                        overflow: "hidden",
                        backdropFilter: "blur(16px)",
                        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
                      }}
                    >
                      {/* Response Telemetry Header */}
                      <div
                        style={{
                          padding: "12px 18px",
                          borderBottom: "1px solid rgba(56, 189, 248, 0.15)",
                          background: "linear-gradient(90deg, rgba(16, 25, 46, 0.9) 0%, rgba(10, 16, 32, 0.9) 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              background: "rgba(56, 189, 248, 0.15)",
                              border: "1px solid rgba(56, 189, 248, 0.3)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Zap size={13} color="#38bdf8" />
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "#ffffff" }}>
                              {chat.summary?.specialist || "RS Specialist VLM"}
                            </span>
                            <span
                              style={{
                                ...mono,
                                fontSize: 10,
                                color: "#34d399",
                                background: "rgba(52, 211, 153, 0.1)",
                                border: "1px solid rgba(52, 211, 153, 0.25)",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}
                            >
                              CONFIDENCE: {chat.answer.confidence || 94}%
                            </span>
                            {chat.duration && (
                              <span style={{ ...mono, fontSize: 10, color: "#64748b" }}>
                                {chat.duration}s LATENCY
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            onClick={() => handleCopy(chat.id, chat.answer.text)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 9px",
                              borderRadius: 5,
                              background: "rgba(255, 255, 255, 0.06)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              color: copiedId === chat.id ? "#34d399" : "#94a3b8",
                              fontSize: 11,
                              ...mono,
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                            title="Copy response markdown"
                          >
                            {copiedId === chat.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedId === chat.id ? "COPIED" : "COPY"}
                          </button>

                          <button
                            onClick={() => handleExportJSON(chat)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 9px",
                              borderRadius: 5,
                              background: "rgba(255, 255, 255, 0.06)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              color: "#38bdf8",
                              fontSize: 11,
                              ...mono,
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                            title="Export evaluation payload as JSON"
                          >
                            <Download size={12} /> EXPORT
                          </button>
                        </div>
                      </div>

                      {/* Content rendering */}
                      <div style={{ padding: "18px 24px" }}>
                        <MarkdownRenderer text={chat.answer.text} />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>

          {/* ── Sticky Input Command Bar & Dropzone ── */}
          <div
            style={{
              marginTop: "auto",
              position: "sticky",
              bottom: 0,
              background: "linear-gradient(180deg, rgba(5,8,15,0.4) 0%, #05080f 35%)",
              paddingTop: 16,
              zIndex: 20,
            }}
          >
            {/* Quick Prompt Suggestion Pills */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 10,
                scrollbarWidth: "none",
              }}
            >
              {[
                { label: "🔍 Localize aircraft & runways", prompt: "Identify all aircraft footprints and delineate runway orientations." },
                { label: "🌊 Detect flood extent & water bodies", prompt: "Detect flood inundation boundary and identify submerged structures." },
                { label: "🌲 Forest canopy change T1-T2", prompt: "Compare vegetation density between T1 and T2 and quantify tree cover loss." },
                { label: "🏗️ Building density breakdown", prompt: "Provide a detailed land-cover breakdown with building density estimates." },
              ].map(qp => (
                <button
                  key={qp.label}
                  onClick={() => setQuery(qp.prompt)}
                  disabled={busy}
                  style={{
                    background: "rgba(15, 23, 42, 0.75)",
                    border: "1px solid rgba(56, 189, 248, 0.18)",
                    color: "#94a3b8",
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.color = "#ffffff"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.18)"; e.currentTarget.style.color = "#94a3b8"; }}
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Input Box Shell */}
            <div
              style={{
                background: "rgba(10, 15, 30, 0.95)",
                border: `1px solid ${dragging ? "#38bdf8" : "rgba(56, 189, 248, 0.25)"}`,
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: dragging
                  ? "0 0 30px rgba(56, 189, 248, 0.35)"
                  : "0 8px 30px rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(16px)",
                transition: "all 0.2s ease",
              }}
            >
              {/* File Dropzone / Previews Strip */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                style={{
                  padding: files.length > 0 ? "10px 14px" : "0",
                  background: dragging ? "rgba(56, 189, 248, 0.1)" : "rgba(14, 21, 38, 0.5)",
                  transition: "background 0.2s",
                  borderBottom: files.length > 0 ? "1px solid rgba(56, 189, 248, 0.15)" : "none",
                }}
              >
                {files.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, overflowX: "auto" }}>
                    {files.map((f, i) => (
                      <ImageThumb
                        key={i}
                        file={f}
                        label={files.length === 2 ? (i === 0 ? "SLOT 1 / OPTICAL" : "SLOT 2 / SAR") : "INPUT SATELLITE IMAGE"}
                        color={i === 0 ? C.optical : C.sar}
                        onRemove={() => removeFile(i)}
                      />
                    ))}
                    {files.length < 2 && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          height: 92,
                          width: 120,
                          borderRadius: 10,
                          border: "1px dashed rgba(56, 189, 248, 0.3)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          cursor: "pointer",
                          color: "#64748b",
                          fontSize: 10,
                          ...mono,
                        }}
                      >
                        <PlusCircle size={18} color="#38bdf8" />
                        <span>ADD 2ND LAYER</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Text Input Row */}
              <div style={{ display: "flex", alignItems: "flex-end", padding: "10px 16px", gap: 12 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    padding: 8,
                    cursor: "pointer",
                    color: files.length > 0 ? "#38bdf8" : "#94a3b8",
                    borderRadius: 8,
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(56, 189, 248, 0.15)"; e.currentTarget.style.color = "#ffffff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; e.currentTarget.style.color = files.length > 0 ? "#38bdf8" : "#94a3b8"; }}
                  title="Upload GeoTIFF / TIFF / PNG / JPEG"
                >
                  <ImagePlus size={19} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".tif,.tiff,.png,.jpg,.jpeg"
                  style={{ display: "none" }}
                  onChange={e => addFiles(Array.from(e.target.files))}
                />

                <textarea
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={Math.min(5, query.split('\n').length || 1)}
                  placeholder="Transmit geospatial query or upload satellite images... (Press Enter to execute)"
                  style={{
                    flex: 1,
                    resize: "none",
                    background: "transparent",
                    border: "none",
                    color: "#ffffff",
                    fontSize: 14,
                    padding: "8px 0",
                    lineHeight: 1.5,
                    maxHeight: 120,
                    fontFamily: "'Inter', sans-serif",
                  }}
                />

                <button
                  onClick={runQuery}
                  disabled={busy || (!query.trim() && files.length === 0)}
                  style={{
                    background: busy || (!query.trim() && files.length === 0)
                      ? "rgba(255, 255, 255, 0.08)"
                      : "linear-gradient(135deg, #0284c7, #2563eb)",
                    border: "none",
                    padding: "10px 16px",
                    borderRadius: 8,
                    cursor: busy || (!query.trim() && files.length === 0) ? "not-allowed" : "pointer",
                    color: busy || (!query.trim() && files.length === 0) ? "#64748b" : "#ffffff",
                    boxShadow: busy || (!query.trim() && files.length === 0) ? "none" : "0 0 16px rgba(56, 189, 248, 0.4)",
                    transition: "all 0.2s",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Play size={15} fill="currentColor" />
                </button>
              </div>
            </div>

            <div style={{ textAlign: "center", paddingTop: 6 }}>
              <span style={{ ...mono, fontSize: 10.5, color: "#64748b" }}>
                PRESS ENTER TO EXECUTE · SHIFT + ENTER FOR MULTI-LINE · SUPPORTS GEOTIFF, TIFF, PNG, JPEG
              </span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Agent Telemetry HUD & Execution Trace ── */}
        <div className="cright" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 1. Request Classification HUD */}
          <div
            style={{
              background: "rgba(11, 17, 32, 0.85)",
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              overflow: "hidden",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderBottom: `1px solid ${C.border}`,
                background: "rgba(14, 21, 38, 0.9)",
              }}
            >
              <Brain size={13} color="#38bdf8" />
              <span style={{ ...mono, fontSize: 11, color: "#cbd5e1", letterSpacing: 0.5, textTransform: "uppercase" }}>
                Routing Intelligence
              </span>
            </div>

            <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {!activeChat || !activeChat.classification ? (
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, ...mono }}>
                  Awaiting query submission for intent categorization & sensor parsing...
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>Task Type:</span>
                    <Pill
                      label={activeChat.classification.taskType}
                      color={TASK_META[activeChat.classification.taskType]?.color || C.accent}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>Input Mode:</span>
                    <span style={{ ...mono, fontSize: 11, color: "#ffffff" }}>
                      {activeChat.classification.detectedInputType}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>Routed Specialist:</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8" }}>
                      {activeChat.classification.specialist}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>Routing Confidence:</span>
                    <span style={{ ...mono, fontSize: 11, color: "#34d399", fontWeight: 700 }}>
                      {activeChat.classification.confidence || 98}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2. Agent Execution Laser Trace */}
          <div
            style={{
              background: "rgba(11, 17, 32, 0.85)",
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              overflow: "hidden",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderBottom: `1px solid ${C.border}`,
                background: "rgba(14, 21, 38, 0.9)",
              }}
            >
              <Activity size={13} color={busy ? "#38bdf8" : "#94a3b8"} />
              <span style={{ ...mono, fontSize: 11, color: "#cbd5e1", letterSpacing: 0.5, textTransform: "uppercase" }}>
                Controller Trace
              </span>
            </div>

            <div style={{ padding: "16px 14px", overflowY: "auto", maxHeight: 380 }}>
              {!activeChat ? (
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, ...mono }}>
                  Autonomous agent trace will visualize node transitions once a mission is started.
                </div>
              ) : (
                <div>
                  {activeChat.steps.map((s, i) => {
                    const Icon = s.icon;
                    const isDone = activeChat.activeStep > i || activeChat.status === "done";
                    const isActive = activeChat.activeStep === i && activeChat.status !== "done";
                    const isPending = activeChat.activeStep < i && activeChat.status !== "done";
                    const detail = activeChat.stepDetails[i] || s.detail;

                    return (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          gap: 12,
                          position: "relative",
                          paddingBottom: i === activeChat.steps.length - 1 ? 0 : 20,
                        }}
                      >
                        {/* Connecting laser line */}
                        {i !== activeChat.steps.length - 1 && (
                          <div
                            style={{
                              position: "absolute",
                              left: 9,
                              top: 22,
                              bottom: 0,
                              width: 1,
                              background: isDone
                                ? "linear-gradient(180deg, #38bdf8 0%, rgba(56, 189, 248, 0.3) 100%)"
                                : "rgba(255, 255, 255, 0.08)",
                              transition: "background 0.3s ease",
                            }}
                          />
                        )}

                        {/* Step Icon Node */}
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            flexShrink: 0,
                            marginTop: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: isPending
                              ? "transparent"
                              : isActive
                              ? "rgba(56, 189, 248, 0.2)"
                              : "#0284c7",
                            border: `1.5px solid ${isPending ? "rgba(255, 255, 255, 0.15)" : "#38bdf8"}`,
                            boxShadow: isActive ? "0 0 10px #38bdf8" : isDone ? "0 0 6px rgba(56, 189, 248, 0.4)" : "none",
                            transition: "all 0.25s ease",
                          }}
                        >
                          {isDone && <CheckCircle2 size={12} color="#FFFFFF" />}
                          {isActive && <Circle size={6} color="#38bdf8" fill="#38bdf8" />}
                        </div>

                        {/* Step Info */}
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: isActive ? 700 : 500,
                              color: isPending ? "#64748b" : "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 2,
                            }}
                          >
                            <Icon size={11} color={isActive ? "#38bdf8" : isDone ? "#34d399" : "#64748b"} />
                            {s.label}
                          </div>
                          {!isPending && (
                            <div style={{ fontSize: 10.5, color: "#94a3b8", ...mono, lineHeight: 1.4 }}>
                              {detail}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3. Specialist Registry */}
          <div
            style={{
              background: "rgba(11, 17, 32, 0.85)",
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              overflow: "hidden",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderBottom: `1px solid ${C.border}`,
                background: "rgba(14, 21, 38, 0.9)",
              }}
            >
              <Cpu size={13} color="#38bdf8" />
              <span style={{ ...mono, fontSize: 11, color: "#cbd5e1", letterSpacing: 0.5, textTransform: "uppercase" }}>
                Specialist VLM Registry
              </span>
            </div>

            <div style={{ padding: "4px 0" }}>
              {[
                { name: "RS-VQA", color: "#fbbf24", tag: "Optical/SAR VQA" },
                { name: "RS-Captioning", color: "#fbbf24", tag: "Scene Description" },
                { name: "Grounding Model", color: "#38bdf8", tag: "Feature Grounding" },
                { name: "Change-VQA", color: "#c084fc", tag: "Bi-Temporal Differential" },
                { name: "Optical–SAR Fusion", color: "#38bdf8", tag: "Multi-Sensor Co-reg" },
              ].map((r, idx, arr) => {
                const isActive = activeChat?.classification?.specialist === r.name && activeChat?.status !== "idle";
                const isFaded = activeChat?.classification && !isActive;

                return (
                  <div
                    key={r.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 14px",
                      borderBottom: idx < arr.length - 1 ? "1px solid rgba(255, 255, 255, 0.05)" : "none",
                      opacity: isFaded ? 0.35 : 1,
                      transition: "opacity 0.3s ease",
                      background: isActive ? `${r.color}15` : "transparent",
                    }}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: r.color,
                        boxShadow: isActive ? `0 0 8px ${r.color}` : "none",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: isActive ? "#ffffff" : "#cbd5e1" }}>
                      {r.name}
                    </span>
                    <span style={{ ...mono, fontSize: 10, color: r.color, opacity: 0.85 }}>
                      {r.tag}
                    </span>
                    {isActive && (
                      <span
                        style={{
                          ...mono,
                          fontSize: 9,
                          background: `${r.color}25`,
                          color: r.color,
                          padding: "2px 5px",
                          borderRadius: 3,
                          border: `1px solid ${r.color}50`,
                          fontWeight: 700,
                        }}
                      >
                        ACTIVE
                      </span>
                    )}
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
