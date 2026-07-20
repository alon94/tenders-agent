import { NextResponse } from "next/server";
import { recordLoginEvent } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// POST /api/track-login  (Authorization: Bearer <user token>)
// נקרא מהלקוח אחרי התחברות מוצלחת — רושם אירוע כניסה לאנליטיקה.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !SUPABASE_URL) return NextResponse.json({ ok: false });
  // מאמתים שהטוקן אמיתי ושייך למשתמש — לא סומכים על מייל מהלקוח
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ ok: false });
  const user = await res.json().catch(() => null);
  if (user?.email) await recordLoginEvent(user.email);
  return NextResponse.json({ ok: true });
}
