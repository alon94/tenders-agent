import { NextResponse } from "next/server";
import { requireAdmin, seriesFromTable, type Granularity } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

// GET /api/admin/analytics?granularity=day|month|year&from=YYYY-MM-DD&to=YYYY-MM-DD
// שלוש סדרות: מכרזים שנקלטו, אירועי כניסה, ריצות צינורות.
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const g = (url.searchParams.get("granularity") || "day") as Granularity;
  const granularity: Granularity = ["day", "month", "year"].includes(g) ? g : "day";
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const [tenders, logins, runs] = await Promise.all([
    seriesFromTable("tenders", "fetched_at", granularity, from, to),
    seriesFromTable("login_events", "at", granularity, from, to),
    seriesFromTable("sync_runs", "started_at", granularity, from, to),
  ]);

  return NextResponse.json({ granularity, from: from || null, to: to || null, tenders, logins, runs });
}
