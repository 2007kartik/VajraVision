import { useEffect, useRef, useState } from "react";

const C = {
  bg:     "#FFFFFF",
  panel:  "#F8FAFC",
  border: "#E2E8F0",
  text:   "#0F172A",
  dim:    "#475569",
  faint:  "#94A3B8",
  optical: "#B45309",
  sar:     "#0369A1",
  change:  "#6D28D9",
  good:    "#047857",
  goodLt:  "#D1FAE5",
};
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const sans = { fontFamily: "'Inter', system-ui, sans-serif" };

const ANSWER = "Built-up area increased 14 % — southern block, 2022 → 2024";
const CAPTION_STEPS = ["From orbit", "To pixels", "To answers"];

function usePrefersReducedMotion() {
  const [v, setV] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const h = (e) => setV(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return v;
}

/* ── typing effect ── */
function TypedText({ text, active, reduced }) {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);

  useEffect(() => {
    if (!active) { setDisplayed(""); idx.current = 0; return; }
    if (reduced) { setDisplayed(text); return; }
    const interval = setInterval(() => {
      idx.current += 1;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) clearInterval(interval);
    }, 28);
    return () => clearInterval(interval);
  }, [active, text, reduced]);

  return (
    <span style={{ ...mono, fontSize: 13, color: C.good, fontWeight: 600 }}>
      {displayed}
      {active && displayed.length < text.length && (
        <span style={{ opacity: 0.7, animation: "blink .7s step-end infinite" }}>|</span>
      )}
    </span>
  );
}

/* ── animated bounding box ── */
function BoundingBox({ active, reduced }) {
  const rectRef = useRef();

  useEffect(() => {
    if (!rectRef.current) return;
    if (reduced || active) {
      rectRef.current.style.strokeDashoffset = "0";
    } else {
      rectRef.current.style.strokeDashoffset = "260";
    }
  }, [active, reduced]);

  return (
    <svg
      viewBox="0 0 400 260"
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0 }}
      aria-hidden="true"
    >
      <rect
        x="230" y="148" width="120" height="68"
        fill={C.change} opacity={active ? 0.12 : 0}
        style={{ transition: "opacity .4s ease" }}
        rx="3"
      />
      <rect
        ref={rectRef}
        x="230" y="148" width="120" height="68"
        fill="none"
        stroke={C.change}
        strokeWidth="2"
        rx="3"
        strokeDasharray="260"
        strokeDashoffset="260"
        style={{ transition: reduced ? "none" : "stroke-dashoffset 0.9s ease forwards" }}
      />
      {active && (
        <g>
          <rect x="230" y="132" width="104" height="15" fill={C.change} rx="3" />
          <text x="236" y="143" fontSize="9" fill="#FFFFFF" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
            change region · +14%
          </text>
        </g>
      )}
    </svg>
  );
}

/* ── satellite tile ── */
function SatTile({ phase }) {
  const opticalVisible = phase === "optical" || phase === "wipe";
  const sarVisible = phase === "sar" || phase === "evidence";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 10, overflow: "hidden", background: "#0A0E14" }}>
      <div style={{ position: "absolute", inset: 0, opacity: opticalVisible ? 1 : 0, transition: "opacity .8s ease" }}>
        <OpticalScene />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: sarVisible ? 1 : 0, transition: "opacity .8s ease" }}>
        <SarScene />
      </div>
      <BoundingBox active={phase === "evidence"} reduced={false} />
      {phase === "wipe" && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 45%, rgba(56,189,248,0.25) 50%, rgba(10,14,20,0.5) 55%)", pointerEvents: "none" }} />
      )}
    </div>
  );
}

function OpticalScene() {
  return (
    <svg viewBox="0 0 400 260" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="260" fill="#3A4A2E" />
      <rect x="10" y="20" width="150" height="90" fill="#5C7A3B" opacity="0.9" />
      <rect x="170" y="20" width="90" height="55" fill="#5C7A3B" opacity="0.7" />
      <rect x="10" y="120" width="90" height="60" fill="#5C7A3B" opacity="0.8" />
      <ellipse cx="330" cy="60" rx="55" ry="38" fill="#1C3A4A" />
      {[...Array(12)].map((_, i) => (
        <rect key={i} x={200 + (i % 5) * 22} y={150 + Math.floor(i / 5) * 20} width="14" height="14" rx="1.5" fill="#8A7350" opacity="0.95" />
      ))}
      <path d="M40 180 L200 158 L260 200 L380 190" stroke="#B9A77A" strokeWidth="2" fill="none" opacity="0.6" />
    </svg>
  );
}

