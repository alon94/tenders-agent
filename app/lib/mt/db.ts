// ============================================================
// מיני־מכרז — גישה ל-Supabase (PostgREST) עם service role. שרת בלבד.
// אותו דפוס כמו app/lib/db.ts: fetch ישיר, בלי supabase-js.
// כל כתיבה לטבלאות mt_* עוברת מכאן; הלקוח מקבל SELECT דרך RLS בלבד.
// ============================================================
import { MtHttpError } from "./http";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function url(path: string) {
  if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
  return `${SUPABASE_URL}/rest/v1${path}`;
}
function headers(extra: Record<string, string> = {}): Record<string, string> {
  if (!SERVICE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra };
}

export class MtDbError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, ctx: string) {
    super(`db ${ctx}: ${status} ${typeof body === "string" ? body : JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

async function run<T>(path: string, init: RequestInit, ctx: string): Promise<T> {
  const res = await fetch(url(path), { cache: "no-store", ...init });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    // אילוצי DB (טריגרים/CHECK/UNIQUE) מתורגמים לתשובות 409 מובנות ללקוח
    const code = (body as { code?: string } | null)?.code;
    const msg = (body as { message?: string } | null)?.message || "";
    if (code === "23505") throw new MtHttpError(409, "duplicate", "כבר קיימת רשומה כזו");
    if (code === "23514" || code === "P0001") throw new MtHttpError(409, "invalid_state", msg.replace(/^mt: /, ""));
    throw new MtDbError(res.status, body, ctx);
  }
  return body as T;
}

/** SELECT — query הוא מחרוזת PostgREST אחרי שם הטבלה, למשל `?id=eq.X&select=*` */
export function dbSelect<T>(table: string, query: string): Promise<T[]> {
  return run<T[]>(`/${table}${query}`, { headers: headers() }, `select ${table}`);
}
export async function dbOne<T>(table: string, query: string): Promise<T | null> {
  const rows = await dbSelect<T>(table, query);
  return rows[0] ?? null;
}
export async function dbCount(table: string, query: string): Promise<number> {
  const res = await fetch(url(`/${table}${query}&select=id`), {
    headers: headers({ Prefer: "count=exact", "Range-Unit": "items", Range: "0-0" }), cache: "no-store",
  });
  const cr = res.headers.get("content-range") || "";
  const m = cr.match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}
export function dbInsert<T>(table: string, rows: unknown, opts: { upsertOn?: string } = {}): Promise<T[]> {
  const q = opts.upsertOn ? `?on_conflict=${opts.upsertOn}` : "";
  const prefer = opts.upsertOn ? "resolution=merge-duplicates,return=representation" : "return=representation";
  return run<T[]>(`/${table}${q}`, { method: "POST", headers: headers({ Prefer: prefer }), body: JSON.stringify(rows) }, `insert ${table}`);
}
export function dbUpdate<T>(table: string, filter: string, patch: unknown): Promise<T[]> {
  return run<T[]>(`/${table}${filter}`, { method: "PATCH", headers: headers({ Prefer: "return=representation" }), body: JSON.stringify(patch) }, `update ${table}`);
}
export function dbDelete(table: string, filter: string): Promise<unknown> {
  return run(`/${table}${filter}`, { method: "DELETE", headers: headers({ Prefer: "return=minimal" }) }, `delete ${table}`);
}
export function dbRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return run<T>(`/rpc/${fn}`, { method: "POST", headers: headers(), body: JSON.stringify(args) }, `rpc ${fn}`);
}

// ---------- Storage (Supabase) ----------
export const MT_BUCKET = "mt-attachments";
export async function storageSignedUpload(path: string): Promise<{ url: string; token: string }> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${MT_BUCKET}/${path}`, {
    method: "POST", headers: headers(), body: "{}",
  });
  if (!res.ok) throw new MtDbError(res.status, await res.text(), "storage sign upload");
  const data = (await res.json()) as { url?: string; token?: string };
  return { url: `${SUPABASE_URL}/storage/v1${data.url || ""}`, token: String(data.token || "") };
}
export async function storageSignedDownload(path: string, expiresIn = 600): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${MT_BUCKET}/${path}`, {
    method: "POST", headers: headers(), body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new MtDbError(res.status, await res.text(), "storage sign download");
  const data = (await res.json()) as { signedURL?: string };
  return `${SUPABASE_URL}/storage/v1${data.signedURL || ""}`;
}
export async function storageExists(path: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/info/${MT_BUCKET}/${path}`, { headers: headers() });
  return res.ok;
}

// ---------- GoTrue admin ----------
export const AUTH_URL = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1` : "";
export function authAdminHeaders() { return headers(); }
