const C = {
  bg:      "#FFFFFF",
  bgAlt:   "#F8FAFC",
  surface: "#F1F5F9",
  border:  "#E2E8F0",
  text:    "#0F172A",
  dim:     "#475569",
  faint:   "#94A3B8",
  accent:  "#2563EB",
  optical: "#B45309",
  opticalLt: "#FEF3C7",
  sar:     "#0369A1",
  sarLt:   "#E0F2FE",
  change:  "#6D28D9",
  changeLt: "#EDE9FE",
  good:    "#047857",
  goodLt:  "#D1FAE5",
};
const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const sans = { fontFamily: "'Inter', system-ui, sans-serif" };

const STATS = [
  { value: "5",       unit: "Specialist models",    detail: "VQA · Captioning · Grounding · Change · Fusion", color: C.optical, bg: C.opticalLt, border: "#FDE68A" },
  { value: "4",       unit: "Benchmark datasets",   detail: "BigEarthNet · VRSBench · RSVQA · CDVQA",         color: C.sar,     bg: C.sarLt,     border: "#BAE6FD" },
  { value: "3",       unit: "Input configurations", detail: "Single · Optical+SAR pair · Bi-temporal pair",   color: C.change,  bg: C.changeLt,  border: "#C4B5FD" },
  { value: "GeoTIFF", unit: "Native format",        detail: "TIFF · PNG · JPEG also accepted",                color: C.good,    bg: C.goodLt,    border: "#6EE7B7" },
  { value: "ISRO",    unit: "Evaluation partner",   detail: "Cartosat-2S optical · RISAT-1 SAR",              color: C.accent,  bg: "#DBEAFE",   border: "#BFDBFE" },
  { value: "VLM",     unit: "Vision backbone",      detail: "Remote-sensing adapted prompting pipeline",      color: C.optical, bg: C.opticalLt, border: "#FDE68A" },
];

export default function CredibilityStrip() {
  return (
    <section
      aria-label="Platform specifications"
      style={{
        background: C.bgAlt,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "80px 24px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            ...mono, fontSize: 11, color: C.accent,
            letterSpacing: 0.5, textTransform: "uppercase",
            marginBottom: 16,
            background: "#DBEAFE",
            border: "1px solid #BFDBFE",
            padding: "5px 14px", borderRadius: 20,
          }}>
            Platform specs
          </div>
          <h2 style={{
            ...sans, fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 700,
            color: C.text, letterSpacing: -1, lineHeight: 1.15,
            marginBottom: 14,
          }}>
            Built for real earth observation
          </h2>
          <p style={{ ...sans, fontSize: 16, color: C.dim, maxWidth: 480, margin: "0 auto" }}>
            Designed with ISRO/SAC requirements in mind — from sensor modalities to benchmark datasets.
          </p>
        </div>

        {/* stats grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}>
          {STATS.map((s) => (
            <div
              key={s.unit}
              style={{
                background: C.bg,
                padding: "28px 24px",
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                display: "flex", flexDirection: "column", gap: 6,
                transition: "box-shadow .2s ease, transform .2s ease, border-color .2s ease",
                cursor: "default",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.08)";
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = s.border;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = C.border;
              }}
            >
              {/* value chip */}
              <div style={{
                display: "inline-flex", alignSelf: "flex-start",
                background: s.bg, border: `1px solid ${s.border}`,
                borderRadius: 8, padding: "4px 10px", marginBottom: 4,
              }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: s.color, ...sans, letterSpacing: -0.5, lineHeight: 1 }}>
                  {s.value}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, ...sans }}>
                {s.unit}
              </div>
              <div style={{ fontSize: 11.5, color: C.faint, ...mono, lineHeight: 1.6 }}>
                {s.detail}
              </div>
            </div>
          ))}
        </div>

        {/* footnote */}
        <p style={{ ...mono, fontSize: 11, color: C.faint, marginTop: 28, lineHeight: 1.7, textAlign: "center" }}>
          Adapted on BigEarthNet multi-label remote-sensing dataset. Final scoring on ISRO/SAC
          Cartosat-2S + RISAT co-registered pairs. Benchmark metrics normalised before combining
          VRSBench, RSVQA, and CDVQA results.
        </p>
      </div>
    </section>
  );
}
