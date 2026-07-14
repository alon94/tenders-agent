// ============================================================
//  agentEngine — מנוע הסוכן החכם (צד שרת)
//  שליפת מכרזים אמיתיים, דירוג לפי פרופיל עסקי, ומענה לשאלות
//  בשפה חופשית על בסיס הנתונים בפועל (retrieval, ללא LLM).
//  משותף ל-/api/agent (GET + POST).
// ============================================================

import { scoreTender, CAT_KW as CAT_KW_PUBLIC } from './scoring';
import { getTenders, type TenderRecord } from './db';

const API = 'https://next.obudget.org/api/query';
const STATUSES = `('פורסם','עתידי','פורסם ולא התקבלו השגות','פורסם והתקבלו השגות','בעדכון')`;

export interface AgentProfile {
  categories: string[];
  region: string;
  publisher_type: string;
  keywords?: string;
}

export interface AgentTender {
  id: string;
  title: string;
  publisher: string;
  publishDate: string;
  deadline: string;
  status: string;
  url: string;
  score: number;    // ציון תצוגה 50-95 מהמנוע המאוחד (scoring.ts)
  matched: boolean; // לפחות פגיעה תוכנית אחת (קטגוריה/מילת מפתח)
}

// רצועות תצוגה — זהות לעמוד הגילוי (ירוק ≥80, זהב ≥65, כחול מתחת)
export const MATCH_THRESHOLD = 65;
export const HIGH_MATCH = 80;

export interface AgentAnswer {
  text: string;
  tenders: AgentTender[];
}

// --- מילוני מילות מפתח (ערכים תואמים לעמוד הפרופיל) ---
export const CAT_LABELS: Record<string, string> = {
  consulting: 'ייעוץ וניהול', tech: 'טכנולוגיה ותוכנה', marketing: 'שיווק ופרסום',
  construction: 'בינוי ותשתיות', legal: 'משפט וחשבונאות', education: 'חינוך והדרכה',
  security: 'אבטחה ושמירה', cleaning: 'ניקיון ותחזוקה', catering: 'קייטרינג ומזון',
  transport: 'הסעות ולוגיסטיקה', health: 'בריאות ורפואה', environment: 'איכות סביבה',
  other: 'אחר',
};

export const DEFAULT_PROFILE: AgentProfile = {
  categories: (process.env.PROFILE_CATEGORIES || 'consulting,tech,marketing').split(','),
  region: process.env.PROFILE_REGIONS?.split(',')[0] || 'national',
  publisher_type: process.env.PROFILE_PUBLISHERS?.split(',')[0] || 'all',
  keywords: process.env.PROFILE_KEYWORDS || '',
};

// --- דירוג התאמה — עטיפה סביב המנוע המאוחד (scoring.ts) ---
export function scoreMatch(
  title: string, publisher: string, profile: AgentProfile,
  publishDate = '', deadline = ''
): { display: number; matched: boolean } {
  const bd = scoreTender(
    { title, publisher, publishDate, deadline },
    { categories: profile.categories, region: profile.region, publisher_type: profile.publisher_type, keywords: profile.keywords }
  );
  return { display: bd.display, matched: bd.matched };
}

// --- שליפת מכרזים פעילים (עם cache של 10 דקות) ---
// המקור הראשי: ה-DB שלנו (Supabase) — מכיל את כל שלושת המקורות:
// obudget, mr.gov.il והמכרזים המוניציפליים. אם ה-DB לא זמין —
// נסיגה ל-obudget ישירות (כמו בגרסה הישנה).
interface RawRow {
  tender_id?: unknown; description?: string; publisher?: string; publisher_unit?: string;
  claim_date?: string; publication_date?: string; status?: string; page_url?: string;
}

let cache: { at: number; rows: TenderRecord[] } = { at: 0, rows: [] };
const CACHE_TTL = 10 * 60 * 1000;

