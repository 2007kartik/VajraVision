const C = {
  bg: "#0C1219", surface: "#0E1520", border: "#1C2A3A",
  text: "#EDF2F7", dim: "#8899AA", faint: "#3D5068",
  optical: "#F0A847", sar: "#38BDF8", change: "#F472B6", good: "#4ADE80",
};
const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const sans = { fontFamily: "'Inter', 'Space Grotesk', sans-serif" };

const STATS = [
  { value: "5",       unit: "Specialist models",    detail: "VQA · Captioning · Grounding · Change · Fusion", color: C.optical },
  { value: "4",       unit: "Benchmark datasets",   detail: "BigEarthNet · VRSBench · RSVQA · CDVQA",         color: C.sar },
  { value: "3",       unit: "Input configurations", detail: "Single · Optical+SAR pair · Bi-temporal pair",   color: C.change },
  { value: "GeoTIFF", unit: "Native format",        detail: "TIFF · PNG · JPEG also accepted",                color: C.good },
  { value: "ISRO",    unit: "Evaluation partner",   detail: "Cartosat-2S optical · RISAT-1 SAR",              color: C.dim },
  { value: "VLM",     unit: "Vision backbone",      detail: "Remote-sensing adapted prompting pipeline",      color: C.optical },
];

export default function CredibilityStrip() {
  return (
    <section
      aria-label="Platform specifications"
      style={{
        background: C.bg,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "64px 24px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 44, flexWrap: "wrap" }}>
          <span style={{ ...mono, fontSize: 10, color: C.faint, letterSpacing: 2, textTransform: "uppercase" }}>
            Platform specs
          </span>
          <div style={{ height: 1, flex: 1, minWidth: 40, background: C.border }} />
        </div>

        {/* stats grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "1px",
          background: C.border,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {STATS.map((s) => (
            <div
              key={s.unit}
              style={{
                background: C.bg,
                padding: "28px 22px",
                display: "flex", flexDirection: "column", gap: 5,
                transition: "background .15s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface}
              onMouseLeave={e => e.currentTarget.style.background = C.bg}
            >
              <div style={{ fontSize: 30, fontWeight: 700, color: s.color, ...sans, letterSpacing: -0.5, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, ...sans }}>
                {s.unit}
              </div>
              <div style={{ fontSize: 11, color: C.faint, ...mono, lineHeight: 1.55, marginTop: 2 }}>
                {s.detail}
              </div>
            </div>
          ))}
        </div>

        {/* footnote */}
        <p style={{ ...mono, fontSize: 10.5, color: C.faint, marginTop: 22, lineHeight: 1.7 }}>
          Adapted on BigEarthNet multi-label remote-sensing dataset. Final scoring on ISRO/SAC
          Cartosat-2S + RISAT co-registered pairs. Benchmark metrics normalised before combining
          VRSBench, RSVQA, and CDVQA results.
        </p>
      </div>
    </section>
  );
}
