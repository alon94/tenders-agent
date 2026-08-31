'use client';

// ============================================================
//  /admin — דשבורד ניהול (MVP: סקירה + צינורות + דיוור)
//  גישה: משתמשים בטבלת admins בלבד; אחרים מקבלים "אין הרשאה".
// ============================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getSession, type AuthSession } from '../lib/authClient';
import { renderDocMarkdown } from '../lib/docMarkdown';

const DARK = '#1a2330';
const BLUE = '#2b6fc4';
const BORDER = '#e6eaee';
const MUTED = '#7a8794';

interface DocRow { slug: string; title: string; content_md: string; updated_at?: string; updated_by?: string | null }
interface SlideRow { id?: number; title: string; subtitle?: string | null; badge?: string | null; cta_label?: string | null; cta_href?: string | null; sort_order?: number; active?: boolean }
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
interface MailBatch { key: string; at: string; type: string; recipients: number; sent: number; failed: number; tenders: number; list: string }
function groupEmails(rows: EmailRow[]): MailBatch[] {
  const map = new Map<string, MailBatch>();
  for (const e of rows) {
    const key = `${(e.sent_at || '').slice(0, 10)}|${e.type}`;
    let b = map.get(key);
    if (!b) { b = { key, at: e.sent_at, type: e.type, recipients: 0, sent: 0, failed: 0, tenders: 0, list: '' }; map.set(key, b); }
    if (e.sent_at < b.at) b.at = e.sent_at;
    b.recipients++;
    if (e.status === 'sent') b.sent++; else b.failed++;
    b.tenders = Math.max(b.tenders, e.tender_count || 0);
    b.list += (b.list ? ', ' : '') + e.recipient;
  }
  return Array.from(map.values()).sort((a, b) => b.at.localeCompare(a.at));
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
const DOC_LABELS: Record<string, string> = { privacy: 'מדיניות פרטיות', terms: 'תנאי שימוש', accessibility: 'הצהרת נגישות' };
const DOC_PATHS: Record<string, string> = { privacy: '/privacy', terms: '/terms', accessibility: '/accessibility' };
const TRIGGER_HE: Record<string, string> = { cron: 'מתוזמן', manual: 'ידני', chain: 'שרשור' };

const inp: React.CSSProperties = { border: '1px solid #e6eaee', borderRadius: 8, padding: '8px 11px', fontSize: '0.8125rem', fontFamily: 'inherit', direction: 'rtl' };

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
  const [usersNotes, setUsersNotes] = useState<string[]>([]);
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [draft, setDraft] = useState<SlideRow>({ title: '', subtitle: '', badge: '', cta_label: '', cta_href: '/dashboard', sort_order: 0, active: true });
  const [slideBusy, setSlideBusy] = useState(false);
  const [pwErr, setPwErr] = useState('');
  // מסמכי אתר (מדיניות/תנאים/נגישות) — עריכה + preview
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [docSlug, setDocSlug] = useState('privacy');
  const [docDraft, setDocDraft] = useState('');
  const [docDirty, setDocDirty] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  // תיבות מתקפלות: ריצות/מיילים מציגות 3 אחרונים; הרחבה לפי דרישה
  const [runsOpen, setRunsOpen] = useState(false);
  const [mailsOpen, setMailsOpen] = useState(false);
  const [openRunId, setOpenRunId] = useState<number | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // הטוקן שעבר את אימות ה-overview הוא המקור לכל שאר הבקשות.
  // באג: קודם adminToken העדיף pwadm_token ישן מ-localStorage בעוד שהטעינה
  // הראשית השתמשה בטוקן ה-session — הדף נטען, אבל משתמשים/אנליטיקה/שקופיות
  // קיבלו 403 מטוקן פג. עכשיו כולם משתמשים באותו bearer מאומת.
  const bearerRef = useRef<string | null>(null);
  const adminToken = useCallback((): string | null => {
    if (bearerRef.current) return bearerRef.current;
    if (typeof window === 'undefined') return null;
    return session?.access_token || localStorage.getItem('pwadm_token') || null;
  }, [session]);

  const loadWith = useCallback(async (bearer: string) => {
    try {
      const r = await fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${bearer}` } });
      if (r.status === 403) {
        if (bearer?.startsWith('pwadm.')) localStorage.removeItem('pwadm_token');
        // הטוקן שנכשל אינו בהכרח היחיד — מנסים את החלופה לפני ויתור
        const alt = bearer === getSession()?.access_token ? localStorage.getItem('pwadm_token') : getSession()?.access_token;
        if (alt && alt !== bearer) {
          const r2 = await fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${alt}` } });
          if (r2.ok) { bearerRef.current = alt; setData(await r2.json()); setState('ready'); return; }
        }
        setState('forbidden'); return;
      }
      if (!r.ok) { setState('error'); return; }
      bearerRef.current = bearer;
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
      const d = await r.json().catch(() => null);
      if (r.ok && d) { setUsers(d.users); setUsersNotes(d.notes || []); }
      else setUsersNotes([`הבקשה נכשלה: HTTP ${r.status}`]);
    } catch (e) { setUsersNotes(['שגיאת תקשורת: ' + String(e).slice(0, 120)]); }
  }, [adminToken]);

  useEffect(() => { if (state === 'ready') { loadAnalytics(); } }, [state, loadAnalytics]);
  useEffect(() => { if (state === 'ready') { loadUsers(); } }, [state, loadUsers]);

  const loadSlides = useCallback(async () => {
    const b = adminToken(); if (!b) return;
    try {
      const r = await fetch('/api/admin/slides', { headers: { Authorization: `Bearer ${b}` } });
      if (r.ok) setSlides((await r.json()).slides || []);
    } catch { /* ignore */ }
  }, [adminToken]);
  useEffect(() => { if (state === 'ready') loadSlides(); }, [state, loadSlides]);

  const loadDocs = useCallback(async () => {
    const b = adminToken(); if (!b) return;
    try {
      const r = await fetch('/api/admin/documents', { headers: { Authorization: `Bearer ${b}` } });
      if (r.ok) {
        const list: DocRow[] = (await r.json()).documents || [];
        setDocs(list);
        // הטיוטה נטענת רק כשאין עריכה פתוחה — רענון רקע לא דורס הקלדה
        setDocDirty((dirty) => {
          if (!dirty) setDocDraft(list.find((d) => d.slug === 'privacy')?.content_md ?? '');
          return dirty;
        });
      }
    } catch { /* ignore */ }
  }, [adminToken]);
  useEffect(() => { if (state === 'ready') loadDocs(); }, [state, loadDocs]);

  function switchDoc(slug: string) {
    if (docDirty && !confirm('יש שינויים שלא נשמרו במסמך הנוכחי. לעבור בלי לשמור?')) return;
    setDocSlug(slug);
    setDocDraft(docs.find((d) => d.slug === slug)?.content_md ?? '');
    setDocDirty(false);
  }

  async function saveDoc() {
    const b = adminToken(); if (!b || docBusy) return;
    setDocBusy(true);
    try {
      const r = await fetch('/api/admin/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${b}` },
        body: JSON.stringify({ slug: docSlug, content_md: docDraft }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        setToast('✓ המסמך פורסם לאתר');
        setDocDirty(false);
        setDocs((prev) => prev.map((x) => x.slug === docSlug ? { ...x, content_md: docDraft, updated_at: new Date().toISOString() } : x));
      } else setToast(`שגיאה: ${d.error || 'השמירה נכשלה'}`);
    } catch { setToast('שגיאת תקשורת'); }
    setDocBusy(false);
  }

  async function saveSlide(sl: SlideRow) {
    const b = adminToken(); if (!b || slideBusy) return;
    setSlideBusy(true);
    try {
      const r = await fetch('/api/admin/slides', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${b}` },
        body: JSON.stringify(sl),
      });
      const d = await r.json();
      setToast(r.ok && d.ok ? '✓ השקופית נשמרה' : `שגיאה: ${d.error || 'שמירה נכשלה'}`);
      if (r.ok) { setDraft({ title: '', subtitle: '', badge: '', cta_label: '', cta_href: '/dashboard', sort_order: 0, active: true }); loadSlides(); }
    } catch { setToast('שגיאת תקשורת'); }
    setSlideBusy(false);
  }

  async function removeSlide(id?: number) {
    const b = adminToken(); if (!b || !id) return;
    if (!confirm('למחוק את השקופית?')) return;
    try {
      const r = await fetch(`/api/admin/slides?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${b}` } });
      setToast(r.ok ? '✓ נמחקה' : 'מחיקה נכשלה');
      loadSlides();
    } catch { setToast('שגיאת תקשורת'); }
  }
  async function removeUser(id: string, email: string) {
    const b = adminToken(); if (!b || !id) return;
    if (!confirm(`למחוק לצמיתות את ${email}? כולל הפרופיל העסקי. אין דרך חזרה.`)) return;
    try {
      const r = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${b}` } });
      const d = await r.json().catch(() => ({}));
      setToast(r.ok && d.ok ? '✓ המשתמש נמחק' : `מחיקה נכשלה: ${d.error || r.status}`);
      loadUsers();
    } catch { setToast('שגיאת תקשורת'); }
  }

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
      if (r.status === 403) {
        // טוקן פג — ניקוי וחזרה לטופס הכניסה
        localStorage.removeItem('pwadm_token');
        setState('forbidden');
        setToast('פג תוקף הכניסה — יש להתחבר מחדש');
        setTriggering(null);
        return;
      }
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
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>שווה מכרזים · מערכת ניהול</span>
        {data && <span style={{ marginInlineStart: 'auto', fontSize: '0.78125rem', opacity: .75 }}>{data.admin.email} · {data.admin.role}</span>}
        <a href="/dashboard" style={{ color: '#9db8d8', fontSize: '0.8125rem', textDecoration: 'none', marginInlineStart: data ? 14 : 'auto' }}>→ לאתר</a>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 40px' }}>{content}</main>
    </div>
  );

  const barChart = (title: string, pts: SeriesPt[], color: string) => {
    const max = Math.max(1, ...pts.map(p => p.count));
    const w = Math.max(320, pts.length * 34);
    return (
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, flex: 1, minWidth: 320, overflowX: 'auto' }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 12 }}>{title}</div>
        {pts.length === 0 ? <div style={{ color: MUTED, fontSize: '0.8125rem' }}>אין נתונים בטווח</div> : (
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
      <div style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: 8 }}>{heading}</div>
      <div style={{ color: MUTED, fontSize: '0.875rem', marginBottom: 20 }}>{sub}</div>
      <div style={{ maxWidth: 320, margin: '0 auto', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 10, color: DARK }}>כניסת מנהל בסיסמה</div>
        <input type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && pwLogin()} placeholder="סיסמת ניהול"
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: '0.875rem', fontFamily: 'inherit', marginBottom: 10, direction: 'rtl' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78125rem', color: MUTED, marginBottom: 10, cursor: 'pointer' }}><input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} />👁 הצג סיסמה</label>
        <button onClick={pwLogin} disabled={pwBusy || !pw}
          style={{ width: '100%', background: pwBusy ? '#9db8d8' : BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {pwBusy ? 'מתחבר…' : 'כניסה'}
        </button>
        {pwErr && <div style={{ color: '#b04a34', fontSize: '0.78125rem', marginTop: 8 }}>{pwErr}</div>}
        <a href="/signin" style={{ display: 'block', color: BLUE, fontSize: '0.78125rem', marginTop: 12, textDecoration: 'none' }}>או התחברות רגילה עם חשבון ←</a>
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
          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{title}</span>
          <span style={{ fontSize: '0.71875rem', color: MUTED, marginInlineStart: 'auto' }}>{schedule}</span>
        </div>
        {last ? (
          <div style={{ fontSize: '0.8125rem', color: '#4a5a6a', lineHeight: 1.7 }}>
            ריצה אחרונה: {fmtTime(last.started_at)} · {fmtDur(last.duration_ms)} · {TRIGGER_HE[last.trigger || ''] || last.trigger}
            {last.error
              ? <div style={{ color: '#b04a34', fontSize: '0.78125rem' }}>שגיאה: {String(last.error).slice(0, 90)}</div>
              : <div style={{ color: MUTED, fontSize: '0.78125rem' }}>{JSON.stringify(last.counts_json || {}).slice(0, 90)}</div>}
          </div>
        ) : (
          <div style={{ fontSize: '0.8125rem', color: MUTED }}>אין עדיין ריצות מתועדות (הרישום החל עם פריסת מערכת הניהול)</div>
        )}
        {data.admin.role !== 'viewer' && (
          <button onClick={() => trigger(type)} disabled={!!triggering}
            style={{ marginTop: 12, background: triggering === type ? '#9db8d8' : BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {triggering === type ? 'מפעיל…' : 'הפעל עכשיו'}
          </button>
        )}
      </div>
    );
  };

  const th: React.CSSProperties = { textAlign: 'right', padding: '9px 12px', fontSize: '0.75rem', color: MUTED, fontWeight: 700, borderBottom: `1px solid ${BORDER}` };
  const td: React.CSSProperties = { padding: '9px 12px', fontSize: '0.78125rem', borderBottom: '1px solid #eef1f4', verticalAlign: 'top' };

  return shell(
    <>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 1, background: BORDER, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.l} style={{ background: '#fff', padding: '14px 16px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{typeof k.v === 'number' ? k.v.toLocaleString('he-IL') : k.v}</div>
            <div style={{ fontSize: '0.75rem', color: MUTED, marginTop: 4 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* צינורות */}
      <div style={{ fontSize: '0.96875rem', fontWeight: 700, margin: '0 0 10px' }}>צינורות</div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
        {pipeCard('sync', 'סנכרון מכרזים + דוח יומי', 'יומי · 07:00')}
        {pipeCard('smallbiz', 'זיהוי העדפת עסקים קטנים', 'יומי · 07:30 + שרשור')}
        {pipeCard('sources', 'סריקת מקורות חדשים', 'יומי · 04:45')}
      </div>
      {toast && <div style={{ background: '#e8f1fb', border: '1px solid #cfe0f4', color: '#1e5aa8', borderRadius: 8, padding: '9px 14px', fontSize: '0.8125rem', marginBottom: 8 }}>{toast}</div>}

      {/* ריצות — ברירת מחדל: 3 אחרונות; לחיצה על שורה פותחת את הדוח המלא */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 10px' }}>
        <div style={{ fontSize: '0.96875rem', fontWeight: 700 }}>ריצות אחרונות</div>
        {data.runs.length > 3 && (
          <button onClick={() => setRunsOpen(!runsOpen)}
            style={{ background: 'transparent', border: 'none', color: '#1e5aa8', fontSize: '0.78125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {runsOpen ? '▲ הצג 3 אחרונות בלבד' : `▼ הצג הכל (${data.runs.length})`}
          </button>
        )}
      </div>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead><tr><th style={th}>זמן</th><th style={th}>סוג</th><th style={th}>משך</th><th style={th}>טריגר</th><th style={th}>נתונים</th><th style={th}>שגיאה</th></tr></thead>
          <tbody>
            {data.runs.length === 0 && <tr><td style={td} colSpan={6}><span style={{ color: MUTED }}>אין ריצות מתועדות עדיין — הריצה הבאה של כל צינור תופיע כאן.</span></td></tr>}
            {(runsOpen ? data.runs : data.runs.slice(0, 3)).map((r) => (
              <React.Fragment key={r.id}>
                <tr onClick={() => setOpenRunId(openRunId === r.id ? null : r.id)} style={{ cursor: 'pointer', background: openRunId === r.id ? '#f4f8fc' : undefined }}
                  title={openRunId === r.id ? 'סגירת הדוח' : 'פתיחת הדוח המלא'}>
                  <td style={td}>{openRunId === r.id ? '▾ ' : '▸ '}{fmtTime(r.started_at)}</td>
                  <td style={td}>{r.type === 'sync' ? 'סנכרון' : r.type === 'sources' ? 'מקורות חדשים' : 'עסקים קטנים'}</td>
                  <td style={td}>{fmtDur(r.duration_ms)}</td>
                  <td style={td}>{TRIGGER_HE[r.trigger || ''] || r.trigger || '—'}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.6875rem', direction: 'ltr', textAlign: 'left' }}>{JSON.stringify(r.counts_json || {}).slice(0, 80)}</td>
                  <td style={{ ...td, color: r.error ? '#b04a34' : MUTED }}>{r.error ? String(r.error).slice(0, 60) : '—'}</td>
                </tr>
                {openRunId === r.id && (
                  <tr>
                    <td colSpan={6} style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: `1px solid ${BORDER}` }}>
                      {r.error && <div style={{ color: '#b04a34', fontSize: '0.78125rem', marginBottom: 8, direction: 'ltr', textAlign: 'left' }}>{r.error}</div>}
                      <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.71875rem', direction: 'ltr', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto' }}>
                        {JSON.stringify(r.counts_json || {}, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* דיוור — ברירת מחדל: 3 משלוחים אחרונים */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 10px' }}>
        <div style={{ fontSize: '0.96875rem', fontWeight: 700 }}>מיילים אחרונים</div>
        {groupEmails(data.emails).length > 3 && (
          <button onClick={() => setMailsOpen(!mailsOpen)}
            style={{ background: 'transparent', border: 'none', color: '#1e5aa8', fontSize: '0.78125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {mailsOpen ? '▲ הצג 3 אחרונים בלבד' : `▼ הצג הכל (${groupEmails(data.emails).length})`}
          </button>
        )}
      </div>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr><th style={th}>זמן</th><th style={th}>סוג</th><th style={th}>נמענים</th><th style={th}>נשלחו</th><th style={th}>מכרזים</th><th style={th}>סטטוס</th></tr></thead>
          <tbody>
            {data.emails.length === 0 && <tr><td style={td} colSpan={6}><span style={{ color: MUTED }}>אין משלוחים מתועדים עדיין.</span></td></tr>}
            {(mailsOpen ? groupEmails(data.emails) : groupEmails(data.emails).slice(0, 3)).map((b) => (
              <tr key={b.key}>
                <td style={td}>{fmtTime(b.at)}</td>
                <td style={td}>{b.type === 'daily' ? 'דוח יומי' : b.type === 'alert' ? 'התראה חמה' : b.type}</td>
                <td style={td} title={b.list}>{b.recipients}</td>
                <td style={td}>{b.sent}</td>
                <td style={td}>{b.tenders || '—'}</td>
                <td style={{ ...td, fontWeight: 600, color: b.failed === 0 ? '#1e9e5a' : b.sent === 0 ? '#c0392b' : '#c98a12' }}>{b.failed === 0 ? '✓ נשלח' : b.sent === 0 ? '✕ נכשל' : `חלקי — ${b.failed} נכשלו`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* מסמכי האתר — עריכה + preview חי */}
      <h2 style={{ fontSize: '0.96875rem', fontWeight: 700, margin: '22px 0 10px' }}>מסמכי האתר</h2>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {['privacy', 'terms', 'accessibility'].map((slug) => (
            <button key={slug} onClick={() => switchDoc(slug)}
              style={{
                background: docSlug === slug ? '#e8f1fb' : '#f6f8fa',
                color: docSlug === slug ? '#1e5aa8' : MUTED,
                border: docSlug === slug ? '1.5px solid ' + BLUE : `1px solid ${BORDER}`,
                borderRadius: 999, padding: '7px 15px', fontSize: '0.8125rem', fontWeight: docSlug === slug ? 700 : 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {DOC_LABELS[slug]}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <a href={DOC_PATHS[docSlug]} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '0.78125rem', color: '#1e5aa8', fontWeight: 600 }}>פתיחת העמוד באתר ←</a>
        </div>
        <div style={{ fontSize: '0.75rem', color: MUTED, marginBottom: 10 }}>
          עיצוב: <code dir="ltr"># כותרת</code>, <code dir="ltr">## כותרת משנה</code>, <code dir="ltr">**מודגש**</code>, <code dir="ltr">- פריט רשימה</code>, <code dir="ltr">[טקסט](קישור)</code>. ה-preview מימין מציג בדיוק את מה שיפורסם.
          {(() => { const d = docs.find((x) => x.slug === docSlug); return d?.updated_at ? <> · עודכן {fmtTime(d.updated_at)}{d.updated_by ? ` ע"י ${d.updated_by}` : ''}</> : null; })()}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
          <textarea
            value={docDraft}
            onChange={(e) => { setDocDraft(e.target.value); setDocDirty(true); }}
            placeholder={'# ' + DOC_LABELS[docSlug] + '\n\nכתבו כאן את תוכן המסמך…'}
            style={{ ...inp, width: '100%', minHeight: 380, resize: 'vertical', lineHeight: 1.7, fontSize: '0.84375rem', boxSizing: 'border-box' }}
          />
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: '18px 20px', minHeight: 380, maxHeight: 560, overflow: 'auto', background: '#fbfcfd' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: MUTED, letterSpacing: 0.5, marginBottom: 10 }}>PREVIEW — כך ייראה העמוד</div>
            {docDraft.trim()
              ? renderDocMarkdown(docDraft)
              : <div style={{ fontSize: '0.8125rem', color: MUTED }}>המסמך ריק — העמוד באתר יציג טקסט ביניים עד שיפורסם תוכן.</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button onClick={saveDoc} disabled={docBusy || !docDirty}
            style={{ background: docDirty ? BLUE : '#9db8d8', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: '0.84375rem', fontWeight: 600, cursor: docDirty ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {docBusy ? 'מפרסם…' : 'פרסום לאתר'}
          </button>
          {docDirty && <span style={{ fontSize: '0.78125rem', color: '#c98a12', fontWeight: 600 }}>יש שינויים שטרם פורסמו</span>}
        </div>
      </div>

      <h2 style={{ fontSize: '0.96875rem', fontWeight: 700, margin: '22px 0 10px' }}>סליידר שיווקי בדף הבית</h2>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10, marginBottom: 10 }}>
          <input placeholder="כותרת (חובה)" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} style={inp} />
          <input placeholder="תגית עליונה (למשל: חדש)" value={draft.badge || ''} onChange={e => setDraft({ ...draft, badge: e.target.value })} style={inp} />
          <input placeholder="טקסט כפתור" value={draft.cta_label || ''} onChange={e => setDraft({ ...draft, cta_label: e.target.value })} style={inp} />
          <input placeholder="קישור הכפתור" value={draft.cta_href || ''} onChange={e => setDraft({ ...draft, cta_href: e.target.value })} style={inp} />
          <input placeholder="סדר הצגה" type="number" value={draft.sort_order ?? 0} onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) })} style={inp} />
        </div>
        <textarea placeholder="טקסט משנה" value={draft.subtitle || ''} onChange={e => setDraft({ ...draft, subtitle: e.target.value })}
          style={{ ...inp, width: '100%', minHeight: 62, resize: 'vertical', marginBottom: 10 }} />
        <button onClick={() => saveSlide(draft)} disabled={slideBusy || !draft.title}
          style={{ background: draft.title ? BLUE : '#9db8d8', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: '0.84375rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {slideBusy ? 'שומר…' : '+ הוספת שקופית'}
        </button>
      </div>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', marginBottom: 6 }}>
        {slides.length === 0 && <div style={{ padding: 18, textAlign: 'center', color: MUTED, fontSize: '0.8125rem' }}>אין שקופיות — דף הבית מציג את ברירת המחדל</div>}
        {slides.map((sl, i) => (
          <div key={sl.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i ? `1px solid ${BORDER}` : 'none' }}>
            <span style={{ fontSize: '0.71875rem', fontWeight: 700, color: MUTED, minWidth: 22 }}>{sl.sort_order ?? 0}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.84375rem', fontWeight: 600 }}>{sl.badge ? `[${sl.badge}] ` : ''}{sl.title}</div>
              <div style={{ fontSize: '0.75rem', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sl.subtitle}</div>
            </div>
            <button onClick={() => saveSlide({ ...sl, active: !sl.active })}
              style={{ background: sl.active ? '#e7f6ec' : '#f2f5f8', color: sl.active ? '#1e7d45' : MUTED, border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {sl.active ? 'פעילה' : 'מוסתרת'}
            </button>
            <button onClick={() => removeSlide(sl.id)}
              style={{ background: 'transparent', color: '#b04a34', border: 'none', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }}>מחיקה</button>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '0.96875rem', fontWeight: 700, margin: '22px 0 10px' }}>אנליטיקה</h2>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        {(['day', 'month', 'year'] as const).map(g => (
          <button key={g} onClick={() => setGran(g)}
            style={{ background: gran === g ? DARK : '#fff', color: gran === g ? '#fff' : '#4a5a6a', border: `1px solid ${gran === g ? DARK : BORDER}`, borderRadius: 8, padding: '7px 14px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {g === 'day' ? 'יומי' : g === 'month' ? 'חודשי' : 'שנתי'}
          </button>
        ))}
        <span style={{ fontSize: '0.78125rem', color: MUTED }}>מ־</span>
        <input type="date" value={fromD} onChange={e => setFromD(e.target.value)} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px', fontSize: '0.8125rem', fontFamily: 'inherit' }} />
        <span style={{ fontSize: '0.78125rem', color: MUTED }}>עד</span>
        <input type="date" value={toD} onChange={e => setToD(e.target.value)} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px', fontSize: '0.8125rem', fontFamily: 'inherit' }} />
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {barChart('מכרזים שנקלטו', analytics?.tenders || [], '#2b6fc4')}
        {barChart('כניסות משתמשים', analytics?.logins || [], '#1e9e5a')}
        {barChart('ריצות צינורות', analytics?.runs || [], '#8a5db8')}
      </div>

      <h2 style={{ fontSize: '0.96875rem', fontWeight: 700, margin: '22px 0 10px' }}>משתמשים רשומים {users ? `(${users.length})` : ''}</h2>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead><tr style={{ background: '#f6f8fa', textAlign: 'right' }}>
            <th style={{ padding: '10px 14px', fontWeight: 600 }}>מייל</th>
            <th style={{ padding: '10px 14px', fontWeight: 600 }}>נרשם</th>
            <th style={{ padding: '10px 14px', fontWeight: 600 }}>כניסה אחרונה</th>
            <th style={{ padding: '10px 14px', fontWeight: 600 }}>מאומת</th>
            <th style={{ padding: '10px 14px', fontWeight: 600 }}>פעולות</th>
          </tr></thead>
          <tbody>
            {(users || []).map(u => (
              <tr key={u.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: '9px 14px', direction: 'ltr', textAlign: 'right' }}>{u.email}</td>
                <td style={{ padding: '9px 14px' }}>{fmtTime(u.created_at)}</td>
                <td style={{ padding: '9px 14px' }}>{u.last_sign_in_at ? fmtTime(u.last_sign_in_at) : '—'}</td>
                <td style={{ padding: '9px 14px' }}>{u.email_confirmed_at ? '✓' : '—'}</td>
                <td style={{ padding: '9px 14px' }}><button onClick={() => removeUser(u.id, u.email)} style={{ background: '#fff', border: '1px solid #f0c6c6', color: '#c0392b', borderRadius: 7, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>מחיקה</button></td>
              </tr>
            ))}
            {users && users.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: MUTED }}>אין משתמשים</td></tr>}
            {(!users || users.length === 0) && usersNotes.length > 0 && (
              <tr><td colSpan={5} style={{ padding: '10px 14px', color: '#b04a34', fontSize: '0.78125rem', background: '#fdf6f4' }}>
                אבחון: {usersNotes.join(' · ')}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <button onClick={() => { const b = adminToken(); if (b) loadWith(b); }} style={{ marginTop: 18, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 18px', fontSize: '0.8125rem', fontWeight: 600, color: '#4a5a6a', cursor: 'pointer', fontFamily: 'inherit' }}>↻ רענון נתונים</button>
    </>
  );
}
