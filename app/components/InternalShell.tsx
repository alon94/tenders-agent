'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import MobileTabBar from './MobileTabBar';
import MobileMenu from './MobileMenu';
import { getSession, signOut, AUTH_EVENT, type AuthSession } from '../lib/authClient';

// ============================================================
// InternalShell — מעטפת משותפת לדפים הפנימיים (סגנון 2a אנטרפרייז)
// סרגל צד 238px לבן + אזור תוכן. במובייל: הסרגל מוסתר ו-MobileTabBar משתלט.
// פלטת צבעים = צבעי הדשבורד הקיים.
// ============================================================

const DARK = '#1a2330';
const BLUE = '#2b6fc4';
const BORDER = '#e6eaee';
const ACTIVE_BG = '#e8f1fb';
const ACTIVE_FG = '#1e5aa8';

const NAV: { icon: string; label: string; href: string; countKey?: 'active' | 'exempt' | 'smallbiz' }[] = [
  { icon: '◧', label: 'גילוי מכרזים', href: '/dashboard', countKey: 'active' },
  { icon: '⊘', label: 'מכרזים פטורים', href: '/dashboard?view=exempt', countKey: 'exempt' },
  { icon: '⭐', label: 'העדפה לעסקים קטנים', href: '/dashboard?view=smallbiz', countKey: 'smallbiz' },
  { icon: '★', label: 'מכרזים מסומנים', href: '/marked' },
  { icon: '◈', label: 'מכרזי הסוכן החכם', href: '/agent' },
  { icon: '▤', label: 'ערבויות וליווי', href: '/guarantee' },
  { icon: '⛁', label: 'מקורות', href: '/sources' },
  { icon: '⚙', label: 'פרופיל עסקי', href: '/profile' },
];

export default function InternalShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const path = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [counts, setCounts] = useState<{ active?: number; exempt?: number; smallbiz?: number }>({});
  const [navQ, setNavQ] = useState('');

  useEffect(() => {
    fetch('/api/nav-counts').then(r => r.ok ? r.json() : {}).then(setCounts).catch(() => {});
  }, []);
  const goSearch = () => { if (navQ.trim()) window.location.href = '/dashboard?q=' + encodeURIComponent(navQ.trim()); };

  useEffect(() => {
    setSession(getSession());
    const onChange = () => setSession(getSession());
    window.addEventListener(AUTH_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    window.location.href = '/signin';
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#eef1f4',
        direction: 'rtl',
        color: DARK,
        fontFamily: "'Heebo', Arial, sans-serif",
      }}
    >
      {!isMobile && (
        <nav aria-label="ניווט ראשי"
          style={{
            flex: '0 0 238px',
            background: '#fff',
            borderInlineEnd: `1px solid ${BORDER}`,
            padding: '22px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingBottom: 18,
              marginBottom: 14,
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: BLUE,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              ש
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>שווה מכרזים</div>
              <div style={{ fontSize: 11, color: '#6b7785' }}>מועדון עסקים 360</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f4f6f8', border: `1.5px solid ${BLUE}33`, borderRadius: 10, padding: '9px 12px', marginBottom: 14 }}>
            <span style={{ color: BLUE, fontSize: 15 }}>⌕</span>
            <input type="search" aria-label="חיפוש מכרזים" className="search-input" value={navQ} onChange={e => setNavQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && goSearch()}
              placeholder="חיפוש מכרזים…" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: DARK, fontFamily: 'inherit' }} />
          </div>
          <div>
            {NAV.map((item) => {
              const base = item.href.split('?')[0];
              const active = item.href.includes('?') ? false : base === '/' ? path === '/' : (path === base || (path != null && path.startsWith(base + '/')));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textDecoration: 'none',
                    padding: '10px 12px',
                    borderRadius: 10,
                    fontSize: 13.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? ACTIVE_FG : '#5b6b7a',
                    background: active ? ACTIVE_BG : 'transparent',
                    borderInlineStart: active ? `3px solid ${BLUE}` : '3px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.countKey && counts[item.countKey] !== undefined && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: active ? ACTIVE_FG : '#6b7785', background: active ? '#fff' : '#eef1f4', borderRadius: 999, padding: '1px 8px' }}>
                      {counts[item.countKey]!.toLocaleString('he-IL')}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
          {/* QA #14: קישור "פרופיל עסקי" הופיע פעמיים — נשאר רק ברשימת הניווט */}
          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #eef1f4' }}>

            {session ? (
              <div style={{ padding: '12px 12px 2px' }}>
                <div style={{ fontSize: 11.5, color: '#6b7785', marginBottom: 8, wordBreak: 'break-all' }}>
                  {session.user.email}
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 9,
                    border: '1px solid #e2e7ec',
                    background: '#fff',
                    color: '#5b6b7a',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  התנתקות
                </button>
              </div>
            ) : (
              <div style={{ padding: '12px 12px 2px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a
                  href="/signin"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '9px 12px',
                    borderRadius: 9,
                    border: '1px solid #e2e7ec',
                    background: '#fff',
                    color: DARK,
                    fontSize: 12.5,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  התחברות
                </a>
                <a
                  href="/signup"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '9px 12px',
                    borderRadius: 9,
                    border: 'none',
                    background: BLUE,
                    color: '#fff',
                    fontSize: 12.5,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  הרשמה
                </a>
              </div>
            )}
          </div>
        </nav>
      )}
      <main
        id="main"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            background: '#fff',
            borderBottom: `1px solid ${BORDER}`,
            padding: isMobile ? '14px 16px' : '15px 26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && <MobileMenu />}
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{title}</h1>
              {subtitle && (
                <div style={{ fontSize: 12.5, color: '#62707e', marginTop: 2 }}>{subtitle}</div>
              )}
            </div>
          </div>
          {action}
        </header>
        <div
          style={{
            flex: 1,
            padding: isMobile ? '16px' : '22px 26px 30px',
            paddingBottom: isMobile ? 80 : undefined,
          }}
        >
          {children}
        </div>
      </main>
      {isMobile && <MobileTabBar />}
    </div>
  );
}
