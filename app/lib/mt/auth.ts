// ============================================================
// מיני־מכרז — אימות המשתמש בצד השרת (אפיון טכני סעיף 11).
// הטוקן מאומת מול GoTrue (/auth/v1/user) — אין פענוח JWT מקומי, אין תלות בסוד.
// Cache בזיכרון ל-60 שניות לכל טוקן כדי לא להכביד על GoTrue בכל בקשה.
// ============================================================
import { dbOne } from "./db";
import { forbidden, unauthorized } from "./http";
import { profileIsComplete, type BusinessProfileRow } from "./types";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export interface MtUser { userId: string; email: string; token: string }
export interface MtActor extends MtUser { profile: BusinessProfileRow | null }

const cache = new Map<string, { user: MtUser; exp: number }>();
const TTL_MS = 60_000;

export function bearer(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

export async function requireUser(req: Request): Promise<MtUser> {
  const token = bearer(req);
  if (!token) throw unauthorized();
  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) return hit.user;
  if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!res.ok) throw unauthorized("הסשן פג — יש להתחבר מחדש");
  const u = (await res.json().catch(() => null)) as { id?: string; email?: string } | null;
  if (!u?.id) throw unauthorized();
  const user: MtUser = { userId: u.id, email: String(u.email || ""), token };
  cache.set(token, { user, exp: Date.now() + TTL_MS });
  if (cache.size > 2000) cache.clear();
  return user;
}

export async function loadProfile(userId: string): Promise<BusinessProfileRow | null> {
  return dbOne<BusinessProfileRow>(
    "business_profiles",
    `?user_id=eq.${userId}&select=user_id,email,categories,category_other,region,publisher_type,keywords,mt_notify_mode`,
  );
}

/** משתמש מחובר + הפרופיל העסקי שלו (יכול להיות null) */
export async function requireActor(req: Request): Promise<MtActor> {
  const user = await requireUser(req);
  const profile = await loadProfile(user.userId);
  return { ...user, profile };
}

/** משתמש עם פרופיל עסקי מלא — תנאי סף לפרסום ולהגשה */
export async function requireCompleteProfile(req: Request): Promise<MtActor & { profile: BusinessProfileRow }> {
  const actor = await requireActor(req);
  if (!profileIsComplete(actor.profile)) {
    throw forbidden("כדי להשתמש במיני־מכרזים צריך להשלים פרופיל עסקי: תחום פעילות ואזור");
  }
  return actor as MtActor & { profile: BusinessProfileRow };
}

/** משתמש עם פרופיל כלשהו (גם חלקי) — מספיק להגשת הצעה למוזמן */
export async function requireProfile(req: Request): Promise<MtActor & { profile: BusinessProfileRow }> {
  const actor = await requireActor(req);
  if (!actor.profile) throw forbidden("נדרש פרופיל עסקי (גם חלקי) כדי להמשיך");
  return actor as MtActor & { profile: BusinessProfileRow };
}
