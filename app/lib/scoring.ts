// ============================================================
//  scoring — מנוע דירוג התאמה מאוחד (בטוח לשימוש בצד לקוח)
//
//  רציונל: ציון = כמה כדאי לעסק *לפעול עכשיו* על המכרז.
//  ארבעה ממדים משוקללים (סה"כ גולמי 0-100):
//
//  1. רלוונטיות תוכנית (0-60) — הליבה. מילת מפתח אישית שווה
//     יותר מקטגוריה, ופגיעות חוזרות באותו ממד מקבלות תשואה
//     פוחתת (הפגיעה הראשונה מלאה, הבאות חצי) — כדי שמכרז עם
//     מילה אחת חזקה לא יפסיד למכרז עם הרבה פגיעות חלשות.
//  2. דחיפות (0-20) — חלון פעולה: 3-14 יום לדדליין הוא המתוק
//     (מספיק זמן להגיש, מספיק דחוף לטפל). מכרז שנסגר מחר כמעט
//     אבוד; מכרז שנסגר עוד חצי שנה לא דורש תשומת לב היום.
//  3. טריות (0-10) — מכרז שפורסם השבוע = הזדמנות חדשה שמעטים
//     ראו. ותק מוריד בהדרגה.
//  4. התאמה סביבתית (0-10) — סוג מפרסם ואזור. בונוס בלבד:
//     לעולם לא הופך מכרז לא-רלוונטי לרלוונטי.
//
//  תצוגה: 50 + גולמי*0.45, תקרה 95 (סקאלת 50-95 המוכרת).
//  רצועות: ירוק 80+, זהב 65+, כחול מתחת.
//  "תואם פרופיל" = לפחות פגיעה תוכנית אחת (רלוונטיות > 0).
// ============================================================

export interface ScoringProfile {
  categories?: string[];
  region?: string | string[];        // אזור אחד או כמה
  publisher_type?: string | string[]; // סוג מפרסם אחד או כמה
  keywords?: string;
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export interface ScorableTender {
  title: string;
  publisher?: string;
  publishDate?: string; // YYYY-MM-DD
  deadline?: string;    // YYYY-MM-DD
}

// TICKET-12: אשכולות הקטגוריות נגזרים מהמנוע המרכזי — אותן מילות
// מפתח בדיוק כמו הסינון והחיפוש בדשבורד. 'other' נשמר לתאימות פרופיל.
import { DOMAINS } from './domains';
import { parseHeDate } from './tenderMeta';
export const CAT_KW: Record<string, string[]> = Object.fromEntries([
  ...DOMAINS.map(d => [d.id, d.kw] as [string, string[]]),
  ['other', [] as string[]],
]);

export const REG_KW: Record<string, string[]> = {
  north: ['צפון', 'עכו', 'נצרת', 'טבריה', 'גליל'],
  haifa: ['חיפה', 'קריות', 'קריית', 'כרמל'],
  center: ['מרכז', 'פתח תקווה', 'ראשון לציון', 'רחובות', 'רמת גן', 'חולון', 'בת ים'],
  tlv: ['תל אביב', 'תל-אביב', 'יפו'],
  jerusalem: ['ירושלים', 'בית שמש', 'מודיעין'],
  south: ['דרום', 'באר שבע', 'אשדוד', 'אשקלון', 'נגב', 'אילת'],
  national: [], all: [],
};

export const PUB_KW: Record<string, string[]> = {
  gov: ['משרד', 'ממשלה', 'מדינה', 'רשות', 'מינהל'],
  local: ['עירייה', 'עיריית', 'מועצה', 'רשות מקומית', 'אזורית'],
  health: ['בית חולים', 'קופת חולים', 'מאוחדת', 'כללית', 'מכבי', 'לאומית', 'בריאות'],
  edu: ['אוניברסיטה', 'מכללה', 'טכניון', 'בית ספר'],
  infra: ['חשמל', 'מים', 'נתיבי', 'מקורות', 'רכבת', 'נמל'],
  all: [],
};

// פגיעות עם תשואה פוחתת: ראשונה מלאה, כל הבאות חצי
function diminishing(hits: number, first: number): number {
  if (hits <= 0) return 0;
  return first + (hits - 1) * (first / 2);
}

function countHits(text: string, words: string[]): number {
  let n = 0;
  for (const w of words) if (text.includes(w.toLowerCase())) n++;
  return n;
}

export interface ScoreBreakdown {
  relevance: number;  // 0-60
  urgency: number;    // 0-20
  freshness: number;  // 0-10
  context: number;    // 0-10
  raw: number;        // 0-100
  display: number;    // 50-95
  matched: boolean;   // פגיעה תוכנית אחת לפחות
}

export function scoreTender(t: ScorableTender, profile: ScoringProfile, now = Date.now()): ScoreBreakdown {
  const text = (t.title + ' ' + (t.publisher || '')).toLowerCase();

  // --- 1. רלוונטיות (0-60) ---
  let relevance = 0;
  const kws = (profile.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
  relevance += diminishing(countHits(text, kws), 25);
  let catHits = 0;
  for (const cat of profile.categories || []) catHits += countHits(text, CAT_KW[cat] || []);
  relevance += diminishing(catHits, 12);
  relevance = Math.min(60, relevance);

  // --- 2. דחיפות (0-20) ---
  let urgency = 5; // ללא מועד — ניטרלי-נמוך
  const deadlineDate = t.deadline ? parseHeDate(t.deadline) : null; // TICKET-11: פרסור ריכוזי
  if (deadlineDate) {
    const days = Math.ceil((deadlineDate.getTime() - now) / 86400000);
    if (days < 0) urgency = 0;            // עבר המועד
    else if (days <= 2) urgency = 6;      // כמעט מאוחר מדי
    else if (days <= 14) urgency = 20;    // חלון הפעולה האידיאלי
    else if (days <= 30) urgency = 14;
    else if (days <= 60) urgency = 8;
    else urgency = 4;
  }

  // --- 3. טריות (0-10) ---
  let freshness = 2;
  const publishDate = t.publishDate ? parseHeDate(t.publishDate) : null; // TICKET-11: פרסור ריכוזי
  if (publishDate) {
    const age = (now - publishDate.getTime()) / 86400000;
    if (age <= 7) freshness = 10;
    else if (age <= 30) freshness = 6;
  }

  // --- 4. התאמה סביבתית (0-10) ---
  let context = 0;
  const pubs = asArray(profile.publisher_type);
  if (pubs.some(p => countHits(text, PUB_KW[p] || []) > 0)) context += 6;
  else if (pubs.includes('all')) context += 2;
  const regs = asArray(profile.region);
  if (regs.some(r => countHits(text, REG_KW[r] || []) > 0)) context += 4;
  else if (regs.includes('national') || regs.includes('all')) context += 2;
  context = Math.min(10, context);

  const raw = Math.min(100, relevance + urgency + freshness + context);
  const display = Math.min(95, Math.round(50 + raw * 0.45));

  return { relevance, urgency, freshness, context, raw, display, matched: relevance > 0 };
}

export function bandColorFor(display: number): string {
  if (display >= 80) return '#1e9e5a';
  if (display >= 65) return '#d9a520';
  return '#2b6fc4';
}
