'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * כפתור צף גלובלי — מעבר מהיר למכרזים מכל נקודה באתר.
 * מוסתר בדשבורד עצמו (מיותר), ומתרומם מעל סרגל הטאבים במובייל.
 */
export default function FloatingTenders() {
  const path = usePathname() || '';
  const [count, setCount] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const f = () => setMobile(window.innerWidth <= 768);
    f(); window.addEventListener('resize', f);
    fetch('/api/nav-counts').then(r => r.ok ? r.json() : null).then(d => d && setCount(d.active)).catch(() => {});
    return () => window.removeEventListener('resize', f);
  }, []);

  // QA #15: בדפי האפליקציה יש כבר "גילוי מכרזים" בסרגל הצד (דסקטופ) ובסרגל התחתון (מובייל) —
  // הכפתור הצף חפף לכרטיס הסוכן, לכפתור ההתחברות ולכותרות תוכן. נשאר רק בדפי השיווק.
  const onAppPage = ['/dashboard', '/admin', '/marked', '/agent', '/guarantee', '/sources', '/profile', '/tender', '/signin', '/signup', '/onboarding', '/auth'].some(p => path.startsWith(p));
  if (onAppPage) return null;

  return (
    <a
      href="/dashboard"
      aria-label="מעבר לכל המכרזים"
      style={{
        position: 'fixed', insetInlineStart: 20,
        bottom: 22,
        zIndex: 300,
        display: 'inline-flex', alignItems: 'center', gap: 9,
        background: '#2b6fc4', color: '#fff', textDecoration: 'none',
        borderRadius: 999, padding: mobile ? '13px 18px' : '14px 22px',
        fontSize: mobile ? 14 : 15, fontWeight: 700, fontFamily: 'inherit',
        boxShadow: '0 8px 24px rgba(43,111,196,.42)',
      }}
    >
      <span style={{ fontSize: 17, lineHeight: 1 }}>▧</span>
      <span>כל המכרזים</span>
      {count !== null && (
        <span style={{ background: 'rgba(255,255,255,.22)', borderRadius: 999, padding: '2px 9px', fontSize: 12.5 }}>
          {count.toLocaleString('he-IL')}
        </span>
      )}
    </a>
  );
}
