// Server-side helper for reading/writing the `tenders` table in Supabase.
// Uses plain fetch() against Supabase's PostgREST API so no extra npm
// dependency is required. Only ever import this from server-side code
// (API routes) - it uses the SUPABASE_SERVICE_ROLE_KEY which must never be
// exposed to the browser.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OBUDGET_API = "https://next.obudget.org/api/query";
const STATUSES = `('פורסם','עתידי','פורסם ולא התקבלו השגות','פורסם והתקבלו השגות','בעדכון')`;

// פענוח ישויות HTML בטקסט (חלק מנתוני המקור מגיעים עם &#1513; וכד')
export function decodeEntities(s: string | null | undefined): string {
    if (!s) return "";
    return s
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
          .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();
}

function restUrl(path: string): string {
    if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL env var");
    return `${SUPABASE_URL}/rest/v1${path}`;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    if (!SERVICE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
    return {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          ...extra,
    };
}

export interface TenderRecord {
    id: string;
    tender_id?: string | null;
    publication_id?: string | null;
    title: string;
    publisher?: string | null;
    publisher_unit?: string | null;
    publish_date?: string | null;
    deadline?: string | null;
    status?: string | null;
    url?: string | null;
    type?: string | null;
    source?: string;
    fetched_at?: string;
    // שדות העדפת עסקים קטנים — נכתבים אך ורק ע"י תהליך 2 (/api/smallbiz)
    small_biz?: boolean | null;
    small_biz_summary?: string | null;
    small_biz_quote?: string | null;
    small_biz_confidence?: string | null;
    small_biz_checked_at?: string | null;
}

interface ObudgetRow {
    publication_id?: string | number | null;
    tender_id?: string | number | null;
    description?: string;
    publisher?: string;
    publisher_unit?: string;
    claim_date?: string;
    publication_date?: string;
    status?: string;
    page_url?: string;
    tender_type_he?: string;
}

// Upserts tenders into the `tenders` table in chunks (dedupes on `id`).
export async function upsertTenders(tenders: TenderRecord[]): Promise<{ count: number }> {
    if (tenders.length === 0) return { count: 0 };
    const CHUNK_SIZE = 500;
    let count = 0;

  for (let i = 0; i < tenders.length; i += CHUNK_SIZE) {
        const chunk = tenders.slice(i, i + CHUNK_SIZE);
        const res = await fetch(restUrl("/tenders?on_conflict=id"), {
                method: "POST",
                headers: authHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
                body: JSON.stringify(chunk),
        });

      if (!res.ok) {
              const text = await res.text().catch(() => "");
              throw new Error(`Supabase upsert failed (${res.status}): ${text}`);
      }

      count += chunk.length;
  }

  return { count };
}

// Reads tenders from the DB with optional search + pagination.
export async function getTenders(opts: { search?: string; offset?: number; limit?: number } = {}): Promise<TenderRecord[]> {
    const { search, offset = 0, limit = 1000 } = opts;

  const params = new URLSearchParams();
    params.set("select", "*");
    params.set("order", "publish_date.desc.nullslast,deadline.desc.nullslast");
      // Use Range headers for pagination (PostgREST / Supabase ignores
      // offset as a query param for large tables). Limit/offset are sent
      // via headers below.

  if (search) {
        const safe = search.replace(/[,()]/g, " ").trim();
        if (safe) {
                params.set("or", `(title.ilike.*${safe}*,publisher.ilike.*${safe}*)`);
        }
  }

  const res = await fetch(`${restUrl("/tenders")}?${params.toString()}`, {
        headers: authHeaders({ Range: `${offset}-${offset + limit - 1}`, "Range-Unit": "items" }),
        cache: "no-store",
  });

  if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Supabase query failed (${res.status}): ${text}`);
  }

  const rows = (await res.json()) as TenderRecord[];
  // פענוח ישויות HTML בקריאה — מכסה גם רשומות ישנות שנשמרו לפני התיקון
  return rows.map((r) => ({ ...r, title: decodeEntities(r.title), publisher: r.publisher ? decodeEntities(r.publisher) : r.publisher }));
}

// שליפת מכרז בודד לפי מזהה (לעמוד הפרטים — בעיקר למכרזים מוניציפליים)
export async function getTenderById(id: string): Promise<TenderRecord | null> {
    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("id", `eq.${id}`);
    params.set("limit", "1");
    const res = await fetch(`${restUrl("/tenders")}?${params.toString()}`, {
          headers: authHeaders(),
          cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as TenderRecord[];
    if (!rows[0]) return null;
    const r = rows[0];
    return { ...r, title: decodeEntities(r.title), publisher: r.publisher ? decodeEntities(r.publisher) : r.publisher };
}

async function fetchObudgetPage(offset: number): Promise<ObudgetRow[]> {
    const today = new Date().toISOString().split("T")[0];
    const cutoffDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const dateFilter = `(claim_date > '${today}' OR (claim_date IS NULL AND publication_date > '${cutoffDate}'))`;
    const cacheBuster = `AND '${Date.now()}' IS NOT NULL`;

  const sql = `SELECT publication_id, tender_id, description, publisher, publisher_unit, claim_date, publication_date, status, page_url, tender_type_he FROM procurement_tenders_all WHERE status IN ${STATUSES} AND ${dateFilter} ${cacheBuster} ORDER BY publication_date DESC NULLS LAST, claim_date DESC NULLS LAST LIMIT 1000 OFFSET ${offset}`;

  const res = await fetch(`${OBUDGET_API}?query=${encodeURIComponent(sql)}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
  });

  if (!res.ok) throw new Error(`Obudget API error: ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(String(data.error));
    if (!Array.isArray(data.rows)) throw new Error("Unexpected obudget response: missing rows");
    return data.rows as ObudgetRow[];
}

function rowToRecord(row: ObudgetRow): TenderRecord {
    const id = String(row.publication_id || row.tender_id || `${row.description}-${row.publisher}-${row.publication_date}`);
    return {
          id,
          tender_id: row.tender_id != null ? String(row.tender_id) : null,
          publication_id: row.publication_id != null ? String(row.publication_id) : null,
          title: String(row.description || ""),
          publisher: row.publisher ? String(row.publisher) : null,
          publisher_unit: row.publisher_unit ? String(row.publisher_unit) : null,
          publish_date: row.publication_date ? String(row.publication_date).split("T")[0] : null,
          deadline: row.claim_date ? String(row.claim_date).split("T")[0] : null,
          status: row.status ? String(row.status) : null,
          url: row.page_url ? String(row.page_url) : null,
          type: row.tender_type_he ? String(row.tender_type_he) : null,
          source: "obudget",
          fetched_at: new Date().toISOString(),
    };
}

// Municipal tenders from obudget's muni_tenders table (scraped from
// municipality websites). Different schema: publication_id is always "0",
// the stable key is tender_id (a hash), and open tenders have status 'פתוח'.
async function fetchMuniPage(offset: number): Promise<ObudgetRow[]> {
    const today = new Date().toISOString().split("T")[0];
    const cutoffDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const filter = `(claim_date > '${today}' OR status = 'פתוח' OR (claim_date IS NULL AND publication_date > '${cutoffDate}'))`;
    const cacheBuster = `AND '${Date.now()}' IS NOT NULL`;

  const sql = `SELECT publication_id, tender_id, description, publisher, publisher_unit, claim_date, publication_date, status, page_url, tender_type_he FROM muni_tenders WHERE ${filter} ${cacheBuster} ORDER BY publication_date DESC NULLS LAST, claim_date DESC NULLS LAST LIMIT 1000 OFFSET ${offset}`;

  const res = await fetch(`${OBUDGET_API}?query=${encodeURIComponent(sql)}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
  });

  if (!res.ok) throw new Error(`Obudget muni API error: ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(String(data.error));
    if (!Array.isArray(data.rows)) throw new Error("Unexpected obudget muni response: missing rows");
    return data.rows as ObudgetRow[];
}

function muniRowToRecord(row: ObudgetRow): TenderRecord {
    // publication_id is "0" for all muni rows - use the tender_id hash,
    // prefixed so it can never collide with government publication ids.
    const key = row.tender_id || `${row.description}-${row.publisher}-${row.publication_date}`;
    return {
          id: `muni-${key}`,
          tender_id: row.tender_id != null ? String(row.tender_id) : null,
          publication_id: null,
          title: decodeEntities(String(row.description || "")),
          publisher: row.publisher ? decodeEntities(String(row.publisher)) : null,
          publisher_unit: row.publisher_unit ? String(row.publisher_unit) : null,
          publish_date: row.publication_date ? String(row.publication_date).split("T")[0] : null,
          deadline: row.claim_date ? String(row.claim_date).split("T")[0] : null,
          status: row.status ? String(row.status) : null,
          url: row.page_url ? String(row.page_url) : null,
          type: row.tender_type_he ? String(row.tender_type_he) : "מכרז מוניציפלי",
          source: "muni",
          fetched_at: new Date().toISOString(),
    };
}

// --- mr.gov.il direct scraping -------------------------------------------
// The official procurement portal. Server-rendered HTML, 20 results per
// page, ordered by last-update date (newest first) - so scraping the first
// few pages daily captures everything that changed since the last run.
// Publication ids are identical to obudget's publication_id, so upserting
// with the same `id` keeps both sources fully in sync (the fresher
// mr.gov.il row overwrites the staler obudget mirror).

const MR_GOV_SEARCH = "https://mr.gov.il/ilgstorefront/he/search/?s=TENDER";

function heDateToIso(d: string | undefined): string | null {
    if (!d) return null;
    const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

interface MrGovRow {
    publication_id: string;
    title: string;
    publisher: string | null;
    status: string | null;
    publish_date: string | null;
    update_date: string | null;
    deadline: string | null;
}

function stripTags(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/\s+/g, " ").trim();
}

function parseMrGovSearchPage(html: string): MrGovRow[] {
    const rows: MrGovRow[] = [];
    // Each result contains a link to /ilgstorefront/he/p/<publication_id>
    // followed by a details block. Split on the product links.
    const parts = html.split(/href="[^"]*\/ilgstorefront\/he\/p\/(\d{6,})"/);
    // parts: [before, id1, chunk1, id2, chunk2, ...]
    for (let i = 1; i < parts.length - 1; i += 2) {
          const id = parts[i];
          const chunk = parts[i + 1];
          const text = stripTags(chunk.slice(0, 4000));

        // Title = text of the anchor itself (start of chunk up to closing tag)
        const titleMatch = chunk.match(/^[^>]*>([\s\S]*?)<\/a>/);
          const title = titleMatch ? stripTags(titleMatch[1]) : "";

        const publisher = (text.match(/שם המפרסם:\s*(.+?)\s*מס' פרסום/) || [])[1] || null;
          const status = (text.match(/סטטוס:\s*(.+?)\s*\|/) || [])[1] || null;
          const publishDate = (text.match(/תאריך פרסום:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1];
          const updateDate = (text.match(/תאריך עדכון:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1];
          const deadline = (text.match(/מועד אחרון להגשה:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1];

        if (!title) continue;
          // Skip duplicates within the same page (mobile+desktop markup)
          if (rows.some(r => r.publication_id === id)) continue;

        rows.push({
                publication_id: id,
                title,
                publisher: publisher ? publisher.trim() : null,
                status: status ? status.trim() : null,
                publish_date: heDateToIso(publishDate),
                update_date: heDateToIso(updateDate),
                deadline: heDateToIso(deadline),
        });
    }
    return rows;
}

async function fetchMrGovPage(page: number): Promise<MrGovRow[]> {
    const res = await fetch(`${MR_GOV_SEARCH}&page=${page}`, {
          headers: {
                Accept: "text/html",
                "User-Agent": "Mozilla/5.0 (compatible; TendersAgent/1.0; +https://tenders-agent.vercel.app)",
                "Accept-Language": "he",
          },
          cache: "no-store",
    });
    if (!res.ok) throw new Error(`mr.gov.il error: ${res.status}`);
    return parseMrGovSearchPage(await res.text());
}

function mrGovRowToRecord(row: MrGovRow): TenderRecord {
    return {
          id: row.publication_id,
          tender_id: null,
          publication_id: row.publication_id,
          title: row.title,
          publisher: row.publisher,
          publisher_unit: null,
          publish_date: row.publish_date,
          deadline: row.deadline,
          status: row.status,
          url: `https://mr.gov.il/ilgstorefront/he/p/${row.publication_id}`,
          type: null,
          source: "mr.gov.il",
          fetched_at: new Date().toISOString(),
    };
}

