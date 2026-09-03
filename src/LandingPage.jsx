import { useRef, useState, useEffect, lazy, Suspense } from "react";
import { ChevronRight, ChevronDown, Satellite, Menu, X as XIcon } from "lucide-react";
import CredibilityStrip from "./components/CredibilityStrip.jsx";
import EvidenceReveal from "./components/EvidenceReveal.jsx";
import Console from "./Console.jsx";
import satOptical from "./assets/optical.jpg";
import satSar from "./assets/sar.jpg";
import satBitemporal from "./assets/bi-temporal.jpg";

const Hero = lazy(() => import("./components/Hero.jsx"));

/* ── design tokens (hero / landing only) ── */
const C = {
  bg: "#0B0F18", panel: "#111827", border: "#1C2A3A",
  text: "#EDF2F7", dim: "#8899AA", faint: "#3D5068",
  optical: "#F0A847", sar: "#38BDF8", change: "#F472B6", good: "#4ADE80",
};
const mono  = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const disp  = { fontFamily: "'Inter', 'Space Grotesk', sans-serif" };

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
    ...mono, fontSize: 12, color: C.dim, textDecoration: "none",
    padding: "6px 0", letterSpacing: 0.3,
    transition: "color .15s ease",
  };

  return (
    <>
      <nav
        aria-label="Main navigation"
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          borderBottom: `1px solid ${scrolled ? C.border : "transparent"}`,
          background: scrolled ? `#0A0E14EE` : "transparent",
          backdropFilter: scrolled ? "blur(10px)" : "none",
          transition: reducedMotion ? "none" : "background .3s ease, border-color .3s ease",
        }}
      >
        <div style={{
          maxWidth: 1400, margin: "0 auto",
          padding: "0 24px", height: 60,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* logo */}
          <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: `linear-gradient(135deg, ${C.optical}, ${C.change})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Satellite size={16} color="#0A0E14" strokeWidth={2.5} />
            </div>
            <span style={{ ...disp, fontWeight: 700, fontSize: 15, color: C.text, letterSpacing: 0.2 }}>SatQuery AI</span>
            <span style={{ ...mono, fontSize: 9.5, color: C.faint, border: `1px solid ${C.border}`, padding: "2px 6px", borderRadius: 4 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a
              href="#console"
              style={{
                ...mono, fontSize: 12, fontWeight: 700,
                background: C.change, color: "#160A11",
                padding: "8px 16px", borderRadius: 7,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
                transition: "opacity .15s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              Open console <ChevronRight size={12} />
            </a>
            <button
              className="nav-mobile-btn"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen(o => !o)}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, display: "none", padding: 4 }}
            >
              {mobileOpen ? <XIcon size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* mobile drawer */}
        {mobileOpen && (
          <div style={{
            background: "#0A0E14F5", borderTop: `1px solid ${C.border}`,
            padding: "16px 24px 24px",
          }}>
            {navLinks.map(l => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                style={{ ...linkStyle, display: "block", padding: "12px 0", borderBottom: `1px solid ${C.border}`, color: C.text }}
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </nav>
      {/* extra responsive styles for navbar */}
      <style>{`
        @media (max-width: 680px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}


function useScrollProgress(ref) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) { setProgress(0); return; }
      const scrolled = -rect.top;
      setProgress(Math.min(1, Math.max(0, scrolled / total)));
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);
  return progress;
}

/* ── stat badge for the scroll section ── */
function ScrollCaption({ text, visible }) {
  return (
    <div style={{
      ...mono, fontSize: 11, color: C.optical, letterSpacing: 1,
      opacity: visible ? 1 : 0, transition: "opacity .5s ease",
      textTransform: "uppercase",
    }}>
      {text}
    </div>
  );
}

