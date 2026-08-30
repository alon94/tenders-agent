'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// פוטר גלובלי רזה — קישורי המסמכים המשפטיים בכל עמודי האתר.
// דף הבית מוחרג (יש לו פוטר ממותג מלא עם אותם קישורים), וכך גם מערכת
// הניהול. במובייל נשמר מרווח תחתון כדי לא להתחבא מאחורי סרגל הטאבים הקבוע.
const HIDDEN_PREFIXES = ['/admin'];

export default function SiteFooter() {
  const pathname = usePathname() || '/';
  if (pathname === '/' || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return (
    <footer
      className="site-footer"
      style={{
        direction: 'rtl',
        fontFamily: "'Heebo', Arial, sans-serif",
        background: '#1a2330',
        color: '#93a9c1',
        padding: '14px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px 22px',
        fontSize: 12.5,
      }}
    >
      <Link href="/" style={{ color: '#c7d4e2', textDecoration: 'none', fontWeight: 700 }}>שווה מכרזים</Link>
      <a href="/terms" style={{ color: '#93a9c1', textDecoration: 'none' }}>תנאי שימוש</a>
      <a href="/privacy" style={{ color: '#93a9c1', textDecoration: 'none' }}>מדיניות פרטיות</a>
      <a href="/accessibility" style={{ color: '#93a9c1', textDecoration: 'none' }}>הצהרת נגישות</a>
      <span style={{ color: '#5f6c7a' }}>© {new Date().getFullYear()} שווה קולקטיב</span>
    </footer>
  );
}
