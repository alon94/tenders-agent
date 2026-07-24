'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSession, signOut, AUTH_EVENT, type AuthSession } from '../lib/authClient';

// ============================================================
// MobileMenu — כפתור המבורגר + מגירת ניווט צדית למובייל
// מוצג בכותרת העמוד במסכים צרים; פותח את תפריט הצד המלא
// כולל פרופיל, התחברות/התנתקות.
// ============================================================

const DARK = '#1a2330';
const BLUE = '#2b6fc4';
const BORDER = '#e6eaee';
const ACTIVE_BG = '#e8f1fb';
const ACTIVE_FG = '#1e5aa8';

const NAV = [
  { icon: '◧', label: 'גילוי מכרזים', href: '/dashboard', countKey: 'active' as const },
  { icon: '⊘', label: 'מכרזים פטורים', href: '/dashboard?view=exempt', countKey: 'exempt' as const },
  { icon: '⭐', label: 'העדפה לעסקים קטנים', href: '/dashboard?view=smallbiz', countKey: 'smallbiz' as const },
  { icon: '★', label: 'מכרזים מסומנים', href: '/marked' },
  { icon: '◈', label: 'מכרזי הסוכן החכם', href: '/agent' },
  { icon: '▤', label: 'ערבויות וליווי', href: '/guarantee' },
  { icon: '⛁', label: 'מקורות', href: '/sources' },
  { icon: '⚙', label: 'פרופיל עסקי', href: '/profile' },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<{ active?: number; exempt?: number; smallbiz?: number }>({});
  useEffect(() => { fetch('/api/nav-counts').then(r => r.ok ? r.json() : {}).then(setCounts).catch(() => {}); }, []);
  const [session, setSession] = useState<AuthSession | null>(null);
  const path = usePathname();

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

  // נעילת גלילה של הרקע כשהמגירה פתוחה
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  async function handleSignOut() {
    await signOut();
    window.location.href = '/signin';
  }

  return (
    <>
      <button
        type="button"
        aria-label="פתיחת תפריט"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        style={{
          width: 38, height: 38, borderRadius: 9, border: `1px solid ${BORDER}`,
          background: '#fff', cursor: 'pointer', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', padding: 0,
        }}
      >
        <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ width: 17, height: 2, borderRadius: 2, background: DARK, display: 'block' }} />
          <span style={{ width: 17, height: 2, borderRadius: 2, background: DARK, display: 'block' }} />
          <span style={{ width: 17, height: 2, borderRadius: 2, background: DARK, display: 'block' }} />
        </span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(16,24,32,0.45)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
              width: 280, maxWidth: '84vw', background: '#fff',
              boxShadow: '0 0 32px rgba(0,0,0,.18)',
              display: 'flex', flexDirection: 'column',
              padding: '18px 14px calc(18px + env(safe-area-inset-bottom))',
              direction: 'rtl', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, marginBottom: 12, borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15 }}>ש</div>
              <div style={{ lineHeight: 1.2, flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: DARK }}>שווה מכרזים</div>
                <div style={{ fontSize: 11, color: '#8a97a3' }}>מועדון עסקים 360</div>
              </div>
              <button
                type="button"
                aria-label="סגירת תפריט"
                onClick={() => setOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#eef1f4', color: DARK, fontSize: 16, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {NAV.map((item) => {
              const active = (path === item.href.split('?')[0] && !item.href.includes('?')) || (path != null && item.href.indexOf('?') < 0 && path.startsWith(item.href + '/'));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                    padding: '12px 12px', borderRadius: 10, fontSize: 14.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? ACTIVE_FG : '#5b6b7a',
                    background: active ? ACTIVE_BG : 'transparent',
                    borderInlineStart: active ? `3px solid ${BLUE}` : '3px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              );
            })}

            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
              {session ? (
                <div>
                  <div style={{ fontSize: 11.5, color: '#8a97a3', marginBottom: 8, wordBreak: 'break-all' }}>{session.user.email}</div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #e2e7ec', background: '#fff', color: '#5b6b7a', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    התנתקות
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <a href="/signin" style={{ display: 'block', textAlign: 'center', padding: '10px 12px', borderRadius: 9, border: '1px solid #e2e7ec', background: '#fff', color: DARK, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>התחברות</a>
                  <a href="/signup" style={{ display: 'block', textAlign: 'center', padding: '10px 12px', borderRadius: 9, border: 'none', background: BLUE, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>הרשמה</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
