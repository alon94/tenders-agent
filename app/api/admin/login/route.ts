import { NextResponse } from "next/server";
import { issueAdminToken } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

// POST /api/admin/login { password }  → { token } | 401
// מסלול כניסה חלופי בסיסמה. דורש ADMIN_PASSWORD במשתני הסביבה.
export async function POST(req: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "כניסת סיסמה אינה מוגדרת (חסר ADMIN_PASSWORD)" }, { status: 501 });
  }
  const body = await req.json().catch(() => ({}));
  const token = issueAdminToken(body?.password || "");
  if (!token) return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
  return NextResponse.json({ token });
}
