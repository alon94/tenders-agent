import { NextRequest, NextResponse } from 'next/server';

const BUDGETKEY_API = 'https://next.obudget.org/api/search';

// שאילתות מהירות לטעינה ראשונה בדשבורד
const DEFAULT_QUERIES = [
  'מכרז עירייה',
  'מכרז מועצה אזורית',
  'מכרז ממשלתי',
  'מכרז רשות מקומית',
  'מכרז ציבורי',
];

function parseTender(raw: Record<string, unknown>): Record<string, unknown> {
  const doc = (raw.source ?? raw) as Record<string, unknown>;
  return {
    id: String(doc.tender_id ?? doc.id ?? Math.random()),
    title: String(doc.tender_name ?? doc.description ?? 'מכרז ללא כותרת'),
    publisher: String(doc.publisher ?? doc.entity_name ?? 'גוף לא ידוע'),
    category: String(doc.tender_type ?? doc.sub_kind_he ?? 'כללי'),
    region: String(doc.city ?? 'כל הארץ'),
    deadline: doc.date_closed ? String(doc.date_closed) : null,
    budget: doc.volume ? Number(doc.volume) : null,
    description: String(doc.description ?? doc.tender_name ?? ''),
    url: doc.url ? String(doc.url) : 'https://www.mr.gov.il/',
    publishDate: String(doc.start_date ?? doc.date_updated ?? new Date().toISOString()),
    status: String(doc.tender_type ?? 'פתוח'),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const customQuery = searchParams.get('q');

  const queries = customQuery ? [customQuery] : DEFAULT_QUERIES;

  try {
    const results = await Promise.all(
      queries.map(q =>
        fetch(`${BUDGETKEY_API}?query=${encodeURIComponent(q)}&doc_types=tenders&size=50`, {
          cache: 'no-store',
        })
          .then(r => r.json())
          .catch(() => ({ hits: { hits: [] } }))
      )
    );

    const seen = new Set<string>();
    const now = new Date();

    const filtered = results
      .flatMap((d: Record<string, unknown>) => {
        const hits = (d?.hits as Record<string, unknown>)?.hits as Record<string, unknown>[];
        return hits ?? [];
      })
      .map(parseTender)
      .filter(t => {
        const id = String(t.id);
        if (seen.has(id)) return false;
        seen.add(id);
        if (!t.title || t.title === 'מכרז ללא כותרת') return false;
        if (t.deadline && new Date(String(t.deadline)) < now) return false;
        if (t.status === 'סגור') return false;
        return true;
      });

    return NextResponse.json({ tenders: filtered, total: filtered.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