// Fetches the full current tender list from all sources (paginated) and
// upserts it into the `tenders` table. Called once a day from the cron route.
export async function syncTendersFromSources(): Promise<{
    fetched: number;
    upserted: number;
    muniFetched: number;
    mrGovFetched: number;
    mrGovNew: number;
    muniError?: string;
    mrGovError?: string;
}> {
    const MAX_PAGES = 10;
    let offset = 0;
    let fetched = 0;
    const byId = new Map<string, TenderRecord>();

  for (let page = 0; page < MAX_PAGES; page++) {
        const rows = await fetchObudgetPage(offset);
        fetched += rows.length;

      for (const row of rows) {
              if (row.description === "מכרז ללא כותרת") continue;
              const rec = rowToRecord(row);
              byId.set(rec.id, rec);
      }

      if (rows.length < 1000) break;
        offset += 1000;
  }

  // Municipal tenders - best-effort: a failure here must not block the
  // main government tender sync.
  let muniFetched = 0;
    let muniError: string | undefined;
    try {
          let muniOffset = 0;
          for (let page = 0; page < MAX_PAGES; page++) {
                const rows = await fetchMuniPage(muniOffset);
                muniFetched += rows.length;
                for (const row of rows) {
                      if (!row.description) continue;
                      const rec = muniRowToRecord(row);
                      byId.set(rec.id, rec);
                }
                if (rows.length < 1000) break;
                muniOffset += 1000;
          }
    } catch (err) {
          muniError = String(err);
    }

  // mr.gov.il - the live official portal, fresher than the obudget mirror.
    // Scrape the first pages (sorted by update date desc) and merge:
    // fresher fields win, but obudget-only fields (type, tender_id,
    // publisher_unit) are preserved. New ids not yet mirrored by obudget
    // are inserted as full records.
    const MR_GOV_PAGES = 25;      // 25 pages x 20 = up to 500 recently-updated tenders
    const MR_GOV_CONCURRENCY = 5; // fetch 5 pages in parallel per batch
    let mrGovFetched = 0;
    let mrGovNew = 0;
    let mrGovError: string | undefined;
    try {
          outer: for (let batchStart = 0; batchStart < MR_GOV_PAGES; batchStart += MR_GOV_CONCURRENCY) {
                const pageNums = Array.from(
                      { length: Math.min(MR_GOV_CONCURRENCY, MR_GOV_PAGES - batchStart) },
                      (_, i) => batchStart + i
                );
                const results = await Promise.all(pageNums.map(p => fetchMrGovPage(p)));

              let sawEmptyPage = false;
                for (const rows of results) {
                      if (rows.length === 0) { sawEmptyPage = true; continue; }
                      mrGovFetched += rows.length;
                      for (const row of rows) {
                            const existing = byId.get(row.publication_id);
                            if (existing) {
                                  // merge: mr.gov.il is fresher - overwrite live fields
                                  existing.title = row.title || existing.title;
                                  existing.publisher = row.publisher || existing.publisher;
                                  existing.status = row.status || existing.status;
                                  existing.publish_date = row.publish_date || existing.publish_date;
                                  existing.deadline = row.deadline || existing.deadline;
                                  existing.fetched_at = new Date().toISOString();
                            } else {
                                  byId.set(row.publication_id, mrGovRowToRecord(row));
                                  mrGovNew++;
                            }
                      }
                }
                if (sawEmptyPage) break outer; // reached the end of the result list
          }
    } catch (err) {
          mrGovError = String(err);
    }

  const { count } = await upsertTenders([...byId.values()]);
    return {
          fetched,
          upserted: count,
          muniFetched,
          mrGovFetched,
          mrGovNew,
          ...(muniError ? { muniError } : {}),
          ...(mrGovError ? { mrGovError } : {}),
    };
}
