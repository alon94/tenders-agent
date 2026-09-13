// ============================================================
//  scrapers/newSources — אדפטרים ל-10 המקורות החדשים
//
//  כל מקור רץ בבידוד מלא (try/catch + timeout) — כשל במקור אחד
//  לא חוסם את השאר. custom parser כשידוע מבנה, ו-fallback גנרי
//  תמיד. ?dry=1 מאפשר הרצת בדיקה בלי כתיבה ל-DB.
// ============================================================

import type { TenderRecord } from "../db";
import { upsertTenders } from "../db";
import { fetchText, fetchJson, harvestTenderLinks, rowsToRecords, heDateToIso, hashId, stripTags, proxied, redactSecrets } from "./core";

export interface NewSource {
  id: string;
  name: string;
  publisher: string;
  enabled: boolean;
  note?: string;
  /** כתובות הרשימה (למקורות גנריים) — לאבחון גולמי בבודק המקורות */
  urls?: string[];
  run: () => Promise<TenderRecord[]>;
}

// ---------- רמ"י: ניסיון API ייעודי, ואם נכשל — קציר HTML ----------
async function runRmi(): Promise<TenderRecord[]> {
  const src = { id: "rmi", publisher: "רשות מקרקעי ישראל" };
  // ה-SPA של רמ"י נשען על SearchApi — מיפוי סובלני לשמות שדות משתנים.
  try {
    const data = await fetchJson("https://apps.land.gov.il/MichrazimSite/api/SearchApi/Search", {
      method: "POST",
      body: JSON.stringify({ pageNumber: 1, pageSize: 200, isActive: true }),
    });
    const arr = extractFirstArray(data);
    if (arr && arr.length) {
      const now = new Date().toISOString();
      const recs: TenderRecord[] = [];
      for (const item of arr) {
        if (typeof item !== "object" || item === null) continue;
        const o = item as Record<string, unknown>;
        const title =
          str(o, ["MichrazName", "michrazName", "Name", "name", "Title", "title", "Teur", "teur", "Description"]) || "";
        const num = str(o, ["MichrazNumber", "michrazNumber", "MichrazID", "michrazId", "Id", "id", "Mispar"]);
        const deadline = dateVal(o, ["SgiraDate", "sgiraDate", "ClosingDate", "closingDate", "DeadLine", "deadline", "LastDate"]);
        const publish = dateVal(o, ["PirsumDate", "pirsumDate", "PublishDate", "publishDate", "OpenDate"]);
        if (!title && !num) continue;
        // ה-API מחזיר את כל ההיסטוריה (8,000+) — שומרים רק פעילים:
        // מועד הגשה מהיום והלאה, או ללא מועד אך פורסם בשנה האחרונה.
        const today = new Date().toISOString().slice(0, 10);
        const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
        if (deadline ? deadline < today : !(publish && publish >= yearAgo)) continue;
        const internalId = str(o, ["MichrazID", "michrazId", "Id", "id"]);
        // QA #20: בלי שדה תיאור הכותרת היא המספר בלבד ("640/2026") — מצרפים ייעוד/יישוב כשקיימים
        const yeud = str(o, ["Yeud", "yeud", "YeudName", "yeudName", "Purpose", "purpose", "SugMichraz", "sugMichraz"]);
        const yeshuv = str(o, ["Yeshuv", "yeshuv", "Ishuv", "ishuv", "YeshuvName", "City", "city", "Shchuna", "shchuna"]);
        const descriptive = [yeud, yeshuv].filter(Boolean).join(" ב");
        const label = title && !/^\d{1,4}\/\d{4}$/.test(title.trim())
          ? title
          : `מכרז מקרקעין ${num || title}${descriptive ? " — " + descriptive : ""}`;
        recs.push({
          id: `rmi-${num ? String(num) : hashId(label)}`,
          tender_id: num ? String(num) : null,
          publication_id: null,
          title: label.slice(0, 500),
          publisher: src.publisher,
          publisher_unit: null,
          publish_date: publish,
          deadline,
          status: "פורסם",
          url: internalId
            ? `https://apps.land.gov.il/MichrazimSite/#/michraz/${internalId}`
            : "https://apps.land.gov.il/MichrazimSite/#/michrazim",
          type: "מכרז מקרקעין",
          source: src.id,
          fetched_at: now,
        });
      }
      if (recs.length) return recs;
    }
  } catch {
    /* נופל ל-fallback */
  }
  const html = await fetchText("https://apps.land.gov.il/MichrazimSite/");
  return rowsToRecords(harvestTenderLinks(html, "https://apps.land.gov.il/MichrazimSite/"), src);
}

function extractFirstArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null) {
    for (const v of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(v) && v.length && typeof v[0] === "object") return v;
    }
    for (const v of Object.values(data as Record<string, unknown>)) {
      const nested = typeof v === "object" && v !== null ? extractFirstArray(v) : null;
      if (nested) return nested;
    }
  }
  return null;
}
function str(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}
function dateVal(o: Record<string, unknown>, keys: string[]): string | null {
  const v = str(o, keys);
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return heDateToIso(v);
}

