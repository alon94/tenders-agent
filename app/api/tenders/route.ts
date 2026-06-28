import { NextRequest, NextResponse } from 'next/server';

const BUDGETKEY_API = 'https://next.obudget.org/api/query';

function buildQuery(keyword: string, limit = 50): string {
  return `SELECT description,publisher,publication_date,claim_date,page_url,page_title,status,tender_type_he,volume,tender_id,publisher_unit FROM procurement_tenders_processed WHERE description ILIKE '%${keyword}%' AND status='פורסם' AND (claim_date IS NULL OR claim_date >= CURRENT_DATE) ORDER BY publication_date DESC LIMIT ${limit}`;
}

function parseTender(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.tender_id ?? row.page_url ?? Math.random()),
    title: String(row.page_title ?? row.description ?? 'מכרז ללא כותרת'),
    publisher: String(row.publisher ?? row.publisher_unit ?? 'גוף לא ידוע'),
    category: String(row.tender_type_he ?? 'כללי'),
    region: 'כל הארץ',
    deadline: row.claim_date ? String(row.claim_date) : null,
    budget: row.volume ? Number(row.volume) : null,
    description: String(row.description ?? ''),
    url: row.page_url ? String(row.page_url) : 'https://www.mr.gov.il/',
    publishDate: row.publication_date ? String(row.publication_date) : new Date().toISOString(),
    status: String(row.status ?? 'פורסם'),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const customQuery = searchParams.get('q');

  const keywords = customQuery
    ? [customQuery]
    : ['מכרז', 'התקשרות', 'הצעת מחיר'];

  try {
    const results = await Promise.all(
      keywords.map(kw =>
        fetch(`${BUDGETKEY_API}?query=${encodeURIComponent(buildQuery(kw))}&format=json`, {
          cache: 'no-store',
        })
          .then(r => r.json())
          .catch(() => ({ rows: [] }))
      )
    );

    const seen = new Set<string>();

    const filtered = results
      .flatMap((d: Record<string, unknown>) =>
        (d?.rows as Record<string, unknown>[]) ?? []
      )
      .map(parseTender)
      .filter(t => {
        const id = String(t.id);
        if (seen.has(id)) return false;
        seen.add(id);
        if (!t.title || t.title === 'מכרז ללא כותרת') return false;
        return true;
      });

    return NextResponse.json({ tenders: filtered, total: filtered.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
