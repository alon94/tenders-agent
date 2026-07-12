// Server-side helper for reading/writing the `tenders` table in Supabase.
// Uses plain fetch() against Supabase's PostgREST API so no extra npm
// dependency is required. Only ever import this from server-side code
// (API routes) - it uses the SUPABASE_SERVICE_ROLE_KEY which must never be
// exposed to the browser.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OBUDGET_API = "https://next.obudget.org/api/query";
const STATUSES = `('פורסם','עתידי','פורסם ולא התקבלו השגות','פורסם והתקבלו השגות','בעדכון')`;

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
    params.set("limit", String(limit));
    params.set("offset", String(offset));

  if (search) {
        const safe = search.replace(/[,()]/g, " ").trim();
        if (safe) {
                params.set("or", `(title.ilike.*${safe}*,publisher.ilike.*${safe}*)`);
        }
  }

  const res = await fetch(`${restUrl("/tenders")}?${params.toString()}`, {
        headers: authHeaders(),
        cache: "no-store",
  });

  if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Supabase query failed (${res.status}): ${text}`);
  }

  return (await res.json()) as TenderRecord[];
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

// Fetches the full current tender list from obudget (paginated) and upserts
// it into the `tenders` table. Called once a day from the cron route.
export async function syncTendersFromSources(): Promise<{ fetched: number; upserted: number }> {
    const MAX_PAGES = 10;
    let offset = 0;
    let fetched = 0;
    const records: TenderRecord[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
        const rows = await fetchObudgetPage(offset);
        fetched += rows.length;

      for (const row of rows) {
              if (row.description === "מכרז ללא כותרת") continue;
              records.push(rowToRecord(row));
      }

      if (rows.length < 1000) break;
        offset += 1000;
  }

  const { count } = await upsertTenders(records);
    return { fetched, upserted: count };
}
