import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function countExact(filter: string): Promise<number> {
  if (!SUPABASE_URL || !SERVICE_KEY) return -1;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tenders?${filter}&select=id&limit=1`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact" },
    cache: "no-store",
  });
  return parseInt((res.headers.get("content-range") || "/0").split("/")[1] || "0", 10);
}

// GET /api/admin/smallbiz-stats?secret=... (או Bearer של אדמין)
// פירוק מלא של מצב בדיקת העדפת עסקים קטנים — לאימות המונים.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const bySecret = url.searchParams.get("secret") === process.env.CRON_SECRET && !!process.env.CRON_SECRET;
  const admin = bySecret ? { email: "secret", role: "super" } : await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const today = new Date().toISOString().split("T")[0];
  const [total, activeCnt, expiredCnt, closedStatus, checked, foundTrue, foundFalse, checkedNull, uncheckedEligible, uncheckedNoBooklet, uncheckedPastDeadline] =
    await Promise.all([
      countExact(""),
      countExact(`or=(deadline.gte.${today},deadline.is.null)`),
      countExact(`deadline=lt.${today}`),
      countExact(`status=eq.${encodeURIComponent("סגור")}`),
      countExact("small_biz_checked_at=not.is.null"),
      countExact("small_biz=is.true"),
      countExact("small_biz=is.false"),
      countExact("small_biz_checked_at=not.is.null&small_biz=is.null"),
      countExact(`small_biz_checked_at=is.null&or=(publication_id.not.is.null,source.in.(iaa,maccabi))&or=(deadline.gte.${today},deadline.is.null)`),
      countExact("small_biz_checked_at=is.null&publication_id=is.null"),
      countExact(`small_biz_checked_at=is.null&publication_id=not.is.null&or=(deadline.lt.${today},deadline.is.null)`),
    ]);

  const p2 = encodeURIComponent;
  const [sweepMarked, noticeMarked, realErrors] = await Promise.all([
    countExact(`small_biz=is.null&small_biz_checked_at=not.is.null&small_biz_summary=like.${p2("לא ניתן לבדיקה%")}`),
    countExact(`small_biz=is.null&small_biz_checked_at=not.is.null&small_biz_summary=like.${p2("הודעת התקשרות%")}`),
    countExact(`small_biz=is.null&small_biz_checked_at=not.is.null&small_biz_summary=is.null`),
  ]);

  return NextResponse.json({
    "סה\"כ מכרזים במאגר": total,
    "פעילים (מועד עתידי או ללא מועד)": activeCnt,
    "לא פעילים (מועד הגשה עבר)": expiredCnt,
    "מסומנים בסטטוס סגור": closedStatus,
    "נבדקו (יש חותמת בדיקה)": checked,
    "מתוכם — נמצאה העדפה": foundTrue,
    "מתוכם — נבדקו ואין העדפה": foundFalse,
    "מתוכם — נבדקו ללא הכרעה (שגיאה/לא רלוונטי)": checkedNull,
    "טרם נבדקו — זכאים (יש חוברת + מועד עתידי)": uncheckedEligible,
    "טרם נבדקו — אין חוברת מכרז": uncheckedNoBooklet,
    "טרם נבדקו — יש חוברת אך פג המועד או ללא מועד (בעיקר פטורים)": uncheckedPastDeadline,
    "— פירוק 'ללא הכרעה' —": "",
    "סומנו ב-sweep (לא ברי-בדיקה)": sweepMarked,
    "הודעות פטור/התקשרות (דילוג מכוון)": noticeMarked,
    "כשל בשליפת חוברת (ניתן לנסות שוב)": realErrors,
    "— שיעורים —": "",
    "הכרעות אמיתיות (העדפה + ללא העדפה)": foundTrue + foundFalse,
    "אחוז העדפה מבין ההכרעות": foundTrue + foundFalse > 0 ? `${Math.round((foundTrue / (foundTrue + foundFalse)) * 100)}%` : "—",
  }, { headers: { "content-type": "application/json; charset=utf-8" } });
}
