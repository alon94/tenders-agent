// ============================================================
//  tenderQuery — סינון, דירוג ועימוד של מכרזים.
//
//  QA/H-1: עד כה כל הלוגיקה הזו רצה *בדפדפן*, ולכן הדשבורד נאלץ
//  למשוך את כל 9,471 המכרזים (3.4MB, 10 בקשות טוריות, ~5 שניות) רק
//  כדי להציג 25 שורות. המודול הזה מאפשר להריץ אותה בצד שרת.
//
//  חשוב: זהו *מקור אמת יחיד*. ה-API והלקוח משתמשים באותה פונקציה
//  בדיוק, כדי שלא תיווצר סטייה בין מה שהשרת מסנן למה שהלקוח מצפה לו.
// ============================================================

import { parseHeDate, isExempt } from './tenderMeta';
import { matchDomain, matchPublisher, matchQuery, domainCounts } from './domains';
import { scoreTender, genericScore } from './scoring';

export interface QueryTender {
  id: string; title: string; publisher: string;
  publishDate?: string; deadline?: string; status?: string;
  url?: string; type?: string;
  smallBiz?: boolean; smallBizConfidence?: string | null;
}

export interface QueryProfile {
  categories: string[]; region: string; publisher_type: string; keywords?: string | null;
}

export interface QueryFilters {
  view?: 'exempt' | 'smallbiz' | null;
  biz?: string; pub?: string;
  maxD?: number;
  showClosed?: boolean; showNoDate?: boolean;
  sbOnly?: boolean;
  q?: string;
  tab?: 'all' | 'closing' | 'new';
  sort?: 'score' | 'deadline' | 'published';
}

function daysTo(d: string | undefined, now: number): number | null {
  const x = parseHeDate(d || '');
  return x === null ? null : Math.ceil((x.getTime() - now) / 86400000);
}

function isSmallBiz(t: QueryTender): boolean {
  return !!t.smallBiz && (t.smallBizConfidence === 'high' || t.smallBizConfidence === 'medium');
}

/** הסינון הבסיסי — פורט מילה במילה מ-dashboard/page.tsx כדי לשמר התנהגות. */
export function applyBaseFilters(all: QueryTender[], f: QueryFilters, now = Date.now()): QueryTender[] {
  const { view, biz, pub, sbOnly, q } = f;
  const maxD = f.maxD ?? 365;
  const showClosed = f.showClosed ?? false;
  const showNoDate = f.showNoDate ?? true;

  let r = all;
  if (view === 'exempt') r = r.filter((t) => isExempt(t.type || '', t.title));
  if (view === 'smallbiz') r = r.filter(isSmallBiz);
  if (biz) r = r.filter((t) => matchDomain(t, biz));
  if (pub) r = r.filter((t) => matchPublisher(t, pub));
  if (!showClosed) r = r.filter((t) => { const d = daysTo(t.deadline, now); return d === null || d >= 0; });
  if (!showNoDate) r = r.filter((t) => !!t.deadline);
  r = r.filter((t) => {
    const d = daysTo(t.deadline, now);
    if (d !== null && d < 0) return showClosed;
    if (d === null) {
      // ללא מועד הגשה: מוצג רק אם פורסם בשנה האחרונה — חוסם רשומות
      // מוניציפליות עתיקות שסטטוסן "פתוח" ומעולם לא עודכן.
      if (!showNoDate) return false;
      const p = parseHeDate(t.publishDate || '');
      return p === null || p.getTime() > now - 365 * 86400000;
    }
    return d <= maxD;
  });
  if (sbOnly) r = r.filter(isSmallBiz);
  if (q && q.trim()) r = r.filter((t) => matchQuery(t, q));
  return r;
}

export function selectTab(base: QueryTender[], tab: QueryFilters['tab'], now = Date.now()): QueryTender[] {
  if (tab === 'closing') {
    return base.filter((t) => { const d = daysTo(t.deadline, now); return d !== null && d >= 0 && d <= 7; });
  }
  if (tab === 'new') {
    return base.filter((t) => {
      if (!t.publishDate) return false;
      const x = parseHeDate(t.publishDate);
      return x !== null && x.getTime() > now - 7 * 86400000;
    });
  }
  return base;
}

