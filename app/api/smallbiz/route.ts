import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { classifySmallBiz, fetchTenderDocsText } from '@/app/lib/smallbiz';
import { recordSyncRun, detectTrigger } from '@/app/lib/ops';
import { isExempt } from '@/app/lib/tenderMeta';

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
const TIME_BUDGET_MS = 45000;  // תקציב 45ש' — בטוח תחת תקרת 60ש' של Hobby
                               // (הראיות: ריצות נחתכו ב-59.4ש'); אם Fluid
                               // מופעל זה פשוט אומר יותר חוליות שרשרת
const MAX_CHAIN = 80; // מכסה ~2,000 בהרצה אחת — סוגר את צבר ה-requeue במחזור יחיד

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

  const chainDepthParam = parseInt(new URL(req.url).searchParams.get('chain') || '0', 10);
  const origin = new URL(req.url).origin;
  const runTrigger = detectTrigger(req);

  // מצב sweep חד-פעמי (?sweep=1): מסמן את כל המכרזים שאינם ניתנים
  // לבדיקה (ללא חוברת מכרז או שפג מועדם) כ"נבדקו" — כדי שהתור ישקף
  // רק מועמדים אמיתיים ומהריצה הבאה ייבדקו חדשים בלבד. ללא קריאות LLM.
  if (new URL(req.url).searchParams.get('sweep') === '1') {
    const today = new Date().toISOString().split('T')[0];
    const filter = `small_biz_checked_at=is.null&or=(publication_id.is.null,deadline.lt.${today},deadline.is.null)`;
    const countRes = await fetch(`${restUrl('/tenders')}?${filter}&select=id&limit=1`, {
      headers: authHeaders({ Prefer: 'count=exact' }), cache: 'no-store',
    });
    const toSweep = parseInt((countRes.headers.get('content-range') || '/0').split('/')[1] || '0', 10);
    await ensureSmallBizColumns();
    const patchRes = await fetch(`${restUrl('/tenders')}?${filter}`, {
      method: 'PATCH',
      headers: authHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        small_biz: null,
        small_biz_summary: 'לא ניתן לבדיקה — אין חוברת מכרז זמינה או שחלף מועד ההגשה',
        small_biz_checked_at: new Date().toISOString(),
      }),
    });
    await recordSyncRun({
      type: 'smallbiz', started_at: new Date().toISOString(), duration_ms: 0, trigger: detectTrigger(req),
      counts: { sweep: true, marked_uncheckable: toSweep, patch_ok: patchRes.ok },
    });
    return NextResponse.json({ sweep: true, marked_uncheckable: toSweep, patch_ok: patchRes.ok });
  }

  // ?requeue_sources=1 — משחרר מכרזים ממקורות שנתמכים כעת ע"י מנוע
  // השליפה הגנרי (רש"ת, מכבי) שסומנו קודם ב-sweep כ"לא ברי-בדיקה",
  // כי אז עדיין נדרש publication_id של mr.gov.il.
  if (new URL(req.url).searchParams.get('requeue_sources') === '1') {
    const today = new Date().toISOString().split('T')[0];
    const filter = `source=in.(iaa,maccabi)&small_biz_checked_at=not.is.null&small_biz=is.null&or=(deadline.gte.${today},deadline.is.null)`;
    const cnt = await fetch(`${restUrl('/tenders')}?${filter}&select=id&limit=1`, {
      headers: authHeaders({ Prefer: 'count=exact' }), cache: 'no-store',
    });
    const affected = parseInt((cnt.headers.get('content-range') || '/0').split('/')[1] || '0', 10);
    const patch = await fetch(`${restUrl('/tenders')}?${filter}`, {
      method: 'PATCH', headers: authHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ small_biz_checked_at: null, small_biz_summary: null }),
    });
    return NextResponse.json({ requeue_sources: true, requeued: affected, patch_ok: patch.ok });
  }

  // ?retry_errors=1 — מחזיר לתור רק מכרזים שנכשלו בשליפת החוברת
  // (small_biz null ללא סיכום מסביר) — לא הודעות ולא סומני sweep.
  if (new URL(req.url).searchParams.get('retry_errors') === '1') {
    const filter = `small_biz=is.null&small_biz_checked_at=not.is.null&small_biz_summary=is.null&publication_id=not.is.null`;
    const cnt = await fetch(`${restUrl('/tenders')}?${filter}&select=id&limit=1`, {
      headers: authHeaders({ Prefer: 'count=exact' }), cache: 'no-store',
    });
    const affected = parseInt((cnt.headers.get('content-range') || '/0').split('/')[1] || '0', 10);
    const patch = await fetch(`${restUrl('/tenders')}?${filter}`, {
      method: 'PATCH', headers: authHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ small_biz_checked_at: null }),
    });
    return NextResponse.json({ retry_errors: true, requeued: affected, patch_ok: patch.ok });
  }

  // ?requeue=1 — מחזיר לתור מכרזים שה-sweep סימן בטעות: יש חוברת,
  // ללא מועד, פורסמו בחצי השנה האחרונה ואינם פטור ממכרז.
  if (new URL(req.url).searchParams.get('requeue') === '1') {
    const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
    const sweepMsg = encodeURIComponent('לא ניתן לבדיקה — אין חוברת מכרז זמינה או שחלף מועד ההגשה');
    const filter = `small_biz_summary=eq.${sweepMsg}&publication_id=not.is.null&deadline=is.null&publish_date=gte.${cutoff}&type=not.ilike.${encodeURIComponent('*פטור*')}`;
    const cnt = await fetch(`${restUrl('/tenders')}?${filter}&select=id&limit=1`, {
      headers: authHeaders({ Prefer: 'count=exact' }), cache: 'no-store',
    });
    const affected = parseInt((cnt.headers.get('content-range') || '/0').split('/')[1] || '0', 10);
    const patch = await fetch(`${restUrl('/tenders')}?${filter}`, {
      method: 'PATCH',
      headers: authHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ small_biz_checked_at: null, small_biz_summary: null }),
    });
    await recordSyncRun({
      type: 'smallbiz', started_at: new Date().toISOString(), duration_ms: 0, trigger: detectTrigger(req),
      counts: { requeue: true, requeued: affected, patch_ok: patch.ok },
    });
    return NextResponse.json({ requeue: true, requeued: affected, patch_ok: patch.ok });
  }

  // מבנה "ענה מיד, עבד ברקע": התשובה חוזרת תוך <1ש', והעיבוד רץ
  // ב-waitUntil בתקציב זמן. כך קריאת השרשור של ההורה מסתיימת מיידית
  // וההורה לא צריך לשרוד את כל ריצת הילד — מה ששבר את השרשרת תחת
  // תקרת 60 השניות של Hobby (ההורה חי 59ש' + המתין ~60ש' לילד → נהרג).
  waitUntil(runSmallBizBatch(chainDepthParam, origin, runTrigger));
  return NextResponse.json({ accepted: true, chain_depth: chainDepthParam });
}

