import { NextResponse } from "next/server";
import { runNewSourceScrapers } from "@/app/lib/scrapers/newSources";
import { recordSyncRun, detectTrigger } from "@/app/lib/ops";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET /api/sources-sync?secret=...            ← מריץ את כל המקורות הפעילים
// GET /api/sources-sync?secret=...&source=rmi ← מקור בודד (גם אם מושבת)
// GET /api/sources-sync?secret=...&dry=1      ← הרצת בדיקה בלי כתיבה ל-DB
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-cron-secret") ||
    url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ?close_expired=1 — ניקוי חד-פעמי: כל מכרז שמועד הגשתו עבר ועדיין
  // מסומן "פתוח" מקבל סטטוס "סגור" (מתקן סטטוסים עתיקים מהמקור).
  if (url.searchParams.get("close_expired") === "1") {
    const today = new Date().toISOString().split("T")[0];
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const filter = `deadline=lt.${today}&status=eq.${encodeURIComponent("פתוח")}`;
    const cnt = await fetch(`${SUPABASE_URL}/rest/v1/tenders?${filter}&select=id&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" }, cache: "no-store",
    });
    const affected = parseInt((cnt.headers.get("content-range") || "/0").split("/")[1] || "0", 10);
    const patch = await fetch(`${SUPABASE_URL}/rest/v1/tenders?${filter}`, {
      method: "PATCH",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "סגור" }),
    });
    return NextResponse.json({ close_expired: true, affected, patch_ok: patch.ok });
  }

  const only = url.searchParams.get("source") || undefined;
  const dry = url.searchParams.get("dry") === "1";

  const startedAt = new Date().toISOString();
  const started = Date.now();
  const reports = await runNewSourceScrapers({ only, dry });
  const totals = reports.reduce(
    (a, r) => ({ fetched: a.fetched + r.fetched, upserted: a.upserted + r.upserted, failed: a.failed + (r.ok ? 0 : 1) }),
    { fetched: 0, upserted: 0, failed: 0 }
  );

  // רישום הריצה ב-sync_runs כדי שתופיע בדשבורד האדמין (למעט dry-run)
  if (!dry) {
    const failedIds = reports.filter((r) => !r.ok).map((r) => r.id);
    await recordSyncRun({
      type: "sources",
      started_at: startedAt,
      duration_ms: Date.now() - started,
      trigger: detectTrigger(req),
      counts: { ...totals, sources: reports.length, perSource: reports.map((r) => ({ id: r.id, ok: r.ok, upserted: r.upserted })) },
      error: failedIds.length ? `נכשלו: ${failedIds.join(", ")}` : null,
    });
  }

  return NextResponse.json({
    ok: true,
    dry,
    ms: Date.now() - started,
    totals,
    sources: reports,
  });
}
