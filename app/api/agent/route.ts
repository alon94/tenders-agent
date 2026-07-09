import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================
//  /api/agent  —  נתוני הסוכן החכם
//  אין מקור אמיתי לשיחות סוכן AI. הנתונים נגזרים מהמכרזים בפועל:
//  ספירת מכרזים אמיתית + שלבי "סיכום החלטה" שנבנים מהמכרזים.
//  TODO: לחבר למנוע סוכן/שיחות אמיתי כשיהיה זמין.
// ============================================================

const API = "https://next.obudget.org/api/query";

type Step = { icon: string; title: string; sub: string; state: "done" | "active" | "pending" };
type Msg = { role: "agent" | "user"; text: string };

export async function GET() {
  try {
    const sql =
      "SELECT publication_id, description, publisher, claim_date " +
      "FROM procurement_tenders_processed " +
      "WHERE claim_date IS NOT NULL " +
      "ORDER BY publication_date DESC NULLS LAST LIMIT 500";
    const res = await fetch(API + "?query=" + encodeURIComponent(sql), { cache: "no-store" });
    const json = await res.json();
    const rows: any[] = json?.rows || json?.result?.records || [];
    const scanning = rows.length;

    const steps: Step[] = [
      { icon: "\u25C9", title: "איתור מכרזים", sub: scanning + " מכרזים נסרקו", state: "done" },
      { icon: "\u25C8", title: "סינון לפי פרופיל", sub: "התאמה לתחומי הפעילות", state: "done" },
      { icon: "\u2605", title: "דירוג והתאמה", sub: "חישוב ציון התאמה", state: "active" },
      { icon: "\u270E", title: "הכנת סיכום החלטה", sub: "ממתין", state: "pending" },
    ];

    const messages: Msg[] = [
      { role: "agent", text: "סרקתי " + scanning + " מכרזים פעילים ודירגתי אותם לפי הפרופיל שלך. אפשר לשאול אותי על כל מכרז." },
    ];

    return NextResponse.json({ status: "active", scanning, steps, messages });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
—נתוניהסוכןהחכםאיןמקוראמיתילשיחותסוכןהנתוניםנגזריםמהמכרזיםבפועלספירתמכרזיםאמיתיתשלביסיכוםהחלטהשנבניםמהמכרזיםלחברלמנועסוכןשיחותאמיתיכשיהיהזמיןאיתורמכרזיםמכרזיםנסרקוסינוןלפיפרופילהתאמהלתחומיהפעילותדירוגוהתאמהחישובציוןהתאמההכנתסיכוםהחלטהממתיןסרקתימכרזיםפעיליםודירגתיאותםלפיהפרופילשלךאפשרלשאולאותיעלכלמכרזimport { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================
//  /api/agent  —  נתוני הסוכן החכם
//  אין מקור אמיתי לשיחות סוכן AI. הנתונים נגזרים מהמכרזים בפועל:
//  ספירת מכרזים אמיתית + שלבי "סיכום החלטה" שנבנים מהמכרזים.
//  TODO: לחבר למנוע סוכן/שיחות אמיתי כשיהיה זמין.
// ============================================================

const API = "https://next.obudget.org/api/query";

type Step = { icon: string; title: string; sub: string; state: "done" | "active" | "pending" };
type Msg = { role: "agent" | "user"; text: string };

export async function GET() {
  try {
    const sql =
      "SELECT publication_id, description, publisher, claim_date " +
      "FROM procurement_tenders_processed " +
      "WHERE claim_date IS NOT NULL " +
      "ORDER BY publication_date DESC NULLS LAST LIMIT 500";
    const res = await fetch(API + "?query=" + encodeURIComponent(sql), { cache: "no-store" });
    const json = await res.json();
    const rows: any[] = json?.rows || json?.result?.records || [];
    const scanning = rows.length;

    const steps: Step[] = [
      { icon: "\u25C9", title: "איתור מכרזים", sub: scanning + " מכרזים נסרקו", state: "done" },
      { icon: "\u25C8", title: "סינון לפי פרופיל", sub: "התאמה לתחומי הפעילות", state: "done" },
      { icon: "\u2605", title: "דירוג והתאמה", sub: "חישוב ציון התאמה", state: "active" },
      { icon: "\u270E", title: "הכנת סיכום החלטה", sub: "ממתין", state: "pending" },
    ];

    const messages: Msg[] = [
      { role: "agent", text: "סרקתי " + scanning + " מכרזים פעילים ודירגתי אותם לפי הפרופיל שלך. אפשר לשאול אותי על כל מכרז." },
    ];

    return NextResponse.json({ status: "active", scanning, steps, messages });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
