"use client";
import { useEffect, useState } from "react";
import { getSession, type AuthSession } from "./lib/authClient";

/* ============================================================
   דף הבית השיווקי — "שווה מכרזים"
   שפה עיצובית: עולם מסמכי הרכש הממשלתי — דיו נייבי, מספרי
   פרסום בגופן מונו כמו ברשומות רשמיות, וחותמת זהב כאלמנט
   החתימה (מגלמת את זיהוי סעיף ההעדפה מתוך חוברת המכרז).
   ============================================================ */

const INK = "#0d2c4a";      // דיו — טקסט וגושים כהים
const BLUE = "#2b6fc4";     // פעולה — זהה לצבע הפעולה בדשבורד
const GOLD = "#b8945f";     // חותמת — צבע המותג
const PAPER = "#f4f7fb";    // נייר
const LINE = "#dbe3ec";
const MUTED = "#5b6b7a";

interface Counts { active?: number; exempt?: number; smallbiz?: number }
interface Sample { id: string; title: string; publisher: string }
interface Slide { id?: number; title: string; subtitle?: string | null; badge?: string | null; cta_label?: string | null; cta_href?: string | null }

// שקופיות ברירת מחדל — מוצגות עד שמנהל המערכת מגדיר משלו
const FALLBACK_SLIDES: Slide[] = [
  { badge: "חדש במערכת", title: "דקל מכרז נוסף למקורות", subtitle: "עיריית ירושלים, מוריה, אוניברסיטת בן גוריון ונתיבי איילון — כולם במקום אחד.", cta_label: "לצפייה במכרזים", cta_href: "/dashboard" },
  { badge: "בלעדי", title: "מכרזים עם העדפה לעסקים קטנים", subtitle: "המערכת קוראת את חוברות המכרז ומאתרת את סעיף ההעדפה עבורך.", cta_label: "לצפייה במכרזים המסומנים", cta_href: "/dashboard?view=smallbiz" },
  { badge: "הסוכן החכם", title: "דירוג לפי הפרופיל העסקי שלך", subtitle: "הגדר תחום, אזור וסוגי גופים — והמכרזים הרלוונטיים יעלו לראש הרשימה.", cta_label: "להגדרת פרופיל", cta_href: "/profile" },
];

