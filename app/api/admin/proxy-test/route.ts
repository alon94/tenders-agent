import { NextResponse } from "next/server";
import { isOpsAuthorized } from "@/app/lib/ops";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/admin/proxy-test — בדיקת בריאות הפרוקסי (Authorization: Bearer <admin/CRON_SECRET>)
export async function GET(req: Request) {
  // QA/B-3: ?secret= הוסר. כותרת בלבד, או אדמין מחובר.
  if (!(await isOpsAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const proxy = process.env.IL_PROXY_URL;
  if (!proxy) return NextResponse.json({ error: "IL_PROXY_URL not set" });

  const targets: Record<string, string> = {
    pais: "https://www.pais.co.il/tenders/",
    innovation: "https://innovationisrael.org.il/kol_kore/",
    iroads: "https://www.iroads.co.il/",
    rail: "https://www.rail.co.il/?page=GeneralAuctions&lan=he",
    iec: "https://www.iec.co.il/content/suppliers/content-pages/tendersinfo",
    mekorot: "https://www.mekorot.co.il/%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D/",
    mashcal: "https://www.mashcal.co.il/our-tenders/",
  };

  const results: Record<string, unknown> = {};
  await Promise.all(Object.entries(targets).map(async ([id, target]) => {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(proxy + encodeURIComponent(target), { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(timer);
      const text = await res.text();
      results[id] = { status: res.status, bytes: text.length, ms: Date.now() - t0, ok: res.status === 200 && text.length > 500 };
    } catch (e) {
      results[id] = { error: String(e).slice(0, 80), ms: Date.now() - t0, ok: false };
    }
  }));

  return NextResponse.json({ proxy_configured: true, results }, { headers: { "content-type": "application/json; charset=utf-8" } });
}
