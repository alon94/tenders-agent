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
