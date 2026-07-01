"use client";
import { useEffect } from "react";

const NAVY = "#0b2e52", BLUE = "#2e86de", LIME = "#cdef4a", PURPLE = "#7c5cf0";
const RBK = "Rubik, 'Assistant', Arial, sans-serif";

const LINKS = [
  { l: "גילוי מכרזים", h: "/dashboard" },
  { l: "מכרזים מסומנים", h: "/marked" },
  { l: "סוכן חכם", h: "/agent" },
  { l: "ערבויות וליווי", h: "/guarantee" },
  { l: "מקורות", h: "/sources" },
];

/** סרגל ניווט משותף — עיצוב 1a. active = ה-href של העמוד הפעיל */
export default function SiteNav({ active, tagline, search, onRefresh }: { active: string; tagline?: React.ReactNode; search?: React.ReactNode; onRefresh?: () => void }) {
  useEffect(() => {
    const id = "ws-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&family=Assistant:wght@400;500;600;700&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  return (
    <>
      {/* TOP BAR */}
      <div style={{ background: "#fff", padding: "16px 32px", display: "flex", alignItems: "center", gap: 24, borderBottom: "1px solid #eef4fa" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
          <a href="/dashboard" style={{ textAlign: "right", lineHeight: 1, textDecoration: "none" }}>
            <div style={{ fontFamily: RBK, fontWeight: 800, fontSize: 26, color: NAVY, letterSpacing: "-.5px" }}>שווה<span style={{ color: BLUE }}>מכרזים</span></div>
            <div style={{ fontSize: 11, color: "#8aa0b5", fontWeight: 600, marginTop: 3 }}>מועדון עסקים 360</div>
          </a>
          {onRefresh
            ? <button onClick={onRefresh} title="רענון" style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg,#2e86de,#1a5fa8)", display: "flex", alignItems: "center", justifyContent: "center", color: LIME, fontSize: 20, border: "none", cursor: "pointer" }}>↻</button>
            : <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg,#2e86de,#1a5fa8)", display: "flex", alignItems: "center", justifyContent: "center", color: LIME, fontSize: 20 }}>↻</div>}
        </div>
        {search}
        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 16, color: "#5b7085", fontSize: 19 }}>
          {!search && <a href="/agent" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1.5px solid #c9b8f7", color: PURPLE, fontWeight: 700, fontSize: 13, padding: "6px 14px", borderRadius: 999, textDecoration: "none", whiteSpace: "nowrap" }}>✦ תובנות AI</a>}
          <a href="/marked" style={{ textDecoration: "none", color: "inherit" }}>🔔</a>
          <a href="/profile" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: NAVY, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
            <span style={{ width: 32, height: 32, borderRadius: 999, background: LIME, display: "inline-flex", alignItems: "center", justifyContent: "center", color: NAVY }}>א</span>ישראל ▾
          </a>
        </div>
      </div>

      {/* NAV ROW */}
      <div style={{ background: "#fff", padding: "0 32px 4px", display: "flex", alignItems: "center", gap: 34, borderBottom: "1px solid #eef4fa", flexWrap: "wrap" }}>
        {LINKS.map((n) => {
          const on = n.h === active;
          return (
            <a key={n.l} href={n.h} style={{ padding: "14px 2px", fontFamily: RBK, fontSize: 15, fontWeight: on ? 700 : 500, color: on ? NAVY : "#5b7085", borderBottom: on ? `3px solid ${BLUE}` : "3px solid transparent", textDecoration: "none" }}>{n.l}</a>
          );
        })}
        <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 7, color: "#1e9e5a", fontSize: 13, fontWeight: 600, padding: "12px 0" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#1e9e5a" }}></span>
          {tagline || <>סריקה מותאמת · מקור <a href="https://data.gov.il" target="_blank" rel="noopener noreferrer" style={{ color: BLUE, textDecoration: "none" }}>data.gov.il</a></>}
        </span>
      </div>
    </>
  );
}
