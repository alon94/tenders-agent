// ============================================================
//  domains — מנוע ההתאמה המרכזי (TICKET-12 + TICKET-13)
//
//  מקור אמת יחיד לתחומים, מילות מפתח, סיווג וחיפוש.
//  מאחד את שלושת הסטים שהיו קיימים בנפרד:
//    · BIZ           (app/dashboard/page.tsx — סינון)
//    · KW            (app/lib/tenderMeta.ts — ציון דף פרט)
//    · CAT_KW        (app/lib/scoring.ts — דירוג פרופיל)
//  כך שסינון תחום ≡ חיפוש מילת תחום ≡ דירוג — אותה לוגיקה בדיוק.
//
//  TICKET-13: הסיווג נגזר מהדאטה — classifyTender בודק גם את שדה
//  המקור type (tender_type_he) דרך TYPE_TO_DOMAIN, וכל מכרז ללא
//  תחום נספר תחת UNCATEGORIZED_ID כדי שהצמצום יהיה מדיד.
// ============================================================

export interface DomainDef {
  id: string;
  label: string;
  kw: string[];
}

export const UNCATEGORIZED_ID = "uncat";
export const UNCATEGORIZED_LABEL = "לא מסווג";

// איחוד מילות המפתח: BIZ (דשבורד) ∪ CAT_KW (scoring) ∪ KW (tenderMeta).
// הרחבת הכיסוי כאן היא המנוף המרכזי לצמצום ה"לא מסווגים" (~4,038).
export const DOMAINS: DomainDef[] = [
  { id: "consulting", label: "ייעוץ וניהול", kw: ["ייעוץ", "יעוץ", "ניהול", "אסטרטגיה", "אסטרטגי", "הדרכה", "ניהול פרויקט", "כלכל", "פרויקט", "תכנון", "מחקר", "סקר"] },
  { id: "tech", label: "טכנולוגיה", kw: ["תוכנה", "מחשוב", "מחשב", "טכנולוגיה", "טכנולוגי", "פיתוח", "סייבר", "IT", "AI", "ענן", "מערכת מידע", "דיגיטל", "מערכות מידע", "אינטרנט", "אפליקציה", "תקשוב", "חומרה"] },
  { id: "marketing", label: "שיווק ופרסום", kw: ["שיווק", "פרסום", "קמפיין", "יחסי ציבור", "מדיה", "תוכן", "SEO", "מיתוג", "דוברות", "הסברה", "גרפיקה", "עיצוב גרפי"] },
  { id: "construction", label: "בינוי ותשתיות", kw: ["בינוי", "בנייה", "בניה", "תשתיות", "תשתית", "קבלן", "שיפוץ", "ביוב", "מים", "כבישים", "אדריכל", "עבודות", "סלילה", "עפר", "הנדס", "חשמל", "מיזוג", "אינסטלציה", "גשר", "מבנה"] },
  { id: "legal", label: "משפט וחשבונאות", kw: ["משפטי", "משפט", "עורך דין", "עו\"ד", "חשבונאות", "רואה חשבון", "ביקורת", "ציות", "חוזה", "רגולצי", "ייצוג", "גבייה", "אכיפה", "שמאות", "שמאי"] },
  { id: "education", label: "חינוך והדרכה", kw: ["חינוך", "הכשרה", "קורס", "מורה", "מרצה", "בית ספר", "אקדמי", "השכלה", "גני ילדים", "גן ילדים", "צהרון", "נוער", "סטודנט", "לימוד", "הוראה"] },
  { id: "security", label: "אבטחה ושמירה", kw: ["אבטחה", "שמירה", "שומר", "מאבטח", "סיור", "בטיחות", "מוקד", "מצלמות", "כיבוי אש", "חירום"] },
  { id: "cleaning", label: "ניקיון ותחזוקה", kw: ["ניקיון", "תחזוקה", "חיטוי", "הדברה", "גינון", "אחזקה", "טיאוט", "שטיפה"] },
  { id: "catering", label: "קייטרינג ומזון", kw: ["קייטרינג", "אוכל", "מזון", "ספק מזון", "ארוחה", "ארוחות", "הסעדה", "כשר", "מטבח", "מזנון"] },
  { id: "transport", label: "הסעות ולוגיסטיקה", kw: ["הסעות", "הסעה", "תחבורה", "לוגיסטיקה", "לוגיסטי", "הובלה", "הובלות", "הובל", "שינוע", "רכב", "אוטובוס", "משאית", "אחסנה", "בלדרות"] },
  { id: "health", label: "בריאות ורפואה", kw: ["בריאות", "רפואה", "רפואי", "סיעוד", "אחות", "רופא", "שיקום", "מרפאה", "מכשור רפואי", "תרופות", "פסיכולוג", "טיפול", "מעבדה", "בית חולים", "ציוד רפואי"] },
  { id: "realestate", label: "נדל\"ן ומקרקעין", kw: ["מקרקעין", "נדל\"ן", "נכסים", "נכס", "שכירות", "השכרה", "חכירה", "קרקע", "מגרש", "דיור"] },
  { id: "environment", label: "איכות סביבה", kw: ["סביבה", "אקולוגי", "ירוק", "פסולת", "מחזור", "זיהום", "קיימות", "אנרגיה ירוקה", "אנרגיה מתחדשת", "סולארי", "אשפה"] },
];

