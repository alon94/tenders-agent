'use client';
// אדמין → «בדיקת מקורות»: מריץ כל מקור ברישום (כולל מושבתים) בבדיקה יבשה
// מ-Vercel ומציג מה נשלף בפועל / השגיאה. הבדיקה היחידה שמשקפת נגישות
// אמיתית מהשרת (WAF, גיאו, IL_PROXY_URL) — לא מהמחשב של המפעיל.
import React, { useCallback, useEffect, useState } from 'react';

const BORDER = '#e6eaee';
const STATUS_LABEL: Record<string, { t: string; c: string }> = {
  empty: { t: '∅ נטען, 0 מכרזים', c: '#B45309' }, blocked: { t: '⛔ חסימה (200)', c: '#B91C1C' }, js: { t: '⚙ מעטפת JS', c: '#7C3AED' },
  tiny: { t: '↪ הפניה/מסמך זעיר', c: '#B45309' }, stub: { t: '— לא ממומש', c: '#8a97a3' }, error: { t: '✗ שגיאה', c: '#B91C1C' },
};
type SourceMeta = { id: string; name: string; publisher: string; enabled: boolean; note: string | null };
type RawDiag = { pages: { url: string; ok: boolean; chars?: number; snippet?: string; anchors?: { href: string; text: string }[]; error?: string }[] };
type Result = { ok: boolean; status?: 'ok' | 'empty' | 'blocked' | 'js' | 'tiny' | 'stub' | 'error'; reason?: string; fetched?: number; raw?: number; ms?: number; error?: string; sample?: { title: string; url: string; deadline: string | null }[] };

