import { useEffect, useRef, useState } from "react";

const C = {
  bg: "#0A0E14", panel: "#101720", border: "#1E2A36",
  text: "#E7EDF3", dim: "#8996A6", faint: "#4C5A68",
  optical: "#F2A93B", sar: "#4FD1C5", change: "#EF5DA8", good: "#6EE7A0",
};
const mono = { fontFamily: "'JetBrains Mono', monospace" };

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
    <span style={{ ...mono, fontSize: 13, color: C.good }}>
      {displayed}
      {active && displayed.length < text.length && (
        <span style={{ opacity: 0.7, animation: "blink .7s step-end infinite" }}>|</span>
      )}
    </span>
  );
}

/* ── animated SVG bounding box ── */
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
      {/* change region highlight */}
      <rect
        x="230" y="148" width="120" height="68"
        fill={C.change} opacity={active ? 0.14 : 0}
        style={{ transition: "opacity .4s ease" }}
        rx="3"
      />
      {/* animated bounding box stroke */}
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
      {/* label */}
      {active && (
        <g>
          <rect x="230" y="132" width="100" height="14" fill={C.change} rx="2" />
          <text x="236" y="142" fontSize="9" fill="#160A11" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
            change region · +14%
          </text>
        </g>
      )}
    </svg>
  );
}

/* ── satellite tile (optical vs SAR crossfade) ── */
function SatTile({ phase }) {
  // optical = SVG land-cover scene; sar = grayscale speckled version
  const opticalVisible = phase === "optical" || phase === "wipe";
  const sarVisible = phase === "sar" || phase === "evidence";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 8, overflow: "hidden", background: "#050709" }}>
      {/* optical layer */}
      <div style={{ position: "absolute", inset: 0, opacity: opticalVisible ? 1 : 0, transition: "opacity .8s ease" }}>
        <OpticalScene />
      </div>
      {/* SAR layer */}
      <div style={{ position: "absolute", inset: 0, opacity: sarVisible ? 1 : 0, transition: "opacity .8s ease" }}>
        <SarScene />
      </div>
      {/* bounding box overlay */}
      <BoundingBox active={phase === "evidence"} reduced={false} />
      {/* wipe divider */}
      {phase === "wipe" && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 45%, #4FD1C544 50%, #0A0E14 55%)", pointerEvents: "none" }} />
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
      <ellipse cx="330" cy="60" rx="55" ry="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
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
          <circle cx="2" cy="1.5" r="0.4" fill="rgba(255,255,255,0.04)" />
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
  const [phase, setPhase] = useState("optical"); // optical → wipe → sar → evidence
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
      {/* caption track */}
      <div style={{ display: "flex", gap: 24, justifyContent: "center", marginBottom: 20 }}>
        {CAPTION_STEPS.map((s, i) => (
          <span
            key={s}
            style={{
              ...mono, fontSize: 11,
              color: i === captionIdx ? C.optical : C.faint,
              transition: "color .3s ease",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {i > 0 && <span style={{ color: C.border }}>→</span>}
            {s}
          </span>
        ))}
      </div>

      {/* tile */}
      <div style={{ position: "relative", aspectRatio: "400/260", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
        <SatTile phase={phase} />
        {/* modality badge */}
        <div style={{
          position: "absolute", top: 10, left: 10,
          ...mono, fontSize: 10, padding: "3px 8px", borderRadius: 5,
          background: phase === "sar" || phase === "evidence" ? `${C.sar}22` : `${C.optical}22`,
          border: `1px solid ${phase === "sar" || phase === "evidence" ? C.sar + "55" : C.optical + "55"}`,
          color: phase === "sar" || phase === "evidence" ? C.sar : C.optical,
          transition: "all .4s ease",
        }}>
          {phase === "sar" || phase === "evidence" ? "SAR · Synthetic Aperture Radar" : "OPTICAL · Multispectral"}
        </div>
        {/* coords */}
        <div style={{ position: "absolute", bottom: 10, right: 10, ...mono, fontSize: 9.5, color: C.faint }}>
          18.52°N, 73.85°E
        </div>
      </div>

      {/* answer line */}
      <div style={{
        marginTop: 16, padding: "12px 16px",
        background: C.panel, border: `1px solid ${phase === "evidence" ? C.change + "44" : C.border}`,
        borderRadius: 8, transition: "border-color .4s ease",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ ...mono, fontSize: 10, color: C.faint, flexShrink: 0 }}>answer →</span>
        <TypedText text={ANSWER} active={phase === "evidence"} reduced={reduced} />
      </div>

      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}
