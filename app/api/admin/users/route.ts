import { NextResponse } from "next/server";
import { requireAdmin, listRegisteredUsers } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

// GET /api/admin/users — המשתמשים הרשומים (Supabase Auth)
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const users = await listRegisteredUsers();
  users.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return NextResponse.json({ users, count: users.length });
}
