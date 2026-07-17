# שווה מכרזים — ארכיטקטורת תהליכי הרקע

> מסמך זה משלים את `תיעוד-Backend-שווה-מכרזים.docx` ומתמקד בשני תהליכי הרקע
> ובהפרדת השדות ביניהם. התרשימים ב-Mermaid (מרונדרים אוטומטית ב-GitHub).

## תרשים זרימה — שני התהליכים

```mermaid
flowchart TD
    subgraph P1["תהליך 1 — סנכרון מכרזים (יומי · 07:00 · /api/cron)"]
        A1[Vercel Cron מפעיל<br/>אימות CRON_SECRET] --> A2[משיכה משלושה מקורות:<br/>obudget · muni_tenders · mr.gov.il]
        A2 --> A3[מיזוג בזיכרון לפי publication_id<br/>mr.gov.il מעדכן שדות חיים,<br/>obudget משלים שדות ייחודיים]
        A3 --> A4[(Supabase tenders —<br/>שדות בסיסיים בלבד)]
        A4 --> A5[דירוג מול פרופיל<br/>מנוע 4-ממדי scoring.ts]
        A5 --> A6[דוח יומי במייל]
        A5 --> A7{מכרזים חדשים<br/>עם ציון 80+?}
        A7 -- כן --> A8[מייל התראה חמה 🔔]
        A7 -- לא --> A9[סיום]
        A8 --> A9
    end
    A9 -. "Cron נפרד · 07:30" .-> B1
    subgraph P2["תהליך 2 — זיהוי העדפת עסקים קטנים (batch · /api/smallbiz)"]
        B1[Cron מפעיל<br/>אימות CRON_SECRET] --> B2[שליפת אצווה 6 מכרזים:<br/>small_biz_checked_at ריק<br/>+ דדליין עתידי + מקור ממשלתי]
        B2 --> B3{נותרו באצווה?}
        B3 -- לא --> B99[סיום הריצה<br/>הריצה הבאה ממשיכה את התור]
        B3 -- כן --> B4[איתור מסמכי המכרז<br/>בעמוד mr.gov.il]
        B4 --> B5[הורדת PDF וחילוץ טקסט<br/>pdf-parse]
        B5 --> B6{טקסט חולץ?}
        B6 -- "לא (סרוק)" --> B7[small_biz = null<br/>סימון 'לא ניתן לבדוק']
        B6 -- כן --> B8[שכבה א׳: ביטויי מפתח<br/>עסקים קטנים · תקנה 15א וכו']
        B8 --> B9{נמצא ביטוי?}
        B9 -- לא --> B10[small_biz = false]
        B9 -- כן --> B11[שכבה ב׳: אימות Claude Haiku<br/>פלט JSON: preference, quote, confidence]
        B11 --> B12[עדכון שדות small_biz_* בלבד]
        B10 --> B13[עדכון small_biz_checked_at]
        B7 --> B13
        B12 --> B13
        B13 --> B3
    end
    B13 -.-> C1[UI: תג 'העדפה לעסקים קטנים'<br/>+ פילטר בדשבורד<br/>מוצג בוודאות גבוהה בלבד]
```

## עקרון מניעת ההתנגשות

| | תהליך 1 (סנכרון) | תהליך 2 (העשרה) |
|---|---|---|
| כותב אל | שדות בסיסיים בלבד (title, dates, status...) | שדות `small_biz_*` בלבד |
| מנגנון | `POST ... resolution=merge-duplicates` — מעדכן רק עמודות שנשלחו | `PATCH /tenders?id=eq.X` נקודתי |
| תוצאה | אינו נוגע בשדות ההעדפה | אינו נוגע בשדות הבסיס |

ה-upsert של PostgREST מעדכן רק את העמודות שמופיעות ב-payload, ולכן הסנכרון היומי
לעולם לא דורס את תוצאות ההעשרה — ולהפך.

## שדות ההעדפה (טבלת tenders)

| שדה | סוג | תיאור |
|---|---|---|
| `small_biz` | boolean (nullable) | true = נמצאה העדפה; false = נבדק ולא נמצאה; null = טרם נבדק / לא ניתן לבדוק |
| `small_biz_summary` | text | סיכום קצר של סעיף ההעדפה |
| `small_biz_quote` | text | ציטוט מדויק מחוברת המכרז |
| `small_biz_confidence` | text | high / medium / low |
| `small_biz_checked_at` | timestamptz | מועד הבדיקה האחרון |

הוספת השדות (הרצה חד-פעמית ב-SQL Editor של Supabase):

```sql
alter table tenders
  add column if not exists small_biz boolean,
  add column if not exists small_biz_summary text,
  add column if not exists small_biz_quote text,
  add column if not exists small_biz_confidence text,
  add column if not exists small_biz_checked_at timestamptz;
```

## שכבות הזיהוי

1. **שכבה א׳ — ביטויי מפתח (חינם):** חיפוש בטקסט המחולץ אחר ביטויים כגון
   "עסק קטן", "עסקים קטנים ובינוניים", "העדפת עסקים", "תקנה 15א".
   אין התאמה → `small_biz=false` בביטחון גבוה.
2. **שכבה ב׳ — אימות LLM (Claude Haiku):** רק כשנמצא ביטוי, קטעי ההקשר
   נשלחים למודל שמחזיר JSON מובנה: האם מדובר בהעדפה אמיתית (ולא, למשל,
   באזכור אגבי), סיכום, ציטוט ורמת ביטחון. ללא `ANTHROPIC_API_KEY` —
   נסיגה לסיווג מבוסס-ביטויים עם `confidence=medium`.

## תזמונים (vercel.json)

| Cron | שעה (IL) | תפקיד |
|---|---|---|
| `/api/cron` | ‎07:00 (חלון עד 08:00) | סנכרון + דירוג + מיילים |
| `/api/smallbiz` | ‎07:30 (חלון עד 08:30) | העשרת אצווה — 6 מכרזים לריצה |

כל ריצת העשרה מטפלת באצווה קטנה בתוך מגבלת ה-serverless (60ש׳);
התור מתקדם מריצה לריצה, מהחדש לישן.
