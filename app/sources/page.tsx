'use client';

import { useEffect, useState } from 'react';
import InternalShell from '../components/InternalShell';
import { DARK, BLUE, MUTED, BORDER } from '../lib/tenderMeta';
import { fetchDedupedTenders } from '../lib/tenderData';

const SOURCES = [
  {
    name: "מינהל הרכש הממשלתי",
    desc: "נסרק ישירות מהפורטל הרשמי — סטטוסים ותאריכים בזמן אמת, כולל מכרזים שטרם הגיעו למראה",
    host: 'mr.gov.il',
    url: 'https://mr.gov.il/ilgstorefront/he/',
    icon: '🏛️',
  },
  {
    name: "obudget – התקציב הפתוח",
    desc: "מקור רשימת המכרזים — רשימה, סטטוסים ותאריכים",
    host: 'next.obudget.org',
    url: 'https://next.obudget.org/',
    icon: '📊',
  },
  {
    name: "מכרזי רשויות מקומיות",
    desc: "מכרזים מוניציפליים מעיריות ומועצות — נאספים מאתרי הרשויות",
    host: 'next.obudget.org',
    url: 'https://next.obudget.org/',
    icon: '🏙️',
  },
];

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid ' + BORDER, borderTopColor: BLUE, borderRadius: '50%', animation: 'sourcesSpin 0.7s linear infinite', verticalAlign: 'middle' }} />
  );
}

export default function SourcesPage() {
  const [count, setCount] = useState<number | null>(null);
  const [updated, setUpdated] = useState<string>('—');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
        fetchDedupedTenders().then((res: any) => {
                setCount(res.tenders.length);
                setUpdated(res.fetchedAt
                                   ? new Date(res.fetchedAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                   : new Date().toLocaleDateString('he-IL'));
                setLoading(false);
        }).catch(() => { setCount(0); setLoading(false); });
  }, []);

  const kpiCells = [
    { v: loading ? <Spinner /> : (count === null ? '…' : count.toLocaleString('he-IL')), l: "מכרזים זמינים", c: DARK },
    { v: String(SOURCES.length), l: "מקורות פעילים", c: '#1e7d45' },
    { v: loading ? <Spinner /> : updated, l: "עדכון אחרון", c: BLUE },
  ];

  return (
    <InternalShell title={"מקורות נתונים"} subtitle={"המקורות שמזינים את הפלטפורמה בזמן אמת"}>
      <style>{`@keyframes sourcesSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', background: '#fff', border: '1px solid ' + BORDER, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        {kpiCells.map((k, i) => (
          <div key={i} style={{ padding: '16px 18px', borderInlineEnd: i < kpiCells.length - 1 ? '1px solid ' + BORDER : 'none' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.c, minHeight: 28, display: 'flex', alignItems: 'center' }}>{k.v}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {SOURCES.map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid ' + BORDER, borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>{s.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: DARK }}>{s.name}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#1e7d45', background: '#e7f6ec', borderRadius: 6, padding: '2px 8px' }}>{"פעיל"}</span>
              </div>
              <div style={{ fontSize: 13.5, color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>{s.desc}</div>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: BLUE, textDecoration: 'none' }}>{"לצפייה במקור"} ← {s.host}</a>
            </div>
          </div>
        ))}
      </div>
    </InternalShell>
  );
}
