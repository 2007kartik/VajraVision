import { useRef, useState, useEffect, lazy, Suspense } from "react";
import { ChevronRight, ChevronDown, Satellite, Menu, X as XIcon, Zap, Shield, Globe, Cpu, Moon, Sun } from "lucide-react";
import CredibilityStrip from "./components/CredibilityStrip.jsx";
import Console from "./Console.jsx";
import satOptical from "./assets/optical.jpg";
import satSar from "./assets/sar.jpg";
import satBitemporal from "./assets/bi-temporal.jpg";

import Hero from "./components/Hero.jsx";

const C = {
  bg:        "var(--bg)",
  bgAlt:     "var(--bgAlt)",
  surface:   "var(--surface)",
  panel:     "var(--panel)",
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
};

const mono  = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const disp  = { fontFamily: "'Inter', system-ui, sans-serif" };

function usePrefersReducedMotion() {
  const [v, setV] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const h = (e) => setV(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return v;
}

/* ── navbar ── */
function Navbar({ reducedMotion }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === "light" ? "dark" : "light"));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "How it works", href: "#how-it-works" },
    { label: "Capabilities",  href: "#capabilities" },
    { label: "Console",       href: "#console" },
  ];

  const linkStyle = {
    ...disp, fontSize: 14, fontWeight: 500, color: C.dim,
    textDecoration: "none", padding: "6px 0", letterSpacing: 0,
    transition: "color .15s ease",
  };

  return (
    <>
      <nav
        aria-label="Main navigation"
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          borderBottom: `1px solid ${scrolled ? C.border : "transparent"}`,
          background: scrolled ? "var(--panel)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          transition: reducedMotion ? "none" : "background .3s ease, border-color .3s ease",
        }}
      >
        <div style={{
          maxWidth: 1320, margin: "0 auto",
          padding: "0 24px", height: 64,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* logo */}
          <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: `linear-gradient(135deg, ${C.accent}, #1D4ED8)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, boxShadow: `0 2px 8px ${C.accent}30`,
            }}>
              <Satellite size={17} color="#FFFFFF" strokeWidth={2} />
            </div>
            <span style={{ ...disp, fontWeight: 700, fontSize: 15.5, color: C.text, letterSpacing: -0.3 }}>SatQuery AI</span>
            <span style={{
              ...mono, fontSize: 10, color: C.faint,
              border: `1px solid ${C.border}`,
              background: C.bgAlt,
              padding: "2px 7px", borderRadius: 5,
            }}>
              ISRO / SAC
            </span>
          </a>

          {/* desktop links */}
          <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="nav-desktop">
            {navLinks.map(l => (
              <a
                key={l.label}
                href={l.href}
                style={linkStyle}
                onMouseEnter={e => e.currentTarget.style.color = C.text}
                onMouseLeave={e => e.currentTarget.style.color = C.dim}
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* CTA + mobile toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a
              href="#console"
              style={{
                ...disp, fontSize: 13.5, fontWeight: 600,
                background: C.accent, color: "#FFFFFF",
                padding: "9px 20px", borderRadius: 8,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7,
                transition: "opacity .15s ease, transform .15s ease, box-shadow .15s ease",
                whiteSpace: "nowrap",
                boxShadow: `0 1px 3px ${C.accent}25, 0 4px 12px ${C.accent}20`,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.92"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Open console <ChevronRight size={13} strokeWidth={2.5} />
            </a>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", color: C.dim, display: "flex", padding: 7, borderRadius: 7 }}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="nav-mobile-btn"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen(o => !o)}
              style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", color: C.dim, display: "none", padding: 7, borderRadius: 7 }}
            >
              {mobileOpen ? <XIcon size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* mobile drawer */}
        {mobileOpen && (
          <div style={{
            background: C.panel, borderTop: `1px solid ${C.border}`,
            padding: "16px 24px 24px", boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
          }}>
            {navLinks.map(l => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                style={{ ...linkStyle, display: "block", padding: "13px 0", borderBottom: `1px solid ${C.border}`, color: C.text }}
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </nav>
      <style>{`
        @media (max-width: 680px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}


/* ── Interactive Satellite Modality Showcase (How It Works) ── */
function HowItWorks({ reducedMotion }) {
  const [activeTab, setActiveTab] = useState("optical");
  const [showOverlay, setShowOverlay] = useState(true);

  const MODALITIES = {
    optical: {
      id: "optical",
      label: "Optical (High-Res)",
      badge: "RGB + NIR · 0.5m GSD",
      badgeColor: "#F59E0B",
      badgeBg: "rgba(245,158,11,0.15)",
      image: satOptical,
      sensor: "Cartosat-2 / Sentinel-2 MSI",
      resolution: "0.5m / pixel (Very High Resolution)",
      bands: "B4 (Red), B3 (Green), B2 (Blue), B8 (NIR)",
      target: "Marina Bay & Coastal Infrastructure",
      coords: "1.29027° N, 103.851959° E",
      specialist: "RS-VQA (BigEarthNet Specialist)",
      vlmDecision: "Detected commercial stadium complex, transit bridge, deep-water port approach.",
      confidence: "98.4%",
      detections: [
        { label: "Stadium Complex", conf: "0.98", x: "54%", y: "15%", w: "26%", h: "35%", color: "#F59E0B" },
        { label: "Transit Bridge", conf: "0.96", x: "8%", y: "20%", w: "45%", h: "40%", color: "#38BDF8" },
      ],
    },
    sar: {
      id: "sar",
      label: "SAR (Synthetic Aperture Radar)",
      badge: "C-Band Microwave · Cloud-Penetrating",
      badgeColor: "#38BDF8",
      badgeBg: "rgba(56,189,248,0.15)",
      image: satSar,
      sensor: "RISAT-1A / Sentinel-1 C-Band",
      resolution: "1.0m / pixel (Synthetic Aperture)",
      bands: "VV + VH dual-polarization backscatter (dB)",
      target: "Petrochemical & Maritime Port Complex",
      coords: "18.9220° N, 72.8347° E",
      specialist: "Optical–SAR Fusion Specialist",
      vlmDecision: "Penetrated haze/smoke. Identified high dielectric metal storage tanks and tanker moorings.",
      confidence: "96.8%",
      detections: [
        { label: "Refinery Tanks", conf: "0.97", x: "22%", y: "45%", w: "38%", h: "40%", color: "#38BDF8" },
        { label: "Container Berths", conf: "0.94", x: "60%", y: "10%", w: "32%", h: "60%", color: "#A78BFA" },
      ],
    },
    bitemporal: {
      id: "bitemporal",
      label: "Bi-Temporal (Change Detection)",
      badge: "T1 (2022) vs T2 (2024) · Siamese Diff",
      badgeColor: "#A78BFA",
      badgeBg: "rgba(167,139,250,0.15)",
      image: satBitemporal,
      sensor: "Bi-temporal Optical Pair (Multi-date)",
      resolution: "0.8m Co-registered Grid",
      bands: "Temporal Feature Differencing Matrix",
      target: "Urban Expansion & Land Conversion",
      coords: "22.9068° S, 43.1729° W",
      specialist: "Change-VQA (CDVQA Specialist)",
      vlmDecision: "Quantified +14% built-up surface area increase from baseline T1 to target T2.",
      confidence: "97.2%",
      detections: [
        { label: "New Construction (+14%)", conf: "0.97", x: "52%", y: "52%", w: "44%", h: "44%", color: "#A78BFA" },
        { label: "Cleared Forest Patch", conf: "0.93", x: "4%", y: "4%", w: "44%", h: "44%", color: "#10B981" },
      ],
    },
  };

  const current = MODALITIES[activeTab];

  return (
    <div
      id="how-it-works"
      style={{
        position: "relative",
        background: "var(--bgAlt)",
        color: "var(--text)",
        padding: "96px 24px",
        overflow: "hidden",
        borderTop: `1px solid var(--border)`,
        borderBottom: `1px solid var(--border)`,
      }}
    >
      {/* subtle space glow background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(37,99,235,0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(109,40,217,0.08) 0%, transparent 50%)
          `,
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 2 }}>
        {/* Section Header */}
        <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 48px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              ...mono,
              fontSize: 11,
              color: "#38BDF8",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              padding: "6px 14px",
              borderRadius: 20,
              background: "rgba(56,189,248,0.1)",
              border: "1px solid rgba(56,189,248,0.25)",
              marginBottom: 20,
            }}
          >
            <Satellite size={14} color="#38BDF8" />
            Sensor Telemetry & Multimodal Analysis
          </div>

          <h2
            style={{
              ...disp,
              fontSize: "clamp(28px, 3.6vw, 44px)",
              fontWeight: 800,
              letterSpacing: -1.2,
              lineHeight: 1.15,
              margin: "0 0 16px",
              color: "var(--text)",
            }}
          >
            How SatQuery AI Reads Orbit-to-Pixel Data
          </h2>

          <p style={{ fontSize: 16, color: "var(--dim)", lineHeight: 1.7, margin: 0 }}>
            Inspect real Earth Observation payloads from <span style={{ color: "var(--text)", fontWeight: 600 }}>src/assets</span>.
            Switch between sensor modalities to examine how our specialized VLM pipeline decodes optical detail,
            radar backscatter, and temporal land cover changes.
          </p>
        </div>

        {/* Modality Selector Tabs */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginBottom: 36,
            flexWrap: "wrap",
          }}
        >
          {Object.values(MODALITIES).map((m) => {
            const isSelected = activeTab === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveTab(m.id)}
                style={{
                  ...disp,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "12px 22px",
                  borderRadius: 10,
                  border: `1px solid ${isSelected ? m.badgeColor : "var(--border)"}`,
                  background: isSelected ? m.badgeBg : "var(--surface)",
                  color: isSelected ? "var(--text)" : "var(--dim)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "all 0.2s ease",
                  boxShadow: isSelected ? `0 4px 20px ${m.badgeColor}22` : "none",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: m.badgeColor,
                    boxShadow: isSelected ? `0 0 8px ${m.badgeColor}` : "none",
                  }}
                />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Main Display Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: 32,
            background: "var(--bg)",
            border: `1px solid var(--border)`,
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 20px 50px rgba(0,0,0,0.1)",
          }}
          className="telemetry-grid"
        >
          {/* LEFT: Satellite Imagery Viewport */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Viewport Header HUD */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 14px",
                background: "var(--panel)",
                borderRadius: 8,
                border: `1px solid var(--border)`,
                ...mono,
                fontSize: 11,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: current.badgeColor, fontWeight: 700 }}>● LIVE FEED</span>
                <span style={{ color: "var(--dim)" }}>|</span>
                <span style={{ color: "var(--text)" }}>{current.sensor}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ color: "var(--dim)" }}>{current.coords}</span>
                <button
                  onClick={() => setShowOverlay(!showOverlay)}
                  style={{
                    background: showOverlay ? "var(--accentLt)" : "transparent",
                    border: `1px solid ${showOverlay ? "var(--accent)" : "var(--border)"}`,
                    color: showOverlay ? "var(--accent)" : "var(--dim)",
                    padding: "3px 9px",
                    borderRadius: 5,
                    cursor: "pointer",
                    fontSize: 10,
                  }}
                >
                  {showOverlay ? "AI Overlays: ON" : "AI Overlays: OFF"}
                </button>
              </div>
            </div>

            {/* Actual Satellite Image from src/assets */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 440,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid #1E293B",
                background: "#020408",
              }}
            >
              <img
                src={current.image}
                alt={current.label}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />

              {/* Grid overlay lines */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `
                    linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
                  `,
                  backgroundSize: "40px 40px",
                  pointerEvents: "none",
                }}
              />

              {/* AI Detections & Bounding Boxes */}
              {showOverlay &&
                current.detections.map((det, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: "absolute",
                      left: det.x,
                      top: det.y,
                      width: det.w,
                      height: det.h,
                      border: `2px solid ${det.color}`,
                      borderRadius: 4,
                      boxShadow: `0 0 12px ${det.color}55, inset 0 0 12px ${det.color}22`,
                      pointerEvents: "none",
                      transition: "all 0.4s ease",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: -18,
                        left: -2,
                        background: det.color,
                        color: "#000000",
                        ...mono,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 3,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {det.label} · {det.conf}
                    </span>
                  </div>
                ))}

              {/* Bottom Telemetry HUD */}
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  right: 12,
                  padding: "8px 14px",
                  background: "rgba(11,17,30,0.85)",
                  backdropFilter: "blur(8px)",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  ...mono,
                  fontSize: 10,
                  color: "#94A3B8",
                }}
              >
                <span>RES: {current.resolution}</span>
                <span>BANDS: {current.bands}</span>
                <span style={{ color: "#34D399" }}>CLOUD COVER: 0.0%</span>
              </div>
            </div>
          </div>

          {/* RIGHT: VLM Analysis & Decision Card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              background: "var(--panel)",
              border: `1px solid var(--border)`,
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div>
              {/* Specialist Routing Header */}
              <div style={{ ...mono, fontSize: 11, color: "var(--faint)", marginBottom: 6 }}>
                ROUTED SPECIALIST MODEL
              </div>
              <div
                style={{
                  ...disp,
                  fontSize: 19,
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Cpu size={20} color={current.badgeColor} />
                {current.specialist}
              </div>

              {/* Specialist Confidence Meter */}
              <div style={{ marginBottom: 24, background: "var(--bgAlt)", padding: "12px 16px", borderRadius: 8, border: `1px solid var(--border)` }}>
                <div style={{ display: "flex", justifyContent: "space-between", ...mono, fontSize: 11, marginBottom: 8 }}>
                  <span style={{ color: "var(--dim)" }}>Classification Confidence</span>
                  <span style={{ color: "var(--good)", fontWeight: 700 }}>{current.confidence}</span>
                </div>
                <div style={{ height: 6, width: "100%", background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: current.confidence,
                      background: "linear-gradient(90deg, #3B82F6, #10B981)",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>

              {/* VLM Synthesis Evidence */}
              <div style={{ ...mono, fontSize: 11, color: "var(--faint)", marginBottom: 8 }}>
                AI SYNTHESIS & REASONING TRACE
              </div>
              <div
                style={{
                  padding: "14px 16px",
                  background: "var(--surface)",
                  border: `1px solid var(--border)`,
                  borderRadius: 8,
                  fontSize: 13.5,
                  color: "var(--text)",
                  lineHeight: 1.6,
                  marginBottom: 24,
                }}
              >
                "{current.vlmDecision}"
              </div>

              {/* Sensor Technical Specifications */}
              <div style={{ ...mono, fontSize: 11, color: "var(--faint)", marginBottom: 10 }}>
                SENSOR TELEMETRY SPECS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, ...mono, fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid var(--border)`, paddingBottom: 6 }}>
                  <span style={{ color: "var(--dim)" }}>Platform:</span>
                  <span style={{ color: "var(--text)" }}>{current.sensor}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid var(--border)`, paddingBottom: 6 }}>
                  <span style={{ color: "var(--dim)" }}>Target Area:</span>
                  <span style={{ color: "var(--text)" }}>{current.target}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid var(--border)`, paddingBottom: 6 }}>
                  <span style={{ color: "var(--dim)" }}>Spectral Config:</span>
                  <span style={{ color: "var(--text)" }}>{current.bands.split(",")[0]}</span>
                </div>
              </div>
            </div>

            {/* CTA to jump to Console */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid var(--border)` }}>
              <a
                href="#console"
                style={{
                  ...disp,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  padding: "12px",
                  borderRadius: 8,
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: 13.5,
                  textDecoration: "none",
                  boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1D4ED8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#2563EB")}
              >
                Analyze this sample in Console <ChevronRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .telemetry-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ── hero section ── */
function HeroSection({ reducedMotion }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShow(true), 120);
    return () => clearTimeout(id);
  }, []);

  const SPACE_BG = "transparent"; // stars come from Starfield canvas

  return (
    <div style={{
      position: "relative", minHeight: "100vh",
      background: SPACE_BG,
      display: "flex", alignItems: "center",
      overflow: "hidden", paddingTop: 64,
    }}>

      {/* Deep space radial gradient centered on globe side */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 65% 70% at 70% 48%, rgba(10,30,80,0.55) 0%, transparent 70%),
          radial-gradient(ellipse 45% 45% at 18% 70%, rgba(30,10,70,0.3) 0%, transparent 60%)
        `,
      }} />

      {/* Subtle grid of dots (space telemetry feel) */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, opacity: 0.12 }}
        aria-hidden="true"
      >
        <defs>
          <pattern id="space-dot-grid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#60a5fa" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#space-dot-grid)" />
      </svg>

      {/* content row */}
      <div style={{
        position: "relative", zIndex: 2,
        maxWidth: 1320, margin: "0 auto", width: "100%",
        padding: "64px 24px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 64,
        alignItems: "center",
        minHeight: "calc(100vh - 64px)",
      }} className="hero-grid">

        {/* LEFT — headline */}
        <div style={{
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(28px)",
          transition: reducedMotion ? "none" : "opacity .9s ease, transform .9s ease",
        }}>
          {/* eyebrow badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            ...mono, fontSize: 11, color: "#38bdf8",
            letterSpacing: 0.8,
            marginBottom: 24,
            background: "rgba(56,189,248,0.1)",
            border: "1px solid rgba(56,189,248,0.3)",
            padding: "5px 14px", borderRadius: 20,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#38bdf8",
              display: "inline-block",
              boxShadow: "0 0 8px #38bdf8",
              animation: "spulse 2s ease-in-out infinite",
            }} />
            Agentic vision-language assistant · Earth observation
          </div>

          <h1 style={{
            ...disp, fontSize: "clamp(36px, 4.8vw, 68px)", fontWeight: 800,
            lineHeight: 1.06, letterSpacing: -2.5, margin: "0 0 24px",
            color: "#f8fafc",
          }}>
            Ask your<br />
            satellite imagery<br />
            <span style={{
              background: "linear-gradient(135deg, #38bdf8, #818cf8, #a78bfa)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 20px rgba(99,102,241,0.4))",
            }}>anything.</span>
          </h1>

          <p style={{ fontSize: 17, color: "#94a3b8", lineHeight: 1.75, maxWidth: 480, marginBottom: 36 }}>
            One query. Any image type. SatQuery AI reads your satellite imagery —
            optical, SAR, or bi-temporal pairs — classifies your intent, and routes
            to the right specialist model automatically.
          </p>

          {/* input type pills */}
          <div style={{ display: "flex", gap: 8, marginBottom: 40, flexWrap: "wrap" }}>
            {[
              { label: "Single image",       bg: "rgba(245,158,11,0.12)",  color: "#f59e0b",  border: "rgba(245,158,11,0.35)" },
              { label: "Optical + SAR pair", bg: "rgba(56,189,248,0.1)",   color: "#38bdf8",  border: "rgba(56,189,248,0.3)" },
              { label: "Bi-temporal pair",   bg: "rgba(167,139,250,0.1)",  color: "#a78bfa",  border: "rgba(167,139,250,0.3)" },
            ].map(({ label, bg, color, border }) => (
              <span key={label} style={{
                ...mono, fontSize: 11.5, color, fontWeight: 500,
                border: `1px solid ${border}`, background: bg,
                padding: "5px 13px", borderRadius: 20, letterSpacing: 0.1,
              }}>{label}</span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href="#console"
              style={{
                ...disp, fontSize: 14, fontWeight: 700,
                background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                color: "#FFFFFF",
                padding: "13px 28px", borderRadius: 10, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 8,
                transition: "opacity .15s ease, transform .15s ease, box-shadow .15s ease",
                boxShadow: "0 4px 20px rgba(59,130,246,0.4), 0 0 40px rgba(99,102,241,0.15)",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(59,130,246,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(59,130,246,0.4)"; }}
            >
              Open console <ChevronRight size={16} strokeWidth={2.5} />
            </a>
            <button
              onClick={() => document.querySelector("#how-it-works")?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" })}
              style={{
                ...disp, fontSize: 14, fontWeight: 600,
                background: "rgba(255,255,255,0.05)",
                color: "#94a3b8",
                padding: "13px 24px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
                backdropFilter: "blur(8px)",
                transition: "border-color .2s ease, color .2s ease, background .2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(56,189,248,0.4)"; e.currentTarget.style.color = "#e2e8f0"; e.currentTarget.style.background = "rgba(56,189,248,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            >
              See it work
            </button>
          </div>

          {/* social proof bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 20, marginTop: 40,
            paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.08)",
            flexWrap: "wrap",
          }}>
            {[
              { icon: <Shield size={13} />, text: "ISRO / SAC evaluated" },
              { icon: <Globe size={13} />,  text: "GeoTIFF · TIFF · JPEG" },
              { icon: <Zap size={13} />,    text: "5 specialist models" },
            ].map(({ icon, text }) => (
              <div key={text} style={{
                display: "flex", alignItems: "center", gap: 6,
                ...disp, fontSize: 12.5, color: "#64748b", fontWeight: 500,
              }}>
                <span style={{ color: "#38bdf8" }}>{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — 3D globe in a deep space container */}
        <div
          className="hero-globe"
          style={{
            position: "relative",
            width: "100%", aspectRatio: "1 / 1",
            maxWidth: 580, justifySelf: "end",
            opacity: show ? 1 : 0,
            transform: show ? "scale(1)" : "scale(0.93)",
            transition: reducedMotion ? "none" : "opacity 1.1s ease .2s, transform 1.1s ease .2s",
            animation: reducedMotion ? "none" : "float 7s ease-in-out infinite",
          }}
        >
          {/* space backdrop */}
          <div style={{
            position: "absolute", inset: 0,
            borderRadius: "50%",
            background: "radial-gradient(ellipse at 38% 38%, #112044 0%, #0a0f1e 55%, #04060d 100%)",
            boxShadow: [
              "0 0 0 1px rgba(56,189,248,0.08)",
              "0 0 60px 12px rgba(56,189,248,0.07)",
              "0 32px 100px rgba(0,0,0,0.6)",
            ].join(", "),
          }} />
          {/* slow orbit ring decoration */}
          <div style={{
            position: "absolute",
            inset: "-14%",
            borderRadius: "50%",
            border: "1px solid rgba(56,189,248,0.08)",
            animation: "orbRing 32s linear infinite",
          }} />
          <div style={{
            position: "absolute",
            inset: "-22%",
            borderRadius: "50%",
            border: "1px dashed rgba(167,139,250,0.06)",
            animation: "orbRing 52s linear infinite reverse",
          }} />
          <Hero scrollProgress={0} reducedMotion={reducedMotion} />
        </div>
      </div>

      {/* scroll hint */}
      <div style={{
        position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        animation: reducedMotion ? "none" : "nudge 2.2s ease-in-out infinite",
        zIndex: 2,
      }}>
        <span style={{ ...mono, fontSize: 10, color: "#334155", letterSpacing: 1.5 }}>SCROLL</span>
        <ChevronDown size={13} color="#334155" />
      </div>

      <style>{`
        @media (max-width: 860px) {
          .hero-grid { grid-template-columns: 1fr !important; padding: 48px 24px !important; }
          .hero-globe { display: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Starfield Canvas Background ── */
function Starfield() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    const stars = [];
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 320; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.4 + 0.2,
        opacity: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
      });
    }
    let t = 0;
    const draw = () => {
      animId = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.016;
      for (const s of stars) {
        const alpha = s.opacity * (0.6 + 0.4 * Math.sin(t * s.twinkleSpeed * 60 + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", inset: 0, zIndex: 0,
        pointerEvents: "none", width: "100%", height: "100%",
      }}
    />
  );
}

