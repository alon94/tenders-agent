'use client';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';

const TABS = [
  { icon: '⌂', label: 'בית', href: '/' },
  { icon: '▧', label: 'גילוי', href: '/dashboard' },
  { icon: '★', label: 'מסומנים', href: '/marked' },
  { icon: '◈', label: 'הסוכן', href: '/agent' },
  { icon: '⦁', label: 'מקורות', href: '/sources' },
  { icon: '⚙', label: 'פרופיל', href: '/profile' },
];

const BLUE = '#2b6fc4', DARK = '#0d2c4a', INACTIVE = '#5b6b7a', BORDER = '#dbe3ec';

export default function MobileTabBar() {
  const path = usePathname();
  const navStyle: CSSProperties = {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 200,
    // רקע מודגש + צל עליון — הסרגל היה כמעט בלתי נראה על רקע לבן
    background: 'linear-gradient(180deg,#ffffff 0%,#f4f7fb 100%)',
    borderTop: `2px solid ${BORDER}`,
    boxShadow: '0 -3px 16px rgba(13,44,74,0.10)',
    padding: '6px 6px calc(6px + env(safe-area-inset-bottom))',
    display: 'flex', justifyContent: 'space-around', direction: 'rtl',
  };
  return (
    <nav style={navStyle}>
      {TABS.map((t) => {
        const active = t.href === '/' ? path === '/' : (path === t.href || (path ? path.startsWith(t.href + '/') : false));
        const linkStyle: CSSProperties = {
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          textDecoration: 'none', minWidth: 52, padding: '5px 4px 4px',
          borderRadius: 12,
          // הטאב הפעיל מקבל גלולה כחולה מלאה — נראות מיידית
          background: active ? BLUE : 'transparent',
          color: active ? '#fff' : INACTIVE,
          fontWeight: active ? 700 : 600,
          boxShadow: active ? '0 2px 8px rgba(43,111,196,0.35)' : 'none',
          transition: 'background .15s ease',
        };
        return (
          <a key={t.href} href={t.href} style={linkStyle}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 10.5, letterSpacing: '-0.2px', color: active ? '#fff' : DARK }}>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