async function runSmallBizBatch(chainDepth: number, origin: string, runTrigger: string) {
  const runStartedAt = new Date().toISOString();
  const runT0 = Date.now();

  try {
    await ensureSmallBizColumns();
    const today = new Date().toISOString().split('T')[0];

    // אצווה: טרם נבדקו, דדליין עתידי, מקור ממשלתי (למוניציפליים אין חוברות ב-mr.gov.il)
    const params = new URLSearchParams();
    params.set('select', 'id,title,type,publication_id,url,source,deadline');
    params.set('small_biz_checked_at', 'is.null');
    // זכאות: יש חוברת, וגם — מועד עתידי, או ללא מועד אך פורסם בחצי
    // השנה האחרונה ואינו פטור ממכרז (ל-obudget יש אלפי מכרזים אמיתיים
    // עם claim_date חסר — בלעדי זה הם לא ייבדקו לעולם).
    const cutoff180 = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
    // זכאות: חוברת mr.gov.il, או מקור שממנו ניתן לשלוף מסמכים מדף
    // המכרז (רש"ת, מכבי — מנוע השליפה הגנרי).
    params.set('and', `(or(publication_id.not.is.null,source.in.(iaa,maccabi)),or(deadline.gte.${today},and(deadline.is.null,publish_date.gte.${cutoff180},type.not.ilike.*פטור*)))`);
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

    const rawBatch = (await res.json()) as { id: string; title: string; type?: string | null; publication_id?: string | null; url?: string | null; source?: string }[];
    // הודעות התקשרות/פטור לפי תבניות כותרת — מסומנות "נבדקו" מיידית,
    // בלי לשרוף קריאת LLM: ההעדפה ממילא לא רלוונטית להודעה שאינה מכרז.
    const notices = rawBatch.filter((t) => isExempt(t.type, t.title));
    if (notices.length) {
      await Promise.all(notices.map((t) =>
        fetch(`${restUrl('/tenders')}?id=eq.${encodeURIComponent(t.id)}`, {
          method: 'PATCH',
          headers: authHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ small_biz: null, small_biz_summary: 'הודעת התקשרות/פטור — בדיקת העדפה לא רלוונטית', small_biz_checked_at: new Date().toISOString() }),
        }).catch(() => {})
      ));
      console.log('SmallBiz: marked', notices.length, 'notices as not-applicable (no LLM)');
    }
    const batch = rawBatch.filter((t) => !isExempt(t.type, t.title));
    const results: { id: string; small_biz: boolean | null; confidence: string | null }[] = [];
    const startedAt = Date.now();

    // עיבוד מכרז בודד + עדכון נקודתי של שדות ההעדפה בלבד
    async function processOne(t: { id: string; title: string; publication_id?: string | null; url?: string | null }) {
      let update: Record<string, unknown>;
      try {
        const text = await fetchTenderDocsText(t);
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
    // הילד עונה תוך <1ש' (מבנה ענה-מיד), כך שה-await כאן זול ובטוח.
    const hasMore = rawBatch.length === BATCH_SIZE || results.length < batch.length;
    let chained = false;
    if (hasMore && chainDepth < MAX_CHAIN && process.env.CRON_SECRET) {
      chained = true;
      await fetch(`${origin}/api/smallbiz?chain=${chainDepth + 1}`, {
        headers: { 'x-cron-secret': process.env.CRON_SECRET },
      }).catch((e) => console.error('SmallBiz chain trigger failed:', e));
      console.log('SmallBiz: chaining next batch, depth', chainDepth + 1);
    }

    await recordSyncRun({
      type: 'smallbiz', started_at: runStartedAt, duration_ms: Date.now() - runT0, trigger: runTrigger,
      counts: { processed: results.length, found: results.filter((r) => r.small_biz === true).length, chain_depth: chainDepth, chained },
    });

    console.log('SmallBiz batch done:', { chainDepth, processed: results.length, chained });
  } catch (err) {
    console.error('SmallBiz error:', err);
    await recordSyncRun({ type: 'smallbiz', started_at: runStartedAt, duration_ms: Date.now() - runT0, trigger: runTrigger, counts: { chain_depth: chainDepth }, error: String(err) });
  }
}
