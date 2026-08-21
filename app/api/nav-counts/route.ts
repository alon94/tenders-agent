import { NextResponse } from "next/server";
import { fetchActiveTenders } from "@/app/lib/agentEngine";
import { getLastSyncAt } from "@/app/lib/db";
import { isExempt } from "@/app/lib/tenderMeta";

export const dynamic = "force-dynamic";

// QA #05: קודם הספירות כאן נעשו ישירות מול ה-DB (9,475) בעוד הדשבורד
// ספר את המאגר הפעיל אחרי סינון כותרת/מועד (9,165) — ושני מספרים שונים
// הופיעו באותו מסך. עכשיו כולם נגזרים מאותו corpus (fetchActiveTenders),
// בדיוק כמו /api/tenders/search.
export async function GET() {
  try {
    const rows = await fetchActiveTenders();
    const active = rows.length;
    const exempt = rows.filter((r) => isExempt(r.type || "", r.title)).length;
    const smallbiz = rows.filter((r) => r.small_biz === true && (r.small_biz_confidence === "high" || r.small_biz_confidence === "medium")).length;
    const fetchedAt = await getLastSyncAt();
    return NextResponse.json(
      { active, exempt, smallbiz, fetchedAt },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json({ active: 0, exempt: 0, smallbiz: 0, fetchedAt: null }, { status: 200 });
  }
}
