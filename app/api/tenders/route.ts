import { NextResponse } from "next/server";
import { getTenders, getLastSyncAt } from "@/app/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
    try {
          const { searchParams } = new URL(req.url);
          const search = searchParams.get("q");
          const offset = parseInt(searchParams.get("offset") || "0");
          // ברירת מחדל: פעילים בלבד. ?all=1 מחזיר גם את שפג מועדם (להיסטוריה).
          const activeOnly = searchParams.get("all") !== "1";
          // ?sample=1 — מדגם קצר לדף הבית, בלי לשלוף 1,000 רשומות
          const sample = searchParams.get("sample") === "1";

      const rows = await getTenders({ search: search || undefined, offset, limit: sample ? 14 : 1000, activeOnly });

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
          return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
