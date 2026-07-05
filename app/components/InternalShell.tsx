'use client';
import { usePathname } from 'next/navigation';
import { useIsMobile } from '../hooks/useIsMobile';
import MobileTabBar from './MobileTabBar';

// ============================================================
//  InternalShell — מעטפת משותפת לדפים הפנימיים (סגנון 2a אנטרפרייז)
//  סרגל צד 238px לבן + אזור תוכן. במובייל: הסרגל מוסתר ו-MobileTabBar משתלט.
//  פלטת צבעים = צבעי הדשבורד הקיים.
// ============================================================

const DARK = '#1a2330', BLUE = '#2b6fc4', BORDER = '#e6eaee';
const ACTIVE_BG = '#e8f1fb', ACTIVE_FG = '#1e5aa8';

const NAV = [
  { icon: '\u25E7', label: 'גילוי', href: '/dashboard' },
  { icon: '\u2605', label: 'מסומנים', href: '/marked' },
  { icon: '\u25C8', label: 'סוכן', href: '/agent' },
  { icon: '\u25A4', label: 'ערבויות', href: '/guarantee' },
  { icon: '\u26C1', label: 'מקורות', href: '/sources' },
];

export default function InternalShell({
  title, subtitle, action, children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const path = usePathname();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#eef1f4', direction: 'rtl', color: DARK, fontFamily: "'Heebo', Arial, sans-serif" }}>
      {!isMobile && (
        <aside style={{ flex: '0 0 238px', background: '#fff', borderInlineEnd: '1px solid ' + BORDER, padding: '22px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, marginBottom: 12, borderBottom: '1px solid ' + BORDER }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>ש</div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>שווה מכרזים</div>
              <div style={{ fontSize: 11, color: '#8a97a3' }}>מועדון עסקים 360</div>
            </div>
          </div>
          {NAV.map((n) => {
            const active = path === n.href || (path != null && path.startsWith(n.href + '/'));
            return (
              <a key={n.href} href={n.href} style={{
                display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none',
                padding: '10px 12px', borderRadius: 10, fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? ACTIVE_FG : '#5b6b7a',
                background: active ? ACTIVE_BG : 'transparent',
                borderInlineStart: active ? '3px solid ' + BLUE : '3px solid transparent',
              }}>
                <span style={{ fontSize: 17 }}>{n.icon}</span>{n.label}
              </a>
            );
          })}
        </aside>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid ' + BORDER, padding: isMobile ? '14px 16px' : '15px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12.5, color: '#7a8794', marginTop: 2 }}>{subtitle}</div>}
          </div>
          {action}
        </header>
        <div style={{ flex: 1, padding: isMobile ? '16px' : '22px 26px 30px', paddingBottom: isMobile ? 88 : 30 }}>
          {children}
        </div>
      </div>

      {isMobile && <MobileTabBar />}
    </div>
  );
}
