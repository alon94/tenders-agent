import { NextResponse } from "next/server";
import { getTenders } from "@/app/lib/db";
import { DOMAINS } from "@/app/lib/domains";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/domains-debug?secret=...
// אבחון סיווג: כמה מכרזים כל מילת מפתח תופסת בפועל, עם דוגמאות
// כותרות למילים החשודות — כדי לאתר מילים שמסווגות-יתר.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // כל המאגר (עד 12k) — כותרת+מפרסם+סוג, כמו במנוע הסיווג
  const all: { text: string; title: string }[] = [];
  for (let off = 0; off < 12000; off += 1000) {
    const page = await getTenders({ offset: off, limit: 1000 });
    for (const t of page) {
      all.push({
        text: ((t.title || "") + " " + (t.publisher || "") + " " + (t.type || "")).toLowerCase(),
        title: t.title || "",
      });
    }
    if (page.length < 1000) break;
  }

  const perDomain = DOMAINS.map((d) => {
    const kwStats = d.kw.map((k) => {
      const kl = k.toLowerCase();
      let count = 0;
      const samples: string[] = [];
      for (const t of all) {
        if (t.text.includes(kl)) {
          count++;
          if (samples.length < 3) samples.push(t.title.slice(0, 90));
        }
      }
      return { kw: k, count, samples: count > 200 ? samples : undefined };
    }).sort((a, b) => b.count - a.count);
    const domainTotal = all.filter((t) => d.kw.some((k) => t.text.includes(k.toLowerCase()))).length;
    return { id: d.id, label: d.label, total: domainTotal, kw: kwStats };
  });

  return NextResponse.json({ tenders: all.length, domains: perDomain });
}
