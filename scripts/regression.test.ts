// ============================================================
//  regression.test.ts — בדיקות קבלה לטיקטים 11/12/13
//  הרצה: npm test   (npx tsx scripts/regression.test.ts)
// ============================================================
import { parseHeDate, fmtDate, daysLeft } from "../app/lib/tenderMeta";
import { scoreTender } from "../app/lib/scoring";
import { applyBaseFilters, queryTenders } from "../app/lib/tenderQuery";
import { isExempt } from "../app/lib/tenderMeta";
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

  // בקרה חיובית: מוודאת ש-mk() חותם במפתח שהמימוש באמת קורא. בלעדיה,
  // בדיקות הזהות/התפקיד למטה היו עוברות מהסיבה הלא-נכונה (דחייה על
  // חתימה) גם מול קוד פגיע, ולא היו מוכיחות דבר.
  check("בקרה חיובית: mk() מייצר חתימה שהמימוש מקבל",
    ops.verifyAdminToken(mk(`${SEED}|super|${Date.now() + 60000}`))?.role === "super");

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

// ---------- QA/H-1: הסינון בצד שרת זהה לסינון שרץ בדפדפן ----------
// הסיכון היחיד בהעברת הסינון לשרת הוא סטייה התנהגותית. הבדיקה הזו
// מריצה את הלוגיקה *המקורית* מ-dashboard/page.tsx מול המודול המשותף,
// על 240 צירופי מסננים, ומוודאת שהתוצאה זהה לחלוטין.
console.log("\nQA/H-1 — סינון בצד שרת ≡ הסינון המקורי בדפדפן");
{
  const now = Date.parse("2026-08-17T09:00:00Z");
  const iso = (d: number) => new Date(now + d * 86400000).toISOString().slice(0, 10);
  const fx: any[] = [
    { id: "1", title: "פיתוח מערכת תוכנה", publisher: "משרד האוצר", type: "מכרז פומבי", publishDate: iso(-3), deadline: iso(5) },
    { id: "2", title: "שירותי ניקיון", publisher: "עיריית חיפה", type: "מכרז", publishDate: iso(-40), deadline: iso(60) },
    { id: "3", title: "פטור ממכרז — ספק יחיד", publisher: "משרד הבריאות", type: "פטור ממכרז", publishDate: iso(-10) },
    { id: "4", title: "הסעות תלמידים", publisher: "מועצה אזורית", type: "מכרז", publishDate: iso(-500) },
    { id: "5", title: "ייעוץ ארגוני", publisher: "רשות המסים", type: "מכרז", publishDate: iso(-1), deadline: iso(-2) },
    { id: "6", title: "אספקת ריהוט", publisher: "מינהל הרכש", type: "מכרז", publishDate: iso(-6), deadline: iso(400) },
    { id: "7", title: "קמפיין פרסום", publisher: "משרד התיירות", type: "מכרז", publishDate: iso(-2), deadline: iso(3), smallBiz: true, smallBizConfidence: "high" },
    { id: "8", title: "בינוי ותשתיות", publisher: "תאגיד מים", type: "מכרז", publishDate: iso(-90), smallBiz: true, smallBizConfidence: "low" },
  ];

  // --- הלוגיקה המקורית, כפי שהייתה ב-dashboard/page.tsx ---
  const dl = (d: string) => { const x = parseHeDate(d); return x === null ? null : Math.ceil((x.getTime() - now) / 86400000); };
  const original = (all: any[], o: any) => {
    let r = all;
    if (o.exemptView) r = r.filter((t) => isExempt(t.type, t.title));
    if (o.sbView) r = r.filter((t) => t.smallBiz && (t.smallBizConfidence === "high" || t.smallBizConfidence === "medium"));
    if (o.biz) r = r.filter((t) => matchDomain(t, o.biz));
    if (o.pub) r = r.filter((t) => matchPublisher(t, o.pub));
    if (!o.showClosed) r = r.filter((t) => { const d = dl(t.deadline); return d === null || d >= 0; });
    if (!o.showNoDate) r = r.filter((t) => !!t.deadline);
    r = r.filter((t) => {
      const d = dl(t.deadline);
      if (d !== null && d < 0) return o.showClosed;
      if (d === null) {
        if (!o.showNoDate) return false;
        const pd = parseHeDate(t.publishDate);
        return pd === null || pd.getTime() > now - 365 * 86400000;
      }
      return d <= o.maxD;
    });
    if (o.sbOnly) r = r.filter((t) => t.smallBiz && (t.smallBizConfidence === "high" || t.smallBizConfidence === "medium"));
    if (o.q && o.q.trim()) r = r.filter((t) => matchQuery(t, o.q));
    return r;
  };

  let combos = 0, mismatches = 0;
  // exemptView ו-sbView נגזרים שניהם מאותו פרמטר ?view= בדשבורד
  // (page.tsx:65-66), ולכן הם מוציאים זה את זה. איטרציה על שלושת
  // המצבים האפשריים בפועל, ולא על שני בוליאנים בלתי תלויים.
  for (const view of [null, "exempt", "smallbiz"] as const)
  for (const showClosed of [false, true])
  for (const showNoDate of [false, true])
  for (const sbOnly of [false, true])
  for (const maxD of [7, 30, 365])
  for (const q of ["", "תוכנה", "ניקיון"])
  for (const biz of ["", "tech"]) {
    combos++;
    const o = { exemptView: view === "exempt", sbView: view === "smallbiz", showClosed, showNoDate, sbOnly, maxD, q, biz, pub: "" };
    const a = original(fx, o).map((t) => t.id).join(",");
    const b = applyBaseFilters(fx, {
      view,
      biz, pub: "", maxD, showClosed, showNoDate, sbOnly, q,
    }, now).map((t) => t.id).join(",");
    if (a !== b) { mismatches++; if (mismatches <= 2) console.error(`    צירוף חורג: ${JSON.stringify(o)} → [${a}] vs [${b}]`); }
  }
  check(`${combos} צירופי מסננים — השרת מחזיר בדיוק כמו הדפדפן`, mismatches === 0, `${mismatches} חריגות`);

  // עימוד: העמודים לא חופפים ומכסים את הכל
  const r1 = queryTenders(fx, { showClosed: true, maxD: 3650 }, null, 1, 3, now);
  const r2 = queryTenders(fx, { showClosed: true, maxD: 3650 }, null, 2, 3, now);
  const ids1 = r1.tenders.map((t) => t.id), ids2 = r2.tenders.map((t) => t.id);
  check("עמוד 1 מחזיר בדיוק perPage", ids1.length === 3, String(ids1.length));
  check("אין חפיפה בין עמודים", ids1.every((i) => !ids2.includes(i)));
  check("total משקף את כל התוצאות ולא רק את העמוד", r1.total === applyBaseFilters(fx, { showClosed: true, maxD: 3650 }, now).length);

  // מיון לפי ציון פועל רק כשיש פרופיל
  const withProf = queryTenders(fx, { showClosed: true, maxD: 3650 }, { categories: ["tech"], region: "all", publisher_type: "all", keywords: "תוכנה" }, 1, 8, now);
  check("עם פרופיל — המכרז התואם ביותר ראשון", withProf.tenders[0].id === "1", withProf.tenders[0].id);
}

