import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function cnt(filter: string): Promise<number> {
  if (!SUPABASE_URL || !SERVICE_KEY) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tenders?${filter}&select=id&limit=1`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact" },
    cache: "no-store",
  });
  return parseInt((res.headers.get("content-range") || "/0").split("/")[1] || "0", 10);
}

// ספירות לסרגל הצד — ציבורי (המספרים ממילא מוצגים בדשבורד), cache 5 דק'.
export async function GET() {
  const today = new Date().toISOString().split("T")[0];
  const activeF = `or=(deadline.gte.${today},deadline.is.null)`;
  const p = encodeURIComponent;
  const exemptF = `or=(type.ilike.${p("*פטור*")},title.ilike.${p("*פטור ממכרז*")},title.ilike.${p("*ספק יחיד*")},title.ilike.${p("*מאשרים הארכה*")},title.ilike.${p("*הארכת התקשרות*")},title.ilike.${p("*מימוש אופציה*")})`;
  const [active, exempt, smallbiz] = await Promise.all([
    cnt(activeF),
    cnt(exemptF),
    cnt(`small_biz=is.true&small_biz_confidence=in.(high,medium)&${activeF}`),
  ]);
  return NextResponse.json(
    { active, exempt, smallbiz },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