export default function SourceTester({ token }: { token: () => string | null }) {
  const [sources, setSources] = useState<SourceMeta[] | null>(null);
  const [results, setResults] = useState<Record<string, Result | 'running'>>({});
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [batch, setBatch] = useState(false);
  const [raw, setRaw] = useState<Record<string, RawDiag | 'running'>>({});
  const [rawOpen, setRawOpen] = useState<string | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);

  useEffect(() => {
    const b = token(); if (!b) return;
    fetch('/api/admin/source-test', { headers: { Authorization: `Bearer ${b}` } })
      .then((r) => (r.ok ? r.json() : null)).then((d) => d && setSources(d.sources)).catch(() => {});
  }, [token]);

  const test = useCallback(async (id: string) => {
    const b = token(); if (!b) return;
    setResults((r) => ({ ...r, [id]: 'running' }));
    try {
      const r = await fetch(`/api/admin/source-test?source=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${b}` } });
      const d = await r.json();
      setResults((prev) => ({ ...prev, [id]: r.ok ? d : { ok: false, error: d.error || `HTTP ${r.status}` } }));
    } catch (e) {
      setResults((prev) => ({ ...prev, [id]: { ok: false, error: String(e) } }));
    }
  }, [token]);

  const diag = useCallback(async (id: string): Promise<RawDiag | null> => {
    const b = token(); if (!b) return null;
    setRaw((r) => ({ ...r, [id]: 'running' }));
    try {
      const r = await fetch(`/api/admin/source-test?source=${encodeURIComponent(id)}&raw=1`, { headers: { Authorization: `Bearer ${b}` } });
      const d = await r.json();
      const v: RawDiag = r.ok ? d : { pages: [{ url: '', ok: false, error: d.error || `HTTP ${r.status}` }] };
      setRaw((prev) => ({ ...prev, [id]: v }));
      return v;
    } catch (e) {
      const v: RawDiag = { pages: [{ url: '', ok: false, error: String(e) }] };
      setRaw((prev) => ({ ...prev, [id]: v })); return v;
    }
  }, [token]);

  const visible = (sources || []).filter((s) =>
    (filter === 'all' || (filter === 'enabled') === s.enabled) &&
    (!q || `${s.id} ${s.name} ${s.publisher}`.includes(q)));

  async function testAll() {
    if (batch) return;
    setBatch(true);
    // 3 במקביל — מספיק כדי לא לחכות, בלי להעמיס על Vercel/הפרוקסי
    const queue = [...visible];
    const workers = Array.from({ length: 3 }, async () => { while (queue.length) { const s = queue.shift()!; await test(s.id); } });
    await Promise.all(workers);
    setBatch(false);
  }
  function exportCsv() {
    const rows = [['id', 'name', 'enabled', 'ok', 'status', 'fetched', 'ms', 'error', 'reason', 'note']];
    for (const s of sources || []) {
      const r = results[s.id];
      const rr = r && r !== 'running' ? r : null;
      rows.push([s.id, s.name, String(s.enabled), rr ? String(rr.ok) : '', rr?.status || '', rr?.fetched != null ? String(rr.fetched) : '', rr?.ms != null ? String(rr.ms) : '', rr?.error || '', rr?.reason || '', s.note || '']);
    }
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `sources-test-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  // אבחון מרוכז: כל המקורות המוצגים שנטענו אך החזירו 0 פריטים (או נכשלו) → JSON אחד
  async function exportDiag() {
    if (diagBusy) return;
    setDiagBusy(true);
    const targets = visible.filter((s) => { const r = results[s.id]; return r && r !== 'running' && (!r.ok || !r.fetched); });
    const out: Record<string, unknown> = {};
    const queue = [...targets];
    await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) { const s = queue.shift()!; out[s.id] = { name: s.name, enabled: s.enabled, note: s.note, result: results[s.id], raw: await diag(s.id) }; } }));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' })); a.download = `sources-diag-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setDiagBusy(false);
  }

  const counts = { ok: 0, fail: 0, empty: 0, blocked: 0, js: 0 };
  for (const s of sources || []) { const r = results[s.id]; if (r && r !== 'running') { if (!r.ok) counts.fail++; else if (r.fetched) counts.ok++; else if (r.status === 'blocked') counts.blocked++; else if (r.status === 'js' || r.status === 'tiny' || r.status === 'stub') counts.js++; else counts.empty++; } }

  const btn = (label: string, onClick: () => void, disabled = false, primary = false) => (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ padding: '6px 12px', borderRadius: 8, border: primary ? 'none' : '1px solid #d6dde4', background: primary ? '#2b6fc4' : '#fff', color: primary ? '#fff' : '#1a2330', fontSize: '0.78rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? .6 : 1 }}>
      {label}
    </button>
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 10px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '0.96875rem', fontWeight: 700, margin: 0 }}>בדיקת מקורות {sources ? `(${sources.length})` : ''}</h2>
        <span style={{ fontSize: '0.74rem', color: '#5f6c7a' }}>בדיקה יבשה מ-Vercel — בלי כתיבה למאגר. מקור מושבת אפשר לבדוק ולהדליק בקוד אם עובד.</span>
        <span style={{ marginInlineStart: 'auto', fontSize: '0.74rem', color: '#5f6c7a' }}>
          {counts.ok > 0 && <span style={{ color: '#0D9488', fontWeight: 700 }}>✓ {counts.ok} </span>}
          {counts.empty > 0 && <span style={{ color: '#B45309', fontWeight: 700 }}>∅ {counts.empty} </span>}
          {counts.blocked > 0 && <span style={{ color: '#B91C1C', fontWeight: 700 }}>⛔ {counts.blocked} </span>}
          {counts.js > 0 && <span style={{ color: '#7C3AED', fontWeight: 700 }}>⚙ {counts.js} </span>}
          {counts.fail > 0 && <span style={{ color: '#B91C1C', fontWeight: 700 }}>✗ {counts.fail}</span>}
        </span>
      </div>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, padding: 10, borderBottom: `1px solid ${BORDER}`, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מקור…" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d6dde4', fontFamily: 'inherit', fontSize: '0.8rem', width: 200 }} />
          {(['all', 'enabled', 'disabled'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{ padding: '5px 10px', borderRadius: 999, border: `1px solid ${filter === f ? '#2b6fc4' : '#d6dde4'}`, background: filter === f ? '#e8f1fb' : '#fff', color: filter === f ? '#1e5aa8' : '#1a2330', fontSize: '0.76rem', fontWeight: filter === f ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              {f === 'all' ? 'הכל' : f === 'enabled' ? 'פעילים' : 'מושבתים'}
            </button>
          ))}
          <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
            {btn(batch ? 'בודק…' : `בדוק את כל המוצגים (${visible.length})`, testAll, batch || !visible.length, true)}
            {btn('ייצוא CSV', exportCsv, !Object.keys(results).length)}
            {btn(diagBusy ? 'מאבחן…' : 'ייצוא אבחון (מקורות ריקים/שגויים)', exportDiag, diagBusy || !Object.keys(results).length)}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: '0.8rem' }}>
          <thead><tr style={{ color: '#5f6c7a', textAlign: 'right' }}>
            <th style={{ padding: '8px 10px', fontWeight: 600 }}>מקור</th><th style={{ padding: '8px 10px', fontWeight: 600 }}>מצב</th><th style={{ padding: '8px 10px', fontWeight: 600 }}>תוצאה</th><th style={{ padding: '8px 10px', fontWeight: 600 }}>הערה</th><th style={{ padding: '8px 10px' }} />
          </tr></thead>
          <tbody>
            {!sources && <tr><td colSpan={5} style={{ padding: 16, color: '#5f6c7a' }}>טוען…</td></tr>}
            {visible.map((s) => {
              const r = results[s.id];
              const rr = r && r !== 'running' ? r : null;
              return (
                <React.Fragment key={s.id}>
                  <tr style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '7px 10px' }}><div style={{ fontWeight: 700 }}>{s.name}</div><div style={{ color: '#8a97a3', fontSize: '0.7rem' }}>{s.id}</div></td>
                    <td style={{ padding: '7px 10px' }}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: s.enabled ? '#CCFBF1' : '#eef1f4', color: s.enabled ? '#0D9488' : '#5f6c7a' }}>{s.enabled ? 'פעיל' : 'מושבת'}</span></td>
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                      {r === 'running' ? <span style={{ color: '#5f6c7a' }}>בודק…</span>
                        : !rr ? <span style={{ color: '#c5ccd3' }}>—</span>
                        : !rr.ok ? <span style={{ color: '#B91C1C', fontWeight: 700 }} title={rr.error}>✗ שגיאה</span>
                        : rr.fetched ? <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} style={{ border: 'none', background: 'transparent', color: '#0D9488', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>✓ {rr.fetched} פריטים · {Math.round((rr.ms || 0) / 100) / 10}s ▾</button>
                        : <span style={{ color: STATUS_LABEL[rr.status || 'empty']?.c || '#B45309', fontWeight: 700 }} title={rr.reason}>{STATUS_LABEL[rr.status || 'empty']?.t || '∅ נטען, 0 פריטים'} · {Math.round((rr.ms || 0) / 100) / 10}s</span>}
                    </td>
                    <td style={{ padding: '7px 10px', color: '#5f6c7a', maxWidth: 360, fontSize: '0.72rem' }}>{rr && !rr.ok ? <span style={{ color: '#B91C1C' }}>{rr.error}</span> : rr && !rr.fetched && rr.reason ? <><span style={{ color: '#1a2330' }}>{rr.reason}</span>{s.note && <span> · {s.note}</span>}</> : s.note}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {btn('בדיקה', () => test(s.id), r === 'running')}
                      {rr && (!rr.ok || !rr.fetched) && <span style={{ marginInlineStart: 4 }}>{btn(raw[s.id] === 'running' ? '…' : 'אבחון', async () => { await diag(s.id); setRawOpen(s.id); }, raw[s.id] === 'running')}</span>}
                    </td>
                  </tr>
                  {rawOpen === s.id && raw[s.id] && raw[s.id] !== 'running' && (
                    <tr><td colSpan={5} style={{ padding: '4px 10px 10px', background: '#fff8e6', fontSize: '0.72rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>אבחון גולמי — מה Vercel מקבל מהכתובות</b><button type="button" onClick={() => setRawOpen(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>סגור ✕</button></div>
                      {(raw[s.id] as RawDiag).pages.map((pg, i) => (
                        <div key={i} style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e0d3b0' }}>
                          <div dir="ltr" style={{ textAlign: 'left', color: pg.ok ? '#1a2330' : '#B91C1C', wordBreak: 'break-all' }}>{pg.url} {pg.ok ? `· ${pg.chars} תווים · ${pg.anchors?.length ?? 0} קישורים` : `· ${pg.error}`}</div>
                          {pg.snippet && <div style={{ color: '#5f6c7a', marginTop: 2 }}>{pg.snippet}</div>}
                          {pg.anchors && <div style={{ marginTop: 4, maxHeight: 260, overflow: 'auto' }}>{pg.anchors.map((a, j) => <div key={j} style={{ padding: '1px 0' }}>{a.text} <span dir="ltr" style={{ color: '#8a97a3' }}>{a.href}</span></div>)}</div>}
                        </div>
                      ))}
                    </td></tr>
                  )}
                  {open === s.id && rr?.sample && (
                    <tr><td colSpan={5} style={{ padding: '4px 10px 10px', background: '#f7f9fb' }}>
                      {rr.sample.map((x, i) => <div key={i} style={{ fontSize: '0.74rem', padding: '2px 0' }}><a href={x.url} target="_blank" rel="noreferrer">{x.title}</a>{x.deadline && <span style={{ color: '#5f6c7a' }}> · {x.deadline}</span>}</div>)}
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
