// ============================================================
//  regression.test.ts — בדיקות קבלה לטיקטים 11/12/13
//  הרצה: npm test   (npx tsx scripts/regression.test.ts)
// ============================================================
import { parseHeDate, fmtDate, daysLeft } from "../app/lib/tenderMeta";
import { harvestTenderLinks, rowsToRecords, heDateToIso as scraperHeDateToIso } from "../app/lib/scrapers/core";
import { DOMAINS, classifyTender, matchDomain, matchPublisher, matchQuery, domainCounts, UNCATEGORIZED_ID } from "../app/lib/domains";
import nodeCrypto from "crypto";
// ops קורא את משתני הסביבה בזמן ריצה (לא בזמן טעינת המודול), ולכן
// ייבוא רגיל בראש הקובץ תקין — הסביבה נקבעת לפני הקריאה לפונקציות.
import { issueAdminToken, verifyAdminToken } from "../app/lib/ops";

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


// ---------- סקרייפרים: קוצר הלינקים הגנרי ----------
console.log("\nסקרייפרים — harvestTenderLinks על HTML לדוגמה");
{
  const html = `
    <div class="item"><a href="/tenders/123">מכרז פומבי 12/2026 לאספקת שירותי ניקיון</a>
      <span>תאריך פרסום: 01/07/2026</span> <span>מועד אחרון להגשה: 15.09.2026</span></div>
    <div class="item"><a href="https://ex.co/t/456">בקשה להצעות מחיר להסעות עובדים</a>
      <span>עד ליום 03/08/2026</span></div>
    <div><a href="/about">אודות הארגון והנהלתו</a></div>
    <div><a href="/tenders/123">מכרז פומבי 12/2026 לאספקת שירותי ניקיון</a></div>
    <a href="/x.css">מכרז מזויף בקובץ עיצוב</a>
    <a href="/short">קצר</a>`;
  const rows = harvestTenderLinks(html, "https://example.org/base/");
  check("נקצרו בדיוק 2 מכרזים (דה-דופ + סינון רעש)", rows.length === 2, String(rows.length));
  const r1 = rows.find((r) => r.title.includes("ניקיון"))!;
  check("URL יחסי הפך מוחלט", r1.url === "https://example.org/tenders/123", r1.url);
  check("deadline מתויג נקלט (DD.MM.YYYY)", r1.deadline === "2026-09-15", String(r1.deadline));
  check("publishDate מתויג נקלט", r1.publishDate === "2026-07-01", String(r1.publishDate));
  const r2 = rows.find((r) => r.title.includes("הסעות"))!;
  check('"עד ליום" מזוהה כ-deadline', r2.deadline === "2026-08-03", String(r2.deadline));

  const recs = rowsToRecords(rows, { id: "test", publisher: "גוף בדיקה" });
  check("id יציב עם קידומת מקור", recs.every((r) => r.id.startsWith("test-")));
  check("source ו-publisher מאוכלסים", recs.every((r) => r.source === "test" && r.publisher === "גוף בדיקה"));
  check("heDateToIso דוחה חודש לא חוקי", scraperHeDateToIso("13/13/2026") === null);
  check("heDateToIso: 12/08/2026 → אוגוסט", scraperHeDateToIso("12/08/2026") === "2026-08-12");
}