export function scoreOf(t: QueryTender, profile: QueryProfile | null, now = Date.now()): number {
  // QA #04: ללא פרופיל — הציון הכללי (אותו ציון שמוצג בדשבורד, בדף הפרט ובסוכן)
  if (!profile) return genericScore({ title: t.title, publisher: t.publisher, publishDate: t.publishDate, deadline: t.deadline }, now);
  return scoreTender(
    { title: t.title, publisher: t.publisher, publishDate: t.publishDate, deadline: t.deadline },
    { categories: profile.categories, region: profile.region, publisher_type: profile.publisher_type, keywords: profile.keywords || '' },
    now
  ).display;
}

export function sortTenders(rows: QueryTender[], profile: QueryProfile | null, now = Date.now(), sort?: QueryFilters['sort']): QueryTender[] {
  // QA #03: קודם הציון ותאריכים פורסרו בתוך ה-comparator — O(n log n) קריאות
  // ל-scoreTender/parseHeDate על ~9,000 שורות = 3+ שניות לכל דפדוף.
  // עכשיו מחושבים פעם אחת לשורה (decorate-sort-undecorate).
  const mode = sort || (profile ? 'score' : 'deadline');
  const needScore = mode === 'score' || mode === 'deadline';
  type Dec = { t: QueryTender; d: number; s: number; p: number };
  const dec: Dec[] = rows.map((t) => ({
    t,
    d: daysTo(t.deadline, now) ?? 9999,
    s: needScore ? scoreOf(t, profile, now) : 0,
    p: parseHeDate(t.publishDate || '')?.getTime() ?? 0,
  }));
  const cmp =
    mode === 'score' ? (a: Dec, b: Dec) => b.s - a.s || a.d - b.d :
    mode === 'published' ? (a: Dec, b: Dec) => b.p - a.p || a.d - b.d :
    (a: Dec, b: Dec) => a.d - b.d || b.s - a.s;
  return dec.sort(cmp).map((x) => x.t);
}

/** QA #17: "משרד הבריאות - X - משרד הבריאות - X" → פעם אחת. */
export function joinPublisher(publisher?: string | null, unit?: string | null): string {
  const p = (publisher || '').trim(), u = (unit || '').trim();
  if (!u) return p;
  if (!p) return u;
  if (u === p || u.includes(p) ) return u;
  if (p.includes(u)) return p;
  return p + ' - ' + u;
}

export interface QueryResult {
  tenders: QueryTender[];
  total: number;
  counts: { base: number; closing: number; new: number; smallBiz: number; active: number; exempt: number };
  domains: { id: string; label: string; count: number }[];
  uncategorized: number;
}

/** נקודת הכניסה — מסנן, מדרג, סופר ומחזיר עמוד אחד בלבד. */
export function queryTenders(
  all: QueryTender[], filters: QueryFilters, profile: QueryProfile | null,
  page = 1, perPage = 25, now = Date.now()
): QueryResult {
  const base = applyBaseFilters(all, filters, now);
  const shown = sortTenders(selectTab(base, filters.tab, now), profile, now, filters.sort);
  // QA #05: מספרי התחומים בתפריט נספרים על אותה קבוצה שמוצגת (ללא סינון התחום עצמו),
  // כך שבחירת "ניקיון (191)" באמת מחזירה 191.
  const { domains, uncategorized } = domainCounts(applyBaseFilters(all, { ...filters, biz: '' }, now));
  return {
    tenders: shown.slice((page - 1) * perPage, page * perPage),
    total: shown.length,
    counts: {
      base: base.length,
      closing: selectTab(base, 'closing', now).length,
      new: selectTab(base, 'new', now).length,
      smallBiz: all.filter(isSmallBiz).length,
      active: all.length,
      exempt: all.filter((t) => isExempt(t.type || '', t.title)).length,
    },
    domains, uncategorized,
  };
}
