'use client';

import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import MobileTabBar from './MobileTabBar';

const BLUE = '#2b6fc4', ACTIVE = '#1e5aa8', ACTIVE_BG = '#e8f1fb';
const MUTED = '#5b6b7a', BORDER = '#e6eaee', DARK = '#1a2330';
const RBK = "Rubik, 'Assistant', Arial, sans-serif";

const LINKS = [
  { l: 'גילוי מכרזים', h: '/dashboard' },
  { l: 'מכרזים מסומנים', h: '/marked' },
  { l: 'סוכן חכם', h: '/agent' },
  { l: 'ערבויות וליווי', h: '/guarantee' },
  { l: 'מקורות', h: '/sources' },
  { l: 'פרופיל עסקי', h: '/profile' },
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
  const path = usePathname();
  const current = active || path || '';

  const navStyle: CSSProperties = {
    fontFamily: RBK,
    direction: 'rtl',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: '#ffffff',
    borderBottom: '1px solid ' + BORDER,
  };

  const inner: CSSProperties = {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    height: 58,
    position: 'relative',
  };

  const logoStyle: CSSProperties = {
    fontFamily: RBK,
    fontWeight: 800,
    fontSize: 19,
    color: DARK,
    textDecoration: 'none',
    letterSpacing: -0.4,
    whiteSpace: 'nowrap',
    paddingInlineEnd: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <>
      <nav style={navStyle} className="site-nav">
        <div style={inner}>
          <a href="/dashboard" style={logoStyle}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#2b6fc4,#1a5fa8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>ש</span>
            <span>שווה</span>
            <span style={{ color: BLUE, fontWeight: 500, fontSize: 14, marginInlineStart: 2 }}>מכרזים</span>
          </a>

          <div className="nav-row" style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            {LINKS.map((lk) => {
              const isActive = current === lk.h;
              return (
                <a
                  key={lk.h}
                  href={lk.h}
                  className={'nav-link' + (isActive ? ' nav-link-active' : '')}
                  style={{
                    color: isActive ? ACTIVE : MUTED,
                    textDecoration: 'none',
                    fontFamily: RBK,
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 14,
                    padding: '7px 12px',
                    borderRadius: 8,
                    background: isActive ? ACTIVE_BG : 'transparent',
                    transition: 'all .15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lk.l}
                </a>
              );
            })}
          </div>

          {onRefresh ? (
            <button
              onClick={onRefresh}
              title="רעננו"
              style={{ width: 34, height: 34, borderRadius: 8, background: '#f2f5f8', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + BORDER, cursor: 'pointer', color: BLUE, fontSize: 16 }}
            >
              ↻
            </button>
          ) : null}

          {search !== undefined && onSearch ? (
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="חיפוש מכרזים…"
              style={{ marginInlineStart: 12, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + BORDER, background: '#f7f9fb', fontSize: 13, fontFamily: RBK, minWidth: 180, color: DARK }}
            />
          ) : (
            <div style={{ marginInlineStart: 'auto' }} />
          )}
        </div>
      </nav>
      <MobileTabBar />
    </>
  );
}
