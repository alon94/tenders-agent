// ============================================================
// מיני־מכרז — OTP ורישום מקוצר: hash לקוד, ויצירת/איתור משתמש GoTrue לפי טלפון.
// המשתמש נוצר עם מייל סינתטי (phone@otp.shaveh.local) וסיסמה אקראית שמתחלפת
// בכל אימות — כך אין סיסמה קבועה, ו-authClient בלקוח מקבל סשן רגיל.
// ============================================================
import { createHash, randomBytes } from "crypto";
import { AUTH_URL, authAdminHeaders, dbInsert } from "./db";

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const hashOtp = (phone: string, code: string) =>
  createHash("sha256").update(`${phone}:${code}:${process.env.MT_OTP_PEPPER || process.env.MT_CRON_SECRET || "mt"}`).digest("hex");

export const syntheticEmail = (phone: string) => `${phone}@otp.shaveh.local`;

interface GoTrueUser { id: string; email?: string; phone?: string }

async function findUserByEmail(email: string): Promise<GoTrueUser | null> {
  const res = await fetch(`${AUTH_URL}/admin/users?page=1&per_page=5&filter=${encodeURIComponent(email)}`, { headers: authAdminHeaders(), cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { users?: GoTrueUser[] };
  return data.users?.find((u) => (u.email || "").toLowerCase() === email.toLowerCase()) || null;
}

/** מוצא או יוצר משתמש לטלפון, מחליף סיסמה אקראית ומחזיר סשן. */
export async function sessionForPhone(phone: string, opts: { businessName?: string | null; contactName?: string | null; email?: string | null }) {
  const email = (opts.email || syntheticEmail(phone)).toLowerCase();
  const password = randomBytes(24).toString("base64url");
  let user = await findUserByEmail(email);
  let created = false;
  if (!user) {
    const res = await fetch(`${AUTH_URL}/admin/users`, {
      method: "POST", headers: authAdminHeaders(),
      body: JSON.stringify({ email, password, email_confirm: true, phone, phone_confirm: true,
        user_metadata: { mt_otp: true, business_name: opts.businessName || null, contact_name: opts.contactName || null } }),
    });
    if (!res.ok) throw new Error(`gotrue create user failed: ${res.status} ${await res.text()}`);
    user = (await res.json()) as GoTrueUser;
    created = true;
  } else {
    const res = await fetch(`${AUTH_URL}/admin/users/${user.id}`, { method: "PUT", headers: authAdminHeaders(), body: JSON.stringify({ password }) });
    if (!res.ok) throw new Error(`gotrue rotate password failed: ${res.status}`);
  }
  // פרופיל עסקי חלקי (upsert) — מסומן במקור otp
  await dbInsert("business_profiles", { user_id: user.id, email, categories: [], region: null, publisher_type: null, keywords: null }, { upsertOn: "user_id" }).catch(() => undefined);

  const login = await fetch(`${AUTH_URL}/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`gotrue login failed: ${login.status}`);
  const session = (await login.json()) as { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email: string } };
  return { session, created, userId: user.id, email };
}
