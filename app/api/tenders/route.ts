import { NextResponse } from "next/server";
import { getTenders } from "@/app/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
    try {
          const { searchParams } = new URL(req.url);
          const search = searchParams.get("q");
          const offset = parseInt(searchParams.get("offset") || "0");

      const rows = await getTenders({ search: search || undefined, offset, limit: 1000 });

      const tenders = rows.map((row, i) => ({
              id: String(row.id ?? `${offset}_${i}`),
              title: String(row.title ?? ""),
              publisher: [row.publisher, row.publisher_unit].filter(Boolean).join(" - "),
              publishDate: row.publish_date ? String(row.publish_date).split("T")[0] : undefined,
              deadline: row.deadline ? String(row.deadline).split("T")[0] : undefined,
              status: String(row.status ?? ""),
              url: String(row.url ?? ""),
              type: String(row.type ?? ""),
      }));

      // fetchedAt: reflects when this row was last synced into the database by
      // the daily cron job, not the time of this read request.
      const fetchedAt = rows.length > 0 && rows[0].fetched_at ? rows[0].fetched_at : new Date().toISOString();

      return NextResponse.json({
              tenders,
              count: tenders.length,
              fetchedAt,
      });
    } catch (err) {
          return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
