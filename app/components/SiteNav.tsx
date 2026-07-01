'use client';

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

export default function SiteNav({
  active,
  search,
  onSearch,
  onRefresh,
}: {
  active?: string;
  search?: string;
  onSearch?: (v: string) => void;
  onRefresh?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navStyle: React.CSSProperties = {
    fontFamily: RBK,
    direction: 'rtl',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: NAVY,
    borderBottom: `1.5px solid ${BLUE}33`,
    boxShadow: scrolled ? '0 2px 12px #0002' : 'none',
    transition: 'box-shadow .2s',
  };

  const inner: React.CSSProperties = {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    height: 58,
    position: 'relative',
  };

  const logoStyle: React.CSSProperties = {
    fontFamily: RBK,
    fontWeight: 800,
    fontSize: 20,
    color: LIME,
    textDecoration: 'none',
    letterSpacing: -0.5,
    whiteSpace: 'nowrap',
    paddingInlineEnd: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  };

  return (
    <nav style={navStyle} className="site-nav">
      <div style={inner}>
        <a href="/dashboard" style={logoStyle}>
          <span style={{ fontSize: 22 }}>📋</span>
          <span>שווה</span>
          <span style={{ color: BLUE, fontWeight: 400, fontSize: 14, marginInlineStart: 2 }}>מכרזים</span>
        </a>

        <div className="nav-row" style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {LINKS.map((lk) => (
            <a
              key={lk.h}
              href={lk.h}
              className={'nav-link' + (active === lk.h ? ' nav-link-active' : '')}
              style={{
                color: active === lk.h ? LIME : '#c8d8e8',
                textDecoration: 'none',
                fontFamily: RBK,
                fontWeight: active === lk.h ? 700 : 400,
                fontSize: 14,
                padding: '6px 10px',
                borderRadius: 7,
                background: active === lk.h ? '#ffffff14' : 'transparent',
                transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}
            >
              {lk.l}
            </a>
          ))}
        </div>

        {onRefresh ? (
          <button
            onClick={onRefresh}
            title="רעננו"
            style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#2e86de,#1a5fa8)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16 }}
          >
            ↻
          </button>
        ) : (
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#2e86de,#1a5fa8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            📋
          </div>
        )}

        {!search && <div style={{ marginInlineStart: 'auto' }} />}
      </div>
    </nav>
  );
}
