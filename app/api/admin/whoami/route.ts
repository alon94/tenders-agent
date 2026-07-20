import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// GET /api/admin/whoami  (Authorization: Bearer <user token>)
// אבחון: מראה בדיוק היכן שרשרת ההרשאה נשברת — בלי לחשוף סודות.
export async function GET(req: Request) {
  const out: Record<string, unknown> = {
    env: {
      SUPABASE_URL: !!SUPABASE_URL,
      SERVICE_KEY: !!SERVICE_KEY,
      ANON_KEY: !!ANON_KEY,
    },
  };

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  out.tokenReceived = !!token;
  if (!token) return NextResponse.json({ ...out, verdict: "לא התקבל טוקן — הלקוח לא שולח Authorization" });
  if (!SUPABASE_URL) return NextResponse.json({ ...out, verdict: "חסר SUPABASE_URL בסביבה" });

  // 1) טוקן → מייל
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY || SERVICE_KEY || "", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  out.userLookupStatus = userRes.status;
  if (!userRes.ok) return NextResponse.json({ ...out, verdict: "אימות הטוקן מול Supabase נכשל" });
  const user = await userRes.json().catch(() => null);
  const email = user?.email;
  out.email = email || null;
  if (!email) return NextResponse.json({ ...out, verdict: "לא נמצא מייל בטוקן" });

  // 2) מייל → שורת admins (גם התאמה case-insensitive לאבחון)
  if (!SERVICE_KEY) return NextResponse.json({ ...out, verdict: "חסר SERVICE_ROLE_KEY" });
  const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

  const exact = await fetch(`${SUPABASE_URL}/rest/v1/admins?email=eq.${encodeURIComponent(email)}&select=email,role`, { headers: svc, cache: "no-store" });
  const exactRows = exact.ok ? await exact.json().catch(() => []) : [];
  out.exactMatch = exactRows;

  const ci = await fetch(`${SUPABASE_URL}/rest/v1/admins?email=ilike.${encodeURIComponent(email)}&select=email,role`, { headers: svc, cache: "no-store" });
  const ciRows = ci.ok ? await ci.json().catch(() => []) : [];
  out.caseInsensitiveMatch = ciRows;

  const allRes = await fetch(`${SUPABASE_URL}/rest/v1/admins?select=email,role`, { headers: svc, cache: "no-store" });
  out.allAdmins = allRes.ok ? await allRes.json().catch(() => []) : `status ${allRes.status}`;

  const verdict = exactRows?.[0]
    ? "תקין — אמור לעבוד"
    : ciRows?.[0]
    ? "אי-התאמת אותיות רישיות (case) בין המייל בטוקן למייל בטבלה"
    : "המייל אינו בטבלת admins — המיגרציה לא הריצה את ה-seed";
  return NextResponse.json({ ...out, verdict });
}
