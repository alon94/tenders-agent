'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import MobileTabBar from './MobileTabBar';
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

const NAV = [
  { icon: '◧', label: 'גילוי', href: '/dashboard' },
  { icon: '★', label: 'מסומנים', href: '/marked' },
  { icon: '◈', label: 'סוכן חכם', href: '/agent' },
  { icon: '▤', label: 'ערבויות', href: '/guarantee' },
  { icon: '⛁', label: 'מקורות', href: '/sources' },
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
        <aside
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
              <div style={{ fontSize: 11, color: '#8a97a3' }}>מועדון עסקים 360</div>
            </div>
          </div>
          <div>
            {NAV.map((item) => {
              const active = path === item.href || (path != null && path.startsWith(item.href + '/'));
              return (
                <a
                  key={item.href}
                  href={item.href}
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
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #eef1f4' }}>
            <a
              href="/profile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textDecoration: 'none',
                padding: '10px 12px',
                borderRadius: 10,
                fontSize: 13.5,
                fontWeight: path === '/profile' ? 700 : 500,
                color: path === '/profile' ? ACTIVE_FG : '#5b6b7a',
                background: path === '/profile' ? ACTIVE_BG : 'transparent',
                borderInlineStart: path === '/profile' ? `3px solid ${BLUE}` : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: 15 }}>⚙</span>
              פרופיל עסקי
            </a>

            {session ? (
              <div style={{ padding: '12px 12px 2px' }}>
                <div style={{ fontSize: 11.5, color: '#8a97a3', marginBottom: 8, wordBreak: 'break-all' }}>
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
        </aside>
      )}
      <div
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
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: 12.5, color: '#7a8794', marginTop: 2 }}>{subtitle}</div>
            )}
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
      </div>
      {isMobile && <MobileTabBar />}
    </div>
  );
}
