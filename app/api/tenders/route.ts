import { NextResponse } from "next/server";
import { getTenders, getLastSyncAt } from "@/app/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
    try {
          const { searchParams } = new URL(req.url);
          const search = (searchParams.get("q") || "").slice(0, 200) || null; // QA/M-2: קלט חסום באורך
          // QA/M-2: offset לא היה מאומת — ?offset=abc נתן NaN ו-?offset=-500
          // התקבל. עכשיו מוצמד לטווח שפוי.
          const rawOffset = parseInt(searchParams.get("offset") || "0", 10);
          const offset = Number.isFinite(rawOffset) ? Math.min(Math.max(rawOffset, 0), 100000) : 0;
          // ברירת מחדל: פעילים בלבד. ?all=1 מחזיר גם את שפג מועדם (להיסטוריה).
          const activeOnly = searchParams.get("all") !== "1";
          // ?sample=1 — מדגם קצר לדף הבית, בלי לשלוף 1,000 רשומות
          const sample = searchParams.get("sample") === "1";
          // QA/B-1: ?ids=a,b,c — שליפה ממוקדת לפי מזהים (עמוד המסומנים).
          // כשמבקשים מזהים מפורשות מוחזרים גם מכרזים שמועדם חלף, אחרת
          // ארכיון הסימונים נשבר בכל פעם שמועד הגשה עובר.
          // פרמטרים חוזרים (?id=a&id=b) הם הצורה המועדפת — חלק מהמזהים
          // נגזרים מטקסט חופשי ועלולים להכיל פסיק. ?ids=a,b נתמך לתאימות.
          const repeated = searchParams.getAll("id").map((s) => s.trim()).filter(Boolean);
          const legacy = (searchParams.get("ids") || "")
            .split(",").map((s) => s.trim()).filter(Boolean);
          const merged = [...repeated, ...legacy];
          const ids = merged.length
            ? Array.from(new Set(merged)).slice(0, 300)
            : undefined;

      const rows = await getTenders({
        search: search || undefined,
        offset: ids ? 0 : offset,
        limit: ids ? ids.length : sample ? 14 : 1000,
        activeOnly: ids ? false : activeOnly,
        ids,
      });

      const tenders = rows.map((row, i) => ({
              id: String(row.id ?? `${offset}_${i}`),
              title: String(row.title ?? ""),
              publisher: [row.publisher, row.publisher_unit].filter(Boolean).join(" - "),
              publishDate: row.publish_date ? String(row.publish_date).split("T")[0] : undefined,
              deadline: row.deadline ? String(row.deadline).split("T")[0] : undefined,
              status: String(row.status ?? ""),
              url: String(row.url ?? ""),
              type: String(row.type ?? ""),
              smallBiz: row.small_biz === true,
              smallBizConfidence: row.small_biz_confidence ?? null,
              smallBizQuote: row.small_biz_quote ?? null,
              smallBizSummary: row.small_biz_summary ?? null,
      }));

      // fetchedAt: reflects when this row was last synced into the database by
      // the daily cron job, not the time of this read request.
      const lastSync = await getLastSyncAt();
        const fetchedAt = lastSync || (rows.length > 0 && rows[0].fetched_at ? rows[0].fetched_at : new Date().toISOString());
      return NextResponse.json({
              tenders,
              count: tenders.length,
              fetchedAt,
      });
    } catch (err) {
          // QA/M-2: קודם הוחזר String(err) ללקוח — כלומר גוף השגיאה הגולמי
          // של Supabase, כולל מבנה השאילתה. עכשיו הפירוט נרשם בלוג בלבד.
          console.error('GET /api/tenders failed:', err);
          return NextResponse.json({ error: 'failed_to_load_tenders' }, { status: 500 });
    }
}
