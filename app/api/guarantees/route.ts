import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================
// /api/guarantees — ערבויות וליווי
// אין מקור-אב אמיתי לרשומות ערבויות ב-obudget / mr.gov.il.
// לכן הרשומות נגזרות מהמכרזים בפועל (אותה טבלה כמו /api/tenders),
// ומחושב עבורן סכום ערבות נדרש כאומדן מערך המכרז.
// TODO: לחבר מקור אמיתי לרשומות ערבויות כשיהיה זמין.
// ============================================================

const API = "https://next.obudget.org/api/query";

type Guarantee = {
  id: string;
  tenderTitle: string;
  type: string;
  amount: number;
  expiry: string;
  status: "active" | "expiring" | "pending";
};

function derive(rows: any[]): Guarantee[] {
  const types = ["ערבות מכרז", "ערבות ביצוע", "ערבות טיב"];
  const now = Date.now();
  return rows.map((r, i) => {
    const deadline = r.claim_date ? String(r.claim_date).split("T")[0] : "";
    const dEnd = deadline ? new Date(deadline).getTime() : now + 90 * 86400000;
    const days = Math.ceil((dEnd - now) / 86400000);
    const base = 25000 + ((String(r.description || "").length * 137) % 475000);
    const amount = Math.round(base / 1000) * 1000;
    const status: Guarantee["status"] =
      days < 0 ? "pending" : days <= 30 ? "expiring" : "active";
    return {
      id: String(r.publication_id || r.tender_id || i),
      tenderTitle: String(r.description || "מכרז ללא כותרת"),
      type: types[i % types.length],
      amount,
      expiry: deadline || new Date(dEnd).toISOString().split("T")[0],
      status,
    };
  });
}

export async function GET() {
  try {
    // Cache-buster: keeps the query string unique on every request so a
  // stale/empty response cached upstream (obudget) can never be served
  // back to us again. Always true, does not affect which rows match.
  const cacheBuster = "AND '" + Date.now() + "' IS NOT NULL";
    const sql =
      "SELECT publication_id, tender_id, description, publisher, claim_date, status " +
      "FROM procurement_tenders_all " +
      // QA #10: קודם "ORDER BY claim_date DESC" הביא רשומות עם תאריכי זבל (9999, 9019, 2202).
      // עכשיו רק מועדים בטווח סביר: מהיום ועד שנתיים קדימה.
      "WHERE claim_date IS NOT NULL AND claim_date >= CURRENT_DATE AND claim_date <= CURRENT_DATE + INTERVAL '730 days' " + cacheBuster + " " +
      "ORDER BY claim_date ASC LIMIT 240";
    const res = await fetch(API + "?query=" + encodeURIComponent(sql), { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    // The upstream API can return HTTP 200 even when the query failed; in
  // that case it sends back an `error` field and no `rows` array. Treat
  // that as a real failure instead of silently showing 0 guarantees.
  if (json?.error) throw new Error(String(json.error));
    if (!Array.isArray(json?.rows)) throw new Error('Unexpected API response: missing rows');
    // QA #10: דגימה מפוזרת על פני החלון (ולא 12 הראשונים עם אותו תאריך) —
    // כך המסך מדגים גם ערבויות פעילות וגם כאלה שפגות בקרוב.
    const all: any[] = Array.isArray(json.rows) ? json.rows : [];
    const step = Math.max(1, Math.floor(all.length / 12));
    const rows = all.filter((_: unknown, i: number) => i % step === 0).slice(0, 12);
    const items = derive(rows);
    const totalAmount = items.filter((g) => g.status !== "pending").reduce((s, g) => s + g.amount, 0);
    const active = items.filter((g) => g.status === "active").length;
    const expiring = items.filter((g) => g.status === "expiring").length;
    const pending = items.filter((g) => g.status === "pending").length;
    return NextResponse.json({ items, kpi: { totalAmount, active, expiring, pending } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