async function fetchObudgetFallback(offset: number): Promise<TenderRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  const dateFilter = `(claim_date > '${today}' OR (claim_date IS NULL AND publication_date > '2026-01-01'))`;
  const sql = `SELECT tender_id, description, publisher, publisher_unit, claim_date, publication_date, status, page_url
    FROM procurement_tenders_all
    WHERE status IN ${STATUSES} AND ${dateFilter}
    ORDER BY publication_date DESC NULLS LAST LIMIT 1000 OFFSET ${offset}`;
  try {
    const res = await fetch(`${API}?query=${encodeURIComponent(sql)}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.rows ?? []) as RawRow[]).map((r, i) => ({
      id: String(r.tender_id || `ob-${offset}-${i}`),
      title: r.description || '',
      publisher: r.publisher || null,
      publisher_unit: r.publisher_unit || null,
      publish_date: r.publication_date ? String(r.publication_date).split('T')[0] : null,
      deadline: r.claim_date ? String(r.claim_date).split('T')[0] : null,
      status: r.status || null,
      url: r.page_url || null,
    }));
  } catch {
    return [];
  }
}

export async function fetchActiveTenders(): Promise<TenderRecord[]> {
  if (Date.now() - cache.at < CACHE_TTL && cache.rows.length > 0) return cache.rows;

  const today = new Date().toISOString().split('T')[0];
  let rows: TenderRecord[] = [];

  try {
    // עד 10,000 רשומות מה-DB, בעימוד של 1000
    for (let offset = 0; offset < 10000; offset += 1000) {
      const page = await getTenders({ offset, limit: 1000 });
      rows.push(...page);
      if (page.length < 1000) break;
    }
    // פעילים בלבד: מועד הגשה עתידי או ללא מועד
    rows = rows.filter((t) => t.title && (!t.deadline || String(t.deadline).split('T')[0] >= today));
  } catch {
    rows = [];
  }

  if (rows.length === 0) {
    const batches = await Promise.all([fetchObudgetFallback(0), fetchObudgetFallback(1000), fetchObudgetFallback(2000)]);
    rows = batches.flat().filter((r) => r.title && r.title !== 'מכרז ללא כותרת');
  }

  if (rows.length > 0) cache = { at: Date.now(), rows };
  return rows;
}

// --- דירוג מלא לפי פרופיל ---
export function rankTenders(rows: TenderRecord[], profile: AgentProfile): AgentTender[] {
  const seen = new Set<string>();
  return rows
    .map((r) => {
      const title = r.title || '';
      const publisher = r.publisher || r.publisher_unit || '';
      const publishDate = r.publish_date ? String(r.publish_date).split('T')[0] : '';
      const deadline = r.deadline ? String(r.deadline).split('T')[0] : '';
      const { display, matched } = scoreMatch(title, publisher, profile, publishDate, deadline);
      return {
        id: String(r.id),
        title,
        publisher,
        publishDate,
        deadline,
        status: r.status || '',
        url: r.url || '',
        score: display,
        matched,
      };
    })
    .filter((t) => {
      // מפתח ייחודי: מזהה + מפרסם (אותו מספר מכרז יכול להופיע אצל מפרסמים שונים)
      const key = t.id + '|' + t.publisher;
      if (!t.title || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

// --- מענה לשאלות בשפה חופשית ---
function daysLeft(deadline: string): number | null {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

function fmtDate(d: string): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return d; }
}

// ============================================================
//  שכבת שליפה משודרגת (רמה 1 — ללא LLM):
//  1. נרמול עברית קל — הסרת ו/ה תחיליות, ריבוי, סיומות
//  2. BM25 — דירוג רלוונטיות סטטיסטי לחיפוש חופשי
//  3. חילוץ מסננים קומפוזיציוני — אזור+תחום+זמן+גוף באותה שאלה
// ============================================================

const STOPWORDS = new Set([
  'של', 'על', 'את', 'עם', 'יש', 'מה', 'איזה', 'אילו', 'כמה', 'האם', 'לי', 'אני', 'לא',
  'מכרז', 'מכרזים', 'תראה', 'הצג', 'חפש', 'מצא', 'בבקשה', 'רוצה', 'אפשר', 'בתחום', 'לגבי', 'עבור',
  'עוד', 'גם', 'או', 'כל', 'זה', 'זו', 'הם', 'הן', 'שלי', 'שלנו', 'אצל',
]);

// נרמול מילה עברית: תחיליות ו/ה תמיד, ב/ל/מ/כ/ש רק במילים ארוכות,
// וסיומות ריבוי — כדי ש"הדרכות" יתאים ל"הדרכה" ו"בצפון" ל"צפון".
function normHe(w: string): string {
  let s = w.replace(/[^א-תa-z0-9]/gi, '');
  for (let i = 0; i < 2; i++) {
    if (/^[וה]/.test(s) && s.length > 3) { s = s.slice(1); continue; }
    if (/^[בלמכש]/.test(s) && s.length > 4) { s = s.slice(1); continue; }
    break;
  }
  if (s.length >= 5) s = s.replace(/(יות|אות|ים|ות)$/, '');
  return s;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[?!.,;:"'()\-\/·|]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
    .map(normHe)
    .filter((w) => w.length >= 2);
}

// BM25 — חיפוש חופשי מדורג על פני כל המכרזים
function bm25Search(query: string, docs: AgentTender[], topK = 6): AgentTender[] {
  const qTokens = [...new Set(tokenize(query))];
  if (qTokens.length === 0) return [];

  const k1 = 1.4, b = 0.75;
  const docTokens = docs.map((d) => tokenize(d.title + ' ' + d.publisher));
  const avgLen = docTokens.reduce((s, t) => s + t.length, 0) / (docTokens.length || 1);

  // תדירות מסמכים לכל מונח
  const df = new Map<string, number>();
  for (const toks of docTokens) {
    const seen = new Set(toks);
    for (const t of seen) if (qTokens.includes(t)) df.set(t, (df.get(t) || 0) + 1);
  }

  const scored: { t: AgentTender; s: number }[] = [];
  for (let i = 0; i < docs.length; i++) {
    const toks = docTokens[i];
    let s = 0;
    for (const qt of qTokens) {
      const n = df.get(qt) || 0;
      if (n === 0) continue;
      const tf = toks.filter((x) => x === qt).length;
      if (tf === 0) continue;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      s += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (toks.length / avgLen))));
    }
    if (s > 0) scored.push({ t: docs[i], s });
  }
  return scored
    .sort((a, b2) => b2.s - a.s || b2.t.score - a.t.score)
    .slice(0, topK)
    .map((x) => x.t);
}

// --- חילוץ מסננים מהשאלה (קומפוזיציוני — כמה מסננים ביחד) ---
const REGION_NAMES: Record<string, string[]> = {
  north: ['צפון', 'גליל', 'עכו', 'נצרת', 'טבריה'],
  haifa: ['חיפה', 'קריות', 'כרמל'],
  center: ['מרכז', 'פתח תקווה', 'ראשון לציון', 'רחובות', 'רמת גן', 'חולון'],
  tlv: ['תל אביב', 'תל-אביב', 'יפו'],
  jerusalem: ['ירושלים', 'בית שמש', 'מודיעין'],
  south: ['דרום', 'באר שבע', 'אשדוד', 'אשקלון', 'נגב', 'אילת'],
};

interface QueryFilters {
  windowDays: number | null;   // "נסגר תוך X"
  isNew: boolean;              // פורסמו לאחרונה
  highOnly: boolean;           // התאמה גבוהה בלבד
  muni: boolean;               // מוניציפליים
  region: string | null;       // מפתח אזור
  regionLabel: string;
  categories: string[];        // מפתחות קטגוריה שזוהו
  ministry: string | null;     // "משרד ה..."
  noDeadline: boolean;
  labels: string[];            // תיאורי המסננים לתשובה
}

function extractFilters(q: string): QueryFilters {
  const f: QueryFilters = {
    windowDays: null, isNew: false, highOnly: false, muni: false,
    region: null, regionLabel: '', categories: [], ministry: null,
    noDeadline: false, labels: [],
  };

  // חלון זמן לסגירה
  if (/נסגר|דדליין|מועד אחרון|להגיש|הגשה/.test(q)) {
    if (/היום|מחר/.test(q)) f.windowDays = 2;
    else if (/שבועיים/.test(q)) f.windowDays = 14;
    else if (/חודש/.test(q)) f.windowDays = 30;
    else f.windowDays = 7; // ברירת מחדל: "בקרוב"/"השבוע"
  } else if (/דחוף|בקרוב|השבוע/.test(q)) f.windowDays = 7;
  if (f.windowDays) f.labels.push(f.windowDays <= 2 ? 'נסגרים ממש עכשיו' : `נסגרים בתוך ${f.windowDays} ימים`);

  // חדשים
  if (/חדש/.test(q)) { f.isNew = true; f.labels.push('פורסמו בשבוע האחרון'); }

  // התאמה גבוהה
  if (/התאמה גבוהה|הכי מתאים|מומלץ|טוב ביותר|מוביל/.test(q)) { f.highOnly = true; f.labels.push('התאמה מובילה'); }

  // מוניציפלי
  if (/מוניציפל|רשויות מקומיות|רשות מקומית|עיריי|מועצה/.test(q)) { f.muni = true; f.labels.push('רשויות מקומיות'); }

  // אזור
  for (const [key, names] of Object.entries(REGION_NAMES)) {
    if (names.some((n) => q.includes(n))) { f.region = key; f.regionLabel = names[0]; f.labels.push(`אזור ${names[0]}`); break; }
  }

  // קטגוריה — לפי שם התחום או מילות המילון שלו
  for (const [cat, label] of Object.entries(CAT_LABELS)) {
    if (cat === 'other') continue;
    const dictWords = CAT_KW_PUBLIC[cat] || [];
    if (q.includes(label) || dictWords.some((w) => q.includes(w.toLowerCase()))) {
      if (!f.categories.includes(cat)) { f.categories.push(cat); f.labels.push(`תחום ${label}`); }
    }
  }

  // משרד ממשלתי ספציפי
  const m = q.match(/משרד ה([א-ת]{2,15})/);
  if (m) { f.ministry = 'משרד ה' + m[1]; f.labels.push(f.ministry); }

  // ללא מועד הגשה
  if (/ללא מועד|בלי מועד|בלי דדליין/.test(q)) { f.noDeadline = true; f.labels.push('ללא מועד הגשה'); }

  return f;
}

function hasFilters(f: QueryFilters): boolean {
  return f.windowDays !== null || f.isNew || f.highOnly || f.muni || !!f.region || f.categories.length > 0 || !!f.ministry || f.noDeadline;
}

function applyFilters(ranked: AgentTender[], f: QueryFilters): AgentTender[] {
  let r = ranked;
  if (f.windowDays !== null) r = r.filter((t) => { const d = daysLeft(t.deadline); return d !== null && d >= 0 && d <= f.windowDays!; });
  if (f.isNew) r = r.filter((t) => t.publishDate && (Date.now() - new Date(t.publishDate).getTime()) / 86400000 <= 7);
  if (f.highOnly) { const hi = r.filter((t) => t.score >= HIGH_MATCH); r = hi.length > 0 ? hi : r.filter((t) => t.matched); }
  if (f.muni) r = r.filter((t) => t.id.startsWith('muni-') || /עיריי|מועצה/.test(t.publisher));
  if (f.region) { const words = REGION_NAMES[f.region]; r = r.filter((t) => words.some((w) => (t.title + ' ' + t.publisher).includes(w))); }
  if (f.categories.length > 0) {
    r = r.filter((t) => {
      const text = (t.title + ' ' + t.publisher).toLowerCase();
      return f.categories.some((c) => (CAT_KW_PUBLIC[c] || []).some((w) => text.includes(w.toLowerCase())));
    });
  }
  if (f.ministry) r = r.filter((t) => t.publisher.includes(f.ministry!));
  if (f.noDeadline) r = r.filter((t) => !t.deadline);
  // מיון: לפי דדליין כשיש חלון זמן, אחרת לפי ציון
  return f.windowDays !== null
    ? [...r].sort((a, b) => (daysLeft(a.deadline) ?? 999) - (daysLeft(b.deadline) ?? 999) || b.score - a.score)
    : [...r].sort((a, b) => b.score - a.score);
}

export function answerQuestion(question: string, ranked: AgentTender[]): AgentAnswer {
  const q = question.toLowerCase().trim();
  const matched = ranked.filter((t) => t.matched);

  // ברכות ועזרה
  if (/^(שלום|היי|הי |בוקר טוב|ערב טוב|אהלן)/.test(q)) {
    return { text: 'שלום! אני סוכן המכרזים שלך. אפשר לשאול אותי למשל: "מה נסגר השבוע?", "מכרזי טכנולוגיה בירושלים", "מכרזים חדשים של רשויות מקומיות", או כל חיפוש חופשי.', tenders: [] };
  }
  if (/מה אתה (יודע|יכול)|עזרה|איך (זה עובד|משתמשים)/.test(q)) {
    return { text: 'אני סורק את כל המכרזים הפעילים משלושת המקורות (ממשלתי, mr.gov.il ורשויות מקומיות) ועונה על שאלות משולבות: לפי תחום ("מכרזי הדרכה"), אזור ("בצפון"), זמן ("נסגרים השבוע", "חדשים"), גוף ("משרד הבריאות", "עיריות") — ואפשר לשלב הכל בשאלה אחת. כל תשובה מגובה במכרזים אמיתיים עם ציון התאמה.', tenders: [] };
  }

  // ספירה
  if (/^כמה/.test(q)) {
    const f = extractFilters(q);
    if (hasFilters(f)) {
      const hits = applyFilters(ranked, f);
      return {
        text: `נמצאו ${hits.length} מכרזים (${f.labels.join(' · ')}).${hits.length > 0 ? ' אלה המובילים:' : ''}`,
        tenders: hits.slice(0, 5),
      };
    }
    const high = matched.filter((t) => t.score >= HIGH_MATCH).length;
    return {
      text: `סרקתי ${ranked.length.toLocaleString('he-IL')} מכרזים פעילים. ${matched.length} מהם תואמים לפרופיל שלך, ומתוכם ${high} בהתאמה גבוהה (ציון ${HIGH_MATCH}+).`,
      tenders: matched.slice(0, 3),
    };
  }

  // מסננים מובנים — תומך בשילובים ("מכרזי בינוי בדרום שנסגרים החודש")
  const f = extractFilters(q);
  if (hasFilters(f)) {
    const hits = applyFilters(f.highOnly || f.windowDays !== null ? matched : ranked, f);
    if (hits.length === 0) {
      return { text: `לא נמצאו מכרזים העונים על: ${f.labels.join(' · ')}. נסה להרחיב את החיפוש.`, tenders: [] };
    }
    return {
      text: `נמצאו ${hits.length} מכרזים — ${f.labels.join(' · ')}:`,
      tenders: hits.slice(0, 6),
    };
  }

  // חיפוש חופשי — BM25 עם נרמול עברית
  const hits = bm25Search(question, ranked);
  if (hits.length > 0) {
    return { text: `נמצאו ${hits.length} מכרזים רלוונטיים לחיפוש שלך:`, tenders: hits };
  }

  // ברירת מחדל
  const top = matched.slice(0, 3);
  return {
    text: top.length > 0
      ? 'לא מצאתי מכרזים לשאלה הזו, אבל אלה ההתאמות המובילות לפרופיל שלך. נסה למשל: "מכרזי ייעוץ בירושלים שנסגרים החודש" או "מכרזים חדשים של עיריות".'
      : 'לא מצאתי מכרזים מתאימים. נסה לנסח אחרת, או עדכן את הפרופיל העסקי שלך.',
    tenders: top,
  };
}

// --- שלבי תהליך אמיתיים ---
export type AgentStep = { icon: string; title: string; sub: string; state: 'done' | 'active' | 'pending' };

export function buildSteps(total: number, matchedCount: number, highCount: number, profile: AgentProfile): AgentStep[] {
  const catNames = (profile.categories || []).map((c) => CAT_LABELS[c] || c).slice(0, 3).join(', ');
  return [
    { icon: '◉', title: 'איתור מכרזים', sub: `${total.toLocaleString('he-IL')} מכרזים פעילים נסרקו`, state: 'done' },
    { icon: '◈', title: 'סינון לפי פרופיל', sub: catNames ? `${matchedCount} תואמים ל: ${catNames}` : `${matchedCount} מכרזים תואמים`, state: 'done' },
    { icon: '★', title: 'דירוג והתאמה', sub: `${highCount} מכרזים בהתאמה גבוהה`, state: 'done' },
    { icon: '✎', title: 'מוכן לשאלות', sub: 'שאל את הסוכן על כל מכרז', state: 'active' },
  ];
}

export { fmtDate, daysLeft };
