// ============================================================
//  tenderMeta — טוקנים ופונקציות עזר משותפים לדפים הפנימיים
//  זהים לפלטת הדשבורד (app/dashboard/page.tsx) — לא פלטת הכחול של המפרט,
//  לפי בקשת המשתמש: הדפים הפנימיים תואמים לצבעי הדשבורד הקיים.
// ============================================================

export const DARK = "#1a2330";
export const BLUE = "#2b6fc4";
export const MUTED = "#667380";
export const BORDER = "#e6eaee";
export const DIVIDER = "#eef1f4";

export type Tag = { label: string; bg: string; fg: string; bd: string };

// ציון band — זהה ל-bandColor בדשבורד (ירוק / זהב / כחול)
export function bandColor(score: number): string {
  if (score >= 80) return "#1e9e5a";
  if (score >= 65) return "#d9a520";
  return "#2b6fc4";
}

const KW: Record<string, string[]> = {
  consulting: ["ייעוץ", "יעוץ", "ניהול", "אסטרטגיה"],
  tech: ["תוכנה", "מחשוב", "טכנולוגיה", "פיתוח", "סייבר"],
};

export function scoreFor(title: string, publisher = ""): number {
  const h = (title + " " + publisher).toLowerCase();
  let best = 55 + ((title.length % 3) * 10);
  for (const k in KW) {
    const hits = KW[k].filter((w) => h.includes(w.toLowerCase())).length;
    if (hits) best = Math.max(best, Math.min(95, 50 + hits * 15));
  }
  return best;
}

export function statusTags(status: string, days: number | null, publisher?: string): Tag[] {
  const tags: Tag[] = [];
  const s = status || "";
  if (s.includes("פורסם")) tags.push({ label: "פורסם", bg: "#e7f6ec", fg: "#1e7d45", bd: "#c6ead2" });
  else if (s.includes("עדכון")) tags.push({ label: "בעדכון", bg: "#fbf3d8", fg: "#96731a", bd: "#f0e3b0" });
  else if (s.includes("סגור") || s.includes("נסגר")) tags.push({ label: s, bg: "#fbe9e7", fg: "#b04a34", bd: "#f2cfc8" });
  else if (s) tags.push({ label: s, bg: "#eef1f4", fg: "#5b6b7a", bd: "#e2e7ec" });
  if (days !== null && days >= 0 && days <= 7) tags.push({ label: "נסגר בקרוב", bg: "#fbe9e7", fg: "#b04a34", bd: "#f2cfc8" });
  if (publisher) tags.push({ label: publisher.length > 20 ? publisher.slice(0, 20) + "…" : publisher, bg: "#eaf1fb", fg: "#1e5aa8", bd: "#d3e2f5" });
  return tags;
}

// ============================================================
// פרסור תאריכים ריכוזי (TICKET-11)
// המקור הישראלי (מינהל הרכש) מחזיר DD/MM/YYYY — new Date() מפרש
// את זה בטעות כ-MM/DD. הפונקציה הזו היא נקודת הפרסור היחידה
// לרשימה ולדף הפרט כאחד.
// ============================================================
export function parseHeDate(d: string): Date | null {
  if (!d) return null;
  // DD/MM/YYYY או DD.MM.YYYY (כולל שעה אופציונלית אחרי)
  const m = d.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) {
    const x = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(x.getTime()) ? null : x;
  }
  // ISO (YYYY-MM-DD) וכל פורמט חד-משמעי אחר
  const x = new Date(d);
  return isNaN(x.getTime()) ? null : x;
}

export function daysLeft(d: string): number | null {
  const x = parseHeDate(d);
  return x === null ? null : Math.ceil((x.getTime() - Date.now()) / 86400000);
}

export function fmtDate(d: string): string {
  const x = parseHeDate(d);
  if (x === null) return "—";
  return x.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
