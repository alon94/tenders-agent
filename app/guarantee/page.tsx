'use client';
import { useEffect, useState } from 'react';
import InternalShell from '../components/InternalShell';
import { BORDER, DARK, fmtDate } from '../lib/tenderMeta';

type Guarantee = {
  id: string; tenderTitle: string; type: string;
  amount: number; expiry: string; status: 'active' | 'expiring' | 'pending';
};
type Kpi = { totalAmount: number; active: number; expiring: number; pending: number };

const STATUS: Record<Guarantee['status'], { label: string; bg: string; fg: string; bd: string }> = {
  active:   { label: 'פעילה',       bg: '#e8f1fb', fg: '#1e5aa8', bd: '#cfe0f4' },
  expiring: { label: 'פגה בקרוב',   bg: '#fbe9e7', fg: '#b04a34', bd: '#f2cfc8' },
  pending:  { label: 'בתהליך אישור', bg: '#fbf3d8', fg: '#96731a', bd: '#f0e3b0' },
};

function shekel(n: number) { return '\u20AA' + n.toLocaleString('he-IL'); }

export default function GuaranteePage() {
  const [items, setItems] = useState<Guarantee[]>([]);
  const [kpi, setKpi] = useState<Kpi>({ totalAmount: 0, active: 0, expiring: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/guarantees')
      .then((r) => r.json())
      .then((d) => { setItems(d.items || []); if (d.kpi) setKpi(d.kpi); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const kpiCells = [
    { v: shekel(kpi.totalAmount), l: 'סה"כ ערבויות', c: DARK },
    { v: String(kpi.active), l: 'פעילות', c: '#1e7d45' },
    { v: String(kpi.expiring), l: 'פגות החודש', c: '#b04a34' },
    { v: String(kpi.pending), l: 'בתהליך אישור', c: '#2b6fc4' },
  ];

  return (
    <InternalShell
      title="ערבויות וליווי"
      subtitle="ניהול ערבויות ומעקב תוקף"
      action={<button style={{ background: '#2b6fc4', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>+ בקשת ערבות חדשה</button>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: '#fff', border: '1px solid ' + BORDER, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        {kpiCells.map((k, i) => (
          <div key={i} style={{ padding: '16px 18px', borderInlineEnd: i < 3 ? '1px solid ' + BORDER : 'none' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
            <div style={{ fontSize: 12, color: '#7a8794', marginTop: 3 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid ' + BORDER, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 130px 150px 120px', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: '#7a8794', borderBottom: '1px solid ' + BORDER, background: '#f6f8fa' }}>
          <span>מכרז</span><span>סוג ערבות</span><span>סכום</span><span>תוקף עד</span><span>סטטוס</span>
        </div>
        {loading ? (
                    <div style={{ padding: 20, color: '#7a8794' }}>טוען…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 20, color: '#7a8794' }}>אין ערבויות להצגה</div>
        ) : (
          items.map((g) => {
            const s = STATUS[g.status];
            return (
              <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 130px 150px 120px', padding: '14px 16px', fontSize: 13.5, alignItems: 'center', borderBottom: '1px solid ' + BORDER }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, paddingInlineEnd: 10 }}>
                  <span style={{ fontWeight: 600, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.tenderTitle}</span>
                  <a href={'/tender/' + g.id} style={{ flex: '0 0 auto', fontSize: 11.5, fontWeight: 600, color: '#1e5aa8', background: '#e8f1fb', border: '1px solid #cfe0f4', borderRadius: 7, padding: '3px 9px', textDecoration: 'none', whiteSpace: 'nowrap' }}>פרטים</a>
                </span>
                <span style={{ color: '#5b6b7a' }}>{g.type}</span>
                <span style={{ fontWeight: 700, color: DARK }}>{shekel(g.amount)}</span>
                <span style={{ color: '#5b6b7a' }}>{fmtDate(g.expiry)}</span>
                <span><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: s.bg, color: s.fg, border: '1px solid ' + s.bd }}>{s.label}</span></span>
              </div>
            );
          })
        )}
      </div>
    </InternalShell>
  );
}
