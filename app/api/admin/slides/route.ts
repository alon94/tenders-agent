import { NextResponse } from "next/server";
import { requireAdmin, listSlides, saveSlide, deleteSlide } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ slides: await listSlides(false) }, { headers: { "content-type": "application/json; charset=utf-8" } });
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body?.title) return NextResponse.json({ error: "נדרשת כותרת" }, { status: 400 });
  return NextResponse.json({ ok: await saveSlide(body) });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  return NextResponse.json({ ok: await deleteSlide(id) });
}
