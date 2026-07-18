// ============================================================
//  regression.test.ts — בדיקות קבלה לטיקטים 11/12/13
//  הרצה: npm test   (npx tsx scripts/regression.test.ts)
// ============================================================
import { parseHeDate, fmtDate, daysLeft } from "../app/lib/tenderMeta";
import { DOMAINS, classifyTender, matchDomain, matchPublisher, matchQuery, domainCounts, UNCATEGORIZED_ID } from "../app/lib/domains";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
}

// ---------- TICKET-11: פרסור תאריכים ----------
console.log("\nTICKET-11 — פרסור תאריכים ריכוזי");
{
  // 12/08/2026 חייב להתפרש כ-12 באוגוסט (לא 8 בדצמבר)
  const a = parseHeDate("12/08/2026")!;
  check("DD/MM/YYYY: 12/08/2026 → אוגוסט", a.getMonth() === 7 && a.getDate() === 12 && a.getFullYear() === 2026);
  const b = parseHeDate("12.08.2026")!;
  check("DD.MM.YYYY: 12.08.2026 → אוגוסט", b.getMonth() === 7 && b.getDate() === 12);
  const c = parseHeDate("2026-08-12")!;
  check("ISO: 2026-08-12 → אוגוסט", c.getMonth() === 7 && c.getDate() === 12);
  check("רשימה ↔ דף פרט: אותו תאריך משני הפורמטים", fmtDate("12/08/2026") === fmtDate("2026-08-12"), `${fmtDate("12/08/2026")} vs ${fmtDate("2026-08-12")}`);
  const d2 = parseHeDate("10/08/2026")!;
  check("עדות 4000619684: 10/08/2026 → אוגוסט (לא אוקטובר)", d2.getMonth() === 7 && d2.getDate() === 10);
  check("קלט ריק → null (מוצג —)", parseHeDate("") === null && fmtDate("") === "—");
}

// ---------- TICKET-11: רגרסיית חלון 365 הימים ----------
console.log("\nTICKET-11 — אף מכרז לא נעלם מחלון 365 הימים עקב תאריך הפוך");
{
  const now = Date.now();
  const iso = (offsetDays: number) => {
    const d = new Date(now + offsetDays * 86400000);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };
  // מכרזים שנסגרים בתוך 60–300 יום, בפורמט DD/MM — פרסור הפוך היה
  // דוחף חלק מהם מעבר ל-365 יום או להופכם ל"עבר מועדם".
  const fixtures = Array.from({ length: 40 }, (_, i) => ({ deadline: iso(30 + i * 7) }));
  const inWindow = fixtures.filter((t) => {
    const d = daysLeft(t.deadline);
    return d !== null && d >= 0 && d <= 365;
  }).length;
  check(`כל ${fixtures.length} המכרזים בפיקסטורה נשארים בחלון`, inWindow === fixtures.length, `בחלון: ${inWindow}`);
}

// ---------- TICKET-12: חיפוש ≡ סינון ----------
console.log("\nTICKET-12 — חיפוש מילת תחום מחזיר תוצאות זהות לסינון התחום");
{
  const fixtures = [
    { id: "1", title: "אספקת שירותי ייעוץ אסטרטגי למשרד", publisher: "משרד האוצר" },
    { id: "2", title: "פיתוח מערכת תוכנה בענן", publisher: "רשות המסים" },
    { id: "3", title: "שירותי ניקיון ואחזקה למבני ציבור", publisher: "עיריית נתניה" },
    { id: "4", title: "הסעות תלמידים", publisher: "מועצה אזורית עמק חפר" },
    { id: "5", title: "רכש מכשור רפואי", publisher: "בית חולים הדסה" },
    { id: "6", title: "אבטחה ושמירה במוסדות חינוך", publisher: "עיריית חיפה" },
    { id: "7", title: "קמפיין פרסום דיגיטלי", publisher: "משרד התיירות" },
    { id: "8", title: "עבודות בינוי ותשתיות ביוב", publisher: "תאגיד מים" },
    { id: "9", title: "אספקת ריהוט משרדי", publisher: "מינהל הרכש" }, // לא מסווג
  ];
  for (const d of DOMAINS) {
    const byFilter = fixtures.filter((t) => matchDomain(t, d.id)).map((t) => t.id).sort().join(",");
    const byQuery = fixtures.filter((t) => matchQuery(t, d.label)).map((t) => t.id).sort().join(",");
    check(`תחום "${d.label}": סינון ≡ חיפוש שם התחום`, byFilter === byQuery, `filter=[${byFilter}] query=[${byQuery}]`);
    const kw = d.kw[0];
    const byKw = fixtures.filter((t) => matchQuery(t, kw)).map((t) => t.id).sort().join(",");
    check(`תחום "${d.label}": חיפוש "${kw}" ⊇ סינון`, byFilter.split(",").every((x) => !x || byKw.includes(x)), `filter=[${byFilter}] kw=[${byKw}]`);
  }
  check('חיפוש חופשי רגיל עדיין עובד ("ריהוט")', fixtures.filter((t) => matchQuery(t, "ריהוט")).length === 1);
}

