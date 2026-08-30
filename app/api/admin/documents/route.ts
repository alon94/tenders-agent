import { NextResponse } from "next/server";
import { requireAdmin, listDocuments, saveDocument, DOCUMENT_SLUGS } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ documents: await listDocuments() }, {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body?.slug || !(DOCUMENT_SLUGS as readonly string[]).includes(body.slug)) {
    return NextResponse.json({ error: "slug לא מוכר" }, { status: 400 });
  }
  if (typeof body.content_md !== "string") {
    return NextResponse.json({ error: "נדרש content_md" }, { status: 400 });
  }
  // מסמך משפטי סביר לא עובר 200KB; הגנה מפני הדבקה שגויה שתנפח את הטבלה
  if (body.content_md.length > 200_000) {
    return NextResponse.json({ error: "התוכן ארוך מדי" }, { status: 400 });
  }
  const ok = await saveDocument(
    { slug: body.slug, title: body.title, content_md: body.content_md },
    admin.email
  );
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "השמירה נכשלה" }, { status: 500 });
}