export default function Home() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [sample, setSample] = useState<Sample[]>([]);
  const [slides, setSlides] = useState<Slide[]>(FALLBACK_SLIDES);
  const [si, setSi] = useState(0);

  useEffect(() => { setSession(getSession()); }, []);
  useEffect(() => {
    fetch("/api/nav-counts").then(r => r.ok ? r.json() : {}).then(setCounts).catch(() => {});
    fetch("/api/tenders?sample=1")
      .then(r => r.ok ? r.json() : { tenders: [] })
      .then(d => setSample((d.tenders || []).filter((t: Sample) => t.title && t.title.length > 12).slice(0, 12)))
      .catch(() => {});
    fetch("/api/slides")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.slides?.length) setSlides(d.slides); })
      .catch(() => {});
  }, []);

  // סיבוב אוטומטי — נעצר כשהמשתמש מבקש הפחתת תנועה
  useEffect(() => {
    if (slides.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setSi(v => (v + 1) % slides.length), 6500);
    return () => clearInterval(t);
  }, [slides.length]);

  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("he-IL"));
  const primaryHref = session ? "/dashboard" : "/signup";
  const primaryLabel = session ? "כניסה לדשבורד" : "פתיחת חשבון";

  return (
    <div dir="rtl" style={{ background: "#fff", color: INK, fontFamily: "'Assistant',system-ui,sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&family=Assistant:wght@400;600&display=swap');
        *{box-sizing:border-box}
        body{margin:0}
        .h{font-family:'Heebo',system-ui,sans-serif;font-weight:900;letter-spacing:-0.02em;line-height:1.12}
        .mono{font-family:ui-monospace,'Courier New',monospace;font-variant-numeric:tabular-nums}
        .wrap{max-width:1120px;margin:0 auto;padding:0 22px}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:10px;
          padding:14px 26px;font-size:16px;font-weight:700;text-decoration:none;transition:transform .12s ease,box-shadow .12s ease}
        .btn:hover{transform:translateY(-1px)}
        .btn-p{background:${BLUE};color:#fff;box-shadow:0 6px 18px rgba(43,111,196,.32)}
        .btn-s{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.45)}
        .btn-d{background:${INK};color:#fff}
        .card{background:#fff;border:1px solid ${LINE};border-radius:14px;padding:26px;transition:transform .14s ease,box-shadow .14s ease}
        .card:hover{transform:translateY(-3px);box-shadow:0 10px 30px rgba(13,44,74,.08)}
        .tick{display:flex;gap:10px;width:max-content;animation:tick 60s linear infinite}
        @keyframes tick{from{transform:translateX(-50%)}to{transform:translateX(0)}}
        a:focus-visible,.btn:focus-visible{outline:3px solid ${GOLD};outline-offset:3px}
        @media (prefers-reduced-motion:reduce){.tick{animation:none}.card:hover,.btn:hover{transform:none}}
        @media(max-width:720px){.hide-m{display:none}}
      `}</style>

      {/* ---------- ניווט ---------- */}
      <header style={{ borderBottom: `1px solid ${LINE}`, position: "sticky", top: 0, background: "rgba(255,255,255,.94)", backdropFilter: "blur(8px)", zIndex: 50 }}>
        <div className="wrap" style={{ display: "flex", alignItems: "center", gap: 14, height: 66 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: BLUE, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>ש</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>שווה מכרזים</div>
            <div style={{ fontSize: 11.5, color: MUTED }}>מועדון עסקים 360</div>
          </div>
          <a className="hide-m" href="/dashboard" style={{ color: INK, textDecoration: "none", fontWeight: 600, fontSize: 15 }}>המכרזים</a>
          <a className="hide-m" href="/sources" style={{ color: INK, textDecoration: "none", fontWeight: 600, fontSize: 15 }}>מקורות</a>
          <a href={session ? "/dashboard" : "/signin"} style={{ color: BLUE, textDecoration: "none", fontWeight: 700, fontSize: 15 }}>
            {session ? "לדשבורד" : "התחברות"}
          </a>
        </div>
      </header>

      {/* ---------- סליידר שיווקי (מנוהל מ-/admin) — ראשון מתחת להדר ---------- */}
      <section style={{ background: INK, borderBottom: "1px solid rgba(255,255,255,.1)" }}>
        <div className="wrap" style={{ paddingTop: 22, paddingBottom: 22 }}>
          <div style={{
            position: "relative",
            background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.16)",
            borderInlineStart: `3px solid ${GOLD}`, borderRadius: 14,
            padding: "20px clamp(20px,3vw,30px)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", minHeight: 96,
          }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              {slides.map((sl, i) => (
                <div key={sl.id ?? i} aria-hidden={i !== si} style={{ display: i === si ? "block" : "none" }}>
                  {sl.badge && (
                    <span style={{ display: "inline-block", color: GOLD, fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", marginBottom: 6 }}>
                      {sl.badge}
                    </span>
                  )}
                  <div className="h" style={{ fontSize: "clamp(17px,2.1vw,22px)", marginBottom: 5, color: "#fff" }}>{sl.title}</div>
                  {sl.subtitle && (
                    <p style={{ color: "#b9cbdf", fontSize: 14.5, lineHeight: 1.55, margin: 0, maxWidth: 660 }}>{sl.subtitle}</p>
                  )}
                </div>
              ))}
            </div>

            {slides[si]?.cta_label && (
              <a href={slides[si].cta_href || "/dashboard"} className="btn btn-p" style={{ padding: "11px 20px", fontSize: 14.5, flex: "0 0 auto" }}>
                {slides[si].cta_label} ←
              </a>
            )}

            {slides.length > 1 && (
              <div style={{ display: "flex", gap: 7, flex: "0 0 auto" }}>
                {slides.map((_, i) => (
                  <button key={i} onClick={() => setSi(i)} aria-label={`שקופית ${i + 1}`}
                    style={{
                      width: i === si ? 22 : 8, height: 8, borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
                      background: i === si ? GOLD : "rgba(255,255,255,.32)", transition: "width .2s ease",
                    }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Hero ---------- */}
      <section style={{ background: INK, color: "#fff", paddingTop: 44, paddingBottom: 0 }}>
        <div className="wrap">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 999, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, marginBottom: 26 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD }} />
            שירות של שווה קולקטיב לעסקים קטנים ובינוניים
          </div>

          <h1 className="h" style={{ fontSize: "clamp(34px,5.6vw,62px)", margin: "0 0 20px", maxWidth: 880 }}>
            כל המכרזים הציבוריים בישראל.<br />
            <span style={{ color: GOLD }}>מסוננים לפי העסק שלך.</span>
          </h1>

          <p style={{ fontSize: "clamp(16px,2vw,20px)", lineHeight: 1.62, color: "#c6d4e4", maxWidth: 640, margin: "0 0 34px" }}>
            מכרזים מתפרסמים בעשרות אתרים נפרדים, כל אחד בפורמט אחר. אנחנו אוספים אותם למקום אחד,
            מסווגים לפי תחום, ומדרגים לפי הפרופיל העסקי שלך — כדי שתראה רק את מה שרלוונטי לך.
          </p>

          <div style={{ display: "flex", gap: 13, flexWrap: "wrap", marginBottom: 30 }}>
            <a className="btn btn-p" href={primaryHref}>{primaryLabel} ←</a>
            <a className="btn btn-s" href="/dashboard">לצפייה במכרזים</a>
          </div>

          {/* מדדים חיים */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 14, overflow: "hidden" }}>
            {[
              { v: n(counts.active), l: "מכרזים פעילים" },
              { v: "13", l: "מקורות נסרקים" },
              { v: n(counts.smallbiz), l: "עם העדפה לעסקים קטנים" },
              { v: "יומי 06:00", l: "תדירות עדכון" },
            ].map((k) => (
              <div key={k.l} style={{ background: INK, padding: "20px 18px" }}>
                <div className="h" style={{ fontSize: 27, color: "#fff" }}>{k.v}</div>
                <div style={{ fontSize: 12.5, color: "#93a9c1", marginTop: 5 }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* טיקר מכרזים אמיתיים — התוכן עצמו הוא ההוכחה */}
        <div style={{ marginTop: 44, borderTop: "1px solid rgba(255,255,255,.14)", padding: "16px 0", overflow: "hidden", maskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)" }}>
          <div className="tick">
            {[...sample, ...sample].map((t, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", fontSize: 13.5, color: "#9fb4cb", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "8px 14px" }}>
                <span className="mono" style={{ color: GOLD, fontSize: 12 }}>{String(t.id).slice(0, 10)}</span>
                {t.title.length > 62 ? t.title.slice(0, 62).replace(/\s+\S*$/, '') + '…' : t.title}
              </span>
            ))}
            {sample.length === 0 && <span style={{ color: "#7b91a8", fontSize: 13.5 }}>טוען מכרזים עדכניים…</span>}
          </div>
        </div>
      </section>

      {/* ---------- הבעיה ---------- */}
      <section style={{ background: PAPER, padding: "76px 0", borderBottom: `1px solid ${LINE}` }}>
        <div className="wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 34, alignItems: "start" }}>
          <div>
            <h2 className="h" style={{ fontSize: "clamp(25px,3.4vw,38px)", margin: "0 0 18px" }}>
              הבעיה איננה שאין מכרזים.<br />הבעיה היא למצוא אותם.
            </h2>
            <p style={{ fontSize: 16.5, lineHeight: 1.72, color: MUTED, margin: 0 }}>
              משרדי ממשלה, עיריות, אוניברסיטאות, קופות חולים ותאגידים ציבוריים — כל אחד מפרסם באתר משלו,
              בפורמט משלו, לעיתים בלי מועד הגשה מסודר. עסק קטן שרוצה כיסוי אמיתי צריך לעקוב ידנית אחרי
              עשרות אתרים, כל יום.
            </p>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              ["מפוזר", "מכרזים מתפרסמים בעשרות פורטלים נפרדים ללא תקן אחיד"],
              ["לא מסונן", "רוב המכרזים אינם רלוונטיים לתחום או לגודל של העסק"],
              ["נעלם מהר", "מועד ההגשה חולף לפני שהמכרז בכלל הגיע לידיעתך"],
            ].map(([t, d]) => (
              <div key={t} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{t}</div>
                <div style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.6 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- יכולות ---------- */}
      <section style={{ padding: "80px 0" }}>
        <div className="wrap">
          <h2 className="h" style={{ fontSize: "clamp(25px,3.4vw,38px)", margin: "0 0 12px" }}>מה המערכת עושה בשבילך</h2>
          <p style={{ color: MUTED, fontSize: 16.5, margin: "0 0 40px", maxWidth: 620 }}>
            איסוף, סיווג ודירוג — אוטומטית, כל יום, בלי שתצטרך לפתוח אתר אחד.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(268px,1fr))", gap: 18 }}>
            {[
              { i: "⛁", t: "איסוף מ-13 מקורות", d: "מינהל הרכש הממשלתי, רמ\"י, רשות שדות התעופה, מכבי, ביטוח לאומי, משרד הביטחון, דקל מכרז ועוד — נסרקים ומתעדכנים מדי בוקר." },
              { i: "◈", t: "סוכן שמדרג לפי הפרופיל", d: "מגדירים תחום, אזור וסוג גופים — והמערכת נותנת ציון התאמה לכל מכרז, כך שהרלוונטיים עולים לראש הרשימה." },
              { i: "⌕", t: "סיווג ל-15 תחומים", d: "בינוי, טכנולוגיה, ייעוץ, ניקיון, הסעות, בריאות, נדל\"ן ועוד. מנוע התאמה אחד — החיפוש והסינון תמיד מחזירים אותה תוצאה." },
              { i: "✉", t: "דוח יומי למייל", d: "רשימת המכרזים החדשים שתואמים לפרופיל שלך, ישירות לתיבה, עם קישור להגשה." },
              { i: "⊘", t: "הודעות פטור וספק יחיד", d: "מסך ייעודי להתקשרויות בפטור ממכרז — מודיעין עסקי על מי זכה, באיזה משרד ובאיזה תחום." },
              { i: "▤", t: "ערבויות וליווי", d: "הכוונה בשלב ההגשה, כולל ערבויות מכרז — דרך מערך השירות של שווה קולקטיב." },
            ].map((f) => (
              <div className="card" key={f.t}>
                <div style={{ fontSize: 21, color: BLUE, marginBottom: 12 }}>{f.i}</div>
                <div className="h" style={{ fontSize: 18.5, marginBottom: 9 }}>{f.t}</div>
                <div style={{ fontSize: 14.8, lineHeight: 1.68, color: MUTED }}>{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- חותמת: העדפה לעסקים קטנים (אלמנט החתימה) ---------- */}
      <section style={{ background: INK, color: "#fff", padding: "84px 0" }}>
        <div className="wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 46, alignItems: "center" }}>
          <div>
            <div style={{ color: GOLD, fontSize: 13, fontWeight: 700, letterSpacing: ".04em", marginBottom: 14 }}>היכולת שאין בשום מקום אחר</div>
            <h2 className="h" style={{ fontSize: "clamp(26px,3.6vw,40px)", margin: "0 0 18px" }}>
              מזהים את סעיף ההעדפה — <br />גם כשהוא קבור בעמוד 40
            </h2>
            <p style={{ fontSize: 16.5, lineHeight: 1.72, color: "#c6d4e4", margin: "0 0 22px" }}>
              תקנות חובת המכרזים מאפשרות לגופים ציבוריים לתת עדיפות לעסקים קטנים ובינוניים.
              הסעיף הזה כמעט אף פעם לא מופיע בכותרת — הוא נמצא בתוך חוברת המכרז.
              המערכת קוראת את החוברות, מאתרת את הסעיף ומסמנת את המכרזים שבהם יש לך יתרון מובנה.
            </p>
            <a className="btn btn-p" href="/dashboard?view=smallbiz">{`לצפייה ב-${n(counts.smallbiz)} מכרזים עם העדפה ←`}</a>
          </div>

          {/* החותמת */}
          <div style={{ display: "grid", placeItems: "center", padding: 12 }}>
            <div style={{
              transform: "rotate(-7deg)", border: `3px solid ${GOLD}`, borderRadius: 14,
              padding: "26px 30px", textAlign: "center", color: GOLD, maxWidth: 320,
              boxShadow: "0 0 0 5px rgba(184,148,95,.13)",
            }}>
              <div style={{ fontSize: 12, letterSpacing: ".22em", marginBottom: 8 }}>נבדק ואומת</div>
              <div className="h" style={{ fontSize: 27, color: GOLD, lineHeight: 1.2 }}>העדפה<br />לעסקים קטנים</div>
              <div style={{ height: 1, background: GOLD, opacity: .5, margin: "14px 0" }} />
              <div className="mono" style={{ fontSize: 12.5 }}>תקנה 34 · חובת המכרזים</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- איך זה עובד ---------- */}
      <section style={{ padding: "80px 0", background: PAPER }}>
        <div className="wrap">
          <h2 className="h" style={{ fontSize: "clamp(25px,3.4vw,38px)", margin: "0 0 40px" }}>שלושה צעדים להתחלה</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(258px,1fr))", gap: 20 }}>
            {[
              ["01", "פותחים חשבון", "הרשמה קצרה עם מייל. אין צורך בכרטיס אשראי."],
              ["02", "מגדירים פרופיל עסקי", "תחומי פעילות, אזור גיאוגרפי וסוגי גופים שמעניינים אתכם."],
              ["03", "מקבלים מכרזים מדורגים", "הדשבורד ממוין לפי התאמה, והדוח היומי מגיע למייל."],
            ].map(([num, t, d]) => (
              <div key={num} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 26 }}>
                <div className="mono h" style={{ fontSize: 30, color: GOLD, marginBottom: 12 }}>{num}</div>
                <div className="h" style={{ fontSize: 19, marginBottom: 8 }}>{t}</div>
                <div style={{ fontSize: 14.8, lineHeight: 1.68, color: MUTED }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- מקורות ---------- */}
      <section style={{ padding: "72px 0" }}>
        <div className="wrap">
          <h2 className="h" style={{ fontSize: "clamp(23px,3vw,32px)", margin: "0 0 10px" }}>מאיפה מגיעים המכרזים</h2>
          <p style={{ color: MUTED, fontSize: 16, margin: "0 0 26px" }}>מקורות רשמיים בלבד — ישירות מהגוף המפרסם, ללא מתווכים.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {["מינהל הרכש הממשלתי", "רשות מקרקעי ישראל", "רשות שדות התעופה", "משרד הביטחון", "מכבי שירותי בריאות",
              "המוסד לביטוח לאומי", "דקל מכרז", "אוניברסיטת תל אביב", "הרשות לפיתוח ירושלים", "עיריות ורשויות מקומיות",
              "התקציב הפתוח"].map((sName) => (
              <span key={sName} style={{ border: `1px solid ${LINE}`, borderRadius: 999, padding: "9px 16px", fontSize: 14.2, background: "#fff", fontWeight: 600 }}>{sName}</span>
            ))}
          </div>
          <div style={{ marginTop: 22 }}>
            <a href="/sources" style={{ color: BLUE, fontWeight: 700, textDecoration: "none", fontSize: 15 }}>לרשימת המקורות המלאה ←</a>
          </div>
        </div>
      </section>

      {/* ---------- למי מתאים ---------- */}
      <section style={{ padding: "20px 0 76px" }}>
        <div className="wrap">
          <h2 className="h" style={{ fontSize: "clamp(23px,3vw,32px)", margin: "0 0 22px" }}>למי זה מתאים</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
            {[
              ["קבלנים ובעלי מקצוע", "בינוי, שיפוצים, חשמל, אינסטלציה, גינון"],
              ["נותני שירותים", "ניקיון, אבטחה, הסעות, קייטרינג"],
              ["יועצים ובעלי מקצוע חופשי", "ייעוץ ארגוני, כלכלי, משפטי וראיית חשבון"],
              ["חברות טכנולוגיה", "פיתוח תוכנה, מערכות מידע, סייבר ודיגיטל"],
            ].map(([t, d]) => (
              <div key={t} style={{ borderTop: `3px solid ${GOLD}`, paddingTop: 14 }}>
                <div className="h" style={{ fontSize: 17, marginBottom: 6 }}>{t}</div>
                <div style={{ fontSize: 14.2, color: MUTED, lineHeight: 1.6 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- שאלות נפוצות ---------- */}
      <section style={{ padding: "76px 0", background: PAPER, borderTop: `1px solid ${LINE}` }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <h2 className="h" style={{ fontSize: "clamp(23px,3vw,32px)", margin: "0 0 26px" }}>שאלות נפוצות</h2>
          {[
            ["באיזו תדירות מתעדכנים המכרזים?", "המערכת סורקת את כל המקורות מדי בוקר. מכרז שפורסם היום יופיע בדשבורד למחרת, ובדוח היומי אם הוא תואם לפרופיל שלך."],
            ["איך נקבע ציון ההתאמה?", "לפי התאמת התחום לפרופיל העסקי שהגדרת, סוג הגוף המפרסם, האזור, וכן דחיפות (מרחק ממועד ההגשה) וטריות הפרסום."],
            ["מה זו העדפה לעסקים קטנים?", "תקנות חובת המכרזים מאפשרות לגוף ציבורי להעדיף הצעות של עסקים קטנים ובינוניים בתנאים מסוימים. המערכת קוראת את חוברת המכרז ומסמנת מכרזים שכוללים סעיף כזה."],
            ["האם המערכת מגישה את המכרז עבורי?", "לא. המערכת מאתרת, מסננת ומתריעה — ההגשה עצמה מתבצעת מולך אל מול הגוף המפרסם, עם קישור ישיר למכרז במקור."],
            ["האם כל המכרזים בישראל נמצאים כאן?", "אנחנו מכסים את המקורות הציבוריים המרכזיים ומרחיבים באופן שוטף. מקורות שאינם מאפשרים סריקה אוטומטית מסומנים בעמוד המקורות."],
          ].map(([q, a]) => (
            <details key={q} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "16px 18px", marginBottom: 11 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 16 }}>{q}</summary>
              <div style={{ marginTop: 10, color: MUTED, fontSize: 15, lineHeight: 1.7 }}>{a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- CTA סוגר ---------- */}
      <section style={{ padding: "76px 0", textAlign: "center" }}>
        <div className="wrap">
          <h2 className="h" style={{ fontSize: "clamp(26px,3.8vw,42px)", margin: "0 0 16px" }}>
            {`${n(counts.active)} מכרזים פעילים מחכים לכם`}
          </h2>
          <p style={{ color: MUTED, fontSize: 17, margin: "0 auto 30px", maxWidth: 540, lineHeight: 1.65 }}>
            פתיחת חשבון לוקחת דקה. הגדרת הפרופיל העסקי — עוד שתיים.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a className="btn btn-p" href={primaryHref}>{primaryLabel} ←</a>
            <a className="btn btn-d" href="/dashboard">לצפייה במכרזים</a>
          </div>
        </div>
      </section>

      {/* ---------- פוטר ---------- */}
      <footer style={{ background: INK, color: "#93a9c1", padding: "40px 0" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ color: "#fff", fontWeight: 800, marginBottom: 5 }}>שווה מכרזים · מועדון עסקים 360</div>
            <div style={{ fontSize: 13.5 }}>שירות של שווה קולקטיב לעסקים קטנים ובינוניים</div>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14 }}>
            <a href="/dashboard" style={{ color: "#93a9c1", textDecoration: "none" }}>המכרזים</a>
            <a href="/sources" style={{ color: "#93a9c1", textDecoration: "none" }}>מקורות</a>
            <a href="/terms" style={{ color: "#93a9c1", textDecoration: "none" }}>תנאי שימוש</a>
            <a href="/privacy" style={{ color: "#93a9c1", textDecoration: "none" }}>פרטיות</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