// ---------- TICKET-13: תחומים דינמיים + לא מסווג ----------
console.log("\nTICKET-13 — תחומים נגזרים מהדאטה, bucket לא-מסווג מדיד");
{
  const fixtures = [
    { title: "פיתוח תוכנה", publisher: "" },
    { title: "פיתוח אפליקציה", publisher: "" },
    { title: "שירותי ניקיון", publisher: "" },
    { title: "אספקת נייר צילום", publisher: "" }, // לא מסווג
  ];
  const { domains, uncategorized } = domainCounts(fixtures);
  check("תחום ללא מכרזים מוסתר", domains.every((d) => d.count > 0));
  check("מיון לפי נפח יורד", domains.every((d, i) => i === 0 || domains[i - 1].count >= d.count));
  check("טכנולוגיה נספרת פעמיים", domains.find((d) => d.id === "tech")?.count === 2);
  check("לא-מסווג = 1", uncategorized === 1, String(uncategorized));
  check("סינון לפי לא-מסווג מחזיר בדיוק אותו", fixtures.filter((t) => matchDomain(t, UNCATEGORIZED_ID)).length === 1);
  check("נרמול שדה type מהמקור (בינוי → construction)", classifyTender({ title: "מכרז 123", type: "עבודות בינוי" }).includes("construction"));
}

// ---------- כיסוי מקורות: הגופים והקטגוריות מהפוטר ----------
console.log("\nכיסוי — כל הגופים והקטגוריות מרשימת המקור מסווגים");
{
  const bodies: [string, string][] = [
    ["ממשלת ישראל", "gov"], ["משרד הביטחון", "gov"], ["רשות מקרקעי ישראל", "gov"],
    ["מנהל מקרקעי ישראל", "gov"], ["משרד החינוך", "gov"], ["משטרת ישראל", "gov"],
    ["נציבות שירות המדינה", "gov"], ["משרד הבריאות", "gov"], ["משרד הרווחה", "gov"],
    ["משרד הבינוי והשיכון", "gov"], ["חברת החשמל", "infra"], ["עיריית באר שבע", "local"],
    ["עיריית הוד השרון", "local"], ["עיריית נתיבות", "local"], ["מועצה אזורית שדות נגב", "local"],
    ["עיריית רמת השרון", "local"], ["מפעל הפיס", "public"], ["ג'וינט ישראל", "public"],
    ["קופת חולים מאוחדת", "health"],
  ];
  for (const [pub, group] of bodies)
    check(`גוף "${pub}" → ${group}`, matchPublisher({ publisher: pub } as any, group));
  const cats: [string, string][] = [
    ["מכרז עבודות בניה", "construction"], ["מכרז מקרקעין", "realestate"],
    ["מכרז השכרת נכסים", "realestate"], ["מכרז עבודות חשמל", "construction"],
    ["מכרז הסעות", "transport"], ["מכרז אספקת רכב", "transport"],
    ["מכרז הובלות", "transport"], ["מכרז לעבודות עפר", "construction"],
    ["מכרז עיצוב גרפי", "marketing"],
  ];
  for (const [title, dom] of cats)
    check(`קטגוריה "${title}" → ${dom}`, classifyTender({ title }).includes(dom));
}

console.log(failures === 0 ? "\n✅ כל הבדיקות עברו" : `\n❌ ${failures} בדיקות נכשלו`);
process.exit(failures === 0 ? 0 : 1);
