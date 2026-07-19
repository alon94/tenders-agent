// ============================================================
//  ops — תשתית מערכת הניהול (Admin MVP)
//
//  1. מיגרציה עצמית של טבלאות התפעול (admins, sync_runs, email_log)
//  2. רישום ריצות צינורות ומשלוחי מייל (best-effort — לעולם לא
//     מפיל את הצינור עצמו)
//  3. אימות אדמין ל-API routes (טוקן משתמש → מייל → טבלת admins)
//
//  שרת בלבד — משתמש ב-SERVICE_ROLE_KEY וב-POSTGRES_URL.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// המייל שמקבל הרשאת Super Admin אוטומטית במיגרציה הראשונה
const SEED_SUPER_ADMIN = 'alonkatabi17@gmail.com';

function restUrl(path: string): string {
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
  return `${SUPABASE_URL}/rest/v1${path}`;
}

function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  if (!SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

// --- מיגרציה עצמית ---
let opsTablesEnsured = false;
export async function ensureOpsTables(): Promise<void> {
  if (opsTablesEnsured) return;
  const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!conn) throw new Error('Missing POSTGRES_URL');
  const cleaned = conn.replace(/([?&])sslmode=[^&]+&?/, '$1').replace(/[?&]$/, '');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require('pg');
  const client = new Client({ connectionString: cleaned, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(`
      create table if not exists admins (
        email text primary key,
        role text not null default 'admin',
        created_at timestamptz not null default now()
      );
      create table if not exists sync_runs (
        id bigserial primary key,
        type text not null,
        started_at timestamptz not null default now(),
        duration_ms integer,
        trigger text,
        counts_json jsonb,
        error text
      );
      create table if not exists email_log (
        id bigserial primary key,
        sent_at timestamptz not null default now(),
        recipient text,
        type text,
        tender_count integer,
        status text,
        message_id text
      );
      insert into admins (email, role) values ('${SEED_SUPER_ADMIN}', 'super')
        on conflict (email) do nothing;
    `);
    opsTablesEnsured = true;
  } finally {
    await client.end();
  }
}

// --- רישום תפעולי (best-effort) ---
export async function recordSyncRun(run: {
  type: 'sync' | 'smallbiz' | 'sources';
  started_at: string;
  duration_ms: number;
  trigger: string;
  counts: Record<string, unknown>;
  error?: string | null;
}): Promise<void> {
  try {
    await ensureOpsTables();
    await fetch(restUrl('/sync_runs'), {
      method: 'POST',
      headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        type: run.type,
        started_at: run.started_at,
        duration_ms: run.duration_ms,
        trigger: run.trigger,
        counts_json: run.counts,
        error: run.error || null,
      }),
    });
  } catch (e) {
    console.error('ops.recordSyncRun failed:', e);
  }
}

export async function recordEmail(entry: {
  recipient: string;
  type: 'daily' | 'alert' | 'test';
  tender_count: number;
  status: string;
  message_id?: string;
}): Promise<void> {
  try {
    await ensureOpsTables();
    await fetch(restUrl('/email_log'), {
      method: 'POST',
      headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ ...entry, message_id: entry.message_id || null }),
    });
  } catch (e) {
    console.error('ops.recordEmail failed:', e);
  }
}

// --- זיהוי הטריגר של הריצה ---
export function detectTrigger(req: Request): string {
  const ua = req.headers.get('user-agent') || '';
  const url = new URL(req.url);
  if (url.searchParams.get('chain')) return 'chain';
  if (ua.includes('vercel-cron')) return 'cron';
  return 'manual';
}

// --- אימות אדמין ---
export interface AdminIdentity { email: string; role: string; }

export async function requireAdmin(req: Request): Promise<AdminIdentity | null> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !SUPABASE_URL) return null;

  // טוקן → פרטי משתמש (GoTrue)
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY || SERVICE_KEY || '', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!userRes.ok) return null;
  const user = await userRes.json().catch(() => null);
  const email = user?.email;
  if (!email) return null;

  // מייל → הרשאה בטבלת admins (התאמה ללא תלות ברישיות)
  await ensureOpsTables();
  const res = await fetch(restUrl(`/admins?email=ilike.${encodeURIComponent(email)}&select=email,role`), {
    headers: svcHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  if (rows?.[0]) return { email: rows[0].email, role: rows[0].role };

  // תיקון עצמי: אם זה ה-super admin המוגדר אך השורה חסרה (המיגרציה
  // רצה לפני שהערך נקבע, או נמחקה) — משלימים אותה כאן.
  if (email.toLowerCase() === SEED_SUPER_ADMIN.toLowerCase()) {
    await fetch(restUrl('/admins'), {
      method: 'POST',
      headers: svcHeaders({ Prefer: 'return=minimal,resolution=merge-duplicates' }),
      body: JSON.stringify({ email: SEED_SUPER_ADMIN, role: 'super' }),
    }).catch(() => {});
    return { email: SEED_SUPER_ADMIN, role: 'super' };
  }
  return null;
}

// --- ספירות למסך הסקירה ---
async function countRows(pathWithFilters: string): Promise<number> {
  const sep = pathWithFilters.includes('?') ? '&' : '?';
  const res = await fetch(restUrl(`${pathWithFilters}${sep}select=*&limit=1`), {
    method: 'HEAD',
    headers: svcHeaders({ Prefer: 'count=exact' }),
    cache: 'no-store',
  });
  const range = res.headers.get('content-range') || '';
  const total = range.split('/')[1];
  return total && total !== '*' ? parseInt(total, 10) : 0;
}

export async function overviewCounts() {
  const today = new Date().toISOString().split('T')[0];
  const [total, active, addedToday, users, emailsToday, sbChecked, sbFound] = await Promise.all([
    countRows('/tenders'),
    countRows(`/tenders?or=(deadline.gte.${today},deadline.is.null)`),
    countRows(`/tenders?publish_date=gte.${today}`),
    countRows('/business_profiles'),
    countRows(`/email_log?sent_at=gte.${today}`),
    countRows('/tenders?small_biz_checked_at=not.is.null'),
    countRows('/tenders?small_biz=is.true'),
  ]);
  return { total, active, addedToday, users, emailsToday, sbChecked, sbFound };
}

export async function recentRuns(limit = 30) {
  const res = await fetch(restUrl(`/sync_runs?select=*&order=started_at.desc&limit=${limit}`), {
    headers: svcHeaders(), cache: 'no-store',
  });
  return res.ok ? res.json() : [];
}

export async function recentEmails(limit = 30) {
  const res = await fetch(restUrl(`/email_log?select=*&order=sent_at.desc&limit=${limit}`), {
    headers: svcHeaders(), cache: 'no-store',
  });
  return res.ok ? res.json() : [];
}