/* ── the big scroll-driven section ── */
function ScrollZoom({ reducedMotion }) {
  const wrapRef = useRef();
  const progress = useScrollProgress(wrapRef);

  // three phases: 0-0.33 = "from orbit", 0.33-0.66 = "to pixels", 0.66-1 = "to answers"
  const phase = progress < 0.33 ? 0 : progress < 0.66 ? 1 : 2;
  const captions = ["From orbit", "To pixels", "To answers"];

  // tile opacity rises after first third
  const tileOpacity = Math.min(1, Math.max(0, (progress - 0.3) / 0.25));
  // SAR crossfade in second third
  const sarOpacity = Math.min(1, Math.max(0, (progress - 0.5) / 0.2));
  // evidence reveal in final third
  const evidenceVisible = progress > 0.72;

  // scroll height: 300vh (gives enough travel)
  const scrollHeight = reducedMotion ? "100vh" : "300vh";

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", height: scrollHeight, background: C.bg }}
      aria-label="Scroll-driven satellite imagery demonstration"
    >
      {/* sticky frame */}
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>

        {/* 3D globe canvas */}
        <div style={{
          position: "absolute", inset: 0,
          opacity: reducedMotion ? 0 : Math.max(0, 1 - tileOpacity * 2),
          transition: "opacity .1s linear",
        }}>
          <Suspense fallback={null}>
            <Hero scrollProgress={progress} reducedMotion={reducedMotion} />
          </Suspense>
        </div>

        {/* static fallback for reduced-motion */}
        {reducedMotion && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <StaticEarth />
          </div>
        )}

        {/* satellite tile crossfade — three phases: optical → SAR → bi-temporal */}
        <div style={{
          position: "absolute", inset: 0,
          opacity: tileOpacity,
          transition: reducedMotion ? "none" : "opacity .3s linear",
        }}>
          {/* OPTICAL */}
          <div style={{ position: "absolute", inset: 0, opacity: Math.max(0, 1 - sarOpacity * 2), transition: reducedMotion ? "none" : "opacity .7s ease" }}>
            <RealSatTile src={satOptical} label="OPTICAL" labelColor={C.optical} annotation={false} />
          </div>
          {/* SAR */}
          <div style={{ position: "absolute", inset: 0, opacity: Math.min(1, sarOpacity * 2) * Math.max(0, 1 - (sarOpacity - 0.5) * 4), transition: reducedMotion ? "none" : "opacity .7s ease" }}>
            <RealSatTile src={satSar} label="SAR" labelColor={C.sar} annotation={false} />
          </div>
          {/* BI-TEMPORAL */}
          <div style={{ position: "absolute", inset: 0, opacity: Math.max(0, (sarOpacity - 0.5) * 4), transition: reducedMotion ? "none" : "opacity .7s ease" }}>
            <RealSatTile src={satBitemporal} label="BI-TEMPORAL" labelColor={C.change} annotation={evidenceVisible} />
          </div>

          {/* vignette edges */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse 90% 85% at 50% 50%, transparent 45%, rgba(10,14,20,0.75) 100%)",
            pointerEvents: "none",
          }} />

          {/* modality badge */}
          <div style={{
            position: "absolute", top: 20, left: 24,
            ...mono, fontSize: 11, padding: "5px 12px", borderRadius: 6,
            background: sarOpacity > 0.75 ? `${C.change}22` : sarOpacity > 0.25 ? `${C.sar}22` : `${C.optical}22`,
            border: `1px solid ${sarOpacity > 0.75 ? C.change+"66" : sarOpacity > 0.25 ? C.sar+"66" : C.optical+"66"}`,
            color: sarOpacity > 0.75 ? C.change : sarOpacity > 0.25 ? C.sar : C.optical,
            backdropFilter: "blur(6px)", transition: "all .4s ease", zIndex: 2,
          }}>
            {sarOpacity > 0.75 ? "BI-TEMPORAL · Change detection" : sarOpacity > 0.25 ? "SAR · Synthetic Aperture Radar" : "OPTICAL · High-resolution"}
          </div>

          {/* coordinates */}
          <div style={{
            position: "absolute", bottom: 100, right: 24,
            ...mono, fontSize: 10, color: "rgba(255,255,255,0.45)", zIndex: 2,
          }}>
            {sarOpacity > 0.75 ? "T1 / T2 · change pair" : sarOpacity > 0.25 ? "C-band · backscatter" : "22.91°S, 43.23°W"}
          </div>
        </div>

        {/* evidence reveal panel */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24,
          padding: "0 24px",
          pointerEvents: evidenceVisible ? "auto" : "none",
        }}>
          <EvidenceReveal visible={evidenceVisible} />
        </div>

        {/* caption overlay (always in DOM for screen readers) */}
        <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 32, pointerEvents: "none" }} aria-live="polite" aria-atomic="true">
          {captions.map((c, i) => (
            <ScrollCaption key={c} text={c} visible={phase === i || reducedMotion} />
          ))}
        </div>

        {/* scroll hint (only at top) */}
        <div style={{
          position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
          opacity: progress < 0.05 ? 1 : 0, transition: "opacity .3s ease",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          animation: reducedMotion ? "none" : "nudge 2s ease-in-out infinite",
        }}>
          <span style={{ ...mono, fontSize: 10, color: C.faint }}>scroll</span>
          <ChevronDown size={14} color={C.faint} />
        </div>
      </div>
    </div>
  );
}

