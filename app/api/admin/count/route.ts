import { NextResponse } from "next/server";

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

// GET /api/admin/count?secret=...&contains=קול קורא
// כלי QA: ספירת מכרזים שהביטוי מופיע בכותרת או בשדה הסוג,
// עם פילוח פעילים/לא-פעילים ודוגמאות.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const contains = (url.searchParams.get("contains") || "").trim();
  if (!contains) return NextResponse.json({ error: "missing ?contains=" }, { status: 400 });

  const enc = encodeURIComponent(`*${contains}*`);
  const today = new Date().toISOString().split("T")[0];
  const titleF = `title=ilike.${enc}`;
  const typeF = `type=ilike.${enc}`;
  const eitherF = `or=(title.ilike.${enc},type.ilike.${enc})`;

  const [inTitle, inType, total, active, withDeadline, samplesRes] = await Promise.all([
    countExact(titleF),
    countExact(typeF),
    countExact(eitherF),
    countExact(`${eitherF}&or=(deadline.gte.${today},deadline.is.null)`),
    countExact(`${eitherF}&deadline=not.is.null`),
    fetch(`${SUPABASE_URL}/rest/v1/tenders?${eitherF}&select=id,title,publisher,deadline,source&order=publish_date.desc.nullslast&limit=5`, {
      headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store",
    }).then((r) => (r.ok ? r.json() : [])),
  ]);

  return NextResponse.json({
    "ביטוי": contains,
    "סה\"כ (כותרת או סוג)": total,
    "מתוכם פעילים": active,
    "מתוכם עם מועד הגשה": withDeadline,
    "בכותרת": inTitle,
    "בשדה הסוג": inType,
    "דוגמאות אחרונות": samplesRes,
  });
}