/* ── Scroll-reveal hook ── */
function useScrollReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ── root page ── */
export default function LandingPage() {
  const reducedMotion = usePrefersReducedMotion();

  // Force dark theme for the space feel
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.body.style.background = "#05080f";
  }, []);

  return (
    <div style={{ background: "#05080f", color: C.text, ...disp, position: "relative" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes nudge { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(8px)} }
        @keyframes spulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes fadein { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
        @keyframes revealUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        @keyframes revealLeft { from{opacity:0;transform:translateX(-40px)} to{opacity:1;transform:translateX(0)} }
        @keyframes revealRight { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
        @keyframes shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes orbRing { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .step-pulse { animation: spulse 2s ease-in-out infinite; }
        .fade-in { animation: fadein .4s ease forwards; }
        .reveal-up { opacity: 0; }
        .reveal-up.visible { animation: revealUp 0.7s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .reveal-left { opacity: 0; }
        .reveal-left.visible { animation: revealLeft 0.7s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .reveal-right { opacity: 0; }
        .reveal-right.visible { animation: revealRight 0.7s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .stagger-1 { animation-delay: 0.1s !important; }
        .stagger-2 { animation-delay: 0.2s !important; }
        .stagger-3 { animation-delay: 0.35s !important; }
        .stagger-4 { animation-delay: 0.5s !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0a0f1c; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 4px; }
        ::selection { background: rgba(59,130,246,0.35); color: #e0f2fe; }
      `}</style>

      {/* Animated twinkling starfield */}
      <Starfield />

      {/* Nebula overlay — fixed behind everything */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 70% 55% at 15% 25%, rgba(37,99,235,0.13) 0%, transparent 60%),
          radial-gradient(ellipse 55% 45% at 85% 75%, rgba(109,40,217,0.12) 0%, transparent 60%),
          radial-gradient(ellipse 40% 35% at 55% 50%, rgba(16,185,129,0.05) 0%, transparent 55%)
        `,
      }} />

      {/* sticky navbar */}
      <div style={{ position: "relative", zIndex: 100 }}>
        <Navbar reducedMotion={reducedMotion} />
      </div>

      {/* 1. Hero */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <HeroSection reducedMotion={reducedMotion} />
      </div>

      {/* 2. Interactive satellite telemetry demo */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <HowItWorksAnimated reducedMotion={reducedMotion} />
      </div>

      {/* 3. Credibility strip */}
      <div id="capabilities" style={{ position: "relative", zIndex: 1 }}>
        <CredibilityStripAnimated />
      </div>

      {/* 4. Console */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <Console />
      </div>
    </div>
  );
}

/* ── Scroll-animated wrappers ── */
function HowItWorksAnimated({ reducedMotion }) {
  const [ref, visible] = useScrollReveal(0.08);
  return (
    <div ref={ref} className={`reveal-up${visible ? " visible" : ""}`}>
      <HowItWorks reducedMotion={reducedMotion} />
    </div>
  );
}

function CredibilityStripAnimated() {
  const [ref, visible] = useScrollReveal(0.1);
  return (
    <div ref={ref} className={`reveal-up stagger-2${visible ? " visible" : ""}`}>
      <CredibilityStrip />
    </div>
  );
}
