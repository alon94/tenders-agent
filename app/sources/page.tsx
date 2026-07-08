'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import InternalShell from '../components/InternalShell';
import { DARK, BLUE, MUTED, BORDER } from '../lib/tenderMeta';

type SourceCard = {
  name: string;
  desc: string;
  href: string;
  status: string;
  dot: string;
};

const SOURCES: SourceCard[] = [
  {
    name: 'מינהל הרכש הממשלתי',
    desc: 'מקור פרטי המכרז החי — פרטים מלאים, אנשי קשר ומסמכים',
    href: 'https://mr.gov.il',
    status: 'פעיל',
    dot: '#1e9e5a',
  },
  {
    name: 'obudget — התקציב הפתוח',
    desc: 'מקור רשימת המכרזים — רשימה, סטטוסים ותאריכים',
    href: 'https://next.obudget.org',
    status: 'פעיל',
    dot: '#1e9e5a',
  },
];

export default function SourcesPage() {
  const [total, setTotal] = useState<number | null>(null);
  const [updated, setUpdated] = useState('');

  useEffect(() => {
    fetch('/api/tenders?count=1')
      .then((r) => r.json())
      .then((d) => setTotal(typeof d.total === 'number' ? d.total : null))
      .catch(() => setTotal(null));
    setUpdated(
      new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    );
  }, []);

  const kpis = [
    { label: 'מכרזים זמינים במאגר', value: total === null ? '…' : total.toLocaleString('he-IL'), dot: BLUE },
    { label: 'מקורות פעילים', value: String(SOURCES.length), dot: '#1e9e5a' },
    { label: 'עדכון אחרון', value: updated || '…', dot: '#d9a520' },
  ];

  return (
    <InternalShell
      title="מקורות נתונים"
      subtitle="המאגרים המזינים את שווה מכרזים בזמן אמת"
    >
      {/* KPI strip — dashboard style: connected cards on BORDER background */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
          background: BORDER,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 22,
        }}
      >
        {kpis.map((k) => (
          <div key={k.label} style={{ background: '#fff', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: k.dot }} />
              <span style={{ fontSize: 12.5, color: MUTED }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: DARK, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Source cards */}
      <div style={{ display: 'grid', gap: 14 }}>
        {SOURCES.map((s) => (
          <div
            key={s.name}
            style={{
              background: '#fff',
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: DARK }}>{s.name}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    color: '#1e9e5a',
                    background: '#eaf6ee',
                    padding: '2px 9px',
                    borderRadius: 999,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot }} />
                  {s.status}
                </span>
              </div>
              <div style={{ fontSize: 13, color: MUTED }}>{s.desc}</div>
            </div>
            <Link
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: BLUE,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              פתח מקור ↗
            </Link>
          </div>
        ))}
      </div>
    </InternalShell>
  );
}
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import MobileTabBar from '../components/MobileTabBar';

const DARK = '#1a2330';
const BLUE = '#2b6fc4';
const MUTED = '#667380';
const BORDER = '#e6eaee';
const PAGE_BG = '#f4f6f8';

type Src = {
  name: string;
  tag: string;
  desc: string;
  href: string;
  hrefLabel: string;
  icon: string;
  dot: string;
};

const SOURCES: Src[] = [
  {
    name: 'מינהל הרכש הממשלתי',
    tag: 'פעיל',
    desc: 'מקור פרטי המכרז החי — פרטים מלאים, אנשי קשר ומסמכים',
    href: 'https://mr.gov.il',
    hrefLabel: 'mr.gov.il',
    icon: '🏛️',
    dot: '#1e9e5a',
  },
  {
    name: 'obudget — התקציב הפתוח',
    tag: 'פעיל',
    desc: 'מקור רשימת המכרזים — רשימה, סטטוסים ותאריכים',
    href: 'https://next.obudget.org',
    hrefLabel: 'next.obudget.org',
    icon: '📊',
    dot: BLUE,
  },
];

export default function SourcesPage() {
  const [count, setCount] = useState<number | null>(null);
  const [time, setTime] = useState('');

  useEffect(() => {
    setTime(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
    (async () => {
      try {
        let total = 0;
        let off = 0;
        for (let i = 0; i < 12; i++) {
          const r = await fetch('/api/tenders?offset=' + off).then((x) => x.json());
          const n = (r.tenders || []).length;
          total += n;
          if (n === 0) break;
          off += 1000;
        }
        setCount(total);
      } catch {
        setCount(null);
      }
    })();
  }, []);

  const kpis = [
    { num: count === null ? '…' : count.toLocaleString('he-IL'), label: 'מכרזים זמינים במאגר', dot: BLUE },
    { num: String(SOURCES.length), label: 'מקורות פעילים', dot: '#1e9e5a' },
    { num: new Date().toLocaleDateString('he-IL'), label: 'עדכון אחרון', dot: '#d9a520' },
  ];

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: 'Assistant, Rubik, Arial, sans-serif', paddingBottom: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: '#fff', borderBottom: '1px solid ' + BORDER, padding: '15px 26px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: DARK }}>מקורות נתונים</div>
        <Link href="/dashboard" style={{ background: BLUE, color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 600 }}>✦ תובנות AI</Link>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eef1f4', color: DARK, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>א</div>
        <div style={{ fontSize: 12.5, color: '#7a8794' }}>עודכן {time} · data.gov.il</div>
        <div style={{ flex: 1 }} />
        <div style={{ minWidth: 320, maxWidth: 420, flex: '0 1 420px', background: '#fff', border: '1px solid ' + BORDER, borderRadius: 10, padding: '9px 14px', color: MUTED, fontSize: 14 }}>
          חיפוש: מקור, כתובת…
        </div>
      </div>

      <div style={{ padding: '22px 26px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: BORDER, border: '1px solid ' + BORDER, borderRadius: 12, overflow: 'hidden', marginBottom: 22 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: '#fff', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-start' }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: DARK }}>{k.num}</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: k.dot, display: 'inline-block' }} />
              </div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {SOURCES.map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid ' + BORDER, borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eef1f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{s.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: DARK }}>{s.name}</div>
                <span style={{ background: '#e7f6ec', color: '#1e7d45', fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '3px 9px' }}>{s.tag}</span>
              </div>
              <div style={{ fontSize: 13.5, color: MUTED, marginTop: 10 }}>{s.desc}</div>
              <div style={{ marginTop: 12 }}>
                <a href={s.href} target="_blank" rel="noreferrer" style={{ color: BLUE, textDecoration: 'none', fontSize: 13.5, fontWeight: 600 }}>לצפייה במקור → {s.hrefLabel}</a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
