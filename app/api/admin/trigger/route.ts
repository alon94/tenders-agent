import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { requireAdmin } from '@/app/lib/ops';

export const dynamic = 'force-dynamic';

// POST /api/admin/trigger { type: 'sync' | 'smallbiz' }
// הפעלה ידנית של צינור מה-UI — רצה ברקע (waitUntil), התשובה מיידית.
export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (admin.role === 'viewer') return NextResponse.json({ error: 'viewer cannot trigger' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const type = body?.type;
  if (type !== 'sync' && type !== 'smallbiz') {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 });
  }
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET missing' }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const path = type === 'sync' ? '/api/cron' : '/api/smallbiz';

  waitUntil(
    fetch(`${origin}${path}`, { headers: { 'x-cron-secret': process.env.CRON_SECRET } })
      .then((r) => console.log(`Admin trigger ${type} by ${admin.email}: status ${r.status}`))
      .catch((e) => console.error(`Admin trigger ${type} failed:`, e))
  );

  return NextResponse.json({ started: true, type, by: admin.email });
}
