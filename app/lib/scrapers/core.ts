// ============================================================
//  scrapers/core — תשתית משותפת לסקרייפרים של מקורות חדשים
//
//  עיקרון: כל מקור מנסה קודם פרסר ייעודי (אם הוגדר), ותמיד יש
//  fallback ל"קוצר לינקים" גנרי — איסוף עוגנים שמכילים "מכרז"
//  מדף הרשימה, עם חילוץ תאריכים מהטקסט הסמוך. כך גם אם מבנה
//  הדף משתנה, המקור ממשיך להניב רשומות בסיסיות במקום להישבר.
// ============================================================

import type { TenderRecord } from "../db";

// UA דפדפני מלא — חומות WAF פשוטות (403 בנתיבי ישראל/איילון) חוסמות
// לפי User-Agent בלבד; כותרות דפדפן סטנדרטיות פותרות זאת ברוב המקרים.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

// מקורות עם הגנת בוטים ברמת רשת (משכ"ל, מפעל הפיס, חח"י) יכולים
// לעבור דרך proxy ישראלי אם מוגדר: IL_PROXY_URL="https://my-proxy/fetch?url="
export function proxied(url: string): string {
  const p = process.env.IL_PROXY_URL;
  return p ? p + encodeURIComponent(url) : url;
}

// הסתרת סודות מהודעות שגיאה שמוצגות לאדמין (דוח סנכרון, בדיקת מקורות, CSV):
// הקידומת של IL_PROXY_URL מכילה token — מוחלפת בסימון קצר וכתובת היעד המקורית.
export function redactSecrets(msg: string): string {
  const p = process.env.IL_PROXY_URL;
  let out = msg;
  if (p) {
    out = out.split(p).join("[IL_PROXY→]");
    out = out.replace(/\[IL_PROXY→\]([^\s:;]+)/g, (_m, enc: string) => {
      try { return "[IL_PROXY→]" + decodeURIComponent(enc); } catch { return "[IL_PROXY→]" + enc; }
    });
  }
  return out.replace(/token=[A-Za-z0-9_-]{8,}/g, "token=***");
}

