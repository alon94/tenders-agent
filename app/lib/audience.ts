// ============================================================
//  audience — מי מולנו: אורח או משתמש רשום.
//
//  מסע הלקוח: אורח רואה רק מכרזים שנסגרו (ארכיון-טעימה);
//  משתמש רשום רואה רק מכרזים פתוחים. ההבחנה נאכפת *בצד השרת*:
//  טוקן Supabase תקף בכותרת Authorization ⇒ member, אחרת guest.
//  הלקוח לא יכול "לבקש" פתוחים בלי טוקן — הפרמטרים לא מוסמכים.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export type Audience = 'guest' | 'member';

// אימות טוקן עולה ~100ms מול GoTrue — התוצאה נשמרת 5 דקות לכל טוקן.
const cache = new Map<string, { ok: boolean; at: number }>();
const TTL = 5 * 60_000;

export async function resolveAudience(req: Request): Promise<Audience> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !SUPABASE_URL) return 'guest';

  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < TTL) return hit.ok ? 'member' : 'guest';

  let ok = false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    ok = res.ok;
  } catch { ok = false; }
  if (cache.size > 2000) cache.clear();
  cache.set(token, { ok, at: Date.now() });
  return ok ? 'member' : 'guest';
}
