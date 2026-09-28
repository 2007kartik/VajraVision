import { useState } from "react";
import { Shield, Cpu, Database, Layers, CheckCircle2, Sparkles } from "lucide-react";

const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const sans = { fontFamily: "'Inter', system-ui, sans-serif" };

const STATS = [
  {
    value: "5",
    unit: "Specialist models",
    detail: "VQA · Captioning · Grounding · Change · Fusion",
    color: "#f59e0b",
    badgeBg: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.3)",
    glow: "rgba(245, 158, 11, 0.15)",
    icon: Cpu,
  },
  {
    value: "4",
    unit: "Benchmark datasets",
    detail: "BigEarthNet · VRSBench · RSVQA · CDVQA",
    color: "#38bdf8",
    badgeBg: "rgba(56, 189, 248, 0.12)",
    border: "rgba(56, 189, 248, 0.3)",
    glow: "rgba(56, 189, 248, 0.15)",
    icon: Database,
  },
  {
    value: "3",
    unit: "Input configurations",
    detail: "Single · Optical+SAR pair · Bi-temporal pair",
    color: "#a78bfa",
    badgeBg: "rgba(167, 139, 250, 0.12)",
    border: "rgba(167, 139, 250, 0.3)",
    glow: "rgba(167, 139, 250, 0.15)",
    icon: Layers,
  },
  {
    value: "GeoTIFF",
    unit: "Native format",
    detail: "TIFF · PNG · JPEG full radiometric support",
    color: "#34d399",
    badgeBg: "rgba(52, 211, 153, 0.12)",
    border: "rgba(52, 211, 153, 0.3)",
    glow: "rgba(52, 211, 153, 0.15)",
    icon: CheckCircle2,
  },
  {
    value: "ISRO / SAC",
    unit: "Evaluation partner",
    detail: "Cartosat-2S optical · RISAT-1 SAR co-registration",
    color: "#60a5fa",
    badgeBg: "rgba(96, 165, 250, 0.12)",
    border: "rgba(96, 165, 250, 0.3)",
    glow: "rgba(96, 165, 250, 0.15)",
    icon: Shield,
  },
  {
    value: "VLM",
    unit: "Vision backbone",
    detail: "Remote-sensing adapted multi-agent pipeline",
    color: "#f43f5e",
    badgeBg: "rgba(244, 63, 94, 0.12)",
    border: "rgba(244, 63, 94, 0.3)",
    glow: "rgba(244, 63, 94, 0.15)",
    icon: Sparkles,
  },
];

export default function CredibilityStrip() {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <section
      id="capabilities"
      aria-label="Platform specifications"
      style={{
        position: "relative",
        background: "linear-gradient(180deg, rgba(5,8,15,0.7) 0%, rgba(9,14,26,0.95) 50%, rgba(5,8,15,0.85) 100%)",
        borderTop: "1px solid rgba(56, 189, 248, 0.12)",
        borderBottom: "1px solid rgba(56, 189, 248, 0.12)",
        padding: "90px 24px",
        overflow: "hidden",
      }}
    >
      {/* Background subtle radial glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 800,
          height: 350,
          background: "radial-gradient(ellipse, rgba(37, 99, 235, 0.08) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              ...mono,
              fontSize: 11,
              color: "#38bdf8",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: 16,
              background: "rgba(56, 189, 248, 0.08)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              padding: "6px 16px",
              borderRadius: 24,
              boxShadow: "0 0 16px rgba(56, 189, 248, 0.12)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#38bdf8",
                boxShadow: "0 0 8px #38bdf8",
                display: "inline-block",
              }}
            />
            Platform Telemetry & Specs
          </div>

          <h2
            style={{
              ...sans,
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              color: "#f8fafc",
              letterSpacing: -1,
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            Engineered for Real-World Earth Observation
          </h2>
          <p
            style={{
              ...sans,
              fontSize: "clamp(15px, 1.8vw, 17px)",
              color: "#94a3b8",
              maxWidth: 580,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Strictly aligned with ISRO / SAC operational parameters — accommodating multi-modal sensors,
            rigorous co-registration, and high-precision evaluation benchmarks.
          </p>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 18,
          }}
        >
          {STATS.map((s, idx) => {
            const Icon = s.icon;
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={s.unit}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  background: isHovered
                    ? "linear-gradient(135deg, rgba(16, 24, 44, 0.85) 0%, rgba(12, 18, 34, 0.95) 100%)"
                    : "rgba(11, 17, 32, 0.65)",
                  backdropFilter: "blur(16px)",
                  padding: "26px 22px",
                  borderRadius: 16,
                  border: `1px solid ${isHovered ? s.border : "rgba(255, 255, 255, 0.08)"}`,
                  boxShadow: isHovered
                    ? `0 12px 32px -8px ${s.glow}, 0 0 20px -2px ${s.glow}`
                    : "0 4px 20px rgba(0, 0, 0, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                  cursor: "default",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Subtle top edge glow bar on hover */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: isHovered
                      ? `linear-gradient(90deg, transparent, ${s.color}, transparent)`
                      : "transparent",
                    transition: "all 0.3s ease",
                  }}
                />

                {/* Top row: Icon + Value chip */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: s.badgeBg,
                      border: `1px solid ${s.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: s.color,
                    }}
                  >
                    <Icon size={18} strokeWidth={2.2} />
                  </div>

                  <div
                    style={{
                      ...mono,
                      fontSize: 10,
                      color: isHovered ? s.color : "#64748b",
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    STATUS: READY
                  </div>
                </div>

                {/* Stat Value */}
                <div>
                  <div
                    style={{
                      fontSize: "clamp(24px, 2.5vw, 30px)",
                      fontWeight: 800,
                      color: isHovered ? "#ffffff" : s.color,
                      ...sans,
                      letterSpacing: -0.8,
                      lineHeight: 1.1,
                      marginBottom: 4,
                      transition: "color 0.2s ease",
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", ...sans }}>
                    {s.unit}
                  </div>
                </div>

                {/* Detail */}
                <div
                  style={{
                    fontSize: 12,
                    color: "#94a3b8",
                    ...mono,
                    lineHeight: 1.5,
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                    paddingTop: 10,
                    marginTop: "auto",
                  }}
                >
                  {s.detail}
                </div>
              </div>
            );
          })}
        </div>

        {/* Telemetry Footnote HUD Bar */}
        <div
          style={{
            marginTop: 40,
            padding: "16px 24px",
            background: "rgba(11, 17, 32, 0.55)",
            backdropFilter: "blur(12px)",
            borderRadius: 12,
            border: "1px solid rgba(56, 189, 248, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
            ...mono,
            fontSize: 11.5,
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 10px #10b981",
              }}
            />
            <span style={{ color: "#94a3b8" }}>
              TRAINED ON BIGEARTHNET · VALIDATED ON VRSBENCH, RSVQA & CDVQA
            </span>
          </div>
          <div style={{ color: "#38bdf8", display: "flex", alignItems: "center", gap: 6 }}>
            <span>ISRO SAC/DECU EVALUATION COMPLIANT</span>
            <span>✓</span>
          </div>
        </div>
      </div>
    </section>
  );
}