function SarScene() {
  return (
    <svg viewBox="0 0 400 260" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="sar-speckle-ev" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#12181C" />
          <circle cx="1" cy="1" r="0.6" fill="rgba(255,255,255,0.07)" />
          <circle cx="3" cy="3" r="0.5" fill="rgba(255,255,255,0.05)" />
        </pattern>
      </defs>
      <rect width="400" height="260" fill="url(#sar-speckle-ev)" />
      <rect x="10" y="20" width="150" height="90" fill="#223038" opacity="0.85" />
      <rect x="170" y="20" width="90" height="55" fill="#223038" opacity="0.65" />
      <rect x="10" y="120" width="90" height="60" fill="#223038" opacity="0.75" />
      <ellipse cx="330" cy="60" rx="55" ry="38" fill="#0A0E11" />
      {[...Array(12)].map((_, i) => (
        <rect key={i} x={200 + (i % 5) * 22} y={150 + Math.floor(i / 5) * 20} width="14" height="14" rx="1.5" fill="#3A4A50" opacity="0.95" />
      ))}
      <path d="M40 180 L200 158 L260 200 L380 190" stroke="rgba(255,255,255,0.18)" strokeWidth="2" fill="none" />
    </svg>
  );
}

/* ── exported component ── */
export default function EvidenceReveal({ visible = false }) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState("optical");
  const timers = useRef([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!visible) { setPhase("optical"); return; }
    if (reduced) { setPhase("evidence"); return; }
    const t1 = setTimeout(() => setPhase("wipe"), 600);
    const t2 = setTimeout(() => setPhase("sar"), 1400);
    const t3 = setTimeout(() => setPhase("evidence"), 2200);
    timers.current = [t1, t2, t3];
    return () => timers.current.forEach(clearTimeout);
  }, [visible, reduced]);

  const captionIdx = phase === "optical" ? 0 : phase === "wipe" || phase === "sar" ? 1 : 2;

  return (
    <div
      style={{
        maxWidth: 680, margin: "0 auto", width: "100%",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: reduced ? "none" : "opacity .6s ease, transform .6s ease",
      }}
    >
      {/* caption track — white glass pills on dark imagery */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 18 }}>
        {CAPTION_STEPS.map((s, i) => (
          <span
            key={s}
            style={{
              ...mono, fontSize: 11,
              color: i === captionIdx ? "#FFFFFF" : "rgba(255,255,255,0.38)",
              transition: "color .3s ease",
              display: "flex", alignItems: "center", gap: 6,
              background: i === captionIdx ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
              border: i === captionIdx ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.1)",
              padding: "4px 12px", borderRadius: 20,
              backdropFilter: "blur(6px)",
            }}
          >
            {i > 0 && <span style={{ opacity: 0.3 }}>→</span>}
            {s}
          </span>
        ))}
      </div>

      {/* satellite tile */}
      <div style={{ position: "relative", aspectRatio: "400/260", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
        <SatTile phase={phase} />

        {/* modality badge */}
        <div style={{
          position: "absolute", top: 10, left: 10,
          ...mono, fontSize: 10, padding: "4px 10px", borderRadius: 6,
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "#FFFFFF",
          backdropFilter: "blur(8px)",
          transition: "all .4s ease",
        }}>
          {phase === "sar" || phase === "evidence" ? "SAR · Synthetic Aperture Radar" : "OPTICAL · Multispectral"}
        </div>

        {/* coords */}
        <div style={{ position: "absolute", bottom: 10, right: 10, ...mono, fontSize: 9.5, color: "rgba(255,255,255,0.4)" }}>
          18.52°N, 73.85°E
        </div>
      </div>

      {/* answer card — white card on dark imagery */}
      <div style={{
        marginTop: 14, padding: "13px 18px",
        background: "rgba(255,255,255,0.95)",
        border: `1px solid ${phase === "evidence" ? `rgba(109,40,217,0.4)` : "rgba(255,255,255,0.25)"}`,
        borderRadius: 10,
        backdropFilter: "blur(16px)",
        transition: "border-color .4s ease, box-shadow .4s ease",
        boxShadow: phase === "evidence" ? "0 4px 24px rgba(109,40,217,0.12)" : "0 4px 16px rgba(0,0,0,0.15)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ ...mono, fontSize: 10, color: C.faint, flexShrink: 0 }}>answer →</span>
        <TypedText text={ANSWER} active={phase === "evidence"} reduced={reduced} />
      </div>

      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}
