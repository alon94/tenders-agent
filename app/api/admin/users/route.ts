import { NextResponse } from "next/server";
import { requireAdmin, listRegisteredUsersDiag, deleteRegisteredUser } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

// GET /api/admin/users — המשתמשים הרשומים (Supabase Auth)
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const { users, notes } = await listRegisteredUsersDiag();
    users.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return NextResponse.json({ users, count: users.length, notes });
  } catch (e) {
    // כשל לא צפוי לא מוחזר כ-500 אטום — האדמין מציג את הסיבה
    return NextResponse.json({ users: [], count: 0, notes: ["שגיאה: " + String((e as Error)?.message || e).slice(0, 200)] });
  }
}

// DELETE /api/admin/users?id=<uuid> — מחיקת משתמש רשום
export async function DELETE(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const r = await deleteRegisteredUser(id);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