// ---------- QA/H-5: שפיות על שנת התאריך ----------
// לפני התיקון נכנסו למאגר מועדי הגשה בשנת 9999, 9019 ו-2206 (שגיאות
// הקלדה במקור), שהוצגו למשתמש כ"נותרו 2,911,852 ימים".
console.log("\nQA/H-5 — ולידציה על שנת התאריך");
{
  const y = new Date().getFullYear();
  check("שנה סבירה מתקבלת", scraperHeDateToIso(`15/09/${y}`) === `${y}-09-15`);
  check("שנה קרובה בעתיד מתקבלת", scraperHeDateToIso(`15/09/${y + 3}`) !== null);
  check("שנת 9999 נדחית", scraperHeDateToIso("01/01/9999") === null);
  check("שנת 9019 נדחית", scraperHeDateToIso("16/09/9019") === null);
  check("שנת 2206 נדחית", scraperHeDateToIso("16/08/2206") === null);
  check("שנה רחוקה מדי בעבר נדחית", scraperHeDateToIso(`01/01/${y - 25}`) === null);
  check("חודש לא חוקי עדיין נדחה", scraperHeDateToIso("13/13/2026") === null);
}

// ---------- QA/M-20: מילות מפתח הן הגורם המכריע בדירוג ----------
// עד לתיקון הזה, השדה keywords נקרא על ידי scoring.ts אך לא נאסף באף
// מסך — ולכן היה ריק אצל כל המשתמשים. התוצאה: אף מכרז לא חצה את סף
// "התאמה גבוהה" (80), כי קטגוריות לבדן לא מספיקות.
console.log("\nQA/M-20 — מילות מפתח בפרופיל");
{
  const now = Date.now();
  const iso = (d: number) => new Date(now + d * 86400000).toISOString().slice(0, 10);
  const tender = {
    title: "מכרז לאספקת שירותי פיתוח תוכנה ואפיון מערכות מידע",
    publisher: "משרד האוצר",
    publishDate: iso(-2),
    deadline: iso(7),
  };
  const base = { categories: ["tech"], region: "national", publisher_type: "all" };

  const without = scoreTender(tender, { ...base, keywords: "" } as never, now);
  const with1 = scoreTender(tender, { ...base, keywords: "פיתוח תוכנה" } as never, now);
  const withMany = scoreTender(tender, { ...base, keywords: "פיתוח תוכנה, אפיון, מערכות מידע" } as never, now);

  check("בלי מילות מפתח — הרלוונטיות נמוכה", without.relevance < with1.relevance,
    `${without.relevance} vs ${with1.relevance}`);
  check("מילת מפתח אחת מעלה את הציון", with1.display > without.display,
    `${without.display} → ${with1.display}`);
  check("עוד מילות מפתח מעלות עוד", withMany.display >= with1.display,
    `${with1.display} → ${withMany.display}`);
  check("עם מילות מפתח מגיעים ל'התאמה גבוהה' (80+)", withMany.display >= 80,
    `display=${withMany.display}`);
  check("בלי מילות מפתח לא מגיעים ל-80", without.display < 80, `display=${without.display}`);
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

    // B-1: escaping לפי כללי PostgREST — לוכסן אחורי, לא הכפלת מרכאה.
    // הכפלה בסגנון SQL גררה 400 PGRST100 והפילה את כל בקשת המסומנים.
    calls.length = 0;
    await getTenders({ ids: ['a"b'] });
    check("B-1: מרכאה במזהה מוברחת בלוכסן אחורי", decodeURIComponent(calls[0]).includes('"a\\"b"'),
      decodeURIComponent(calls[0]).slice(0, 120));
    calls.length = 0;
    await getTenders({ ids: ['a\\b'] });
    check("B-1: לוכסן אחורי במזהה מוכפל", decodeURIComponent(calls[0]).includes('"a\\\\b"'),
      decodeURIComponent(calls[0]).slice(0, 120));
    // פסיק ועברית בתוך מרכאות — תקינים ללא escaping נוסף
    calls.length = 0;
    await getTenders({ ids: ['מכרז, ניקיון-עיריית חיפה'] });
    // URLSearchParams מקודד רווח כ-'+' (form-encoding), ו-PostgREST מפענח
    // אותו חזרה לרווח — ולכן הפענוח בבדיקה חייב לעשות את אותו הדבר.
    const urlDecode = (s: string) => decodeURIComponent(s.replace(/\+/g, " "));
    check("B-1: פסיק ועברית בתוך מרכאות נשמרים",
      urlDecode(calls[0]).includes('"מכרז, ניקיון-עיריית חיפה"'),
      urlDecode(calls[0]).slice(0, 140));

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

// ---------- QA: מטפלי המסלולים נכשלים-סגור ----------
// מפעיל את ה-handlers ישירות עם Request אמיתי (בלי שרת מאזין), בשני
// תרחישי סביבה. שתי הרגרסיות שנתפסו כאן בפועל:
//   • domains-debug אישר בקשה ללא שום אישור כש-CRON_SECRET לא הוגדר
//     (undefined !== undefined הוא false).
//   • /api/admin/login זרק על סיסמה *נכונה* כשאין מפתח חתימה, בעוד
//     סיסמה שגויה החזירה 401 — אורקל שמאפשר לפצח את הסיסמה לפי הסטטוס.
async function routeAuthTests() {
  console.log("\nQA — מטפלי מסלולים נכשלים-סגור");
  const status = async (p: Promise<Response>) => {
    try { return (await p).status; } catch { return 500; }
  };

  for (const [label, env] of [
    ["בלי CRON_SECRET ובלי ADMIN_TOKEN_SECRET", {}],
    ["עם CRON_SECRET", { CRON_SECRET: "s3cr3t" }],
  ] as [string, Record<string, string>][]) {
    for (const k of ["CRON_SECRET", "ADMIN_TOKEN_SECRET"]) delete process.env[k];
    Object.assign(process.env, env);
    process.env.ADMIN_PASSWORD = "correct-horse";

    const bust = "?v=" + label.length + Object.keys(env).length;
    const dd = await import("../app/api/domains-debug/route" + bust);
    const login = await import("../app/api/admin/login/route" + bust);
    const mkLogin = (pw: string) => new Request("http://x/api/admin/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });

    check(`[${label}] domains-debug ללא אישור → 401`,
      (await status(dd.GET(new Request("http://x/api/domains-debug")))) === 401);
    check(`[${label}] domains-debug עם "Bearer undefined" → 401`,
      (await status(dd.GET(new Request("http://x/api/domains-debug", {
        headers: { authorization: "Bearer undefined" } })))) === 401);

    const okPw = await status(login.POST(mkLogin("correct-horse")));
    const badPw = await status(login.POST(mkLogin("nope")));
    if (Object.keys(env).length === 0) {
      check(`[${label}] סיסמה נכונה ושגויה מחזירות אותו סטטוס (בלי אורקל)`,
        okPw === badPw && okPw === 501, `ok=${okPw} bad=${badPw}`);
    } else {
      check(`[${label}] סיסמה נכונה → 200, שגויה → 401`,
        okPw === 200 && badPw === 401, `ok=${okPw} bad=${badPw}`);
    }
  }
}

dbQueryTests()
  .then(routeAuthTests)
  .catch((e) => { failures++; console.error("  ✗ בדיקה אסינכרונית זרקה שגיאה — " + e); })
  .then(() => {
    console.log(failures === 0 ? "\n✅ כל הבדיקות עברו" : `\n❌ ${failures} בדיקות נכשלו`);
    process.exit(failures === 0 ? 0 : 1);
  });
