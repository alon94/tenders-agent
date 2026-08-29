import type { TenderRecord } from './db';

// QA #20 — היגיינת רשומות (בצד הקריאה, כדי לא לגעת ב-DB):
//  · כותרות בדיקה/placeholder ("בדיקה", "קובץ המכרז") אינן מכרזים — מסוננות.
//  · תאריך פרסום עם שנה לא סבירה ("1016-08-17") — מתאפס ל-null במקום להציג "פורסם לפני 1,010 שנה".
//  · מכרזי רמ"י נשמרו עם מספר בלבד ככותרת ("640/2026") — מקבלים תווית קריאה.
// QA 29.08.2026 — רשומות בדיקה של mr.gov.il דלפו לפרודקשן ("בדיקה",
// "בדיקה (משרד האוצר - סיגמה)", "בדיקה (ביטוח לאומי, מבוטל)",
// "בדיקה אתגר RFI"). קודם סוננה רק כותרת שכולה המילה "בדיקה", ולכן
// שלוש מהן עברו. הסינון כאן מכוון לצורות האלה בלבד ובמכוון אינו תופס כל
// כותרת שמתחילה ב"בדיקה": "בדיקה תקופתית של מעליות" הוא מכרז אמיתי,
// והמחיר של הסתרת מכרז אמיתי גבוה מהמחיר של הצגת רשומת בדיקה אחת.
// הערה: \b אינו עובד אחרי אות עברית (עברית אינה \w ב-JS), ולכן גבול
// המילה נאכף בעזרת lookahead מפורש.
const TEST_WORD = '(?:בדיקה|טסט|test|demo|dummy)';
const NOT_WORD_CHAR = '(?![\\u05d0-\\u05eaA-Za-z0-9])';
const JUNK_TITLE_PATTERNS: RegExp[] = [
  // הכותרת כולה מציין בדיקה או placeholder
  /^(בדיקה|טסט|test|קובץ המכרז|tender|מכרז ללא כותרת)$/i,
  // מציין בדיקה ואחריו סוגריים/מקף/פסיק — "בדיקה (משרד האוצר - סיגמה)"
  new RegExp(`^${TEST_WORD}\\s*[([{|,:;\\-–—]`, 'i'),
  // מציין בדיקה בפתיחה + מונח בדיקה לטיני בהמשך — "בדיקה אתגר RFI"
  new RegExp(`^${TEST_WORD}${NOT_WORD_CHAR}.*\\b(?:rfi|rfp|rfq|qa|test)\\b`, 'i'),
];

// מקור אמת אחד לכותרות שאינן מכרז — נאכף גם בכתיבה (db.syncTendersFromSources)
// וגם בקריאה (כאן ובנתיב /api/tenders), כדי שרשומות שכבר במאגר לא יוצגו.
export function isJunkTitle(title: string | null | undefined): boolean {
  const t = (title || '').trim();
  if (!t || t.length < 3) return true;
  return JUNK_TITLE_PATTERNS.some((re) => re.test(t));
}

export function sanitizeRows(rows: TenderRecord[]): TenderRecord[] {
  const out: TenderRecord[] = [];
  for (const r of rows) {
    const title = (r.title || '').trim();
    if (isJunkTitle(title)) continue;
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

