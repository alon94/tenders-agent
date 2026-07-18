// ============================================================
//  scrapers/newSources — אדפטרים ל-10 המקורות החדשים
//
//  כל מקור רץ בבידוד מלא (try/catch + timeout) — כשל במקור אחד
//  לא חוסם את השאר. custom parser כשידוע מבנה, ו-fallback גנרי
//  תמיד. ?dry=1 מאפשר הרצת בדיקה בלי כתיבה ל-DB.
// ============================================================

import type { TenderRecord } from "../db";
import { upsertTenders } from "../db";
import { fetchText, fetchJson, harvestTenderLinks, rowsToRecords, heDateToIso, hashId, stripTags, proxied } from "./core";

export interface NewSource {
  id: string;
  name: string;
  publisher: string;
  enabled: boolean;
  note?: string;
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
        const label = title || `מכרז מקרקעין ${num}`;
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
  opts: { match?: RegExp; hrefMatch?: RegExp; enabled?: boolean; note?: string } = {}
): NewSource {
  return {
    id,
    name,
    publisher,
    enabled: opts.enabled ?? true,
    note: opts.note,
    run: async () => {
      const all: TenderRecord[] = [];
      const errors: string[] = [];
      for (const u of urls) {
        try {
          const html = await fetchText(u);
          all.push(...rowsToRecords(harvestTenderLinks(html, u, { match: opts.match, hrefMatch: opts.hrefMatch }), { id, publisher }));
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

export const NEW_SOURCES: NewSource[] = [
  { id: "rmi", name: 'רמ"י — מכרזי מקרקעין', publisher: "רשות מקרקעי ישראל", enabled: true, run: runRmi },
  { id: "mod", name: "משרד הביטחון — סחר אלקטרוני", publisher: "משרד הביטחון", enabled: true, run: runMod },
  genericSource("mashcal", 'משכ"ל', "החברה למשק וכלכלה של השלטון המקומי", [
    proxied("https://www.mashcal.co.il/our-tenders/"),
    proxied("https://www.mashcal.co.il/published-tenders/"),
  ], { hrefMatch: /tender/i, note: "הגנת בוטים ברמת רשת — ללא IL_PROXY_URL הבקשה צפויה להיכשל" }),
  genericSource("pais", "מפעל הפיס", "מפעל הפיס", [
    proxied("https://www.pais.co.il/tenders/"),
  ], { hrefMatch: /tender/i, note: "מוגן Imperva/Incapsula — ללא IL_PROXY_URL הבקשה צפויה להיכשל" }),
  genericSource("meuhedet", "קופת חולים מאוחדת", "קופת חולים מאוחדת", [
    "https://www.meuhedet.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D-%D7%A4%D7%A2%D7%99%D7%9C%D7%99%D7%9D/",
  ], {
    // שמות המכרזים באתר מאוחדת אינם מכילים את המילה "מכרז" — הזיהוי
    // לפי נתיב הקישור (עמודי פרט תחת /מכרזים/), בעברית או ב-URL-encoding
    hrefMatch: /מכרז|%D7%9E%D7%9B%D7%A8%D7%96/i,
  }),
  genericSource("maccabi", "מכבי שירותי בריאות", "מכבי שירותי בריאות", [
    "https://www.maccabi4u.co.il/bids/",
    "https://www.maccabi4u.co.il/new/bids/",
  ], { match: /מכרז|הצעת מחיר|הצעות|RFI|RFP/ }),
  genericSource("btl", "המוסד לביטוח לאומי", "המוסד לביטוח לאומי", [
    "https://www.btl.gov.il/About/tenders/Pages/default.aspx",
  ]),
  genericSource("iroads", "נתיבי ישראל", "נתיבי ישראל", [
    "https://www.iroads.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/",
  ]),
  genericSource("ayalon", "נתיבי איילון", "נתיבי איילון", [
    "https://www.ayalonhw.co.il/tenders/tenders-lobby/",
  ], { hrefMatch: /tender/i }),
  genericSource("iec", "חברת החשמל", "חברת החשמל לישראל", [
    "https://www.iec.co.il/content/suppliers/content-pages/tendersinfo",
  ], {
    enabled: false,
    note: "אתר חח\"י חסום לגלישה מחוץ לישראל — שרתי Vercel ייחסמו. להפעלה נדרש proxy ישראלי (משתנה סביבה IL_PROXY_URL).",
  }),
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
  const reports: SourceRunReport[] = [];
  const targets = NEW_SOURCES.filter((s) => (opts.only ? s.id === opts.only : s.enabled));
  for (const s of targets) {
    const t0 = Date.now();
    try {
      const recs = await s.run();
      // סינון היגיינה: כותרת מינימלית ו-id ייחודי
      const clean = recs.filter((r) => r.title && r.title.length >= 8);
      let upserted = 0;
      if (!opts.dry && clean.length) {
        const res = await upsertTenders(clean);
        upserted = res.count;
      }
      reports.push({ id: s.id, name: s.name, ok: true, fetched: clean.length, upserted, ms: Date.now() - t0, note: s.note });
    } catch (e) {
      reports.push({ id: s.id, name: s.name, ok: false, fetched: 0, upserted: 0, ms: Date.now() - t0, error: String(e), note: s.note });
    }
  }
  // מקורות מושבתים מדווחים גם הם, לשקיפות
  for (const s of NEW_SOURCES.filter((x) => !x.enabled && !opts.only)) {
    reports.push({ id: s.id, name: s.name, ok: false, fetched: 0, upserted: 0, ms: 0, error: "disabled", note: s.note });
  }
  return reports;
}
