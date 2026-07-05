'use client';
import { useEffect, useState } from 'react';
import InternalShell from '../components/InternalShell';
import { BORDER, DARK, bandColor, scoreFor, statusTags, daysLeft, fmtDate } from '../lib/tenderMeta';

interface Tender {
  id: string; title?: string; publisher?: string;
  publishDate?: string; deadline?: string; status?: string; url?: string; type?: string;
}

export default function MarkedPage() {
  const [all, setAll] = useState<Tender[]>([]);
  const [marked, setMarked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'closing'>('all');

  useEffect(() => {
    try { setMarked(JSON.parse(localStorage.getItem('markedTenders') || '[]')); } catch {}
    fetch('/api/tenders?offset=0')
      .then((r) => r.json())
      .then((d) => setAll(Array.isArray(d) ? d : d.items || d.tenders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function remove(id: string) {
    const next = marked.filter((m) => m !== id);
    setMarked(next);
    try { localStorage.setItem('markedTenders', JSON.stringify(next)); } catch {}
  }

  const rows = all.filter((t) => marked.includes(t.id));
  const closing = rows.filter((t) => { const d = daysLeft(t.deadline || ''); return d !== null && d >= 0 && d <= 7; });
  const shown = tab === 'closing' ? closing : rows;

  return (
    <InternalShell
      title="מכרזים מסומנים"
      subtitle={rows.length + ' מכרזים שמורים למעקב'}
      action={<button style={{ background: '#fff', color: '#1e5aa8', border: '1px solid ' + BORDER, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>ייצוא ל-Excel \u2193</button>}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('all')} style={{ border: '1px solid ' + (tab === 'all' ? DARK : BORDER), background: tab === 'all' ? DARK : '#fff', color: tab === 'all' ? '#fff' : '#5b6b7a', borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>הכל \u00B7 {rows.length}</button>
        <button onClick={() => setTab('closing')} style={{ border: '1px solid ' + (tab === 'closing' ? '#b04a34' : BORDER), background: tab === 'closing' ? '#fbe9e7' : '#fff', color: '#b04a34', borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>נסגרים בקרוב \u00B7 {closing.length}</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid ' + BORDER, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 232px 150px 120px', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: '#7a8794', borderBottom: '1px solid ' + BORDER, background: '#f6f8fa' }}>
          <span>ציון</span><span>נושא</span><span>סטטוס</span><span>מועד</span><span>פעולות</span>
        </div>
        {loading ? (
          <div style={{ padding: 20, color: '#7a8794' }}>טוען\u2026</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 24, color: '#7a8794', textAlign: 'center' }}>אין מכרזים מסומנים עדיין. סמנו מכרזים \u2606 מדף הגילוי.</div>
        ) : (
          shown.map((t) => {
            const d = daysLeft(t.deadline || '');
            const score = scoreFor(t.title || '', t.publisher || '');
            const tags = statusTags(t.status || '', d, t.publisher);
            return (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 232px 150px 120px', padding: '14px 16px', alignItems: 'center', borderBottom: '1px solid ' + BORDER }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: DARK, lineHeight: 1 }}>{score}</span>
                  <span style={{ width: 26, height: 3, borderRadius: 2, background: bandColor(score) }} />
                </div>
                <div style={{ paddingInlineEnd: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: DARK, lineHeight: 1.4 }}>{t.title || 'ללא כותרת'}</div>
                  <div style={{ fontSize: 12, color: '#7a8794', marginTop: 3 }}>{t.publisher || 'לא ידוע'} \u00B7 פורסם {fmtDate(t.publishDate || '')}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {tags.slice(0, 3).map((g, gi) => (<span key={gi} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: g.bg, color: g.fg, border: '1px solid ' + g.bd }}>{g.label}</span>))}
                </div>
                <div style={{ fontSize: 13 }}>
                  <div style={{ color: DARK, fontWeight: 600 }}>{fmtDate(t.deadline || '')}</div>
                  {d !== null && d >= 0 && <div style={{ color: d <= 7 ? '#b04a34' : '#7a8794', fontSize: 12 }}>נותרו {d} ימים</div>}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                  <a href={'/tender/' + t.id} style={{ color: '#2b6fc4', fontWeight: 600, textDecoration: 'none' }}>פרטים</a>
                  <button onClick={() => remove(t.id)} style={{ color: '#b04a34', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>הסר</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </InternalShell>
  );
}