// TICKET-13: נרמול קטגוריית המקור (tender_type_he ומקורות עתידיים)
// לתחום מוצג. שדה type במקור מציין לרוב סוג הליך ("מכרז פומבי") —
// אך כשמופיע בו סיווג ענפי, הוא ממופה כאן ומרחיב את הכיסוי מעבר
// למילות המפתח שבכותרת.
export const TYPE_TO_DOMAIN: Record<string, string> = {
  "בינוי": "construction",
  "תשתיות": "construction",
  "מחשוב": "tech",
  "טכנולוגיה": "tech",
  "אבטחה": "security",
  "ניקיון": "cleaning",
  "הסעות": "transport",
  "בריאות": "health",
  "חינוך": "education",
};

export interface PublisherDef { id: string; label: string; kw: string[] }

// איחוד PUBS (דשבורד) ∪ PUB_KW (scoring)
export const PUBLISHERS: PublisherDef[] = [
  { id: "gov", label: "משרדי ממשלה", kw: ["משרד", "רשות", "מינהל", "מנהל", "אגף", "ממשלת", "ממשלה", "מדינה", "משטרת", "משטרה", "צה\"ל", "נציבות"] },
  { id: "local", label: "רשויות מקומיות", kw: ["עיריית", "עירייה", "מועצה", "מועצת", "רשות מקומית", "אזורית"] },
  { id: "health", label: "מערכת הבריאות", kw: ["בית חולים", "קופת חולים", "מאוחדת", "לאומית", "כללית", "מכבי", "מדא", "הדסה"] },
  { id: "edu", label: "מוסדות חינוך", kw: ["אוניברסיטה", "מכללה", "בית ספר", "טכניון"] },
  { id: "infra", label: "חברות ממשלתיות", kw: ["חברת חשמל", "חברת החשמל", "מקורות", "נמלים", "רכבת", "נתיבי", "נמל"] },
  { id: "public", label: "גופים ציבוריים", kw: ["מפעל הפיס", "ג'וינט", "ביטוח לאומי", "סוכנות היהודית", "קרן קיימת", "קק\"ל", "יד ושם", "הסתדרות"] },
];

export interface ClassifiableTender {
  title?: string;
  publisher?: string;
  id?: string;
  type?: string;
}

function searchText(t: ClassifiableTender): string {
  return ((t.title || "") + " " + (t.publisher || "") + " " + (t.type || "")).toLowerCase();
}

function kwHit(text: string, kw: string[]): boolean {
  return kw.some((k) => text.includes(k.toLowerCase()));
}

/** כל התחומים שהמכרז משתייך אליהם (מילות מפתח + נרמול שדה type). */
export function classifyTender(t: ClassifiableTender): string[] {
  const text = searchText(t);
  const ids = new Set<string>();
  for (const d of DOMAINS) if (kwHit(text, d.kw)) ids.add(d.id);
  const typ = (t.type || "").trim();
  if (typ) {
    for (const key of Object.keys(TYPE_TO_DOMAIN)) {
      if (typ.includes(key)) ids.add(TYPE_TO_DOMAIN[key]);
    }
  }
  return Array.from(ids);
}

