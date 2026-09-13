import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/ops';
import { NEW_SOURCES } from '@/app/lib/scrapers/newSources';
import { fetchText, listAnchors, redactSecrets, stripTags } from '@/app/lib/scrapers/core';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/admin/source-test            ← רשימת כל המקורות ברישום (כולל מושבתים)
// GET /api/admin/source-test?source=id  ← הרצת בדיקה יבשה של מקור אחד מ-Vercel:
//    מה נשלף בפועל (כמות + דוגמאות) או השגיאה המדויקת. בלי כתיבה ל-DB.
//    זו הבדיקה היחידה שמשקפת נגישות אמיתית מהשרת (WAF/גיאו/פרוקסי).
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('source');
  if (!id) {
    return NextResponse.json({
      sources: NEW_SOURCES.map((s) => ({ id: s.id, name: s.name, publisher: s.publisher, enabled: s.enabled, note: s.note ?? null })),
    });
  }
  const src = NEW_SOURCES.find((s) => s.id === id);
  if (!src) return NextResponse.json({ error: 'unknown source' }, { status: 404 });

  // ?raw=1 — אבחון: מה השרת מקבל בפועל מכל כתובת (גודל, קטע טקסט, עוגנים)
  // כדי לכוון כתובת/hrefMatch למקורות שנטענים אך מחזירים 0 פריטים.
  if (new URL(req.url).searchParams.get('raw') === '1') {
    const pages = await Promise.all((src.urls ?? []).map(async (u) => {
      try {
        const html = await fetchText(u);
        const text = stripTags(html).replace(/\s+/g, ' ').trim();
        return { url: redactSecrets(u), ok: true, chars: html.length, snippet: text.slice(0, 400), anchors: listAnchors(html, u.includes('url=') ? decodeURIComponent(u.split('url=')[1]) : u) };
      } catch (e) {
        return { url: redactSecrets(u), ok: false, error: redactSecrets(String(e)).slice(0, 300) };
      }
    }));
    return NextResponse.json({ id, name: src.name, enabled: src.enabled, note: src.note ?? null, pages });
  }

  const t0 = Date.now();
  try {
    const recs = await src.run();
    const clean = recs.filter((r) => r.title && r.title.length >= 8);
    return NextResponse.json({
      id, ok: true, enabled: src.enabled, fetched: clean.length, raw: recs.length, ms: Date.now() - t0,
      sample: clean.slice(0, 5).map((r) => ({ title: r.title.slice(0, 120), url: r.url, deadline: r.deadline, publisher: r.publisher })),
    });
  } catch (e) {
    return NextResponse.json({ id, ok: false, enabled: src.enabled, fetched: 0, ms: Date.now() - t0, error: redactSecrets(String(e)).slice(0, 600) });
  }
}
