const C = {
  bg: "#0C1118", border: "#1E2A36", text: "#E7EDF3",
  dim: "#8996A6", faint: "#4C5A68",
  optical: "#F2A93B", sar: "#4FD1C5", change: "#EF5DA8", good: "#6EE7A0",
};
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const disp = { fontFamily: "'Space Grotesk', sans-serif" };

const STATS = [
  { value: "5",              unit: "specialist models",    detail: "VQA Â· captioning Â· grounding Â· change Â· fusion",   color: C.optical },
  { value: "4",              unit: "benchmark datasets",   detail: "BigEarthNet Â· VRSBench Â· RSVQA Â· CDVQA",           color: C.sar },
  { value: "3",              unit: "input configurations", detail: "single Â· optical+SAR pair Â· bi-temporal pair",     color: C.change },
  { value: "GeoTIFF",        unit: "native format",        detail: "TIFF Â· PNG Â· JPEG also accepted",                  color: C.good },
  { value: "ISRO/SAC",       unit: "evaluation partner",   detail: "Cartosat-2S optical Â· RISAT-1 SAR",                color: C.dim },
  { value: "Vision LLM",     unit: "vision backbone",      detail: "Remote-sensing adapted prompting",                 color: C.optical },
];

export default function CredibilityStrip() {
  return (
    <section
      aria-label="Platform statistics"
      style={{
        background: C.bg,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "56px 24px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* header */}
        <div style={{ marginBottom: 40, display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <span style={{ ...mono, fontSize: 10, color: C.faint, letterSpacing: 1.5, textTransform: "uppercase" }}>
            Platform specs
          </span>
          <div style={{ height: 1, flex: 1, minWidth: 40, background: C.border }} />
        </div>

        {/* stat grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1px",
          background: C.border,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}>
          {STATS.map((s) => (
            <div
              key={s.unit}
              style={{
                background: C.bg,
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, ...disp, letterSpacing: -0.5, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, ...disp }}>
                {s.unit}
              </div>
              <div style={{ fontSize: 11, color: C.faint, ...mono, lineHeight: 1.5, marginTop: 2 }}>
                {s.detail}
              </div>
            </div>
          ))}
        </div>

        {/* footnote */}
        <p style={{ ...mono, fontSize: 10.5, color: C.faint, marginTop: 20, lineHeight: 1.6 }}>
          Adapted on BigEarthNet multi-label remote-sensing dataset. Final evaluation on ISRO/SAC Cartosat-2S + RISAT co-registered pairs.
          Benchmark scores normalised before combining VRSBench, RSVQA, and CDVQA metrics.
        </p>
      </div>
    </section>
  );
}