// ---------- QA/B-3 + B-4: טוקן האדמין ----------
// בדיקות שמגנות על תיקוני סבב ה-QA. סביבה מקומית בלבד, בלי גישה לרשת.
console.log("\nQA/B-3 + B-4 — חתימה ואימות של טוקן האדמין");
{
  process.env.ADMIN_TOKEN_SECRET = "test-signing-secret";
  process.env.ADMIN_PASSWORD = "correct-horse";
  const SEED = "alonkatabi17@gmail.com";
  const PREFIX = "pwadm.";

  // require אחרי הגדרת הסביבה — המפתח נקרא בזמן ריצה.
  const ops = { issueAdminToken, verifyAdminToken };
  const sign = (b64: string) =>
    nodeCrypto.createHmac("sha256", process.env.ADMIN_TOKEN_SECRET!).update(b64).digest("base64url");
  const mk = (payload: string) => {
    const b64 = Buffer.from(payload).toString("base64url");
    return `${PREFIX}${b64}.${sign(b64)}`;
  };

  const good = ops.issueAdminToken("correct-horse");
  check("סיסמה נכונה מנפיקה טוקן", typeof good === "string" && good!.startsWith(PREFIX));
  check("סיסמה שגויה לא מנפיקה טוקן", ops.issueAdminToken("wrong") === null);
  check("סיסמה ריקה לא מנפיקה טוקן", ops.issueAdminToken("") === null);
  check("סיסמה באורך שונה לא מפילה את safeEqual", ops.issueAdminToken("x") === null);

  const id = ops.verifyAdminToken(good!);
  check("טוקן תקין מאומת ומחזיר super", id?.role === "super" && id?.email === SEED);

  // B-3: מטען מזויף בלי חתימה תקפה
  const forged = Buffer.from(`attacker@evil.com|super|${Date.now() + 60000}`).toString("base64url");
  check("מטען מזויף בלי חתימה תקפה נדחה", ops.verifyAdminToken(`${PREFIX}${forged}.deadbeef`) === null);

  // B-3: חתימה תקפה אך זהות אחרת — הזהות מאומתת, לא רק החתימה
  check("חתימה תקפה + מייל זר → נדחה",
    ops.verifyAdminToken(mk(`someone@else.com|super|${Date.now() + 60000}`)) === null);

  // B-3: תפקיד מחוץ לרשימת ההיתר
  check("תפקיד לא מוכר (root) → נדחה",
    ops.verifyAdminToken(mk(`${SEED}|root|${Date.now() + 60000}`)) === null);

  // תוקף
  check("טוקן שפג תוקפו נדחה", ops.verifyAdminToken(mk(`${SEED}|super|${Date.now() - 1000}`)) === null);
  check("תוקף לא מספרי נדחה", ops.verifyAdminToken(mk(`${SEED}|super|not-a-number`)) === null);

  // B-4: תוקף 12 שעות ולא שבוע
  const expMs = Number(
    Buffer.from(good!.slice(PREFIX.length).split(".")[0], "base64url").toString().split("|")[2]
  ) - Date.now();
  check("תוקף הטוקן ≤ 12 שעות", expMs > 0 && expMs <= 12 * 3600 * 1000 + 5000,
    `${(expMs / 3600000).toFixed(1)}h`);

  check("טוקן בלי הקידומת נדחה", ops.verifyAdminToken("Bearer abc") === null);
  check("מחרוזת ריקה נדחית", ops.verifyAdminToken("") === null);
}

// ---------- QA/H-2 + B-1: בניית השאילתה ב-getTenders ----------
// db.ts קורא את משתני הסביבה בזמן טעינת המודול, ולכן ייבוא דינמי אחרי
// הגדרתם. global.fetch מוחלף כדי ללכוד את ה-URL בלי לפנות לרשת.
async function dbQueryTests() {
  console.log("\nQA/H-2 + B-1 — בניית השאילתה של getTenders");
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const { getTenders } = await import("../app/lib/db");

    // H-2: שובר שוויון ייחודי במיון
    await getTenders({ offset: 1000 });
    const ordered = decodeURIComponent(calls[0]);
    check("H-2: המיון כולל שובר שוויון id.asc", ordered.includes("id.asc"), ordered.slice(0, 160));
    check("H-2: סדר המיון נשמר (publish_date → deadline → id)",
      /order=publish_date\.desc\.nullslast,deadline\.desc\.nullslast,id\.asc/.test(ordered));

    // B-1: שליפה לפי מזהים
    calls.length = 0;
    await getTenders({ ids: ["4000620563", "muni-77"], activeOnly: false });
    const byIds = decodeURIComponent(calls[0]);
    check("B-1: נבנה מסנן id=in.(...)", /id=in\.\("4000620563","muni-77"\)/.test(byIds), byIds.slice(0, 200));

    // B-1: מזהים + activeOnly=false → בלי מסנן מועד הגשה
    check("B-1: שליפה לפי מזהים לא מסננת מכרזים שמועדם חלף", !byIds.includes("deadline.gte"));

    // B-1: מרכאות במזהה עוברות escaping ולא שוברות את המסנן
    calls.length = 0;
    await getTenders({ ids: ['a"b'] });
    check("B-1: מרכאות במזהה עוברות escaping", decodeURIComponent(calls[0]).includes('"a""b"'));

    // רגרסיה: בלי ids אין מסנן id
    calls.length = 0;
    await getTenders({ activeOnly: true });
    const plain = decodeURIComponent(calls[0]);
    check("ללא ids — אין מסנן id בשאילתה", !/[?&]id=in\./.test(plain));
    check("activeOnly עדיין מסנן לפי מועד הגשה", plain.includes("deadline.gte"));
  } finally {
    globalThis.fetch = realFetch;
  }
}

dbQueryTests()
  .catch((e) => { failures++; console.error("  ✗ dbQueryTests זרק שגיאה — " + e); })
  .then(() => {
    console.log(failures === 0 ? "\n✅ כל הבדיקות עברו" : `\n❌ ${failures} בדיקות נכשלו`);
    process.exit(failures === 0 ? 0 : 1);
  });
