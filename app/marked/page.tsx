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
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'all' | 'closing'>('all');

  // QA/B-1: קודם נשלפו 1,000 המכרזים הראשונים והסינון נעשה בדפדפן, כך
  // ש-8,485 מתוך 9,485 המכרזים (89%) לא היו ניתנים לשחזור כאן — וגם כל
  // מכרז שמועד הגשתו חלף נעלם, כי ה-API מחזיר פעילים בלבד כברירת מחדל.
  // עכשיו נשלפים בדיוק המזהים המסומנים, ללא סינון פעילים.
  useEffect(() => {
    let cancelled = false;
    let ids: string[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem('markedTenders') || '[]');
      if (Array.isArray(raw)) ids = raw.filter((x): x is string => typeof x === 'string' && !!x);
    } catch {}
    setMarked(ids);

    if (!ids.length) { setLoading(false); return; }

    // הגנה על אורך ה-URL: שליחה במנות של 100 מזהים.
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

    // מזהים נשלחים כפרמטרים חוזרים (?id=a&id=b) ולא כרשימה מופרדת
    // בפסיקים — חלק מהמזהים נגזרים מטקסט חופשי ועשויים להכיל פסיק,
    // שהיה מפצל אותם לשני מזהי זבל.
    // allSettled ולא all: מנה אחת שנכשלת לא מוחקת את המנות שהצליחו.
    Promise.allSettled(
      chunks.map((chunk) => {
        const qs = new URLSearchParams();
        for (const id of chunk) qs.append('id', id);
        return fetch('/api/tenders?' + qs.toString())
          .then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
          .then((d) => (Array.isArray(d) ? d : d.tenders || []) as Tender[]);
      })
    )
      .then((results) => {
        if (cancelled) return;
        const ok = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<Tender[]>[];
        setAll(ok.flatMap((r) => r.value));
        // שגיאה מוצגת רק אם משהו באמת נכשל — ואם חלק הצליח, היא באנר
        // ולא מסך ריק.
        setError(ok.length < results.length);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  function remove(id: string) {
    const next = marked.filter((m) => m !== id);
    setMarked(next);
    try { localStorage.setItem('markedTenders', JSON.stringify(next)); } catch {}
  }

  // QA/M-11: הכפתור "ייצוא ל-Excel" רונדר בלי onClick ולא עשה דבר.
  // ייצוא CSV עם BOM כדי ש-Excel יזהה עברית ב-UTF-8.
  function exportCsv(list: Tender[]) {
    // כותרות המכרזים נגרפות מאתרים חיצוניים, ולכן הן תוכן לא-אמין.
    // Excel מסיר את המרכאות ומריץ תא שמתחיל ב-= + - @ טאב או CR
    // (formula injection), ולכן מוסיפים גרש מוביל שמנטרל את ההרצה.
    const esc = (v: string) => {
      const s = String(v ?? '');
      const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    const header = ['ציון', 'נושא', 'גוף מפרסם', 'סטטוס', 'תאריך פרסום', 'מועד הגשה', 'קישור'];
    const lines = list.map((t) => [
      String(scoreFor(t.title || '', t.publisher || '')),
      t.title || '', t.publisher || '', t.status || '',
      fmtDate(t.publishDate || ''), fmtDate(t.deadline || ''), t.url || '',
    ].map(esc).join(','));
    const blob = new Blob(['﻿' + [header.map(esc).join(','), ...lines].join('\r\n')],
      { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marked-tenders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    // שחרור ב-tick נפרד — שחרור באותו tick של ה-click גורם להורדות
    // קטומות בחלק מהדפדפנים.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const rows = all.filter((t) => marked.includes(t.id));
  const closing = rows.filter((t) => { const d = daysLeft(t.deadline || ''); return d !== null && d >= 0 && d <= 7; });
  const shown = tab === 'closing' ? closing : rows;

  return (
    <InternalShell
      title="מכרזים מסומנים"
      subtitle={rows.length + ' מכרזים שמורים למעקב'}
      // מייצא את כל המסומנים (rows) ולא רק את הטאב הפעיל — הכפתור יושב
      // בכותרת ליד "N מכרזים שמורים למעקב", ולכן זו הציפייה הסבירה.
      action={<button onClick={() => exportCsv(rows)} disabled={rows.length === 0} style={{ background: '#fff', color: rows.length ? '#1e5aa8' : '#9aa6b2', border: '1px solid ' + BORDER, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: rows.length ? 'pointer' : 'not-allowed' }}>ייצוא ל-Excel ↓</button>}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button onClick={() => setTab('all')} style={{ border: '1px solid ' + (tab === 'all' ? DARK : BORDER), background: tab === 'all' ? DARK : '#fff', color: tab === 'all' ? '#fff' : '#5b6b7a', borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>הכל · {rows.length}</button>
                <button onClick={() => setTab('closing')} style={{ border: '1px solid ' + (tab === 'closing' ? '#b04a34' : BORDER), background: tab === 'closing' ? '#fbe9e7' : '#fff', color: '#b04a34', borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>נסגרים בקרוב · {closing.length}</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid ' + BORDER, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 232px 150px 120px', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: '#7a8794', borderBottom: '1px solid ' + BORDER, background: '#f6f8fa' }}>
          <span>ציון</span><span>נושא</span><span>סטטוס</span><span>מועד</span><span>פעולות</span>
        </div>
        {error && !loading && shown.length > 0 && (
          // כשל חלקי: חלק מהמנות נטענו — באנר, לא מסך ריק.
          <div style={{ padding: '10px 16px', background: '#fdf1e5', borderBottom: '1px solid ' + BORDER, color: '#a8500f', fontSize: 13, fontWeight: 600 }}>
            חלק מהמכרזים המסומנים לא נטענו. הרשימה חלקית — נסו לרענן.
          </div>
        )}
        {loading ? (
                    <div style={{ padding: 20, color: '#7a8794' }}>טוען…</div>
        ) : error && shown.length === 0 ? (
                    // QA/H-3: כשל טעינה חייב להיראות אחרת מ"אין סימונים".
                    <div style={{ padding: 24, textAlign: 'center' }}>
                      <div style={{ color: '#b04a34', fontWeight: 600, marginBottom: 8 }}>לא הצלחנו לטעון את המכרזים המסומנים</div>
                      <div style={{ color: '#7a8794', fontSize: 13, marginBottom: 12 }}>הסימונים שלכם נשמרו ולא אבדו. נסו לרענן.</div>
                      <button onClick={() => window.location.reload()} style={{ background: DARK, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>רענון</button>
                    </div>
        ) : shown.length === 0 ? (
                    <div style={{ padding: 24, color: '#7a8794', textAlign: 'center' }}>אין מכרזים מסומנים עדיין. סמנו מכרזים ☆ מדף הגילוי.</div>
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
                                    <div style={{ fontSize: 12, color: '#7a8794', marginTop: 3 }}>{t.publisher || 'לא ידוע'} · פורסם {fmtDate(t.publishDate || '')}</div>
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
