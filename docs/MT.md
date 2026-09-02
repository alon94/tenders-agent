# מיני־מכרז (mt) — מדריך תפעול

מסמכי האפיון: `docs/אפיון-מיני-מכרז.docx` (מוצרי), `docs/אפיון-טכני-מיני-מכרז.docx` (טכני).

## סדר פריסה
1. **DB** — Supabase → SQL Editor → `scripts/migrations/2026-09-mt.sql` (אידמפוטנטי).
2. **Storage** — ליצור bucket פרטי בשם `mt-files` (public = off). אין צורך ב-policies: הגישה רק דרך signed URLs מה-API.
3. **Env ב-Vercel** (בנוסף לקיימים):
   | משתנה | חובה | תפקיד |
   |---|---|---|
   | `MT_CRON_SECRET` | כן | אימות `/api/mt/cron` (pg_net) — מחרוזת אקראית ארוכה |
   | `MT_OTP_PEPPER` | מומלץ | pepper ל-hash של קודי OTP (אחרת נופל ל-MT_CRON_SECRET) |
   | `SMS_WEBHOOK_URL`, `SMS_API_KEY`, `SMS_SENDER` | ל-OTP בייצור | ספק SMS דרך webhook גנרי `POST {to,text,sender}` |
   | `ANTHROPIC_API_KEY` | קיים | עוזר הניסוח (`/api/mt/ai-draft`) |
   | `GMAIL_USER`, `GMAIL_APP_PASSWORD` | קיימים | מיילים |
4. **דיפלוי קוד** (`git push`).
5. **בדיקות RLS מול הפרויקט**: `npm run test:mt-rls` עם `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
6. **Cron** — להפעיל pg_cron + pg_net ב-Supabase, להחליף URL וסוד ב-`scripts/migrations/2026-09-mt-cron.sql` ולהריץ.
7. בדיקת פעימה ידנית: `curl -H "x-mt-secret: $MT_CRON_SECRET" "https://<site>/api/mt/cron?tick=1"`.

## מבנה הקוד
- `app/lib/mt/` — `http` (שגיאות אחידות), `db` (PostgREST + Storage עם service role), `auth` (אימות טוקן מול GoTrue), `validate`, `types`, `tender` (דומיין), `events` (יומן+התראות דרך mt_log/mt_notify), `mailer`+`templates`, `rate`, `sms`, `otp`, `questions`.
- `app/api/mt/**` — 24 route handlers. כל אחד: `handle(async (req, ctx) => ...)`, אימות → ולידציה → פעולה → אירוע/התראה.
- הלקוח קורא נתונים ישירות מ-PostgREST (anon + RLS) או דרך ה-GET-ים כאן; **כל כתיבה — כאן בלבד**.

## החלטות שסטו מהאפיון (ומדוע)
- מזהה פרופיל = `business_profiles.user_id` (לא `id`) — זו העמודה שהאפליקציה עובדת איתה.
- אין zod: `app/lib/mt/validate.ts` קטן ובלי תלות. להחליף אם הפרויקט יאמץ zod.
- OTP: משתמש GoTrue נוצר עם מייל סינתטי `<phone>@otp.shaveh.local` וסיסמה אקראית שמתחלפת בכל אימות — אין סיסמה קבועה.
- PDF להצעה נדחה (דף הדפסה יגיע ב-1d); ייצוא השוואה = CSV בלקוח.

## בדיקה מקומית של המיגרציה (Postgres רגיל)
```
createdb mt_test
psql -d mt_test -f scripts/migrations/local-test/supabase-stub.sql -f scripts/migrations/2026-09-mt.sql -f scripts/migrations/local-test/mt-scenario.sql
```
כל שורה אמורה להסתיים ב-`| t`.
