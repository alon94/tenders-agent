import { NextResponse } from 'next/server';
import { requireAdmin, overviewCounts, recentRuns, recentEmails } from '@/app/lib/ops';

export const dynamic = 'force-dynamic';

// GET /api/admin/overview — כל נתוני מסך הסקירה בקריאה אחת
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  try {
    const [counts, runs, emails] = await Promise.all([
      overviewCounts(),
      recentRuns(30),
      recentEmails(30),
    ]);

    // סטטוס אחרון לכל צינור
    const lastByType: Record<string, unknown> = {};
    for (const r of runs as { type: string }[]) {
      if (!lastByType[r.type]) lastByType[r.type] = r;
    }

    return NextResponse.json({ admin, counts, runs, emails, lastByType });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
