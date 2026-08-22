import { NextResponse } from "next/server";
import { issueAdminToken } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

// POST /api/admin/login { password }  → { token } | 401
// מסלול כניסה חלופי בסיסמה. דורש ADMIN_PASSWORD במשתני הסביבה.
export async function POST(req: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "כניסת סיסמה אינה מוגדרת (חסר ADMIN_PASSWORD)" }, { status: 501 });
  }
  // QA: issueAdminToken זורק כשאין מפתח חתימה (ראו adminSigningKey).
  // בלי הבדיקה הזו סיסמה *נכונה* הייתה מחזירה 500 בעוד סיסמה שגויה
  // מחזירה 401 — כלומר אורקל שמאפשר לפצח את הסיסמה לפי קוד הסטטוס,
  // ומבטל בדיוק את מה ש-safeEqual נועד למנוע. הבדיקה מתבצעת *לפני*
  // קריאת הסיסמה, כדי שהתשובה לא תוכל להיות תלויה בנכונותה.
  if (!process.env.ADMIN_TOKEN_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "כניסת סיסמה אינה מוגדרת (חסר ADMIN_TOKEN_SECRET)" },
      { status: 501 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const token = issueAdminToken(body?.password || "");
  if (!token) return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
  return NextResponse.json({ token });
}
