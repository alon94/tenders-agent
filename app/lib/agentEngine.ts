// ============================================================
//  agentEngine — מנוע הסוכן החכם (צד שרת)
//  שליפת מכרזים אמיתיים, דירוג לפי פרופיל עסקי, ומענה לשאלות
//  בשפה חופשית על בסיס הנתונים בפועל (retrieval, ללא LLM).
//  משותף ל-/api/agent (GET + POST).
// ============================================================

import { scoreTender } from './scoring';

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
interface RawRow {
  tender_id?: unknown; description?: string; publisher?: string; publisher_unit?: string;
  claim_date?: string; publication_date?: string; status?: string; page_url?: string;
}

let cache: { at: number; rows: RawRow[] } = { at: 0, rows: [] };
const CACHE_TTL = 10 * 60 * 1000;

async function fetchBatch(offset: number): Promise<RawRow[]> {
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
    return (data?.rows ?? []) as RawRow[];
  } catch {
    return [];
  }
}

export async function fetchActiveTenders(): Promise<RawRow[]> {
  if (Date.now() - cache.at < CACHE_TTL && cache.rows.length > 0) return cache.rows;
  const batches = await Promise.all([fetchBatch(0), fetchBatch(1000), fetchBatch(2000)]);
  const rows = batches.flat().filter((r) => r.description && r.description !== 'מכרז ללא כותרת');
  if (rows.length > 0) cache = { at: Date.now(), rows };
  return rows;
}

// --- דירוג מלא לפי פרופיל ---
export function rankTenders(rows: RawRow[], profile: AgentProfile): AgentTender[] {
  const seen = new Set<string>();
  return rows
    .map((r, i) => {
      const title = r.description || '';
      const publisher = r.publisher || r.publisher_unit || '';
      const publishDate = r.publication_date ? String(r.publication_date).split('T')[0] : '';
      const deadline = r.claim_date ? String(r.claim_date).split('T')[0] : '';
      const { display, matched } = scoreMatch(title, publisher, profile, publishDate, deadline);
      return {
        id: String(r.tender_id || i),
        title,
        publisher,
        publishDate,
        deadline,
        status: r.status || '',
        url: r.page_url || '',
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

const STOPWORDS = new Set([
  'של', 'על', 'את', 'עם', 'יש', 'מה', 'איזה', 'אילו', 'כמה', 'האם', 'לי', 'אני',
  'מכרז', 'מכרזים', 'תראה', 'הצג', 'חפש', 'מצא', 'בבקשה', 'רוצה', 'אפשר', 'בתחום', 'לגבי', 'עבור',
]);

function extractTerms(question: string): string[] {
  return question
    .replace(/[?!.,;:"'()]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

export function answerQuestion(question: string, ranked: AgentTender[]): AgentAnswer {
  const q = question.toLowerCase();
  const matched = ranked.filter((t) => t.matched);

  // 1. מכרזים שנסגרים בקרוב
  if (/נסגר|דדליין|מועד אחרון|בקרוב|השבוע|דחוף/.test(q)) {
    const soon = matched
      .filter((t) => { const d = daysLeft(t.deadline); return d !== null && d >= 0 && d <= 7; })
      .sort((a, b) => b.score - a.score || (daysLeft(a.deadline) ?? 99) - (daysLeft(b.deadline) ?? 99))
      .slice(0, 5);
    if (soon.length === 0) {
      return { text: 'אין כרגע מכרזים מותאמים לפרופיל שלך שנסגרים בשבוע הקרוב.', tenders: [] };
    }
    return {
      text: `נמצאו ${soon.length} מכרזים מותאמים שנסגרים בשבוע הקרוב — כדאי לפעול מהר:`,
      tenders: soon,
    };
  }

  // 2. כמה / ספירה
  if (/^כמה|כמה מכרזים/.test(q)) {
    const high = matched.filter((t) => t.score >= HIGH_MATCH).length;
    return {
      text: `סרקתי ${ranked.length} מכרזים פעילים. ${matched.length} מהם תואמים לפרופיל שלך, ומתוכם ${high} בהתאמה גבוהה (ציון ${HIGH_MATCH}+).`,
      tenders: matched.slice(0, 3),
    };
  }

  // 3. המלצות / הכי מתאים
  if (/מומלץ|הכי|מתאים|כדאי|טוב ביותר|מוביל/.test(q)) {
    const top = matched.slice(0, 5);
    if (top.length === 0) return { text: 'לא נמצאו מכרזים מותאמים לפרופיל שלך כרגע. נסה להרחיב את תחומי הפעילות בפרופיל העסקי.', tenders: [] };
    return { text: `אלה ${top.length} המכרזים המתאימים ביותר לפרופיל שלך כרגע:`, tenders: top };
  }

  // 4. חיפוש חופשי לפי מילות השאלה
  const terms = extractTerms(question);
  if (terms.length > 0) {
    const hits = ranked
      .filter((t) => {
        const text = (t.title + ' ' + t.publisher).toLowerCase();
        return terms.some((term) => text.includes(term.toLowerCase()));
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    if (hits.length > 0) {
      return { text: `נמצאו ${hits.length} מכרזים רלוונטיים לשאלה שלך:`, tenders: hits };
    }
  }

  // 5. ברירת מחדל — ההתאמות המובילות
  const top = matched.slice(0, 3);
  return {
    text: top.length > 0
      ? 'לא מצאתי מכרזים ספציפיים לשאלה, אבל אלה ההתאמות המובילות לפרופיל שלך. אפשר לשאול למשל: "מה נסגר השבוע?", "כמה מכרזים בתחום שלי?", או לחפש מילה חופשית.'
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