export async function fetchText(url: string, timeoutMs = 20000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
      cache: "no-store",
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // 13.09.2026: אתרים ישנים (ח.ל.ת ועוד) מוגשים ב-windows-1255 — res.text()
    // מפענח תמיד כ-UTF-8 ומחזיר ג'יבריש, והקוצר לא מוצא «מכרז» בכותרות.
    const buf = new Uint8Array(await res.arrayBuffer());
    const head = new TextDecoder("latin1").decode(buf.subarray(0, 4096));
    const ct = res.headers.get("content-type") || "";
    const cs = (ct.match(/charset=([\w-]+)/i)?.[1] || head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] || "utf-8").toLowerCase();
    try {
      return new TextDecoder(cs === "iso-8859-8" || cs === "iso-8859-8-i" ? "iso-8859-8" : cs).decode(buf);
    } catch {
      return new TextDecoder("utf-8").decode(buf);
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...BROWSER_HEADERS, Accept: "application/json", "Content-Type": "application/json", ...(init.headers || {}) },
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
    // ישויות מספריות (&#x5DC; / &#1506;) — מכבי, עמידר ועוד מקודדים כך כל טקסט עברי
    .replace(/&#x([0-9a-f]{1,6});/gi, (_m, h: string) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return " "; } })
    .replace(/&#(\d{1,7});/g, (_m, d: string) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return " "; } })
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
  // QA/H-5: שפיות על השנה. בלי זה נכנסו למאגר מועדי הגשה בשנת 9999,
  // 9019 ו-2206 (שגיאות הקלדה במקור), שהוצגו כ"נותרו 2,911,852 ימים".
  const yr = Number(m[3]);
  const thisYear = new Date().getFullYear();
  if (yr < thisYear - 20 || yr > thisYear + 10) return null;
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
// כותרות ניווט/קטגוריה שמכילות את המילה «מכרז» אבל אינן מכרז — נפוצות
// בתפריטי אתרי רשויות (מסוננות לפי טקסט מלא, לא לפי תחילית)
// מכרזי כוח אדם / משרות — לא רלוונטיים לעסקים (הפלטפורמה העירונית מערבבת
// אותם עם מכרזי רכש באותה רשימה)
const HR_JUNK = /^(דרוש(ים|ה|ות|\/ה|\/ות|ים\/ות)?|מכרז (פנימי|חיצוני|פנימי\/חיצוני|כו?ח אדם|כ"א)|הארכת מכרז (פנימי|חיצוני)|משרה|משרת)(?=[\s:,.\-–—(]|$)/;
// משרות בניסוח מגדרי «רכז/ת הכנסות», «מדריך/ה», «עו"ס …», «אח/ות», וכן «… - ללא מכרז»
const HR_TITLE_JUNK = /^([\u0590-\u05ff"״']{2,}\/(ת|ה|ית|נית|ות|אית)(\s|$)|עו["״]ס(\s|$)|(רכז|מנהל|מזכיר|מדריך|עובד|פקיד|אח|פסיכולוג|קב"ט|מהנדס|מפקח|אדריכל)(ת|ה|ית|ות)?\s+(ה?יחיד|ה?מחלק|ה?אגף|ה?מדור|ל?בית|ל?מרכז|ב?מרכז|ה?הכנסות|ה?תעסוקה|ה?רווחה))/;
const NAV_TITLE_JUNK = /^(מכרזים( ודרושים| פעילים| פומביים| סגורים| והתקשרויות| והודעות| וקולות קוראים)?|מכרזי (חוף [\u0590-\u05ff ]{2,12}|כו?ח אדם|משאבי אנוש|שירותים ותשתיות|העירייה|רכש|נכסים|מקרקעין)|ועדת מכרזים|ארכיון מכרזים|מסמכי המכרז|תוצאות מכרזים( עירוניים)?|דפי מכרזים|פרוטוקולים? ועדת מכרזים|כל המכרזים|לכל המכרזים|רשימת המכרזים|מכרזים ודרושים)\s*[›>»]?\s*$/;

/**
 * קוצר הלינקים הגנרי: סורק עוגנים בדף רשימה, שומר את אלה שנראים
 * כמו מכרז (לפי טקסט העוגן או ה-href), ומחלץ תאריכים מהטקסט שסביב
 * העוגן — "מועד/הגשה/עד" → deadline, "פרסום" → publishDate, אחרת
 * התאריך המאוחר בסביבה נחשב deadline.
 */
export function harvestTenderLinks(
  html: string,
  baseUrl: string,
  opts: { match?: RegExp; hrefMatch?: RegExp; hrefOnly?: boolean; minTitle?: number } = {}
): HarvestedRow[] {
  const match = opts.match ?? /מכרז|בל["״"]?מ|קול קורא|הצעות מחיר|RFI|RFP/;
  const minTitle = opts.minTitle ?? 8;
  const rows: HarvestedRow[] = [];
  const seen = new Set<string>();

  const anchorRe = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
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
    if (NAV_JUNK.test(title) || NAV_TITLE_JUNK.test(title) || HR_JUNK.test(title) || HR_TITLE_JUNK.test(title)) continue;
    const hrefOk = opts.hrefMatch ? opts.hrefMatch.test(href) : false;
    // hrefOnly: רק ה-href קובע (לאתרים שבהם כל תפריט מכיל «מכרזים»)
    if (opts.hrefOnly ? !hrefOk : (!match.test(title) && !hrefOk)) continue;
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
/** אבחון: כל העוגנים בדף (href + טקסט) — כדי לראות מה הקוצר רואה ולכוון hrefMatch/כתובת */
export function listAnchors(html: string, baseUrl: string, limit = 80): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < limit) {
    const text = stripTags(m[2]).replace(/\s+/g, " ").trim();
    if (text.length < 4) continue;
    if (/^(mailto:|tel:|javascript:)/i.test(m[1])) continue;
    out.push({ href: absolutize(baseUrl, m[1]), text: text.slice(0, 120) });
  }
  return out;
}

export function rowsToRecords(
  rows: HarvestedRow[],
  src: { id: string; publisher: string }
): TenderRecord[] {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const out: TenderRecord[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = `${src.id}-${hashId(r.url + "|" + r.title)}`;
    // 13.09.2026: מועד הגשה השווה ליום הסריקה בלי תאריך פרסום הוא כמעט תמיד
    // «עודכן לאחרונה» של הדף, לא מועד אמיתי — הציף את «נסגרים בקרוב»
    const deadline = r.deadline && !r.publishDate && r.deadline.slice(0, 10) === today ? null : r.deadline;
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
      deadline,
      status: "פורסם",
      url: r.url,
      type: "מכרז",
      source: src.id,
      fetched_at: now,
    });
  }
  return out;
}
