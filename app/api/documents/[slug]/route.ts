import { NextResponse } from "next/server";
import { getDocument, DOCUMENT_SLUGS, DOCUMENT_TITLES } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

// נתיב ציבורי (ללא אימות) — מגיש את תוכן המסמכים לעמודי /privacy, /terms,
// /accessibility. ה-slug מאומת מול רשימה סגורה בתוך getDocument.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!(DOCUMENT_SLUGS as readonly string[]).includes(slug)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const doc = await getDocument(slug);
  return NextResponse.json(
    doc ?? { slug, title: DOCUMENT_TITLES[slug], content_md: "" },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
