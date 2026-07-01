'use client';
import { usePathname } from 'next/navigation';

const TABS = [
  { icon: '▧', label: 'גילוי', href: '/dashboard' },
  { icon: '★', label: 'מסומנים', href: '/marked' },
  { icon: '◈', label: 'סוכן', href: '/agent' },
  { icon: '▤', label: 'ערבויות', href: '/guarantee' },
  { icon: '⦁', label: 'מקורות', href: '/sources' },
];

const BLUE = '#2b6fc4', MUTED = '#8a97a3', BORDER = '#e6eaee';

export default function MobileTabBar() {
  const path = usePathname();
  return (
    <nav style={{
      position: 'fixed', insetInline: 0, bottom: 0, zIndex: 200,
      background: '#fff', borderTop: `1px solid ${BORDER}`,
      padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
      display: 'flex', justifyContent: 'space-around', direction: 'rtl',
    }}>
      {TABS.map(t => {
        const active = path === t.href || path?.startsWith(t.href + '/');
        return (
          <a key={t.href} href={t.href} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            textDecoration: 'none', minWidth: 56,
            color: active ? BLUE : MUTED, fontWeight: active ? 700 : 500,
          }}>
            <span style={{ fontSize: 19 }}>{t.icon}</span>
            <span style={{ fontSize: 10 }}>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