/* ── simple SVG tiles ── */
/* ── real satellite imagery tiles — local assets ── */
function RealSatTile({ src, label, labelColor, annotation }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* placeholder while loading */}
      {!loaded && (
        <div style={{ position: "absolute", inset: 0, background: "#0C1219", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 28, height: 28, border: `2px solid ${labelColor}44`, borderTopColor: labelColor, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      )}
      <img
        src={src}
        alt={label}
        onLoad={() => setLoaded(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: loaded ? 1 : 0, transition: "opacity .4s ease" }}
      />
      {/* scan-line overlay to give it that satellite sensor feel */}
      <div style={{
        position: "absolute", inset: 0,
        background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)",
        pointerEvents: "none",
      }} />
      {/* annotation box on "to answers" phase */}
      {annotation && loaded && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
            <rect x="28%" y="22%" width="44%" height="46%"
              fill="none" stroke="#EF5DA8" strokeWidth="2.5" rx="4"
              strokeDasharray="300"
              style={{ strokeDashoffset: 0, transition: "stroke-dashoffset 1s ease" }}
            />
            <rect x="28%" y="14%" width="120" height="16" fill="#EF5DA8" rx="2" />
            <text x="30%" y="24.5%" fontSize="11" fill="#160A11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
              stadium · built-up · 0.97
            </text>
          </svg>
        </div>
      )}
    </div>
  );
}
      <rect x="10" y="20" width="150" height="90" fill="#5C7A3B" opacity="0.9" />
/* ── reduced-motion static earth ── */
function StaticEarth() {
  return (
    <svg viewBox="0 0 360 360" width="360" height="360" aria-hidden="true">
      <defs>
        <radialGradient id="sg" cx="38%" cy="33%" r="60%">
          <stop offset="0%" stopColor="#2d6a4f" />
          <stop offset="45%" stopColor="#1b4332" />
          <stop offset="72%" stopColor="#1C3A4A" />
          <stop offset="100%" stopColor="#0d1b2a" />
        </radialGradient>
        <radialGradient id="satm" cx="50%" cy="50%" r="55%">
          <stop offset="72%" stopColor="transparent" />
          <stop offset="100%" stopColor="#4FD1C518" />
        </radialGradient>
      </defs>
      <circle cx="180" cy="180" r="148" fill="url(#sg)" />
      <circle cx="180" cy="180" r="152" fill="url(#satm)" />
      <circle cx="180" cy="180" r="148" fill="none" stroke="#4FD1C5" strokeWidth="0.8" opacity="0.35" />
      <ellipse cx="180" cy="180" rx="148" ry="22" fill="none" stroke="#1E2A36" strokeWidth="0.6" opacity="0.5" />
      <ellipse cx="180" cy="180" rx="148" ry="60" fill="none" stroke="#1E2A36" strokeWidth="0.5" opacity="0.35" />
      <circle cx="285" cy="105" r="5" fill="#F2A93B" />
      <line x1="180" y1="180" x2="285" y2="105" stroke="#F2A93B" strokeWidth="0.7" opacity="0.4" />
    </svg>
  );
}

