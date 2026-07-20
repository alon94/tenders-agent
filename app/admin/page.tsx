'use client';

// ============================================================
//  /admin — דשבורד ניהול (MVP: סקירה + צינורות + דיוור)
//  גישה: משתמשים בטבלת admins בלבד; אחרים מקבלים "אין הרשאה".
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { getSession, type AuthSession } from '../lib/authClient';

const DARK = '#1a2330';
const BLUE = '#2b6fc4';
const BORDER = '#e6eaee';
const MUTED = '#7a8794';

interface SeriesPt { bucket: string; count: number }
interface UserRow { id: string; email: string; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null }
interface RunRow {
  id: number; type: string; started_at: string; duration_ms: number | null;
  trigger: string | null; counts_json: Record<string, unknown> | null; error: string | null;
}
interface EmailRow {
  id: number; sent_at: string; recipient: string; type: string;
  tender_count: number | null; status: string;
}
interface Overview {
  admin: { email: string; role: string };
  counts: { total: number; active: number; addedToday: number; users: number; emailsToday: number; sbChecked: number; sbFound: number };
  runs: RunRow[];
  emails: EmailRow[];
  lastByType: Record<string, RunRow | undefined>;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtDur(ms: number | null): string {
  if (ms == null) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}ש׳`;
}
const TRIGGER_HE: Record<string, string> = { cron: 'מתוזמן', manual: 'ידני', chain: 'שרשור' };

export default function AdminPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<'loading' | 'noauth' | 'forbidden' | 'ready' | 'error'>('loading');
  const [triggering, setTriggering] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [pw, setPw] = useState('');
  const [gran, setGran] = useState<'day' | 'month' | 'year'>('day');
  const [fromD, setFromD] = useState('');
  const [toD, setToD] = useState('');
  const [analytics, setAnalytics] = useState<{ tenders: SeriesPt[]; logins: SeriesPt[]; runs: SeriesPt[] } | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  // טוקן אדמין-סיסמה נשמר בין רענונים; נשלח כ-Bearer בדיוק כמו טוקן Supabase
  const adminToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return session?.access_token || localStorage.getItem('pwadm_token');
  }, [session]);

  const loadWith = useCallback(async (bearer: string) => {
    try {
      const r = await fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${bearer}` } });
      if (r.status === 403) { setState('forbidden'); return; }
      if (!r.ok) { setState('error'); return; }
      setData(await r.json());
      setState('ready');
    } catch { setState('error'); }
  }, []);

  const loadAnalytics = useCallback(async () => {
    const b = adminToken(); if (!b) return;
    const q = new URLSearchParams({ granularity: gran });
    if (fromD) q.set('from', fromD);
    if (toD) q.set('to', toD);
    try {
      const r = await fetch(`/api/admin/analytics?${q}`, { headers: { Authorization: `Bearer ${b}` } });
      if (r.ok) setAnalytics(await r.json());
    } catch { /* ignore */ }
  }, [adminToken, gran, fromD, toD]);

  const loadUsers = useCallback(async () => {
    const b = adminToken(); if (!b) return;
    try {
      const r = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${b}` } });
      if (r.ok) setUsers((await r.json()).users);
    } catch { /* ignore */ }
  }, [adminToken]);

  useEffect(() => { if (state === 'ready') { loadAnalytics(); } }, [state, loadAnalytics]);
  useEffect(() => { if (state === 'ready') { loadUsers(); } }, [state, loadUsers]);

  async function pwLogin() {
    if (pwBusy || !pw) return;
    setPwBusy(true); setPwErr('');
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const d = await r.json();
      if (!r.ok) { setPwErr(d.error || 'שגיאה'); setPwBusy(false); return; }
      localStorage.setItem('pwadm_token', d.token);
      setState('loading');
      await loadWith(d.token);
    } catch { setPwErr('שגיאת תקשורת'); }
    setPwBusy(false);
  }

  useEffect(() => {
    const s = getSession();
    setSession(s);
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pwadm_token') : null;
    const bearer = s?.access_token || stored;
    if (!bearer) { setState('noauth'); return; }
    loadWith(bearer);
  }, [loadWith]);

  async function trigger(type: 'sync' | 'smallbiz' | 'sources') {
    const bearer = adminToken();
    if (!bearer || triggering) return;
    setTriggering(type);
    setToast('');
    try {
      const r = await fetch('/api/admin/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ type }),
      });
      const d = await r.json();
      setToast(r.ok ? `✓ ${type === 'sync' ? 'סנכרון' : type === 'sources' ? 'סריקת מקורות חדשים' : 'בדיקת עסקים קטנים'} הופעל — הטבלה תתרענן אוטומטית` : `שגיאה: ${d.error}`);
      if (r.ok) {
        // מדיניות רענון: רענון מהיר אחרי 20ש' ורענון מלא אחרי 2 דקות
        for (const delay of [20000, 120000]) {
          setTimeout(() => { const b2 = adminToken(); if (b2) { loadWith(b2); loadAnalytics(); } }, delay);
        }
      }
    } catch { setToast('שגיאת תקשורת'); }
    setTriggering(null);
  }

  const shell = (content: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#eef1f4', direction: 'rtl', fontFamily: "'Heebo',Arial,sans-serif", color: DARK }}>
      <header style={{ background: DARK, color: '#fff', padding: '14px 26px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 32, height: 32, borderRadius: 8, background: BLUE, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>ש</span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>שווה מכרזים · מערכת ניהול</span>
        {data && <span style={{ marginInlineStart: 'auto', fontSize: 12.5, opacity: .75 }}>{data.admin.email} · {data.admin.role}</span>}
        <a href="/dashboard" style={{ color: '#9db8d8', fontSize: 13, textDecoration: 'none', marginInlineStart: data ? 14 : 'auto' }}>→ לאתר</a>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 40px' }}>{content}</main>
    </div>
  );

  const barChart = (title: string, pts: SeriesPt[], color: string) => {
    const max = Math.max(1, ...pts.map(p => p.count));
    const w = Math.max(320, pts.length * 34);
    return (
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, flex: 1, minWidth: 320, overflowX: 'auto' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{title}</div>
        {pts.length === 0 ? <div style={{ color: MUTED, fontSize: 13 }}>אין נתונים בטווח</div> : (
          <svg width={w} height={150} style={{ direction: 'ltr' }}>
            {pts.map((p, i) => {
              const h = Math.round((p.count / max) * 100);
              return (
                <g key={p.bucket}>
                  <rect x={i * 34 + 4} y={120 - h} width={24} height={h} rx={3} fill={color} />
                  <text x={i * 34 + 16} y={116 - h} textAnchor="middle" fontSize={10} fill="#4a5a6a">{p.count.toLocaleString('he-IL')}</text>
                  <text x={i * 34 + 16} y={138} textAnchor="middle" fontSize={8.5} fill="#7a8794">{gran === 'day' ? p.bucket.slice(5) : p.bucket}</text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    );
  };

  const pwForm = (heading: string, sub: string) => shell(
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{heading}</div>
      <div style={{ color: MUTED, fontSize: 14, marginBottom: 20 }}>{sub}</div>
      <div style={{ maxWidth: 320, margin: '0 auto', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: DARK }}>כניסת מנהל בסיסמה</div>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && pwLogin()} placeholder="סיסמת ניהול"
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', marginBottom: 10, direction: 'rtl' }} />
        <button onClick={pwLogin} disabled={pwBusy || !pw}
          style={{ width: '100%', background: pwBusy ? '#9db8d8' : BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {pwBusy ? 'מתחבר…' : 'כניסה'}
        </button>
        {pwErr && <div style={{ color: '#b04a34', fontSize: 12.5, marginTop: 8 }}>{pwErr}</div>}
        <a href="/signin" style={{ display: 'block', color: BLUE, fontSize: 12.5, marginTop: 12, textDecoration: 'none' }}>או התחברות רגילה עם חשבון ←</a>
      </div>
    </div>
  );

  if (state === 'loading') return shell(<div style={{ padding: 60, textAlign: 'center', color: MUTED }}>טוען…</div>);
  if (state === 'noauth') return pwForm('נדרשת התחברות', 'התחבר עם חשבון מנהל, או הזן סיסמת ניהול.');
  if (state === 'forbidden') return pwForm('אין הרשאת ניהול', 'החשבון המחובר אינו מנהל — אפשר להיכנס עם סיסמת ניהול.');
  if (state === 'error' || !data) return shell(<div style={{ padding: 60, textAlign: 'center', color: '#b04a34' }}>שגיאה בטעינת הנתונים — נסה לרענן.</div>);

  const c = data.counts;
  const kpis = [
    { v: c.total, l: 'מכרזים במאגר' },
    { v: c.active, l: 'פעילים' },
    { v: c.addedToday, l: 'נוספו היום' },
    { v: c.users, l: 'משתמשים רשומים' },
    { v: c.emailsToday, l: 'מיילים היום' },
    { v: `${c.sbFound}/${c.sbChecked}`, l: 'עסקים קטנים: נמצאו/נבדקו' },
  ];

  const pipeCard = (type: 'sync' | 'smallbiz' | 'sources', title: string, schedule: string) => {
    const last = data.lastByType[type];
    const ok = last && !last.error;
    const staleMs = last ? Date.now() - new Date(last.started_at).getTime() : Infinity;
    const stale = staleMs > 26 * 3600 * 1000;
    const color = !last ? '#d9a520' : last.error ? '#b04a34' : stale ? '#d9a520' : '#1e9e5a';
    return (
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, flex: 1, minWidth: 280 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
          <span style={{ fontSize: 11.5, color: MUTED, marginInlineStart: 'auto' }}>{schedule}</span>
        </div>
        {last ? (
          <div style={{ fontSize: 13, color: '#4a5a6a', lineHeight: 1.7 }}>
            ריצה אחרונה: {fmtTime(last.started_at)} · {fmtDur(last.duration_ms)} · {TRIGGER_HE[last.trigger || ''] || last.trigger}
            {last.error
              ? <div style={{ color: '#b04a34', fontSize: 12.5 }}>שגיאה: {String(last.error).slice(0, 90)}</div>
              : <div style={{ color: MUTED, fontSize: 12.5 }}>{JSON.stringify(last.counts_json || {}).slice(0, 90)}</div>}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: MUTED }}>אין עדיין ריצות מתועדות (הרישום החל עם פריסת מערכת הניהול)</div>
        )}
        {data.admin.role !== 'viewer' && (
          <button onClick={() => trigger(type)} disabled={!!triggering}
            style={{ marginTop: 12, background: triggering === type ? '#9db8d8' : BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {triggering === type ? 'מפעיל…' : 'הפעל עכשיו'}
          </button>
        )}
      </div>
    );
  };

  const th: React.CSSProperties = { textAlign: 'right', padding: '9px 12px', fontSize: 12, color: MUTED, fontWeight: 700, borderBottom: `1px solid ${BORDER}` };
  const td: React.CSSProperties = { padding: '9px 12px', fontSize: 12.5, borderBottom: '1px solid #eef1f4', verticalAlign: 'top' };

  return shell(
    <>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 1, background: BORDER, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.l} style={{ background: '#fff', padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{typeof k.v === 'number' ? k.v.toLocaleString('he-IL') : k.v}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* צינורות */}
      <div style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 10px' }}>צינורות</div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
        {pipeCard('sync', 'סנכרון מכרזים + דוח יומי', 'יומי · 07:00')}
        {pipeCard('smallbiz', 'זיהוי העדפת עסקים קטנים', 'יומי · 07:30 + שרשור')}
        {pipeCard('sources', 'סריקת מקורות חדשים', 'יומי · 04:45')}
      </div>
      {toast && <div style={{ background: '#e8f1fb', border: '1px solid #cfe0f4', color: '#1e5aa8', borderRadius: 8, padding: '9px 14px', fontSize: 13, marginBottom: 8 }}>{toast}</div>}

      {/* ריצות */}
      <div style={{ fontSize: 15.5, fontWeight: 700, margin: '18px 0 10px' }}>ריצות אחרונות</div>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead><tr><th style={th}>זמן</th><th style={th}>סוג</th><th style={th}>משך</th><th style={th}>טריגר</th><th style={th}>נתונים</th><th style={th}>שגיאה</th></tr></thead>
          <tbody>
            {data.runs.length === 0 && <tr><td style={td} colSpan={6}><span style={{ color: MUTED }}>אין ריצות מתועדות עדיין — הריצה הבאה של כל צינור תופיע כאן.</span></td></tr>}
            {data.runs.map((r) => (
              <tr key={r.id}>
                <td style={td}>{fmtTime(r.started_at)}</td>
                <td style={td}>{r.type === 'sync' ? 'סנכרון' : r.type === 'sources' ? 'מקורות חדשים' : 'עסקים קטנים'}</td>
                <td style={td}>{fmtDur(r.duration_ms)}</td>
                <td style={td}>{TRIGGER_HE[r.trigger || ''] || r.trigger || '—'}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, direction: 'ltr', textAlign: 'left' }}>{JSON.stringify(r.counts_json || {}).slice(0, 80)}</td>
                <td style={{ ...td, color: r.error ? '#b04a34' : MUTED }}>{r.error ? String(r.error).slice(0, 60) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* דיוור */}
      <div style={{ fontSize: 15.5, fontWeight: 700, margin: '22px 0 10px' }}>מיילים אחרונים</div>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr><th style={th}>זמן</th><th style={th}>נמען</th><th style={th}>סוג</th><th style={th}>מכרזים</th><th style={th}>סטטוס</th></tr></thead>
          <tbody>
            {data.emails.length === 0 && <tr><td style={td} colSpan={5}><span style={{ color: MUTED }}>אין משלוחים מתועדים עדיין.</span></td></tr>}
            {data.emails.map((e) => (
              <tr key={e.id}>
                <td style={td}>{fmtTime(e.sent_at)}</td>
                <td style={td}>{e.recipient}</td>
                <td style={td}>{e.type === 'daily' ? 'דוח יומי' : e.type === 'alert' ? 'התראה חמה' : e.type}</td>
                <td style={td}>{e.tender_count ?? '—'}</td>
                <td style={td}>{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: '22px 0 10px' }}>אנליטיקה</h2>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        {(['day', 'month', 'year'] as const).map(g => (
          <button key={g} onClick={() => setGran(g)}
            style={{ background: gran === g ? DARK : '#fff', color: gran === g ? '#fff' : '#4a5a6a', border: `1px solid ${gran === g ? DARK : BORDER}`, borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {g === 'day' ? 'יומי' : g === 'month' ? 'חודשי' : 'שנתי'}
          </button>
        ))}
        <span style={{ fontSize: 12.5, color: MUTED }}>מ־</span>
        <input type="date" value={fromD} onChange={e => setFromD(e.target.value)} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit' }} />
        <span style={{ fontSize: 12.5, color: MUTED }}>עד</span>
        <input type="date" value={toD} onChange={e => setToD(e.target.value)} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit' }} />
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {barChart('מכרזים שנקלטו', analytics?.tenders || [], '#2b6fc4')}
        {barChart('כניסות משתמשים', analytics?.logins || [], '#1e9e5a')}
        {barChart('ריצות צינורות', analytics?.runs || [], '#8a5db8')}
      </div>

      <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: '22px 0 10px' }}>משתמשים רשומים {users ? `(${users.length})` : ''}</h2>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#f6f8fa', textAlign: 'right' }}>
            <th style={{ padding: '10px 14px', fontWeight: 600 }}>מייל</th>
            <th style={{ padding: '10px 14px', fontWeight: 600 }}>נרשם</th>
            <th style={{ padding: '10px 14px', fontWeight: 600 }}>כניסה אחרונה</th>
            <th style={{ padding: '10px 14px', fontWeight: 600 }}>מאומת</th>
          </tr></thead>
          <tbody>
            {(users || []).map(u => (
              <tr key={u.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: '9px 14px', direction: 'ltr', textAlign: 'right' }}>{u.email}</td>
                <td style={{ padding: '9px 14px' }}>{fmtTime(u.created_at)}</td>
                <td style={{ padding: '9px 14px' }}>{u.last_sign_in_at ? fmtTime(u.last_sign_in_at) : '—'}</td>
                <td style={{ padding: '9px 14px' }}>{u.email_confirmed_at ? '✓' : '—'}</td>
              </tr>
            ))}
            {users && users.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: MUTED }}>אין משתמשים</td></tr>}
          </tbody>
        </table>
      </div>

      <button onClick={() => { const b = adminToken(); if (b) loadWith(b); }} style={{ marginTop: 18, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, color: '#4a5a6a', cursor: 'pointer', fontFamily: 'inherit' }}>↻ רענון נתונים</button>
    </>
  );
}
