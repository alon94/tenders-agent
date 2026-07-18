// ============================================================
//  scrapers/core — תשתית משותפת לסקרייפרים של מקורות חדשים
//
//  עיקרון: כל מקור מנסה קודם פרסר ייעודי (אם הוגדר), ותמיד יש
//  fallback ל"קוצר לינקים" גנרי — איסוף עוגנים שמכילים "מכרז"
//  מדף הרשימה, עם חילוץ תאריכים מהטקסט הסמוך. כך גם אם מבנה
//  הדף משתנה, המקור ממשיך להניב רשומות בסיסיות במקום להישבר.
// ============================================================

import type { TenderRecord } from "../db";

const UA = "Mozilla/5.0 (compatible; TendersAgent/1.0; +https://tenders-agent.vercel.app)";

export async function fetchText(url: string, timeoutMs = 20000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "he" },
      cache: "no-store",
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 20000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/json", "Accept-Language": "he", ...(init.headers || {}) },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// DD/MM/YYYY או DD.MM.YYYY או DD-MM-YYYY → ISO. שנים דו-ספרתיות נדחות.
export function heDateToIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const mo = Number(m[2]);
  const d = Number(m[1]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[3]}-${mm}-${dd}`;
}

// מזהה יציב וקצר מתוך מחרוזת (djb2 hex) — לבניית id ייחודי-פר-מקור.
export function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export function absolutize(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export interface HarvestedRow {
  title: string;
  url: string;
  publishDate: string | null;
  deadline: string | null;
}

const NAV_JUNK = /^(עוד|קרא עוד|לחץ כאן|לפרטים|כניסה|הרשמה|התחברות|דף הבית|צור קשר|אודות|חיפוש|הבא|הקודם|עברית|english)/i;

/**
 * קוצר הלינקים הגנרי: סורק עוגנים בדף רשימה, שומר את אלה שנראים
 * כמו מכרז (לפי טקסט העוגן או ה-href), ומחלץ תאריכים מהטקסט שסביב
 * העוגן — "מועד/הגשה/עד" → deadline, "פרסום" → publishDate, אחרת
 * התאריך המאוחר בסביבה נחשב deadline.
 */
export function harvestTenderLinks(
  html: string,
  baseUrl: string,
  opts: { match?: RegExp; hrefMatch?: RegExp; minTitle?: number } = {}
): HarvestedRow[] {
  const match = opts.match ?? /מכרז|בל["״"]?מ|קול קורא|הצעות מחיר|RFI|RFP/;
  const minTitle = opts.minTitle ?? 8;
  const rows: HarvestedRow[] = [];
  const seen = new Set<string>();

  const anchorRe = /<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const matches: { index: number; end: number; href: string; inner: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    matches.push({ index: m.index, end: m.index + m[0].length, href: m[1], inner: m[2] });
  }
  for (let i = 0; i < matches.length; i++) {
    const a = matches[i];
    const href = a.href;
    const title = stripTags(a.inner);
    if (title.length < minTitle) continue;
    if (NAV_JUNK.test(title)) continue;
    const hrefOk = opts.hrefMatch ? opts.hrefMatch.test(href) : false;
    if (!match.test(title) && !hrefOk) continue;
    if (/\.(css|js|png|jpe?g|svg|ico)(\?|$)/i.test(href)) continue;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;

    const url = absolutize(baseUrl, href);
    const key = url + "|" + title;
    if (seen.has(key)) continue;
    seen.add(key);

    // חלון טקסט סביב העוגן — תחום בין העוגנים השכנים כדי שתאריך
    // של מכרז סמוך לא ידלוף פנימה
    const prevEnd = i > 0 ? matches[i - 1].end : 0;
    const nextStart = i < matches.length - 1 ? matches[i + 1].index : html.length;
    // אחורה: עד גבול הבלוק האחרון (</div>/</li>/</tr>) — תאריכים
    // שנגררים אחרי המכרז הקודם נשארים מחוץ לחלון
    const between = html.slice(prevEnd, a.index);
    const lastClose = Math.max(between.lastIndexOf("</div>"), between.lastIndexOf("</li>"), between.lastIndexOf("</tr>"), between.lastIndexOf("</td>"));
    const blockStart = lastClose >= 0 ? prevEnd + lastClose : prevEnd;
    const start = Math.max(blockStart, a.index - 300);
    const end = Math.min(nextStart, a.end + 600);
    const ctx = stripTags(html.slice(start, end));

    const deadline =
      heDateToIso((ctx.match(/(?:מועד(?:\s+אחרון)?(?:\s+ל?הגשה)?|הגשה|עד\s+ל?(?:יום|תאריך)?)[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/) || [])[1]) ||
      null;
    const publishDate =
      heDateToIso((ctx.match(/(?:פרסום|פורסם)[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/) || [])[1]) || null;

    let dl = deadline;
    if (!dl) {
      // ללא תווית מפורשת — התאריך המאוחר ביותר בהקשר
      const all = Array.from(ctx.matchAll(/\d{1,2}[./-]\d{1,2}[./-]\d{4}/g)).map((x) => heDateToIso(x[0])).filter(Boolean) as string[];
      if (all.length) dl = all.sort().slice(-1)[0];
    }

    rows.push({ title, url, publishDate, deadline: dl });
  }
  return rows;
}

/** ממיר שורות שנקצרו ל-TenderRecord אחיד עבור מקור נתון. */
export function rowsToRecords(
  rows: HarvestedRow[],
  src: { id: string; publisher: string }
): TenderRecord[] {
  const now = new Date().toISOString();
  const out: TenderRecord[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = `${src.id}-${hashId(r.url + "|" + r.title)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      tender_id: null,
      publication_id: null,
      title: r.title.slice(0, 500),
      publisher: src.publisher,
      publisher_unit: null,
      publish_date: r.publishDate,
      deadline: r.deadline,
      status: "פורסם",
      url: r.url,
      type: "מכרז",
      source: src.id,
      fetched_at: now,
    });
  }
  return out;
}