/** התאמת מכרז לתחום — נקודת האמת היחידה לסינון, לחיפוש ולספירה. */
export function matchDomain(t: ClassifiableTender, domainId: string): boolean {
  if (!domainId) return true;
  if (domainId === UNCATEGORIZED_ID) return classifyTender(t).length === 0;
  return classifyTender(t).includes(domainId);
}

/** התאמת מכרז לגוף מפרסם. */
export function matchPublisher(t: ClassifiableTender, pubId: string): boolean {
  if (!pubId) return true;
  const p = PUBLISHERS.find((x) => x.id === pubId);
  if (!p) return true;
  const pub = (t.publisher || "").toLowerCase();
  return p.kw.some((k) => pub.includes(k.toLowerCase()));
}

/**
 * TICKET-12: חיפוש חופשי דרך אותו מנוע —
 * 1. התאמת מחרוזת ישירה (כותרת / מפרסם / מזהה / סוג).
 * 2. הרחבה סמנטית: אם השאילתה מזהה תחום (לפי שם התחום או מילת
 *    אשכול), כל מכרז המסווג לאותו תחום נחשב תואם — כך שחיפוש
 *    "טכנולוגיה" מחזיר בדיוק את תוצאות סינון "טכנולוגיה".
 */
export function queryDomains(q: string): string[] {
  const ql = q.toLowerCase().trim();
  if (!ql) return [];
  // התאמה מדויקת לשם תחום גוברת — מונעת דליפה בין אשכולות עם
  // מילות מפתח חופפות (למשל "הדרכה" בייעוץ וגם בחינוך).
  const exact = DOMAINS.find((d) => d.label.toLowerCase() === ql);
  if (exact) return [exact.id];
  const out: string[] = [];
  for (const d of DOMAINS) {
    const label = d.label.toLowerCase();
    const hit =
      label.includes(ql) ||
      ql.includes(label) ||
      d.kw.some((k) => {
        const kl = k.toLowerCase();
        return kl === ql || (ql.length >= 2 && (kl.includes(ql) || ql.includes(kl)));
      });
    if (hit) out.push(d.id);
  }
  return out;
}

export function matchQuery(t: ClassifiableTender, q: string): boolean {
  const ql = q.toLowerCase().trim();
  if (!ql) return true;
  const text = searchText(t) + " " + (t.id || "").toLowerCase();
  if (text.includes(ql)) return true;
  const doms = queryDomains(q);
  if (doms.length === 0) return false;
  const mine = classifyTender(t);
  return doms.some((d) => mine.includes(d));
}

export interface DomainCount { id: string; label: string; count: number }

/**
 * TICKET-13: התחומים נגזרים מהנתונים בפועל — ספירה חיה, תחום ריק
 * מוסתר, מיון לפי נפח, ובסוף bucket "לא מסווג" מדיד (יעד צמצום).
 */
export function domainCounts(tenders: ClassifiableTender[]): { domains: DomainCount[]; uncategorized: number } {
  const counts = new Map<string, number>();
  let uncategorized = 0;
  for (const t of tenders) {
    const ids = classifyTender(t);
    if (ids.length === 0) { uncategorized++; continue; }
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  }
  const domains = DOMAINS
    .map((d) => ({ id: d.id, label: d.label, count: counts.get(d.id) || 0 }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  return { domains, uncategorized };
}

// ------------------------------------------------------------
// אפשרויות פרופיל — נגזרות מאותו מקור אמת, כך שהקטגוריות בפרופיל
// העסקי ובאונבורדינג זהות אחת-לאחת לתחומי המכרזים בדשבורד.
// ------------------------------------------------------------
export interface Option { value: string; label: string }

export const CATEGORY_OPTIONS: Option[] = [
  ...DOMAINS.map((d) => ({ value: d.id, label: d.label })),
  { value: "other", label: "אחר" },
];

export const PUBLISHER_OPTIONS: Option[] = [
  { value: "all", label: "כל המפרסמים" },
  ...PUBLISHERS.map((p) => ({ value: p.id, label: p.label })),
];
