גילוימכרזיםמכרזיםמסומניםסוכןחכםערבויותוליווימקורותשווהמכרזיםמועדוןעסקיםרענוןתובנותאישראלסריקהמותאמתמקור'use client';
import { useEffect, useState } from 'react';

const NAVY = '#0b2e52', BLUE = '#2e86de', LIME = '#cdef4a', PURPLE = '#7c5cf0';
const RBK = "Rubik, 'Assistant', Arial, sans-serif";

const LINKS = [
  { l: 'גילוי מכרזים', h: '/dashboard' },
  { l: 'מכרזים מסומנים', h: '/marked' },
  { l: 'סוכן חכם', h: '/agent' },
  { l: 'ערבויות וליווי', h: '/guarantee' },
  { l: 'מקורות', h: '/sources' },
  ];

/** סרגל ניווט משותף — active = ה-href של העמוד הפעיל */
export default function SiteNav({
    active,
    tagline,
    search,
    onRefresh,
}: {
    active: string;
    tagline?: React.ReactNode;
    search?: React.ReactNode;
    onRefresh?: () => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
        const id = 'ws-fonts';
        if (!document.getElementById(id)) {
                const l = document.createElement('link');
                l.id = id;
                l.rel = 'stylesheet';
                l.href = 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&family=Assistant:wght@400;500;600;700&display=swap';
                document.head.appendChild(l);
        }
  }, []);

  return (
        <>
          {/* TOP BAR */}
              <div style={{ background: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #eef4fa', position: 'sticky', top: 0, zIndex: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                                <a href="/dashboard" style={{ textAlign: 'right', lineHeight: 1.15, textDecoration: 'none' }}>
                                            <div style={{ fontFamily: RBK, fontWeight: 800, fontSize: 20, color: NAVY, letterSpacing: '-.5px' }}>
                                                          שווה<span style={{ color: BLUE }}>מכרזים</span>span>
                                            </div>div>
                                            <div style={{ fontSize: 10, color: '#8aa0b5', fontWeight: 600, marginTop: 1 }}>מועדון עסקים 360</div>div>
                                </a>a>
                      </div>div>
              
                {onRefresh ? (
                    <button onClick={onRefresh} title="רענון" style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#2e86de,#1a5fa8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: LIME, fontSize: 16, border: 'none', cursor: 'pointer', flexShrink: 0 }}>↻</button>button>
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#2e86de,#1a5fa8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: LIME, fontSize: 16, flexShrink: 0 }}>↻</div>div>
                      )}
              
                {search && (
                    <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 12, color: '#5b7085', fontSize: 14 }}>
                                <a href="/agent" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid #c9b8f7', color: PURPLE, fontWeight: 700, fontSize: 13, padding: '6px 14px', borderRadius: 999, textDecoration: 'none', whiteSpace: 'nowrap' }}>✦ תובנות AI</a>a>
                                <a href="/marked" style={{ textDecoration: 'none', color: 'inherit' }}>🔔</a>a>
                                <a href="/profile" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: NAVY, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                                              <span style={{ width: 28, height: 28, borderRadius: 999, background: LIME, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: NAVY }}>א</span>span>
                                              ישראל ▾
                                </a>a>
                    </div>div>
                      )}
              
                {!search && <div style={{ marginInlineStart: 'auto' }} />}
              
                {/* Mobile hamburger */}
                      <button
                                  onClick={() => setMenuOpen(!menuOpen)}
                                  aria-label={menuOpen ? 'סגור תפריט' : 'פתח תפריט'}
                                  style={{ display: 'none', width: 36, height: 36, borderRadius: 8, background: 'transparent', border: '1px solid #dde3e8', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: NAVY, flexShrink: 0 }}
                                  className="nav-hamburger"
                                >
                        {menuOpen ? '✕' : '☰'}
                      </button>button>
              </div>div>
        
          {/* NAV ROW */}
              <div className={`nav-row${menuOpen ? ' nav-row-open' : ''}`}>
                {LINKS.map(({ l, h }) => {
                    const isActive = h === active;
                    return (
                                  <a key={h} href={h} className={`nav-link${isActive ? ' nav-link-active' : ''}`} onClick={() => setMenuOpen(false)}>
                                    {l}
                                  </a>a>
                                );
        })}
                      <span style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1e9e5a', fontSize: 13, fontWeight: 600, padding: '12px 0' }}>
                                <span style={{ width: 7, height: 7, borderRadius: 999, background: '#1e9e5a', display: 'inline-block' }} />
                        {tagline || (
                      <>סריקה מותאמת · מקור{' '}<a href="https://data.gov.il" target="_blank" rel="noopener noreferrer" style={{ color: BLUE, textDecoration: 'none' }}>data.gov.il</a>a></>>
                    )}
                      </span>span>
              </div>div>
        </>>
      );
}
</></>