/* ── hero headline section — left text / right globe ── */
function HeroSection({ reducedMotion }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(id);
  }, []);

  return (
    <div style={{
      position: "relative", minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center",
      overflow: "hidden", paddingTop: 60,
    }}>
      <StarField />

      {/* content row */}
      <div style={{
        position: "relative", zIndex: 2,
        maxWidth: 1400, margin: "0 auto", width: "100%",
        padding: "0 24px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 48,
        alignItems: "center",
        minHeight: "calc(100vh - 60px)",
      }}>
        {/* LEFT — headline */}
        <div style={{
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(20px)",
          transition: reducedMotion ? "none" : "opacity .9s ease, transform .9s ease",
        }}>
          <div style={{ ...mono, fontSize: 11, color: C.optical, letterSpacing: 2, marginBottom: 20, textTransform: "uppercase" }}>
            agentic vision-language assistant · earth observation
          </div>
          <h1 style={{
            ...disp, fontSize: "clamp(34px, 4.5vw, 64px)", fontWeight: 700,
            lineHeight: 1.08, letterSpacing: -2, margin: "0 0 24px",
            color: C.text,
          }}>
            Ask your imagery<br />
            <span style={{ color: C.optical }}>anything.</span>
          </h1>
          <p style={{ fontSize: 16, color: C.dim, lineHeight: 1.75, maxWidth: 480, marginBottom: 36 }}>
            One query. Any image type. SatQuery AI reads your satellite imagery —
            optical, SAR, or bi-temporal pairs — classifies your intent, and routes
            to the right specialist model automatically.
          </p>

          {/* input-type pills */}
          <div style={{ display: "flex", gap: 8, marginBottom: 36, flexWrap: "wrap" }}>
            {[
              { label: "Single image",        color: C.optical },
              { label: "Optical + SAR pair",  color: C.sar },
              { label: "Bi-temporal pair",    color: C.change },
            ].map(({ label, color }) => (
              <span key={label} style={{
                ...mono, fontSize: 11, color,
                border: `1px solid ${color}44`,
                background: `${color}10`,
                padding: "5px 11px", borderRadius: 20,
              }}>{label}</span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href="#console"
              style={{
                ...disp, fontSize: 13, fontWeight: 700,
                background: C.text, color: C.bg,
                padding: "12px 22px", borderRadius: 8, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 8,
                transition: "opacity .15s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              Open console <ChevronRight size={15} />
            </a>
            <button
              onClick={() => document.querySelector(".scroll-zone")?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" })}
              style={{
                ...disp, fontSize: 13, fontWeight: 600,
                background: "transparent", color: C.dim,
                padding: "12px 22px", borderRadius: 8,
                border: `1px solid ${C.border}`, cursor: "pointer",
                transition: "border-color .15s ease, color .15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#2C3D4C"; e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}
            >
              See it work
            </button>
          </div>
        </div>

        {/* RIGHT — 3-D globe */}
        <div style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          maxWidth: 580,
          justifySelf: "end",
          opacity: show ? 1 : 0,
          transition: reducedMotion ? "none" : "opacity 1.1s ease .2s",
        }}>
          {/* subtle radial glow behind globe */}
          <div style={{
            position: "absolute", inset: "-15%",
            background: `radial-gradient(circle, ${C.sar}12 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />
          <Suspense fallback={<StaticEarth />}>
            <Hero scrollProgress={0} reducedMotion={reducedMotion} />
          </Suspense>
        </div>
      </div>

      {/* scroll hint */}
      <div style={{
        position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        animation: reducedMotion ? "none" : "nudge 2.2s ease-in-out infinite",
        zIndex: 2,
      }}>
        <span style={{ ...mono, fontSize: 10, color: C.faint, letterSpacing: 1 }}>SCROLL</span>
        <ChevronDown size={14} color={C.faint} />
      </div>

      {/* mobile override */}
      <style>{`
        @media (max-width: 860px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-globe { display: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ── minimal star field ── */
function StarField() {
  const stars = useRef(
    Array.from({ length: 120 }, (_, i) => ({
      x: (Math.sin(i * 2.7) * 0.5 + 0.5) * 100,
      y: (Math.cos(i * 1.9) * 0.5 + 0.5) * 100,
      r: 0.6 + (i % 3) * 0.4,
      o: 0.2 + (i % 5) * 0.12,
    }))
  );
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} aria-hidden="true">
      {stars.current.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white" opacity={s.o} />
      ))}
    </svg>
  );
}

/* ── console bridge headline ── */
function ConsoleBridge() {
  return (
    <div style={{
      background: C.bg,
      padding: "80px 24px 0",
      borderTop: `1px solid ${C.border}`,
    }}>
      <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          ...mono, fontSize: 10, color: C.change,
          letterSpacing: 2, textTransform: "uppercase",
          marginBottom: 20,
          background: `${C.change}10`,
          border: `1px solid ${C.change}33`,
          padding: "5px 14px", borderRadius: 20,
        }}>
          ↓ Product console
        </div>
        <h2 style={{ ...disp, fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700, letterSpacing: -1.2, marginBottom: 16, lineHeight: 1.1 }}>
          One interface.<br />
          <span style={{ color: C.optical }}>Every input type.</span>
        </h2>
        <p style={{ fontSize: 15, color: C.dim, lineHeight: 1.75, maxWidth: 480, margin: "0 auto" }}>
          Upload one or two images, type your question. The agent classifies the task,
          picks a specialist, and returns a structured, evidence-grounded answer.
        </p>
      </div>
      <div style={{ marginTop: 56, height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />
    </div>
  );
}

/* ── root page ── */
export default function LandingPage() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div style={{ background: C.bg, color: C.text, ...disp }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0B0F18; }
        #root { width: 100% !important; max-width: 100% !important; border: none !important; min-height: 100vh; text-align: left; }
        ::selection { background: #F472B644; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .step-pulse { animation: spulse 1s ease-in-out infinite; }
        @keyframes spulse { 0%,100%{box-shadow:0 0 0 0 #F472B644}50%{box-shadow:0 0 0 5px #F472B600} }
        .fade-in { animation: fadein .4s ease forwards; }
        @keyframes fadein { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
        @keyframes nudge { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(6px)} }
        ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-thumb { background:#243444; border-radius:3px; }
        @media (prefers-reduced-motion:reduce) {
          .spin,.step-pulse,.fade-in { animation:none !important; }
          * { transition-duration:.01ms !important; }
        }
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion:reduce) { html { scroll-behavior: auto; } }
      `}</style>

      {/* sticky navbar */}
      <Navbar reducedMotion={reducedMotion} />

      {/* 1. Hero — full-bleed globe + headline */}
      <HeroSection reducedMotion={reducedMotion} />

      {/* 2. Scroll-driven zoom — globe → tile → SAR wipe → evidence */}
      <div id="how-it-works" className="scroll-zone">
        <ScrollZoom reducedMotion={reducedMotion} />
      </div>

      {/* 3. Credibility strip — calm, static, data-backed */}
      <div id="capabilities">
        <CredibilityStrip />
      </div>

      {/* 4. Bridge copy into console */}
      <ConsoleBridge />

      {/* 5. Console — the actual product UI */}
      <Console />
    </div>
  );
}
