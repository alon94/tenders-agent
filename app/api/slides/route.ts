import { NextResponse } from "next/server";
import { listSlides } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

// GET /api/slides — שקופיות פעילות לדף הבית (ציבורי)
export async function GET() {
  const slides = await listSlides(true).catch(() => []);
  return NextResponse.json({ slides }, {
    headers: { "content-type": "application/json; charset=utf-8", "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
  });
}
