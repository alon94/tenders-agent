import type { TenderRecord } from './db';

// QA #20 — היגיינת רשומות (בצד הקריאה, כדי לא לגעת ב-DB):
//  · כותרות בדיקה/placeholder ("בדיקה", "קובץ המכרז") אינן מכרזים — מסוננות.
//  · תאריך פרסום עם שנה לא סבירה ("1016-08-17") — מתאפס ל-null במקום להציג "פורסם לפני 1,010 שנה".
//  · מכרזי רמ"י נשמרו עם מספר בלבד ככותרת ("640/2026") — מקבלים תווית קריאה.
const JUNK_TITLE = /^(בדיקה|טסט|test|קובץ המכרז|tender|מכרז ללא כותרת)$/i;
export function sanitizeRows(rows: TenderRecord[]): TenderRecord[] {
  const out: TenderRecord[] = [];
  for (const r of rows) {
    const title = (r.title || '').trim();
    if (!title || title.length < 3 || JUNK_TITLE.test(title)) continue;
    let rec = r;
    if (r.publish_date) {
      const y = Number(String(r.publish_date).slice(0, 4));
      if (!(y >= 2000 && y <= 2100)) rec = { ...rec, publish_date: null };
    }
    if (/^\d{1,4}\/\d{4}$/.test(title)) {
      rec = { ...rec, title: `מכרז מקרקעין ${title} — ${r.publisher || 'רשות מקרקעי ישראל'}` };
    }
    out.push(rec);
  }
  return out;
}

