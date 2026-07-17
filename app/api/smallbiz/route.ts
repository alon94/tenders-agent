import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { classifySmallBiz, fetchTenderPdfText } from '@/app/lib/smallbiz';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Fluid Compute מאפשר עד 5 דקות גם ב-Hobby

// ============================================================
//  /api/smallbiz — תהליך 2: זיהוי העדפת עסקים קטנים (batch)
//  רץ ב-cron נפרד (07:30) אחרי הסנכרון הראשי. כל ריצה מטפלת
//  באצווה קטנה; התור מתקדם מריצה לריצה (small_biz_checked_at).
//  כותב אך ורק לשדות small_biz_* — אין נגיעה בשדות הבסיס.
// ============================================================

const BATCH_SIZE = 30;      // עד 30 מכרזים לריצה
const CONCURRENCY = 4;      // 4 מכרזים מעובדים בו-זמנית
const TIME_BUDGET_MS = 250000; // עצירה מסודרת אחרי ~4 דקות כדי לא להיקטע
const MAX_CHAIN = 40;       // מעצור בטיחות: עד 40 ריצות משורשרות (~1,200 מכרזים)

// מיגרציה עצמית: מוודא שעמודות small_biz_* קיימות (חד-פעמי בפועל,
// idempotent תמיד). משתמש בחיבור Postgres הישיר של אינטגרציית Supabase.
let columnsEnsured = false;
async function ensureSmallBizColumns(): Promise<void> {
  if (columnsEnsured) return;
  const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!conn) throw new Error('Missing POSTGRES_URL for migration');
  // sslmode שבתוך ה-URL של Supabase דורס את אובייקט ה-ssl — מסירים אותו
  const cleaned = conn.replace(/([?&])sslmode=[^&]+&?/, '$1').replace(/[?&]$/, '');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require('pg');
  const client = new Client({ connectionString: cleaned, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(`
      alter table tenders
        add column if not exists small_biz boolean,
        add column if not exists small_biz_summary text,
        add column if not exists small_biz_quote text,
        add column if not exists small_biz_confidence text,
        add column if not exists small_biz_checked_at timestamptz;
    `);
    columnsEnsured = true;
  } finally {
    await client.end();
  }
}

function restUrl(path: string): string {
  const base = process.env.SUPABASE_URL;
  if (!base) throw new Error('Missing SUPABASE_URL');
  return `${base}/rest/v1${path}`;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra };
}

export async function GET(req: Request) {
  // אימות — זהה ל-cron הראשי
  const authHeader = req.headers.get('authorization');
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    (!!process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureSmallBizColumns();
    const today = new Date().toISOString().split('T')[0];

    // אצווה: טרם נבדקו, דדליין עתידי, מקור ממשלתי (למוניציפליים אין חוברות ב-mr.gov.il)
    const params = new URLSearchParams();
    params.set('select', 'id,title,publication_id,deadline');
    params.set('small_biz_checked_at', 'is.null');
    params.set('deadline', `gte.${today}`);
    params.set('publication_id', 'not.is.null');
    params.set('order', 'publish_date.desc.nullslast');
    params.set('limit', String(BATCH_SIZE));

    const res = await fetch(`${restUrl('/tenders')}?${params.toString()}`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // אם העמודות עוד לא קיימות בטבלה — הודעה ברורה
      if (text.includes('small_biz')) {
        return NextResponse.json({
          error: 'missing columns',
          hint: 'הרץ את ה-SQL מ-docs/ARCHITECTURE.md ב-Supabase SQL Editor להוספת עמודות small_biz_*',
        }, { status: 500 });
      }
      throw new Error(`Supabase query failed (${res.status}): ${text}`);
    }

    const batch = (await res.json()) as { id: string; title: string; publication_id: string }[];
    const results: { id: string; small_biz: boolean | null; confidence: string | null }[] = [];
    const startedAt = Date.now();

    // עיבוד מכרז בודד + עדכון נקודתי של שדות ההעדפה בלבד
    async function processOne(t: { id: string; title: string; publication_id: string }) {
      let update: Record<string, unknown>;
      try {
        const text = await fetchTenderPdfText(t.publication_id);
        const cls = await classifySmallBiz(t.title, text);
        update = { ...cls, small_biz_checked_at: new Date().toISOString() };
        results.push({ id: t.id, small_biz: cls.small_biz, confidence: cls.small_biz_confidence });
      } catch (err) {
        update = {
          small_biz: null,
          small_biz_summary: 'שגיאה בבדיקה: ' + String(err).slice(0, 150),
          small_biz_checked_at: new Date().toISOString(),
        };
        results.push({ id: t.id, small_biz: null, confidence: null });
      }
      await fetch(`${restUrl('/tenders')}?id=eq.${encodeURIComponent(t.id)}`, {
        method: 'PATCH',
        headers: authHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify(update),
      });
    }

    // עיבוד במנות מקביליות, עם עצירה מסודרת לפני תקרת הזמן
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      await Promise.all(batch.slice(i, i + CONCURRENCY).map(processOne));
    }

    console.log('SmallBiz: processed', results.length, 'tenders:', JSON.stringify(results));

    // --- לולאת שרשור: אם נשארו מכרזים בתור, הריצה מפעילה את הבאה ---
    // תנאי המשך: האצווה הייתה מלאה (כנראה יש עוד) או שנעצרנו לפני שסיימנו אותה.
    const chainDepth = parseInt(new URL(req.url).searchParams.get('chain') || '0', 10);
    const hasMore = batch.length === BATCH_SIZE || results.length < batch.length;
    let chained = false;
    if (hasMore && chainDepth < MAX_CHAIN && process.env.CRON_SECRET) {
      const origin = new URL(req.url).origin;
      chained = true;
      waitUntil(
        fetch(`${origin}/api/smallbiz?chain=${chainDepth + 1}`, {
          headers: { 'x-cron-secret': process.env.CRON_SECRET },
        }).catch((e) => console.error('SmallBiz chain trigger failed:', e))
      );
      console.log('SmallBiz: chaining next batch, depth', chainDepth + 1);
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      found_preference: results.filter((r) => r.small_biz === true).length,
      llm_enabled: !!process.env.ANTHROPIC_API_KEY,
      chain_depth: chainDepth,
      chained_next: chained,
      results,
    });
  } catch (err) {
    console.error('SmallBiz error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