// ---------- משהב"ט: טבלת בל"מ ב-BalamList.aspx ----------
async function runMod(): Promise<TenderRecord[]> {
  const src = { id: "mod", publisher: "משרד הביטחון" };
  const base = "https://www.online.mod.gov.il/Online2016/Pages/General/Balam/BalamList.aspx?Reset=1";
  const html = await fetchText(base);
  // ניסיון פרסינג טבלאי: שורות <tr> עם תאים — כותרת + תאריכים
  const recs: TenderRecord[] = [];
  const now = new Date().toISOString();
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html)) !== null) {
    const cells = Array.from(m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((c) => stripTags(c[1]));
    if (cells.length < 2) continue;
    const rowText = cells.join(" | ");
    if (!/מכרז|בל["״]?מ|הצעות/.test(rowText)) continue;
    const title = cells.reduce((a, b) => (b.length > a.length ? b : a), "");
    if (title.length < 10 || /^תאריך|^מס' |^סטטוס/.test(title)) continue;
    const dates = (rowText.match(/\d{1,2}[./-]\d{1,2}[./-]\d{4}/g) || []).map(heDateToIso).filter(Boolean) as string[];
    dates.sort();
    recs.push({
      id: `mod-${hashId(title)}`,
      tender_id: null,
      publication_id: null,
      title: title.slice(0, 500),
      publisher: src.publisher,
      publisher_unit: null,
      publish_date: dates.length > 1 ? dates[0] : null,
      deadline: dates.length ? dates[dates.length - 1] : null,
      status: "פורסם",
      url: base,
      type: 'בל"מ',
      source: src.id,
      fetched_at: now,
    });
  }
  if (recs.length) return recs;
  return rowsToRecords(harvestTenderLinks(html, base, { match: /מכרז|בל["״]?מ/ }), src);
}

// ---------- מקור גנרי: דף רשימה אחד או יותר → קציר לינקים ----------
function genericSource(
  id: string,
  name: string,
  publisher: string,
  urls: string[],
  opts: { match?: RegExp; hrefMatch?: RegExp; hrefOnly?: boolean; enabled?: boolean; note?: string } = {}
): NewSource {
  return {
    id,
    name,
    publisher,
    enabled: opts.enabled ?? true,
    note: opts.note,
    urls,
    run: async () => {
      const all: TenderRecord[] = [];
      const errors: string[] = [];
      for (const u of urls) {
        try {
          const html = await fetchText(u);
          all.push(...rowsToRecords(harvestTenderLinks(html, u, { match: opts.match, hrefMatch: opts.hrefMatch, hrefOnly: opts.hrefOnly }), { id, publisher }));
        } catch (e) {
          errors.push(`${u}: ${String(e)}`);
        }
      }
      if (!all.length && errors.length === urls.length) throw new Error(errors.join(" ; "));
      // דה-דופ בין עמודים
      const seen = new Set<string>();
      return all.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    },
  };
}


// ---------- דקל מכרז: פלטפורמת פרסום של מאות גופים ציבוריים ----------
// עמוד הבית חושף את כל המכרזים הפומביים ב-HTML פתוח (ללא התחברות),
// כולל שם המפרסם. זהו הפרסום הרשמי של הגוף עצמו — מקור ראשוני.
// ערך מיוחד: גופים שחסומים לנו ישירות (נתיבי איילון, רש"ת) מפרסמים כאן.
async function runDekel(): Promise<TenderRecord[]> {
  const src = { id: "dekel", publisher: "דקל מכרז" };
  const base = "https://bids.dekel.co.il/";
  const html = await fetchText(base);
  const now = new Date().toISOString();
  const recs: TenderRecord[] = [];
  const seen = new Set<string>();

  const decode = (v: string) =>
    v.replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#x27;/gi, "'").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();

  // לוכדים כל תגית <a> במלואה ובודקים את המאפיינים בנפרד — עמיד
  // לסדר מאפיינים משתנה ולנוכחות/היעדר title.
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  let lastEnd = 0;
  while ((m = anchorRe.exec(html)) !== null) {
    const attrs = m[1];
    const idMatch = attrs.match(/Item\.aspx\?ID=(\d+)/i);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (seen.has(id)) { lastEnd = m.index + m[0].length; continue; }

    const chunk = stripTags(html.slice(lastEnd, m.index));

    // כותרת: מאפיין title ("צפייה במכרז: <שם>"), ואם אין — הכותרת
    // שקדמה לקישור בגוש (h1-h4), ולבסוף טקסט הקישור.
    let title = "";
    const titleAttr = attrs.match(/title="([^"]*)"/i);
    if (titleAttr) title = decode(titleAttr[1]).replace(/^צפייה ב(?:מכרז|קול קורא)\s*:?\s*/, "").trim();
    if (title.length < 8) {
      const heads = [...html.slice(lastEnd, m.index).matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)];
      if (heads.length) title = decode(stripTags(heads[heads.length - 1][1]));
    }
    if (title.length < 8) title = decode(stripTags(m[2]));
    if (title.length < 8 || /^צפייה/.test(title)) { lastEnd = m.index + m[0].length; continue; }

    const pubMatch = chunk.match(/מפרסם ה(?:מכרז|קול קורא)\s*:?\s*(.{3,80}?)(?:\s*עלות|\s*תחום\s*:|\s*$)/);
    const publisher = pubMatch ? decode(pubMatch[1]) : src.publisher;
    const isCall = /קול קורא/.test(title) || /קול קורא/.test(chunk.slice(-120));

    seen.add(id);
    recs.push({
      id: `dekel-${id}`,
      tender_id: id,
      publication_id: null,
      title: title.slice(0, 500),
      publisher: publisher.slice(0, 200),
      publisher_unit: null,
      publish_date: null,
      deadline: null,
      status: "פורסם",
      url: `https://bids.dekel.co.il/Item.aspx?ID=${id}`,
      type: isCall ? "קול קורא" : "מכרז פומבי",
      source: src.id,
      fetched_at: now,
    });
    lastEnd = m.index + m[0].length;
  }
  return recs;
}

export const NEW_SOURCES: NewSource[] = [
  { id: "dekel", name: "דקל מכרז — פלטפורמת מאות גופים", publisher: "דקל מכרז", enabled: true, run: runDekel },
  { id: "rmi", name: 'רמ"י — מכרזי מקרקעין', publisher: "רשות מקרקעי ישראל", enabled: true, run: runRmi },
  { id: "mod", name: "משרד הביטחון — סחר אלקטרוני", publisher: "משרד הביטחון", enabled: true, run: runMod },
  genericSource("mashcal", 'משכ"ל', "החברה למשק וכלכלה של השלטון המקומי", [
    proxied("https://www.mashcal.co.il/our-tenders/"),
    proxied("https://www.mashcal.co.il/published-tenders/"),
  ], { enabled: false, hrefMatch: /tender/i, note: "הגנת בוטים ברמת רשת — ללא IL_PROXY_URL הבקשה צפויה להיכשל" }),
  genericSource("pais", "מפעל הפיס", "מפעל הפיס", [
    proxied("https://www.pais.co.il/tenders/"),
  ], { enabled: false, hrefMatch: /tender/i, note: "Imperva — חסימת cloud ברמת רשת (reset/timeout גם דרך IL_PROXY_URL ב-Oracle IL, אומת 27.08.2026) — עובד רק מ-IP ביתי" }),
  genericSource("meuhedet", "קופת חולים מאוחדת", "קופת חולים מאוחדת", [
    "https://www.meuhedet.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%A4%D7%A2%D7%99%D7%9C%D7%99%D7%9D/",
  ], {
    hrefMatch: /מכרז|%D7%9E%D7%9B%D7%A8%D7%96/i,
    note: "רשימת המכרזים נטענת ב-JavaScript בצד לקוח — ה-HTML מהשרת ריק. נדרשת כתובת ה-API הפנימי (DevTools → Network) כדי לקצור ישירות ממנו",
  }),
  genericSource("maccabi", "מכבי שירותי בריאות", "מכבי שירותי בריאות", [
    "https://www.maccabi4u.co.il/bids/",
    "https://www.maccabi4u.co.il/new/bids/",
  ], { match: /מכרז|הצעת מחיר|הצעות|RFI|RFP/ }),
  genericSource("btl", "המוסד לביטוח לאומי", "המוסד לביטוח לאומי", [
    "https://www.btl.gov.il/About/tenders/Pages/default.aspx",
  ]),
  genericSource("iroads", "נתיבי ישראל", "נתיבי ישראל", [
    proxied("https://www.iroads.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/"),
  ], { enabled: false, note: "WAF מחזיר 403 גם עם כותרות דפדפן — נדרש IL_PROXY_URL" }),
  genericSource("ayalon", "נתיבי איילון", "נתיבי איילון", [
    proxied("https://www.ayalonhw.co.il/tenders/tenders-lobby/"),
  ], { enabled: false, hrefMatch: /tender/i, note: "חסימת cloud ברמת רשת (reset/timeout גם דרך IL_PROXY_URL ב-Oracle IL, אומת 27.08.2026) — עובד רק מ-IP ביתי" }),
  // ---------- גל שני: תחבורה, תעופה, אקדמיה, פיתוח עירוני ----------
  genericSource("rail", "רכבת ישראל", "רכבת ישראל", [
    proxied("https://tender.rail.co.il/"),
    "https://tender.rail.co.il/",
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "tender.rail.co.il — מעטפת JS (13.09.2026); נדרש מיפוי API/רינדור" }),
  genericSource("nta", 'נת"ע — מטרו וקווי רכבת קלה', 'נת"ע נתיבי תחבורה עירוניים', [
    proxied("https://www.nta.co.il/tenders/"),
  ], { enabled: false, hrefMatch: /tender/i, note: "WAF מחזיר 403 מכל מקור כולל IP ביתי (אומת 27.08.2026) — נדרש רינדור דפדפן" }),
  genericSource("iaa", "רשות שדות התעופה", "רשות שדות התעופה", [
    // מבנה האתר החדש: הגרסה העברית ללא קידומת /he
    proxied("https://www.iaa.gov.il/tenders-and-contracts/active-tenders/"),
    proxied("https://www.iaa.gov.il/tenders-and-contracts/tenders-archive/"),
  ]),
  genericSource("tau", "אוניברסיטת תל אביב — מכרזים והתקשרויות", "אוניברסיטת תל אביב", [
    "https://tenders.tau.ac.il/tenders",
  ], { hrefMatch: /tender/i }),
  genericSource("jda", "הרשות לפיתוח ירושלים", "הרשות לפיתוח ירושלים", [
    "https://www.jda.gov.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/",
  ]),
  genericSource("innovation", "רשות החדשנות — קולות קוראים", "רשות החדשנות", [
    proxied("https://innovationisrael.org.il/kol_kore/"),
    proxied("https://innovationisrael.org.il/programs/"),
  ], { match: /קול קורא|מסלול|פנייה לציבור|הליך תחרותי/, hrefMatch: /kol[_-]kore/i,
       note: "WAF מחזיר 403 לשרתי חו\"ל — נדרש IL_PROXY_URL" }),
  genericSource("iec", "חברת החשמל", "חברת החשמל לישראל", [
    proxied("https://www.iec.co.il/content/suppliers/content-pages/tendersinfo"),
  ], {
    note: "חסום גיאוגרפית — דרך IL_PROXY_URL",
  }),
  // מקורות — חברת המים הלאומית. חוסמת בוטים ישירות, נדרש פרוקסי.
  genericSource("mekorot", "מקורות — חברת המים", "מקורות חברת מים בע\"מ", [
    proxied("https://www.mekorot.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/"),
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "חוסמת בוטים — דרך IL_PROXY_URL" }),
  // ---------- גל שלישי: שלטון מקומי מרכזי וקולות קוראים ממשלתיים ----------
  // מש"מ — מרכז השלטון המקומי: ~50 מכרזים וקולות קוראים לרשויות, רשימה
  // מרונדרת-שרת בעמוד אחד (אומת 23.08.2026). קישורי פריט: /bids/?id=NN
  genericSource("masham", 'מש"מ — מרכז השלטון המקומי', "מרכז השלטון המקומי", [
    proxied("https://masham.org.il/bids/"),
  ], { hrefMatch: /bids\/?\?id=/i, note: "נטען דרך IL_PROXY_URL (אומת 27.08.2026)" }),
  // פורטל רשויות ובעלויות חינוך — קולות קוראים של משרד החינוך (SharePoint)
  genericSource("edu-pob", "משרד החינוך — קולות קוראים לרשויות", "משרד החינוך", [
    "https://pob.education.gov.il/kolotkorim/kolkore/",
    "https://pob.education.gov.il/kolotkorim/pages/kolkore.aspx",
  ], { enabled: false, match: /קול קורא|קו"ק|מכרז/, hrefMatch: /kolkore|KolKore|kolotkorim/i, note: "SharePoint — חסימת cloud ברמת רשת (reset/timeout גם דרך IL_PROXY_URL ב-Oracle IL, אומת 27.08.2026) — עובד רק מ-IP ביתי" }),
  // קק"ל — מכרזים והתקשרויות (דף האב מנווט לרשימות משנה)
  genericSource("kkl", 'קק"ל — מכרזים', "קרן קימת לישראל", [
    "https://www.kkl.org.il/about-us/tenders/",
  ], { hrefMatch: /tender|מכרז/i, note: "דף אב — אם הרשימות בתתי-עמודים בלבד, להרחיב כתובות" }),

  // ============================================================
  //  גל רביעי — הרחבה רוחבית: בריאות, תשתיות, אקדמיה, תאגידים
  //  עירוניים ותעשיות ביטחוניות. סיווג enabled/disabled נקבע לפי
  //  בדיקת נגישות בפועל (WebFetch משרת חו"ל): מקורות server-html
  //  שנטענים ישירות = enabled; חסומי WAF/גיאו = disabled + proxied()
  //  (ידרשו IL_PROXY_URL); אתרי JS/SPA = disabled + הערה שנדרש API.
  // ============================================================

  // ---------- בריאות: קופות חולים ותאגידי בריאות של בתי חולים ----------
  // שירותי בריאות כללית — אין רשימה מאוחדת אחת; ועדות נפרדות בתתי-עמודים.
  genericSource("clalit", "שירותי בריאות כללית — מכרזים", "שירותי בריאות כללית", [
    proxied("https://www.clalit.co.il/he/info/tenders/Pages/michraz_michshuv.aspx"),
    proxied("https://www.clalit.co.il/he/info/tenders/Pages/mkomi_hospital.aspx"),
    proxied("https://www.clalit.co.il/he/info/tenders/Pages/mkomi_mhozot.aspx"),
    proxied("https://www.clalit.co.il/he/info/tenders/Pages/general_matters.aspx"),
    proxied("https://www.clalit.co.il/he/info/tenders/Pages/kol-kore.aspx"),
  ], { hrefMatch: /tender|michraz|Pages/i, note: "Incapsula חוסם את ה-IP של הפרוקסי (דף חסימה ב-200, אומת 13.09.2026) — נדרש IP אחר/רץ ביתי" }),
  genericSource("leumit", "קופת חולים לאומית — מכרזים", "קופת חולים לאומית", [
    "https://www.leumit.co.il/bids/publictenders/",
  ], { hrefMatch: /bids|tender|publictenders/i }),
  genericSource("ichilov", "איכילוב — תאגיד הבריאות (סוראסקי)", "המרכז הרפואי תל אביב סוראסקי", [
    "https://www.tasmc.org.il/all/michrazim-health-corp/",
  ], { hrefMatch: /michraz|tender/i }),
  genericSource("hadassah", "הדסה — ועדת התקשרויות", "הדסה", [
    proxied("https://he.hadassah.org.il/center/vaadat-itkashruyot/"),
  ], { hrefMatch: /center\/michrazim|itkashr/i }),
  genericSource("rambam", 'רמב"ם — מכרזים פומביים', 'רמב"ם — הקריה הרפואית', [
    "https://www.rambam.org.il/departmentsandclinics/purchasing-department/public-tenders/",
  ], { hrefMatch: /tender|public-tenders/i }),
  genericSource("shamir", "שמיר (אסף הרופא) — מכרזים", "המרכז הרפואי שמיר", [
    "https://www.shamir.org/he/about/tenders/",
  ], { hrefMatch: /media|tender/i, note: "מכרזים כקובצי PDF — כותרות קצרות (מספר/שנה)" }),
  // בית חולים שיבא — הרשימה נטענת ב-JS; מכרזיו הפומביים מתפרסמים ממילא
  // בפורטל הרכש הממשלתי (mr.gov.il) שכבר במאגר. מושבת עד למיפוי ה-API.
  { id: "sheba", name: "שיבא תל השומר — מכרזים", publisher: "המרכז הרפואי שיבא", enabled: false,
    note: "אתר JS/SPA — הרשימה אינה ב-HTML הגולמי; מכוסה חלקית דרך פורטל הרכש הממשלתי", run: async () => [] },

  // ---------- תשתיות, אנרגיה, מים וחברות ממשלתיות ----------
  genericSource("ingl", 'נתג"ז — נתיבי הגז הטבעי', "נתיבי הגז הטבעי לישראל", [
    "https://www.ingl.co.il/tenders/",
  ], { hrefMatch: /tender/i, note: "רשימה מובנית היטב — מכרזים פתוחים/סגורים עם קבצים מצורפים" }),
  genericSource("ashdod-port", "נמל אשדוד — מכרזים", "חברת נמל אשדוד", [
    "https://www.ashdodport.co.il/about/opportunities/pages/tenders.aspx",
  ], { enabled: false, hrefMatch: /tender|opportunit/i, note: "חסימת cloud ברמת רשת (reset/timeout גם דרך IL_PROXY_URL ב-Oracle IL, אומת 27.08.2026) — עובד רק מ-IP ביתי" }),
  genericSource("israports", 'חברת נמלי ישראל — חנ"י', "חברת נמלי ישראל", [
    "https://www.israports.co.il/he/TendersRegistration/Pages/default.aspx",
  ], { enabled: false, hrefMatch: /TenderPage|no=|Tenders/i, note: "חסימת cloud ברמת רשת (reset/timeout גם דרך IL_PROXY_URL ב-Oracle IL, אומת 27.08.2026) — עובד רק מ-IP ביתי" }),
  genericSource("amigour", "עמיגור — מכרזים ופרסומים", "עמיגור ניהול נכסים", [
    proxied("https://www.amigour.co.il/tenders/"),
  ], { hrefMatch: /\.pdf|prdFiles/i, note: "מכרזים כ-PDF תחת /prdFiles/" }),
  // חסומי WAF/גיאו לשרת חו"ל — ידרשו IL_PROXY_URL
  genericSource("haifa-port", "נמל חיפה — מכרזים", "חברת נמל חיפה", [
    proxied("https://www.haifaport.co.il/tenders/"),
  ], { enabled: false, hrefMatch: /\/tender|engagements|annonce|\.pdf/i, note: "13.09.2026: 403 דרך IL_PROXY_URL (קודם נטען ריק) — ה-IP של הפרוקסי כנראה סומן" }),
  genericSource("transisrael", "חוצה ישראל (כביש 6) — מכרזים", "חוצה ישראל", [
    proxied("https://www.transisrael.co.il/Tenders"),
  ], { enabled: true, hrefMatch: /tender/i, note: "נטען דרך IL_PROXY_URL — 19 פריטים (אומת 08.09.2026)" }),
  genericSource("amidar", "עמידר — מכרזים", "עמידר החברה הלאומית לשיכון", [
    proxied("https://www.amidar.co.il/wps/portal/amidar/applications/tenders"),
  ], { enabled: true, hrefMatch: /tender/i, note: "WebSphere /applications/tenders דרך IL_PROXY_URL — 4 פריטים (אומת 13.09.2026)" }),
  // קצא"א (EAPC) — אתר WordPress בטעינת JS; מכרזים כעמודי /hpirsum/ נפרדים.
  genericSource("eapc", 'קצא"א — מכרזים', 'קצא"א (EAPC)', [
    "https://www.eapc.co.il/conn/",
    proxied("https://www.eapc.co.il/conn/"),
  ], { enabled: false, hrefMatch: /hpirsum|tender|מכרז|\.pdf/i, note: "/conn/ נטען אך הרשימה נבנית ב-JS (13.09.2026) — נדרש מיפוי API" }),
  // דואר ישראל — מערכת Domino ישנה בתהליך מעבר ל-SPA; כניסה מפנה ל-SPA.
  { id: "israelpost", name: "דואר ישראל — מכרזים", publisher: "חברת דואר ישראל", enabled: false,
    note: "מעבר ל-SPA — נדרשת כתובת ה-view הישירה של mihrazim.nsf או ה-API החדש", run: async () => [] },

  // ---------- מוסדות להשכלה גבוהה ----------
  genericSource("huji", "האוניברסיטה העברית — מכרזים", "האוניברסיטה העברית בירושלים", [
    "https://tenders.huji.ac.il/bids/",
  ], { hrefMatch: /bids|tender/i }),
  genericSource("technion", "הטכניון — מכרזים", "הטכניון — מכון טכנולוגי לישראל", [
    "https://michrazim.technion.ac.il/tenders-list/",
  ], { hrefMatch: /tender/i }),
  genericSource("biu", 'בר-אילן — מכרזים', "אוניברסיטת בר-אילן", [
    "https://tiful.biu.ac.il/michrazim",
  ], { hrefMatch: /michrazim|node/i }),
  genericSource("bgu", 'בן-גוריון — מכרזים פומביים', "אוניברסיטת בן-גוריון בנגב", [
    "https://w3.bgu.ac.il/bengurionbids/bidsList.aspx?dep=100",
  ], { hrefMatch: /bid|Details/i }),
  genericSource("haifa-univ", "אוניברסיטת חיפה — מכרזים", "אוניברסיטת חיפה", [
    "https://tender.haifa.ac.il/index.php?option=com_content&view=category&id=12&Itemid=12",
  ], { hrefMatch: /com_content|Itemid|article/i }),
  genericSource("weizmann", "מכון ויצמן — מכרזים", "מכון ויצמן למדע", [
    "https://www.weizmann.ac.il/michrazim/public-tenders",
  ], { hrefMatch: /tender-details|michrazim/i }),
  genericSource("openu", "האוניברסיטה הפתוחה — מכרזים", "האוניברסיטה הפתוחה", [
    "https://www.openu.ac.il/bid/",
  ], { hrefMatch: /bid|michraz|shlifa/i, note: "דף נחיתה סטטי המקשר למערכת Oracle ישנה" }),
  genericSource("ariel", "אוניברסיטת אריאל — מכרזים", "אוניברסיטת אריאל בשומרון", [
    proxied("https://www.ariel.ac.il/wp/auctions-and-decisions/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/"),
  ], { hrefMatch: /auctions|tender|michraz/i, note: "WordPress מחזיר 573 תווים — אנטי-בוט (13.09.2026); לנסות דרך הפרוקסי" }),

  // ---------- תאגידים עירוניים, מים וחברות כלכליות ----------
  genericSource("mei-avivim", "מי אביבים — מכרזים פומביים", "מי אביבים", [
    "https://www.mei-avivim.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%A4%D7%95%D7%9E%D7%91%D7%99%D7%99%D7%9D/",
  ], { hrefMatch: /\/tender\//i }),
  genericSource("mei-carmel", "מי כרמל — מכרזים פתוחים", "מי כרמל", [
    "https://www.mei-carmel.co.il/category/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%A4%D7%AA%D7%95%D7%97%D7%99%D7%9D/",
  ], { hrefMatch: /tender|michraz/i }),
  genericSource("ezra-bitzaron", "עזרה וביצרון — מכרזים", "עזרה וביצרון", [
    "https://www.e-b.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/",
  ], { hrefMatch: /\.pdf|tender|michraz/i }),
  genericSource("ahuzot-hahof", "אחוזות החוף — מכרזים", "אחוזות החוף", [
    "https://www.ahuzot.co.il/tenders/",
  ], { hrefMatch: /tender/i, note: "ASP.NET — חלק מהקישורים postback; ייתכן קציר חלקי" }),
  genericSource("atarim", "אתרים — מכרזים", "חברת אתרים", [
    "https://www.atarim.gov.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/",
  ], { hrefMatch: /tender|michraz/i }),
  genericSource("yefenof", "יפה נוף — מכרזים", "יפה נוף תחבורה תשתיות ובנייה", [
    "https://www.yefenof.co.il/tenders",
  ], { hrefMatch: /Tender\?tenderID|tender/i }),
  genericSource("hagihon", "הגיחון — מכרזים פעילים", "תאגיד המים הגיחון", [
    proxied("https://www.hagihon.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%95%D7%A1%D7%A4%D7%A7%D7%99%D7%9D/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%A4%D7%A2%D7%99%D7%9C%D7%99%D7%9D/"),
  ], { enabled: true, hrefMatch: /tender|michraz/i, note: "נטען דרך IL_PROXY_URL — 4 מכרזים פעילים (אומת 08.09.2026)" }),
  genericSource("halat", 'ח.ל.ת נתניה — מכרזים', "ח.ל.ת החברה לפיתוח ותיירות נתניה", [
    proxied("https://www.halat.co.il/html5/?_id=12925&did=2300&g=12157&sm=12925"),
    proxied("https://www.halat.co.il/html5/?_id=15746&did=2300&g=12157&sm=15746"),
  ], { enabled: true, note: "CMS html5 ב-windows-1255 דרך IL_PROXY_URL — 16 פריטים (אומת 13.09.2026)" }),
  // מניב ראשון — SharePoint (List13) ללא עמוד אינדקס נקי; מושבת עד למיפוי.
  genericSource("meniv", "מניב ראשון — מכרזים", "מניב ראשון לציון", [
    proxied("https://www.meniv-rishon.co.il/pages/wanted.aspx"),
    "https://www.meniv-rishon.co.il/pages/wanted.aspx",
  ], { enabled: false, hrefMatch: /tender|מכרז|\.pdf|List/i, note: "pages/wanted.aspx — 502 דרך הפרוקסי ו-fetch failed ישירות (13.09.2026) — חסימת cloud; רץ ביתי" }),

  // ---------- תעשיות ביטחוניות ומקורות ממשלתיים נוספים ----------
  // סיב"ת — מִנהל הסחר החוץ-ביטחוני של משהב"ט (רשימה ציבורית מרונדרת-שרת)
  genericSource("modsibat", 'משהב"ט — סחר חוץ (סיב"ת)', "משרד הביטחון — סיב\"ת", [
    "https://www.online.mod.gov.il/Online2016/Pages/General/Sibat/TendersList.aspx?Reset=1",
  ], { match: /מכרז|בל["״]?מ|הצעות|RFP|RFI/, hrefMatch: /Tender|Sibat/i }),
  // התעשייה האווירית ורפאל — אין עמוד מכרזים פומבי; המכרזים רצים בפורטלים
  // סגורים (SourcingVision / iai-auction) בהזמנה אישית. מתועד כמושבת.
  { id: "iai", name: 'התעשייה האווירית — ספקים', publisher: "התעשייה האווירית לישראל", enabled: false,
    note: "אין רשימת מכרזים פומבית — מכרזים בפורטלי מכרז הפוך סגורים (התחברות)", run: async () => [] },
  { id: "rafael", name: "רפאל — ספקים", publisher: "רפאל מערכות לחימה מתקדמות", enabled: false,
    note: "אין רשימת מכרזים פומבית — מתפרסמים בערוצים ממשלתיים/משהב\"ט", run: async () => [] },
  // ילקוט הפרסומים / רשומות — Angular + PDF; נדרש רה-הנדוס של קריאת ה-collector
  { id: "reshumot", name: "ילקוט הפרסומים (רשומות)", publisher: "רשומות — ילקוט הפרסומים", enabled: false,
    note: "gov.il DynamicCollector (Angular) + PDF — נדרש מיפוי ה-API של האוסף", run: async () => [] },
  // ============================================================
  //  גל חמישי — עיריות גדולות, מכללות ומוסדות ציבור נוספים.
  //  עיריות/גופי ציבור עטופים ב-proxied() (מוגני WAF נפוצים);
  //  אקדמיה נטענת ישירות. server-html = enabled; JS/WAF = disabled.
  // ============================================================

  // ---------- עיריות גדולות ----------
  genericSource("haifa-muni", "עיריית חיפה — מכרזים", "עיריית חיפה", [
    proxied("https://www2.haifa.muni.il/Michrazim/Default.aspx"),
  ], { hrefMatch: /Michrazim|TendersFiles|\.pdf/i, note: "ASP.NET — עוגנים במרכאות בודדות/PDF תחת /Michrazim/TendersFiles; תמיכה במרכאות בודדות נוספה 13.09.2026" }),
  genericSource("rishon-muni", "עיריית ראשון לציון — מכרזים", "עיריית ראשון לציון", [
    proxied("https://www.rishonlezion.muni.il/Activities/Tenders/Pages/Contracting_tenders.aspx"),
  ], { enabled: false, hrefMatch: /CustomDispForm|Tenders/i, note: "SharePoint — חסימת cloud ברמת רשת (reset/timeout גם דרך IL_PROXY_URL ב-Oracle IL, אומת 27.08.2026) — עובד רק מ-IP ביתי" }),
  genericSource("beersheva-muni", "עיריית באר שבע — מכרזים", "עיריית באר שבע", [
    proxied("https://www.beer-sheva.muni.il/City/FreeInfo/Rehesh/Pages/Bids.aspx"),
  ], { enabled: false, hrefMatch: /CustomDispForm|Rehesh|Bids/i, note: "SharePoint — חסימת cloud ברמת רשת (reset/timeout גם דרך IL_PROXY_URL ב-Oracle IL, אומת 27.08.2026) — עובד רק מ-IP ביתי" }),
  genericSource("holon-muni", "עיריית חולון — מכרזים", "עיריית חולון", [
    proxied("https://www.holon.muni.il/CityHall/Bids/Pages/default.aspx"),
  ], { hrefMatch: /CustomDispForm|Bids/i }),
  genericSource("ashdod-muni", "עיריית אשדוד — מכרזים פעילים", "עיריית אשדוד", [
    proxied("https://www.ashdod.muni.il/he-il/%D7%90%D7%AA%D7%A8-%D7%94%D7%A2%D7%99%D7%A8/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%A4%D7%A2%D7%99%D7%9C%D7%99%D7%9D/"),
  ], { hrefMatch: /tender|michraz/i, note: "טבלת מכרזים פעילים — ייתכן קציר חלקי אם התאים אינם עוגנים" }),
  genericSource("telaviv-muni", "עיריית תל אביב-יפו — מכרזים", "עיריית תל אביב-יפו", [
    proxied("https://www.tel-aviv.gov.il/AuctionAndCareers/Pages/Service.aspx"),
  ], { enabled: true, hrefMatch: /Auction|tender|מכרז|\.pdf/i, note: "SharePoint AuctionAndCareers/Pages/Service.aspx דרך IL_PROXY_URL — 5 פריטים (אומת 13.09.2026)" }),
  genericSource("petahtikva-muni", "עיריית פתח תקווה — מכרזים", "עיריית פתח תקווה", [
    proxied("https://www.petah-tikva.muni.il/city-and-municipality/bids/bids"),
  ], { enabled: false, note: "F5 «Request Rejected» גם דרך IL_PROXY_URL (13.09.2026) — נדרש IP ביתי" }),
  genericSource("netanya-muni", "עיריית נתניה — מכרזים", "עיריית נתניה", [
    proxied("https://www.netanya.muni.il/CityHall/transparency/Tenders/Pages/default.aspx"),
  ], { enabled: true, hrefMatch: /TendersAndJobsList|\.pdf|מכרז/i, note: "SharePoint transparency/Tenders דרך IL_PROXY_URL — 12 פריטים (אומת 13.09.2026)" }),

  // ---------- מכללות ואוניברסיטאות נוספות ----------
  genericSource("sapir", "המכללה האקדמית ספיר — מכרזים", "המכללה האקדמית ספיר", [
    "https://www.sapir.ac.il/tenders",
  ], { hrefMatch: /tenders|sourcingvision/i }),
  genericSource("shenkar", "שנקר — מכרזים", "שנקר — הנדסה עיצוב אמנות", [
    "https://www.shenkar.ac.il/he/pages/tenders-shenkar/",
  ], { hrefMatch: /\.pdf|uploads|drive\.google/i, note: "מכרזים כ-PDF (חלק ב-Google Drive)" }),
  genericSource("hit", "HIT מכון טכנולוגי חולון — מכרזים", "מכון טכנולוגי חולון", [
    "https://www.hit.ac.il/tenders/",
  ], { hrefMatch: /\.pdf|tender/i }),
  genericSource("mta-college", "המכללה האקדמית ת\"א-יפו — מכרזים", "המכללה האקדמית תל אביב-יפו", [
    "https://www.mta.ac.il/tenders",
  ], { hrefMatch: /tender_|tenders|sourcingvision/i }),
  genericSource("braude", "אורט בראודה — מכרזים", "המכללה האקדמית להנדסה אורט בראודה", [
    "https://w3.braude.ac.il/about/tenders/",
  ], { hrefMatch: /\.pdf|tender/i, note: "אקורדיון — ייתכן קציר חלקי" }),
  genericSource("yvc", "המכללה האקדמית עמק יזרעאל — מכרזים", "המכללה האקדמית עמק יזרעאל", [
    "https://www.yvc.ac.il/tender/",
  ], { hrefMatch: /\/tender\//i }),
  genericSource("ruppin", "מכללת רופין — מכרזים", "המרכז האקדמי רופין", [
    "https://www.ruppin.ac.il/tenders/the-list-of-tenders/",
    proxied("https://www.ruppin.ac.il/tenders/the-list-of-tenders/"),
  ], { enabled: false, hrefMatch: /tender|מכרז|\.pdf/i, note: "גם עמוד הרשימה הישיר מחזיר מעטפת של ~580 תווים (אנטי-בוט/JS, 13.09.2026) — נדרש רינדור/רץ ביתי" }),

  // ---------- גופי ממשלה וציבור נוספים ----------
  genericSource("parks", "רשות הטבע והגנים — מכרזים", "רשות הטבע והגנים", [
    proxied("https://www.parks.org.il/tender/"),
  ], { hrefMatch: /\/tender\//i, note: "ארכיון WordPress מרונדר-שרת (חלופה ל-SPA ב-/tenders/)" }),
  genericSource("rmi-rechesh", "רמ\"י — מכרזי רכש והתקשרות", "רשות מקרקעי ישראל", [
    proxied("https://land.gov.il/Pages/Tenders.aspx"),
  ], { hrefMatch: /DispForm|Tenders/i, note: "land.gov.il מחזיר דף ריק (3K) דרך הפרוקסי — כנראה חסימה שקטה (13.09.2026); נדרש IP אחר/רץ ביתי" }),
  genericSource("eilat-port", "נמל אילת — מכרזים", "חברת נמל אילת", [
    "https://eilatport.co.il/tenders/",
  ], { hrefMatch: /\.pdf|tender/i, note: "נפח נמוך, מכרזים כ-PDF" }),


  // ============================================================
  //  גל חמישי (ספטמבר 2026) — מועמדים חדשים. כולם enabled:false עד
  //  שבדיקה יבשה מ-Vercel (אדמין → «בדיקת מקורות») מאשרת שליפה בפועל.
  //  כתובות שסומנו «לאימות» הן משוערות לפי מבנה האתר המקובל — אם
  //  הבדיקה מחזירה 404 יש לתקן את הכתובת, לא למחוק את המקור.
  // ============================================================

  // ---------- פורטלים רוחביים וגופים לאומיים ----------
  { id: "gov-collector", name: "gov.il — אוסף המכרזים הממשלתי", publisher: "משרדי הממשלה (gov.il)", enabled: false,
    note: "DynamicCollector (Angular) — נדרש מיפוי ה-API של האוסף (DevTools → Network → api/DynamicCollector). מכסה משרדים בלי אתר מכרזים משלהם", run: async () => [] },
  genericSource("boi", "בנק ישראל — מכרזים", "בנק ישראל", [
    "https://www.boi.org.il/bank-of-israel/tenders/",
  ], { enabled: false, hrefMatch: /\/tenders\/|מכרז/i, note: "Radware JS-challenge (13.09.2026) — נדרש רינדור דפדפן/רץ ביתי" }),
  genericSource("knesset", "הכנסת — מכרזים", "הכנסת", [
    "https://main.knesset.gov.il/About/KnessetWork/Pages/Tenders.aspx",
    "https://main.knesset.gov.il/About/Tenders/Pages/default.aspx",
  ], { enabled: false, hrefMatch: /KnessetWork\/Tender\/|\.pdf/i, note: "הכתובות מחזירות 577 תווים (הפניה/JS) — 13.09.2026; לאתר את עמוד הרשימה האמיתי" }),
  genericSource("kan", "תאגיד השידור «כאן» — מכרזים", "תאגיד השידור הישראלי", [
    "https://www.kan.org.il/tenders/",
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "403 גם ישירות וגם דרך IL_PROXY_URL (08.09.2026) — עובד רק מ-IP ביתי" }),
  genericSource("jewish-agency", "הסוכנות היהודית — מכרזים", "הסוכנות היהודית לארץ ישראל", [
    "https://app.vendors.co.il/jewishagency/michrazim",
    "https://www.jewishagency.org/il/tenders/",
  ], { enabled: false, hrefMatch: /michrazim\/[0-9a-f]{12,}$/i, note: "Arma (app.vendors.co.il) — הקישורים נשלפים אך הכותרת היא «קישור להגשה» (13.09.2026); נדרש קוצר ייעודי שלוקח כותרת מההקשר" }),
  genericSource("yadvashem", "יד ושם — מכרזים", "יד ושם", [
    proxied("https://yvservices.yadvashem.org/he/tenders"),
  ], { enabled: false, hrefMatch: /tender|מכרז|\.pdf/i, note: "yvservices — SPA, ה-HTML ריק (אומת באבחון 13.09.2026); נדרש מיפוי API" }),

  // ---------- תשתיות, אנרגיה, סביבה ----------
  genericSource("noga", "נוגה — ניהול המערכת: מכרזים", "נוגה — ניהול מערכת החשמל", [
    "https://www.noga-iso.co.il/procurement-lobby/tenders/",
    proxied("https://www.noga-iso.co.il/procurement-lobby/tenders/"),
  ], { enabled: true, hrefMatch: /tender|מכרז|\.pdf/i, note: "נטען ישירות — 3 מכרזים (אומת 13.09.2026)" }),
  genericSource("pei", 'תש"ן — תשתיות נפט ואנרגיה: מכרזים', 'תש"ן', [
    proxied("https://www.pei.co.il/tenders/"),
  ], { enabled: true, hrefMatch: /tender|מכרז/i, note: "עבד דרך IL_PROXY_URL (16 פריטים, 08.09) — 13.09.2026: 403 דרך הפרוקסי; ה-IP של הפרוקסי כנראה סומן" }),
  genericSource("escil", "החברה לשירותי איכות הסביבה — מכרזים", "החברה לשירותי איכות הסביבה", [
    "https://enviro-services.co.il/blog/category/tender/active-tenders/",
  ], { enabled: true, hrefMatch: /\/blog\/tender\//i, note: "WordPress enviro-services.co.il — קטגוריית «מכרזים פעילים» בלבד (אומת 08.09.2026)" }),
  genericSource("moriah", "מוריה — חברת הפיתוח של ירושלים", "מוריה", [
    proxied("https://www.moriah.co.il/suppliers/"),
    proxied("https://www.moriah.co.il/tender_cat/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/"),
  ], { enabled: true, hrefMatch: /tender|מכרז|\.pdf/i, note: "WordPress דרך IL_PROXY_URL — 13 פריטים (אומת 13.09.2026); מפרסמת גם בדקל" }),
  genericSource("pami", 'פמ"י — פיתוח מזרח ירושלים', 'פמ"י', [
    "https://www.pami.co.il/he/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/",
  ], { enabled: true, hrefMatch: /tender|מכרז/i, note: "החזיר 2–3 פריטים (08–13.09) אך לעיתים מסמך זעיר (213 תווים) — תגובה לא יציבה, לעקוב" }),
  genericSource("jtmt", "תוכנית אב לתחבורה ירושלים — מכרזים", "צוות תוכנית אב לתחבורה ירושלים", [
    proxied("https://jet.gov.il/tenders/"),
    proxied("https://jet.gov.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/"),
  ], { enabled: false, hrefMatch: /tenders-\d/i, note: "13.09.2026: 502 דרך IL_PROXY_URL, fetch failed ישירות — לאבחון" }),

  // ---------- רשויות מקומיות גדולות שחסרות ----------
  // עיריית ירושלים מפרסמת גם בדקל (bids.dekel.co.il/jerusalemMuni) שכבר סרוק — כאן המקור הישיר.
  genericSource("jerusalem-muni", "עיריית ירושלים — מכרזים", "עיריית ירושלים", [
    "https://www.jerusalem.muni.il/he/city/tenders/",
    "https://www.jerusalem.muni.il/he/city/tenders/publictenders/",
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "403 גם ישירות וגם דרך IL_PROXY_URL (08.09.2026) — עובד רק מ-IP ביתי; מכוסה חלקית דרך דקל" }),
  genericSource("ramatgan-muni", "עיריית רמת גן — מכרזים", "עיריית רמת גן", [
    "https://www.ramat-gan.muni.il/michrazim-ramatgan/business-units/michrazim-public",
    "https://www.ramat-gan.muni.il/thecity/jobs/auctions/",
  ], { enabled: false, hrefMatch: /michrazim|auction|\.pdf|מכרז/i, note: "אפליקציית JS — ה-HTML ללא קישורים (אומת באבחון 13.09.2026); נדרש מיפוי API" }),
  genericSource("herzliya-muni", "עיריית הרצליה — מכרזים", "עיריית הרצליה", [
    proxied("https://www.herzliya.muni.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf/i, note: "פלטפורמה עירונית — עד 11 פריטים (09.09.2026); ניווט ומשרות מסוננים לפי כותרת" }),
  genericSource("kfarsaba-muni", "עיריית כפר סבא — מכרזים", "עיריית כפר סבא", [
    proxied("https://www.kfar-saba.muni.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf/i, note: "פלטפורמה עירונית — עד 40 פריטים (09.09.2026); ניווט ומשרות מסוננים לפי כותרת" }),
  genericSource("raanana-muni", "עיריית רעננה — מכרזים", "עיריית רעננה", [
    proxied("https://www.raanana.muni.il/bids/"),
  ], { enabled: true, hrefMatch: /bids|tender|מכרז/i, note: "ארכיון מכרזים (WordPress) — 45 פריטים (אומת 08.09.2026)" }),
  genericSource("rehovot-muni", "עיריית רחובות — מכרזים", "עיריית רחובות", [
    proxied("https://www.rehovot.muni.il/bids/?categoryId=7"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf/i, note: "פלטפורמה עירונית — עד 8 פריטים (09.09.2026); ניווט ומשרות מסוננים לפי כותרת" }),
  genericSource("modiin-muni", "עיריית מודיעין-מכבים-רעות — מכרזים", "עיריית מודיעין", [
    proxied("https://www.modiin.muni.il/modiinwebsite/ChannelArticle.aspx?PageID=487_468"),
  ], { enabled: true, hrefMatch: /GlobalFiles|\.pdf/i, note: "ASP.NET דרך IL_PROXY_URL — נטען (13.09.2026); hrefMatch הוגבל ל-GlobalFiles/PDF כי ArticlePage תפס את כל האתר (320)" }),
  genericSource("batyam-muni", "עיריית בת ים — מכרזים", "עיריית בת ים", [
    proxied("https://www.bat-yam.muni.il/he/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf/i, note: "פלטפורמה עירונית — עד 58 פריטים (09.09.2026); ניווט ומשרות מסוננים לפי כותרת" }),
  genericSource("bneibrak-muni", "עיריית בני ברק — מכרזים", "עיריית בני ברק", [
    proxied("https://www.bnei-brak.muni.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf/i, note: "פלטפורמה עירונית — עד 75 פריטים (09.09.2026); ניווט ומשרות מסוננים לפי כותרת" }),
  genericSource("ashkelon-muni", "עיריית אשקלון — מכרזים", "עיריית אשקלון", [
    "https://ashkelon.muni.gov.il/he/%D7%94%D7%A2%D7%99%D7%A8%D7%99%D7%99%D7%94/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D",
  ], { enabled: false, hrefMatch: /\/media\/|\.pdf|מכרז/i, note: "Umbraco — הרשימה ב-JS (68K תווים, 0 עוגנים; 13.09.2026); נדרש מיפוי API" }),
  genericSource("hadera-muni", "עיריית חדרה — מכרזים", "עיריית חדרה", [
    proxied("https://www.ur-hadera.co.il/index.php?id=19"),
  ], { enabled: false, hrefMatch: /bids|tender|מכרז/i, note: "עמוד id=19 מכיל ניווט בלבד (13.09.2026) — המכרזים כנראה בטקסט/טבלה ללא קישורים; לבדוק ידנית" }),
  genericSource("eilat-muni", "עיריית אילת — מכרזים", "עיריית אילת", [
    proxied("https://www.eilat.muni.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf/i, note: "פלטפורמה עירונית — עד 16 פריטים (09.09.2026); ניווט ומשרות מסוננים לפי כותרת" }),
  genericSource("beitshemesh-muni", "עיריית בית שמש — מכרזים", "עיריית בית שמש", [
    proxied("https://betshemesh.muni.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf/i, note: "פלטפורמה עירונית — עד 27 פריטים (09.09.2026); ניווט ומשרות מסוננים לפי כותרת" }),
  genericSource("nazareth-muni", "עיריית נצרת — מכרזים", "עיריית נצרת", [
    proxied("https://www.nazareth.muni.il/tenders/"),
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "502 דרך IL_PROXY_URL (08.09.2026) — SharePoint, כנראה חסימת cloud; IP ביתי" }),

  // ---------- דיור ציבורי ----------
  genericSource("halamish", "חלמיש — מכרזים", "חלמיש — חברה ממשלתית עירונית לדיור", [
    "https://www.halamish.org/bids/",
    proxied("https://www.halamish.org/bids/"),
  ], { enabled: true, hrefOnly: true, hrefMatch: /\/bids\/\d|\.pdf/i, note: "halamish.org/bids/ — נטען (13.09.2026); רשימה ריקה כרגע, רק דפי /bids/NNN או PDF נקלטים" }),
  genericSource("prazot", "פרזות — מכרזים", "פרזות — חברה ממשלתית עירונית לשיכון ירושלים", [
    proxied("https://www.prazot.co.il/tenders/"),
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "לא נמצא אתר מכרזים פעיל (10.09.2026); פרסומים דרך gov.il/דקל — להשאיר מושבת" }),
  genericSource("shikmona", "שקמונה — מכרזים", "שקמונה — חברה ממשלתית עירונית לשיקום הדיור בחיפה", [
    proxied("https://www.shikmona-haifa.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/"),
  ], { enabled: false, hrefMatch: /tender|מכרז|\.pdf/i, note: "הדומיין הנכון shikmona-haifa.co.il (10.09.2026) — עמוד מכרזים משוער; לאימות" }),

  // ---------- בריאות ----------
  genericSource("assuta", "אסותא — מכרזים", "אסותא מרכזים רפואיים", [
    proxied("https://www.assuta.co.il/tenders/"),
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "403 גם ישירות וגם דרך IL_PROXY_URL (08.09.2026) — עובד רק מ-IP ביתי; הכתובת משוערת" }),
  genericSource("laniado", "לניאדו — מכרזים", "המרכז הרפואי לניאדו", [
    "https://www.laniado.org.il/tenders/",
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "ה-URL מחזיר את דף הבית (13.09.2026) — אין עמוד מכרזים; להשאיר מושבת" }),
  genericSource("mayanei", "מעייני הישועה — מכרזים", "המרכז הרפואי מעייני הישועה", [
    proxied("https://www.mymc.co.il/tenders/"),
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "לא נמצא עמוד מכרזים באתר (10.09.2026) — רק דרושים; להשאיר מושבת" }),

  // ---------- מכללות ----------
  genericSource("telhai", "מכללת תל-חי — מכרזים", "המכללה האקדמית תל-חי", [
    proxied("https://www.telhai.ac.il/tenders/"),
  ], { enabled: true, hrefMatch: /tender|מכרז/i, note: "נטען דרך IL_PROXY_URL — 13 פריטים (אומת 08.09.2026)" }),
  genericSource("kinneret", "המכללה האקדמית כנרת — מכרזים", "המכללה האקדמית כנרת", [
    proxied("https://www.kinneret.ac.il/tenders/"),
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "timeout דרך IL_PROXY_URL ו-403 ישירות (08.09.2026) — עובד רק מ-IP ביתי; הכתובת משוערת" }),
  genericSource("sce", "סמי שמעון (SCE) — מכרזים", "המכללה האקדמית להנדסה סמי שמעון", [
    proxied("https://www.sce.ac.il/tenders/"),
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "403 גם ישירות וגם דרך IL_PROXY_URL (08.09.2026) — עובד רק מ-IP ביתי; הכתובת משוערת" }),
  genericSource("jct", "מכון לב (JCT) — מכרזים", "המרכז האקדמי לב", [
    "https://www.jct.ac.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%95%D7%94%D7%95%D7%93%D7%A2%D7%95%D7%AA/",
  ], { enabled: true, hrefMatch: /מכרז|\.pdf/i, note: "נטען ישירות — 17 פריטים (אומת 08.09.2026)" }),
  genericSource("bezalel", "בצלאל — מכרזים", "בצלאל אקדמיה לאמנות ועיצוב", [
    "https://www.bezalel.ac.il/tenders/",
  ], { enabled: false, hrefMatch: /tender|מכרז/i, note: "לא נמצא עמוד מכרזים ציבורי באתר (08.09.2026) — כנראה מפרסמים רק בעיתונות/מייל; להשאיר מושבת" }),
  genericSource("wingate", "מכון וינגייט — מכרזים", "מכון וינגייט", [
    "https://wingate.org.il/tender_type/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%A4%D7%A2%D7%99%D7%9C%D7%99%D7%9D/",
  ], { enabled: true, hrefMatch: /\/tenders\//i, note: "נטען ישירות — 9 מכרזים פעילים (אומת 08.09.2026)" }),
  // ============================================================
  //  גל 6 (13.09.2026): מועמדים מקובץ «מפת מקורות וקישורים» — 63 עמודי
  //  מכרזים שאותרו (מועצות אזוריות, תאגידי מים, רשויות ניקוז, מכללות,
  //  בתי חולים, חברות ממשלתיות). כולם מושבתים עד אימות בבודק המקורות.
  // ============================================================

  // ---------- רשויות מקומיות ----------
  genericSource("ofaqim-muni", "עיריית אופקים — מכרזים", "עיריית אופקים", [
    proxied("https://www.ofaqim.muni.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 8 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("harish-muni", "עיריית חריש — מכרזים", "עיריית חריש", [
    proxied("https://www.harish.muni.il/cityservices/info/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 41 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("tiberias-muni", "עיריית טבריה — מכרזים", "עיריית טבריה", [
    proxied("https://www.tiberias.muni.il/council_services/toshav/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 4 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("lod-muni", "עיריית לוד — מכרזים", "עיריית לוד", [
    "https://www.lod.muni.il/bids/",
  ], { enabled: false, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "timeout דרך הפרוקסי (13.09.2026) — נוסה ישירות" }),
  genericSource("nahariya-muni", "עיריית נהריה — מכרזים", "עיריית נהריה", [
    "https://www.nahariya.muni.il/bids/",
  ], { enabled: false, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "timeout דרך הפרוקסי (13.09.2026) — נוסה ישירות" }),
  genericSource("nof-hagalil-muni", "עיריית נוף הגליל — מכרזים", "עיריית נוף הגליל", [
    proxied("https://www.nof-hagalil.muni.il/duplicated-1630576171/"),
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 18 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("arad-muni", "עיריית ערד — מכרזים", "עיריית ערד", [
    proxied("https://www.arad.muni.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 10 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("ramle-muni", "עיריית רמלה — מכרזים", "עיריית רמלה", [
    proxied("https://ramle.org.il/446/"),
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 6 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),

  // ---------- מועצות אזוריות ----------
  genericSource("arava-rc", "מועצה אזורית הערבה התיכונה — מכרזים", "מועצה אזורית הערבה התיכונה", [
    proxied("https://www.arava.co.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 11 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("ma-tamar-rc", "מועצה אזורית תמר — מכרזים", "מועצה אזורית תמר", [
    proxied("https://www.ma-tamar.org.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 6 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("eshkol-rc", "מועצה אזורית אשכול — מכרזים", "מועצה אזורית אשכול", [
    "https://eshkol.info/bids/",
  ], { enabled: false, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "403 דרך הפרוקסי (13.09.2026) — נוסה ישירות" }),
  genericSource("bns-rc", "מועצה אזורית בני שמעון — מכרזים", "מועצה אזורית בני שמעון", [
    proxied("https://www.bns.org.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 33 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("lachish-rc", "מועצה אזורית לכיש — מכרזים", "מועצה אזורית לכיש", [
    "https://lachish.org.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/",
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 249 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("hrhevron-rc", "מועצה אזורית הר חברון — מכרזים", "מועצה אזורית הר חברון", [
    proxied("https://www.hrhevron.co.il/2153/"),
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 3 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("hof-ashkelon-rc", "מועצה אזורית חוף אשקלון — מכרזים", "מועצה אזורית חוף אשקלון", [
    proxied("https://www.hof-ashkelon.org.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 4 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("shaffir-rc", "מועצה אזורית שפיר — מכרזים", "מועצה אזורית שפיר", [
    proxied("https://www.shaffir.org.il/195/"),
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 4 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("yoav-rc", "מועצה אזורית יואב — מכרזים", "מועצה אזורית יואב", [
    proxied("https://www.yoav.org.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/"),
  ], { enabled: false, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "403 ישירות (13.09.2026) — נוסה דרך הפרוקסי" }),
  genericSource("beer-tuvia-rc", "מועצה אזורית באר טוביה — מכרזים", "מועצה אזורית באר טוביה", [
    proxied("https://beer-tuvia.org.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 19 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("m-yehuda-rc", "מועצה אזורית מטה יהודה — מכרזים", "מועצה אזורית מטה יהודה", [
    proxied("https://www.m-yehuda.org.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 20 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("gderot-rc", "מועצה אזורית גדרות — מכרזים", "מועצה אזורית גדרות", [
    proxied("https://www.gderot.muni.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 2 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("hevel-yavne-rc", "מועצה אזורית חבל יבנה — מכרזים", "מועצה אזורית חבל יבנה", [
    proxied("https://www.hevel-yavne.org.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 7 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("brener-rc", "מועצה אזורית ברנר — מכרזים", "מועצה אזורית ברנר", [
    proxied("https://www.brener.org.il/955/"),
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 6 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("ganrave-rc", "מועצה אזורית גן רווה — מכרזים", "מועצה אזורית גן רווה", [
    proxied("https://www.ganrave.org.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 36 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("gezer-region-rc", "מועצה אזורית גזר — מכרזים", "מועצה אזורית גזר", [
    proxied("https://gezer-region.muni.il/bids/?category=4"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 175 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("hof-hasharon-rc", "מועצה אזורית חוף השרון — מכרזים", "מועצה אזורית חוף השרון", [
    proxied("https://hof-hasharon.co.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 37 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("lev-hasharon-rc", "מועצה אזורית לב השרון — מכרזים", "מועצה אזורית לב השרון", [
    proxied("https://www.lev-hasharon.com/348/"),
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 4 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("hefer-rc", "מועצה אזורית עמק חפר — מכרזים", "מועצה אזורית עמק חפר", [
    proxied("https://www.hefer.org.il/bids/?category=3"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 5 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("menashe-rc", "מועצה אזורית מנשה — מכרזים", "מועצה אזורית מנשה", [
    proxied("https://www.menashe.co.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 22 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("megiddo-rc", "מועצה אזורית מגידו — מכרזים", "מועצה אזורית מגידו", [
    proxied("https://www.megiddo.org.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 5 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("hof-hacarmel-rc", "מועצה אזורית חוף הכרמל — מכרזים", "מועצה אזורית חוף הכרמל", [
    proxied("https://www.hof-hacarmel.co.il/183/"),
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 23 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("emekyizrael-rc", "מועצה אזורית עמק יזרעאל — מכרזים", "מועצה אזורית עמק יזרעאל", [
    proxied("https://www.emekyizrael.org.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 32 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("hagilboa-rc", "מועצה אזורית הגלבוע — מכרזים", "מועצה אזורית הגלבוע", [
    proxied("https://www.hagilboa.org.il/308/"),
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 7 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("bustanelmarg-rc", "מועצה אזורית בוסתאן אל מרג׳ — מכרזים", "מועצה אזורית בוסתאן אל מרג׳", [
    proxied("https://www.bustanelmarg.muni.il/about/info/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 13 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),

  // ---------- תאגידי מים ----------
  genericSource("mei-hari-nazareth", "הרי נצרת — מכרזים", "הרי נצרת", [
    proxied("https://www.hari-nazareth.org.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 20 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("mei-mono", "מי אונו — מכרזים", "מי אונו", [
    "https://www.mono.org.il/?CategoryID=252",
  ], { enabled: true, hrefMatch: /ItemID=|\.pdf/i, note: "גל 6 — 83 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("mei-barak", "מי ברק — מכרזים", "מי ברק", [
    "https://www.mei-barak.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%A4%D7%95%D7%9E%D7%91%D7%99%D7%99%D7%9D/",
  ], { enabled: false, hrefMatch: /\/tenders\/./i, note: "עוגני «לפרטים» → דפי /tenders/ (כותרת מההקשר/slug, 13.09.2026) — לאימות" }),
  genericSource("mei-bat-yam", "מי בת ים — מכרזים", "מי בת ים", [
    "https://www.mei-bat-yam.co.il/?CategoryID=246",
  ], { enabled: true, hrefMatch: /ItemID=|\.pdf/i, note: "גל 6 — 56 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("mei-givatayim", "מי גבעתיים — מכרזים", "מי גבעתיים", [
    proxied("https://mei-givatayim.co.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 9 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("mei-megalil", "מי גליל — מכרזים", "מי גליל", [
    "https://megalil.co.il/bids/",
  ], { enabled: false, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "timeout דרך הפרוקסי (13.09.2026) — נוסה ישירות" }),
  genericSource("mei-hahar", "מי ההר — מכרזים", "מי ההר", [
    "https://mei-hahar.co.il/%D7%93%D7%A8%D7%95%D7%A9%D7%99%D7%9D-%D7%95%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D",
  ], { enabled: false, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "העמוד מכיל ניווט בלבד (13.09.2026) — לאתר עמוד רשימה" }),
  genericSource("mey-herz", "מי הרצליה — מכרזים", "מי הרצליה", [
    "https://www.mey-herz.co.il/מכרזים/",
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 6 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("mei-hatanur", "מי התנור — מכרזים", "מי התנור", [
    proxied("https://www.hatanur.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D"),
  ], { enabled: false, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "403 ישירות (13.09.2026) — נוסה דרך הפרוקסי" }),
  genericSource("mei-hadera", "מי חדרה — מכרזים", "מי חדרה", [
    proxied("https://www.mei-hadera.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%95%D7%94%D7%A6%D7%A2%D7%95%D7%AA"),
  ], { enabled: false, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "403 ישירות (13.09.2026) — נוסה דרך הפרוקסי" }),

  // ---------- חברות וגופים ציבוריים ----------
  genericSource("tarbut-hadiur", "האגודה לתרבות הדיור — מכרזים", "האגודה לתרבות הדיור", [
    "https://www.tarbut-hadiur.gov.il/content/20393",
  ], { enabled: false, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "80 קישורים, אף אחד לא מכרז (13.09.2026) — לאתר עמוד רשימה" }),
  genericSource("igtc", "החברה הממשלתית לתיירות — מכרזים", "החברה הממשלתית לתיירות", [
    "https://igtc.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/",
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 3 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("matnasim", "החברה למתנ״סים — מכרזים", "החברה למתנ״סים", [
    "https://www.matnasim.org.il/messages",
  ], { enabled: false, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "עמוד הודעות ענק (1.9MB) ללא קישורי מכרז (13.09.2026) — לאתר עמוד ייעודי" }),
  genericSource("travelrova", "החברה לשיקום ולפיתוח הרובע היהודי — מכרזים", "החברה לשיקום ולפיתוח הרובע היהודי", [
    "https://travelrova.co.il/michrazim/",
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 28 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("kanat", "קנט – הקרן לביטוח נזקי טבע בחקלאות — מכרזים", "קנט – הקרן לביטוח נזקי טבע בחקלאות", [
    "https://www.kanat.co.il/tenders/active-tenders/",
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 4 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("rotemi", "רותם תעשיות — מכרזים", "רותם תעשיות", [
    "https://www.rotemi.co.il/tenders/",
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 1 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("osh", "המוסד לבטיחות ולגיהות — מכרזים", "המוסד לבטיחות ולגיהות", [
    "https://www.osh.org.il/heb/projects/.aspx",
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 16 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("sii", "מכון התקנים הישראלי — מכרזים", "מכון התקנים הישראלי", [
    "https://www.sii.org.il/he/tenders/",
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 29 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),

  // ---------- השכלה גבוהה ----------
  genericSource("afeka", "אפקה — מכרזים", "אפקה", [
    "https://www.afeka.ac.il/about-afeka/general-information/tenders/",
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 8 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("beitberl", "המכללה האקדמית בית ברל — מכרזים", "המכללה האקדמית בית ברל", [
    proxied("https://www.beitberl.ac.il/about-information/auctions/publicity/"),
  ], { enabled: false, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "fetch failed ישירות (13.09.2026) — נוסה דרך הפרוקסי" }),
  genericSource("smkb", "סמינר הקיבוצים — מכרזים", "סמינר הקיבוצים", [
    "https://www.smkb.ac.il/us/contact-us/biddings/bidding/",
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 61 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),

  // ---------- בריאות ----------
  genericSource("hymc", "הלל יפה — מכרזים", "הלל יפה", [
    "https://hymc.org.il/?CategoryID=360",
  ], { enabled: true, hrefMatch: /ItemID=|\.pdf/i, note: "גל 6 — 78 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("poria", "פוריה – המרכז הרפואי צפון — מכרזים", "פוריה – המרכז הרפואי צפון", [
    proxied("https://www.poria.org.il/?CategoryID=1944"),
  ], { enabled: false, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "403 ישירות (13.09.2026) — נוסה דרך הפרוקסי" }),

  // ---------- רשויות ניקוז ונחלים ----------
  genericSource("nikuzcarmel-nikuz", "רשות ניקוז ונחלים כרמל — מכרזים", "רשות ניקוז ונחלים כרמל", [
    "https://www.nikuzcarmel.co.il/tenders/",
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 11 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),
  genericSource("rnsharon-nikuz", "רשות ניקוז ונחלים שרון — מכרזים", "רשות ניקוז ונחלים שרון", [
    "https://rnsharon.org.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%95%D7%93%D7%A8%D7%95%D7%A9%D7%99%D7%9D/",
  ], { enabled: false, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "הכתובת הוחלפה לעמוד «מכרזים ודרושים» (13.09.2026) — לאימות" }),
  genericSource("yarkon-nikuz-nikuz", "רשות ניקוז ירקון — מכרזים", "רשות ניקוז ירקון", [
    proxied("https://yarkon-nikuz.org.il/index.php/bids-1/"),
  ], { match: /מכרז|קול קורא|מאגר|הצעות|בל"מ/, enabled: false, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "הפריטים הם «רישום למאגר…» — match הורחב (13.09.2026) — לאימות" }),
  genericSource("nikuz-nikuz", "רשות ניקוז ונחלים שורק לכיש — מכרזים", "רשות ניקוז ונחלים שורק לכיש", [
    "https://nikuz.org.il/he/tender/",
  ], { enabled: false, hrefMatch: /\/he\/tender\/./i, note: "עוגני «קרא עוד» → דפי /he/tender/ (כותרת מההקשר/slug, 13.09.2026) — לאימות" }),
  genericSource("besor-nikuz", "רשות ניקוז ונחלים שקמה בשור — מכרזים", "רשות ניקוז ונחלים שקמה בשור", [
    "https://www.besor.org.il/he/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%A4%D7%A2%D7%99%D7%9C%D7%99%D7%9D/",
  ], { enabled: false, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "העמוד מכיל ניווט בלבד — הרשימה כנראה ב-JS (13.09.2026)" }),
  genericSource("dsda-nikuz", "רשות ניקוז ים המלח — מכרזים", "רשות ניקוז ים המלח", [
    proxied("https://dsda.org.il/125/"),
  ], { enabled: true, hrefMatch: /tender|bid|מכרז|\.pdf|CategoryID|michraz/i, note: "גל 6 — 2 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),

  // ---------- חברות כלכליות ----------
  genericSource("c-hefer", "החברה הכלכלית עמק חפר — מכרזים", "החברה הכלכלית עמק חפר", [
    proxied("https://c-hefer.org.il/bids/"),
  ], { enabled: true, hrefMatch: /\/bids\/|\.pdf|מכרז/i, note: "גל 6 — 6 פריטים בבדיקה יבשה (אומת 13.09.2026)" }),

];

export interface SourceRunReport {
  id: string;
  name: string;
  ok: boolean;
  fetched: number;
  upserted: number;
  ms: number;
  error?: string;
  note?: string;
}

export async function runNewSourceScrapers(opts: { only?: string; dry?: boolean } = {}): Promise<SourceRunReport[]> {
  const targets = NEW_SOURCES.filter((s) => (opts.only ? s.id === opts.only : s.enabled));

  // הרצה מקבילה: בטור, מקורות חסומים "אוכלים" את תקציב הזמן בהמתנה
  // ומפילים את כל הריצה בטיים-אאוט של הפלטפורמה. במקביל — משך
  // הריצה נקבע ע"י המקור האיטי ביותר בלבד.
  const reports: SourceRunReport[] = await Promise.all(
    targets.map(async (s): Promise<SourceRunReport> => {
      const t0 = Date.now();
      try {
        const recs = await s.run();
        const clean = recs.filter((r) => r.title && r.title.length >= 8);
        let upserted = 0;
        if (!opts.dry && clean.length) {
          const res = await upsertTenders(clean);
          upserted = res.count;
        }
        return { id: s.id, name: s.name, ok: true, fetched: clean.length, upserted, ms: Date.now() - t0, note: s.note };
      } catch (e) {
        return { id: s.id, name: s.name, ok: false, fetched: 0, upserted: 0, ms: Date.now() - t0, error: redactSecrets(String(e)), note: s.note };
      }
    })
  );
  // מקורות מושבתים מדווחים גם הם, לשקיפות
  for (const s of NEW_SOURCES.filter((x) => !x.enabled && !opts.only)) {
    reports.push({ id: s.id, name: s.name, ok: false, fetched: 0, upserted: 0, ms: 0, error: "disabled", note: s.note });
  }
  return reports;
}
