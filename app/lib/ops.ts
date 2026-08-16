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

import crypto from 'crypto';

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
      create table if not exists marketing_slides (
        id bigserial primary key,
        title text not null,
        subtitle text,
        badge text,
        cta_label text,
        cta_href text,
        sort_order int not null default 0,
        active boolean not null default true,
        updated_at timestamptz not null default now()
      );
      create table if not exists login_events (
        id bigserial primary key,
        email text not null,
        at timestamptz not null default now()
      );
      create index if not exists login_events_at_idx on login_events (at);
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

/**
 * QA/B-3: אימות למסלולי תפעול/דיבוג באמצעות CRON_SECRET.
 * הסוד מתקבל מכותרת בלבד — לא מ-?secret= בכתובת, שנשמרת בלוגי Vercel,
 * בהיסטוריית הדפדפן ובכותרות Referer. ההשוואה בזמן קבוע, והפונקציה
 * נכשלת-סגור כאשר CRON_SECRET אינו מוגדר.
 */
export async function isOpsAuthorized(req: Request): Promise<boolean> {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  const header = req.headers.get('x-cron-secret') || '';
  for (const candidate of [bearer, header]) {
    if (candidate && safeEqual(candidate, expected)) return true;
  }
  return false;
}

export async function requireAdmin(req: Request): Promise<AdminIdentity | null> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;

  // מסלול חלופי: טוקן סיסמת-אדמין (עוקף את Supabase Auth לגמרי).
  // מאפשר כניסה גם כשאין חשבון Supabase או שהאימות מולו נכשל.
  const pw = verifyAdminToken(token);
  if (pw) return pw;

  if (!SUPABASE_URL) return null;

  // טוקן → פרטי משתמש (GoTrue)
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY || SERVICE_KEY || '', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!userRes.ok) return null;
  const user = await userRes.json().catch(() => null);
  const email = user?.email;
  if (!email) return null;

  // מייל → הרשאה בטבלת admins.
  // QA/B-2: בעבר השורה הזו השתמשה ב-`ilike` והזריקה את המייל מהטוקן
  // כ*תבנית*. התווים `_`, `%` ו-`*` שורדים את encodeURIComponent
  // ומתפקדים כתווים כלליים, כך שכתובת כמו alonkatabi1_@gmail.com הייתה
  // תואמת את שורת הסופר-אדמין.
  //
  // הניסיון הראשון לתקן זאת (שתי השוואות `eq`) איבד את חוסר-התלות
  // ברישיות: כשהמייל בטוקן כבר קטן, ההשוואה השנייה נדלגת, ואדמין
  // ששורתו נשמרה עם אות גדולה היה ננעל בחוץ ללא דרך שחזור.
  // הפתרון: להביא את הטבלה כולה (טבלה זעירה) ולהשוות בזיכרון —
  // התאמה מדויקת, חסרת-רישיות, בלי שום סמנטיקת תבנית.
  await ensureOpsTables();
  const normalized = email.toLowerCase().trim();
  const res = await fetch(restUrl('/admins?select=email,role'), {
    headers: svcHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const rows = (await res.json().catch(() => [])) as { email?: string; role?: string }[];
  const hit = Array.isArray(rows)
    ? rows.find((r) => String(r?.email ?? '').toLowerCase().trim() === normalized)
    : undefined;
  if (hit?.email && hit?.role) return { email: hit.email, role: hit.role };

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

// ============================================================
//  כניסת אדמין באמצעות סיסמה (מסלול חלופי ל-Supabase Auth)
//
//  ADMIN_PASSWORD במשתני הסביבה מפעיל את המסלול. הכניסה מנפיקה
//  טוקן חתום (HMAC על CRON_SECRET) בתוקף 12 שעות, שנשלח כ-Bearer
//  בדיוק כמו טוקן Supabase — כך ש-requireAdmin מקבל את שניהם.
// ============================================================

const ADMIN_TOKEN_PREFIX = 'pwadm.';
// QA/B-4: היה שבוע, בעוד שההערה למעלה הבטיחה 12 שעות. הטוקן חסר-מצב
// ולא ניתן לביטול, ולכן ככל שהתוקף קצר יותר — כך קטן חלון הנזק.
const ADMIN_TOKEN_TTL_MS = 12 * 3600 * 1000;
// QA/B-3: רק תפקידים מוכרים מתקבלים מתוך מטען הטוקן.
const ADMIN_ROLES = new Set(['viewer', 'admin', 'super']);

/**
 * QA/B-3: מפתח החתימה של טוקני האדמין.
 * קודם: נפל למחרוזת הקבועה 'fallback-key' — טוקן שניתן לזיוף על ידי כל מי
 * שקרא את הקוד. עכשיו: זורק שגיאה אם אין סוד אמיתי.
 * ADMIN_TOKEN_SECRET מועדף כדי להפריד בין חתימת האדמין לאימות ה-cron;
 * CRON_SECRET נשמר כנפילה-לאחור כדי לא לשבור פריסות קיימות.
 */
function adminSigningKey(): string {
  const key = process.env.ADMIN_TOKEN_SECRET || process.env.CRON_SECRET;
  if (!key) throw new Error('Missing ADMIN_TOKEN_SECRET (or CRON_SECRET) for admin token signing');
  return key;
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', adminSigningKey()).update(data).digest('base64url');
}

/** השוואה בזמן קבוע — מונעת דליפת מידע דרך מדידת זמן. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    // עדיין מבצעים השוואה כדי לשמור על זמן אחיד, ואז מחזירים false.
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

/** מאמת סיסמה ומנפיק טוקן אדמין חתום. מחזיר null אם הסיסמה שגויה. */
export function issueAdminToken(password: string): string | null {
  const expected = process.env.ADMIN_PASSWORD;
  // QA/B-4: השוואה בזמן קבוע במקום !== .
  if (!expected || !safeEqual(password, expected)) return null;
  const payload = `${SEED_SUPER_ADMIN}|super|${Date.now() + ADMIN_TOKEN_TTL_MS}`;
  const b64 = Buffer.from(payload).toString('base64url');
  return `${ADMIN_TOKEN_PREFIX}${b64}.${hmac(b64)}`;
}

/** מאמת טוקן אדמין־סיסמה. מחזיר את הזהות או null. */
export function verifyAdminToken(token: string): AdminIdentity | null {
  if (!token.startsWith(ADMIN_TOKEN_PREFIX)) return null;
  const rest = token.slice(ADMIN_TOKEN_PREFIX.length);
  const dot = rest.lastIndexOf('.');
  if (dot < 0) return null;
  const b64 = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  // QA/B-3/B-4: השוואת חתימה בזמן קבוע. adminSigningKey זורק כשאין סוד,
  // ולכן עוטפים — טוקן פשוט נדחה במקום להפיל את הבקשה ב-500.
  try {
    if (!safeEqual(hmac(b64), sig)) return null; // חתימה לא תקינה
  } catch {
    return null;
  }
  try {
    const [email, role, expStr] = Buffer.from(b64, 'base64url').toString().split('|');
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Date.now()) return null; // פג תוקף
    // QA/B-3: קודם הוחזרו email ו-role כפי שהיו כתובים במטען, בלי בדיקה.
    // עכשיו התפקיד חייב להיות מוכר, והמייל חייב להיות הסופר-אדמין המוגדר —
    // שהוא הזהות היחידה ש-issueAdminToken מנפיק בפועל.
    if (!email || !ADMIN_ROLES.has(role)) return null;
    if (email.toLowerCase() !== SEED_SUPER_ADMIN.toLowerCase()) return null;
    return { email, role };
  } catch {
    return null;
  }
}


// ============================================================
//  אנליטיקה וניהול משתמשים
// ============================================================

/** רישום אירוע כניסה (best-effort — לא מפיל את זרימת ההתחברות). */
export async function recordLoginEvent(email: string): Promise<void> {
  try {
    await ensureOpsTables();
    await fetch(restUrl('/login_events'), {
      method: 'POST',
      headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ email }),
    });
  } catch (e) {
    console.error('ops.recordLoginEvent failed:', e);
  }
}

