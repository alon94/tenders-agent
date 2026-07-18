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

  const load = useCallback(async (s: AuthSession) => {
    try {
      const r = await fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${s.access_token}` } });
      if (r.status === 403) { setState('forbidden'); return; }
      if (!r.ok) { setState('error'); return; }
      setData(await r.json());
      setState('ready');
    } catch { setState('error'); }
  }, []);

  useEffect(() => {
    const s = getSession();
    setSession(s);
    if (!s) { setState('noauth'); return; }
    load(s);
  }, [load]);

  async function trigger(type: 'sync' | 'smallbiz') {
    if (!session || triggering) return;
    setTriggering(type);
    setToast('');
    try {
      const r = await fetch('/api/admin/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type }),
      });
      const d = await r.json();
      setToast(r.ok ? `✓ ${type === 'sync' ? 'סנכרון' : 'בדיקת עסקים קטנים'} הופעל — התוצאה תופיע בטבלת הריצות בעוד 1-5 דקות` : `שגיאה: ${d.error}`);
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

  if (state === 'loading') return shell(<div style={{ padding: 60, textAlign: 'center', color: MUTED }}>טוען…</div>);
  if (state === 'noauth') return shell(
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>נדרשת התחברות</div>
      <a href="/signin" style={{ color: BLUE, fontWeight: 600 }}>לעמוד ההתחברות ←</a>
    </div>
  );
  if (state === 'forbidden') return shell(
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>אין הרשאת ניהול</div>
      <div style={{ color: MUTED, fontSize: 14 }}>החשבון המחובר אינו מוגדר כמנהל מערכת.</div>
    </div>
  );
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

  const pipeCard = (type: 'sync' | 'smallbiz', title: string, schedule: string) => {
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
                <td style={td}>{r.type === 'sync' ? 'סנכרון' : 'עסקים קטנים'}</td>
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

      <button onClick={() => session && load(session)} style={{ marginTop: 18, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, color: '#4a5a6a', cursor: 'pointer', fontFamily: 'inherit' }}>↻ רענון נתונים</button>
    </>
  );
}
