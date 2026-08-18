import { NextResponse } from "next/server";
import { fetchActiveTenders } from "@/app/lib/agentEngine";
import { getLastSyncAt } from "@/app/lib/db";
import { queryTenders, type QueryFilters, type QueryProfile, type QueryTender } from "@/app/lib/tenderQuery";

export const dynamic = "force-dynamic";

// QA/H-1: הדשבורד משך 9,471 שורות (3.4MB, 10 בקשות, ~5 שניות) רק כדי
// להציג 25. כאן הסינון, הדירוג והספירות רצים בצד שרת — על גבי מטמון
// של 10 דקות שכבר קיים ב-agentEngine — והלקוח מקבל עמוד אחד.
//
// POST ולא GET: הבקשה נושאת את הפרופיל העסקי (כולל מילות מפתח), ואין
// סיבה שהוא ייכנס לכתובות ולוגי שרת.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const page = Math.max(1, Math.min(Number(body?.page) || 1, 10000));
    const perPage = Math.max(1, Math.min(Number(body?.perPage) || 25, 100));

    const f = body?.filters || {};
    const filters: QueryFilters = {
      view: f.view === 'exempt' || f.view === 'smallbiz' ? f.view : null,
      biz: typeof f.biz === 'string' ? f.biz.slice(0, 40) : '',
      pub: typeof f.pub === 'string' ? f.pub.slice(0, 40) : '',
      maxD: Number.isFinite(Number(f.maxD)) ? Math.min(Math.max(Number(f.maxD), 0), 3650) : 365,
      showClosed: !!f.showClosed,
      showNoDate: f.showNoDate !== false,
      sbOnly: !!f.sbOnly,
      q: typeof f.q === 'string' ? f.q.slice(0, 200) : '',
      tab: f.tab === 'closing' || f.tab === 'new' ? f.tab : 'all',
    };

    const p = body?.profile;
    const profile: QueryProfile | null =
      p && Array.isArray(p.categories)
        ? {
            categories: p.categories.slice(0, 30).map((c: unknown) => String(c).slice(0, 40)),
            region: String(p.region || 'all').slice(0, 40),
            publisher_type: String(p.publisher_type || 'all').slice(0, 40),
            keywords: typeof p.keywords === 'string' ? p.keywords.slice(0, 500) : '',
          }
        : null;

    const rows = await fetchActiveTenders();
    const all: QueryTender[] = rows.map((r, i) => ({
      id: String(r.id ?? i),
      title: String(r.title ?? ''),
      publisher: [r.publisher, r.publisher_unit].filter(Boolean).join(' - '),
      publishDate: r.publish_date ? String(r.publish_date).split('T')[0] : undefined,
      deadline: r.deadline ? String(r.deadline).split('T')[0] : undefined,
      status: String(r.status ?? ''),
      url: String(r.url ?? ''),
      type: String(r.type ?? ''),
      smallBiz: r.small_biz === true,
      smallBizConfidence: r.small_biz_confidence ?? null,
    }));

    const result = queryTenders(all, filters, profile, page, perPage);
    const fetchedAt = await getLastSyncAt();

    return NextResponse.json({ ...result, fetchedAt, corpus: all.length });
  } catch (err) {
    console.error('POST /api/tenders/search failed:', err);
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
