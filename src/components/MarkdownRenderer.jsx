/**
 * Lightweight markdown renderer — no external deps.
 * Handles: ## headings, **bold**, *italic*, `code`,
 * numbered lists, bullet lists, and simple | tables |
 */

const C = {
  text: "#EDF2F7", dim: "#8899AA", faint: "#3D5068",
  optical: "#F0A847", sar: "#38BDF8", change: "#F472B6",
  good: "#4ADE80", warn: "#FBBF24", border: "#1C2A3A",
  raised: "#151F2E", panel: "#111827",
};
const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const disp = { fontFamily: "'Inter', 'Space Grotesk', sans-serif" };

/* ── inline formatting: bold, italic, inline code ── */
function InlineText({ text }) {
  // split on **bold**, *italic*, `code`
  const parts = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
    if (m[0].startsWith("**"))      parts.push({ type: "bold",   content: m[2] });
    else if (m[0].startsWith("*"))  parts.push({ type: "italic", content: m[3] });
    else                             parts.push({ type: "code",   content: m[4] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });

  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "bold")   return <strong key={i} style={{ fontWeight: 700, color: C.text }}>{p.content}</strong>;
        if (p.type === "italic") return <em key={i} style={{ fontStyle: "italic", color: C.dim }}>{p.content}</em>;
        if (p.type === "code")   return (
          <code key={i} style={{ ...mono, fontSize: "0.88em", background: C.raised, color: C.optical, padding: "1px 5px", borderRadius: 3 }}>
            {p.content}
          </code>
        );
        return <span key={i}>{p.content}</span>;
      })}
    </>
  );
}

/* ── table parser ── */
function MarkdownTable({ rows }) {
  const [head, sep, ...body] = rows;
  if (!head || !sep) return null;
  const headers = head.split("|").map(c => c.trim()).filter(Boolean);
  const alignments = sep.split("|").map(c => c.trim()).filter(Boolean).map(c => {
    if (c.startsWith(":") && c.endsWith(":")) return "center";
    if (c.endsWith(":")) return "right";
    return "left";
  });
  const dataRows = body.filter(r => r.includes("|")).map(r =>
    r.split("|").map(c => c.trim()).filter(Boolean)
  );

  return (
    <div style={{ overflowX: "auto", margin: "16px 0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", ...disp, fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: alignments[i] || "left",
                padding: "8px 12px",
                background: C.raised,
                color: C.optical,
                fontWeight: 600,
                fontSize: 11,
                ...mono,
                letterSpacing: 0.5,
                borderBottom: `2px solid ${C.optical}44`,
                borderRight: i < headers.length - 1 ? `1px solid ${C.border}` : "none",
                whiteSpace: "nowrap",
              }}>
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : C.raised + "88" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  textAlign: alignments[ci] || "left",
                  padding: "9px 12px",
                  color: C.text,
                  borderBottom: `1px solid ${C.border}`,
                  borderRight: ci < row.length - 1 ? `1px solid ${C.border}` : "none",
                  lineHeight: 1.5,
                  verticalAlign: "top",
                }}>
                  <InlineText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── main renderer ── */
export default function MarkdownRenderer({ text }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // blank line
    if (!line.trim()) { i++; continue; }

    // h1
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} style={{ ...disp, fontSize: 18, fontWeight: 700, color: C.text, margin: "20px 0 10px", letterSpacing: -0.3 }}>
          <InlineText text={line.slice(2)} />
        </h2>
      );
      i++; continue;
    }

    // h2
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} style={{ ...disp, fontSize: 15, fontWeight: 700, color: C.optical, margin: "18px 0 8px", letterSpacing: 0 }}>
          <InlineText text={line.slice(3)} />
        </h3>
      );
      i++; continue;
    }

    // h3
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} style={{ ...disp, fontSize: 13, fontWeight: 600, color: C.sar, margin: "14px 0 6px" }}>
          <InlineText text={line.slice(4)} />
        </h4>
      );
      i++; continue;
    }

    // horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "16px 0" }} />);
      i++; continue;
    }

    // table (line contains | and next line is a separator)
    if (line.includes("|") && lines[i + 1]?.match(/^\|?[\s\-:|]+\|/)) {
      const tableRows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        tableRows.push(lines[i]);
        i++;
      }
      elements.push(<MarkdownTable key={`tbl-${i}`} rows={tableRows} />);
      continue;
    }

    // numbered list — collect consecutive items
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ paddingLeft: 20, margin: "10px 0", display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7 }}>
              <InlineText text={item} />
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // bullet list
    if (/^[-*•]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: 20, margin: "10px 0", display: "flex", flexDirection: "column", gap: 5, listStyleType: "none" }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: C.sar, flexShrink: 0, marginTop: 2 }}>▸</span>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} style={{
          borderLeft: `3px solid ${C.change}`,
          margin: "12px 0", padding: "8px 14px",
          background: `${C.change}08`,
          borderRadius: "0 6px 6px 0",
          color: C.dim, fontSize: 13, lineHeight: 1.6,
        }}>
          <InlineText text={line.slice(2)} />
        </blockquote>
      );
      i++; continue;
    }

    // confidence line — highlight specially
    if (/[Cc]onfidence[:\s]+\d+%/.test(line)) {
      const match = line.match(/(\d+)%/);
      const conf = match ? parseInt(match[1]) : null;
      const confColor = conf >= 85 ? C.good : conf >= 70 ? C.optical : C.warn;
      elements.push(
        <div key={i} style={{
          margin: "14px 0 4px",
          padding: "10px 14px",
          background: `${confColor}10`,
          border: `1px solid ${confColor}33`,
          borderRadius: 7,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: confColor, flexShrink: 0 }} />
          <span style={{ ...mono, fontSize: 12, color: confColor, fontWeight: 600 }}>
            <InlineText text={line.trim()} />
          </span>
        </div>
      );
      i++; continue;
    }

    // paragraph
    elements.push(
      <p key={i} style={{ color: C.text, fontSize: 13.5, lineHeight: 1.75, margin: "8px 0" }}>
        <InlineText text={line} />
      </p>
    );
    i++;
  }

  return <div style={{ ...disp }}>{elements}</div>;
}