export interface RegisteredUser {
  id: string; email: string; created_at: string; last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

/** רשימת המשתמשים הרשומים דרך Supabase Auth Admin API (service key). */
export async function listRegisteredUsers(): Promise<RegisteredUser[]> {
  try { const viaSql = await authUsersViaSql(); if (viaSql.length) return viaSql; } catch (e) { console.error('ops.listRegisteredUsers via postgres failed:', e); }
  if (!SUPABASE_URL || !SERVICE_KEY) return [];
  const out: RegisteredUser[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=100`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      cache: 'no-store',
    });
    if (!res.ok) { console.error('ops.listRegisteredUsers admin API failed:', res.status); break; }
    const data = await res.json().catch(() => null);
    const users = (data?.users || data || []) as Record<string, unknown>[];
    if (!Array.isArray(users) || users.length === 0) break;
    for (const u of users) {
      out.push({
        id: String(u.id || ''),
        email: String(u.email || ''),
        created_at: String(u.created_at || ''),
        last_sign_in_at: (u.last_sign_in_at as string) || null,
        email_confirmed_at: (u.email_confirmed_at as string) || null,
      });
    }
    if (users.length < 100) break;
  }
  return out;
}

// שליפה ישירה של auth.users דרך Postgres - אותו חיבור שמשמש את המיגרציה העצמית.
async function authUsersViaSql(): Promise<RegisteredUser[]> {
  const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!conn) return [];
  const cleaned = conn.replace(/([?&])sslmode=[^&]+&?/, '$1').replace(/[?&]$/, '');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require('pg');
  const client = new Client({ connectionString: cleaned, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const sql = 'select id, email, created_at, last_sign_in_at, email_confirmed_at from auth.users order by created_at desc limit 500';
  const q = await client.query(sql).finally(() => client.end().catch(() => {}));
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return ((q.rows || []) as Record<string, unknown>[]).map((u) => ({ id: String(u.id || ''), email: String(u.email || ''), created_at: iso(u.created_at) || '', last_sign_in_at: iso(u.last_sign_in_at), email_confirmed_at: iso(u.email_confirmed_at) }));
}

export type Granularity = 'day' | 'month' | 'year';

export function bucketKey(iso: string, g: Granularity): string {
  if (!iso) return '';
  const d = iso.slice(0, 10);
  return g === 'day' ? d : g === 'month' ? d.slice(0, 7) : d.slice(0, 4);
}

/** סדרת ספירות לפי תקופה מטבלה כלשהי (עמודת תאריך אחת). */
export async function seriesFromTable(
  table: string, dateCol: string, g: Granularity, fromIso?: string, toIso?: string, extraFilter = ''
): Promise<{ bucket: string; count: number }[]> {
  const filters: string[] = [`select=${dateCol}`, 'limit=20000'];
  if (fromIso) filters.push(`${dateCol}=gte.${fromIso}`);
  if (toIso) filters.push(`${dateCol}=lte.${toIso}`);
  if (extraFilter) filters.push(extraFilter);
  const res = await fetch(restUrl(`/${table}?${filters.join('&')}`), { headers: svcHeaders(), cache: 'no-store' });
  if (!res.ok) return [];
  const rows = (await res.json().catch(() => [])) as Record<string, string>[];
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = bucketKey(String(r[dateCol] || ''), g);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([bucket, count]) => ({ bucket, count })).sort((a, b) => a.bucket.localeCompare(b.bucket));
}


// ============================================================
//  שקופיות שיווקיות לדף הבית — ניתנות לעריכה ממערכת הניהול
// ============================================================
export interface Slide {
  id?: number; title: string; subtitle?: string | null; badge?: string | null;
  cta_label?: string | null; cta_href?: string | null; sort_order?: number; active?: boolean;
}

export async function listSlides(onlyActive = false): Promise<Slide[]> {
  await ensureOpsTables();
  const f = onlyActive ? 'active=is.true&' : '';
  const res = await fetch(restUrl(`/marketing_slides?${f}order=sort_order.asc,id.asc`), {
    headers: svcHeaders(), cache: 'no-store',
  });
  if (!res.ok) return [];
  return (await res.json().catch(() => [])) as Slide[];
}

export async function saveSlide(slide: Slide): Promise<boolean> {
  await ensureOpsTables();
  const body = {
    title: slide.title, subtitle: slide.subtitle ?? null, badge: slide.badge ?? null,
    cta_label: slide.cta_label ?? null, cta_href: slide.cta_href ?? null,
    sort_order: slide.sort_order ?? 0, active: slide.active ?? true, updated_at: new Date().toISOString(),
  };
  const res = slide.id
    ? await fetch(restUrl(`/marketing_slides?id=eq.${slide.id}`), {
        method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(body) })
    : await fetch(restUrl('/marketing_slides'), {
        method: 'POST', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(body) });
  return res.ok;
}

export async function deleteSlide(id: number): Promise<boolean> {
  await ensureOpsTables();
  const res = await fetch(restUrl(`/marketing_slides?id=eq.${id}`), {
    method: 'DELETE', headers: svcHeaders({ Prefer: 'return=minimal' }),
  });
  return res.ok;
}

// ============================================================
// נמעני הדיוור היומי — הצלבת auth.users עם business_profiles
// ============================================================
export interface MailRecipient {
  userId: string; email: string; categories: string[];
  region: string; publisherType: string; keywords: string;
}

/** כל המשתמשים שיש להם שורת פרופיל עסקי, עם הפרופיל שלהם. */
export async function listMailRecipients(): Promise<MailRecipient[]> {
  const users = await listRegisteredUsers();
  if (!users.length) return [];
  const res = await fetch(restUrl('/business_profiles?select=user_id,categories,category_other,region,publisher_type,keywords'), { headers: svcHeaders(), cache: 'no-store' });
  if (!res.ok) { console.error('ops.listMailRecipients profiles failed:', res.status); return []; }
  const rows = (await res.json().catch(() => [])) as Record<string, unknown>[];
  const byUser = new Map<string, Record<string, unknown>>();
  for (const r of rows) byUser.set(String(r.user_id || ''), r);
  const out: MailRecipient[] = [];
  for (const u of users) {
    const p = byUser.get(u.id);
    if (!p || !u.email) continue;
    out.push({
      userId: u.id, email: u.email,
      categories: Array.isArray(p.categories) ? (p.categories as string[]) : [],
      region: String(p.region || 'all'),
      publisherType: String(p.publisher_type || 'all'),
      // QA/M-20: קודם נלקח כאן category_other — שדה "תחום עיסוק אחר" החופשי
      // שימש בטעות כמילות מפתח לדיוור. עכשיו נקרא השדה הייעודי, עם
      // נפילה-לאחור ל-category_other עבור פרופילים ישנים.
      keywords: String(p.keywords || p.category_other || ''),
    });
  }
  return out;
}

// ============================================================
// מחיקת משתמש רשום — auth.users + הפרופיל העסקי שלו
// ============================================================
export async function deleteRegisteredUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!userId) return { ok: false, error: 'missing user id' };
  if (!SUPABASE_URL || !SERVICE_KEY) return { ok: false, error: 'missing service key' };

  const users = await listRegisteredUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) return { ok: false, error: 'user not found' };
  if (target.email.toLowerCase() === SEED_SUPER_ADMIN.toLowerCase()) {
    return { ok: false, error: 'cannot delete super admin' };
  }

  try {
    await fetch(restUrl(`/business_profiles?user_id=eq.${userId}`), { method: 'DELETE', headers: svcHeaders() });
  } catch (e) { console.error('ops.deleteRegisteredUser profile failed:', e); }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    console.error('ops.deleteRegisteredUser auth failed:', res.status);
    return { ok: false, error: `auth delete failed (${res.status})` };
  }
  return { ok: true };
}
