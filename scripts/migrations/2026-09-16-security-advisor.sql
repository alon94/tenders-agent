-- ============================================================
-- 2026-09-16-security-advisor.sql
-- תיקוני Security Advisor (Supabase, פרויקט tenders-il)
-- הורץ ידנית ב-SQL Editor ב-16.09.2026. הקובץ נשמר בריפו כדי
-- שהמצב בקוד יתאים למצב ב-DB ויישמר גם אם ה-DB ייבנה מחדש.
-- כל הפקודות אידמפוטנטיות - בטוח להריץ שוב.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) RLS לטבלאות תוכן האתר (marketing_slides, site_documents)
--    הטבלאות נוצרות ב-runtime עם create table if not exists,
--    ולכן נוצרו בלי RLS. קריאה ציבורית בלבד; כתיבה רק מהשרת
--    דרך service_role (/api/admin/slides, /api/admin/documents).
-- ------------------------------------------------------------

alter table if exists public.marketing_slides enable row level security;
alter table if exists public.site_documents   enable row level security;

revoke insert, update, delete, truncate, references, trigger
  on public.marketing_slides from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.site_documents from anon, authenticated;

drop policy if exists "public read active slides"   on public.marketing_slides;
drop policy if exists "public read site documents"  on public.site_documents;

create policy "public read active slides" on public.marketing_slides
  for select to anon, authenticated using (active = true);

create policy "public read site documents" on public.site_documents
  for select to anon, authenticated using (true);

-- ------------------------------------------------------------
-- 2) פונקציות SECURITY DEFINER של המיני-מכרז: רק service_role
--    (מופעלות מהשרת /api/mt/* ומ-pg_cron בלבד).
--    לפני התיקון anon יכול היה להפעיל mt_notify/mt_log דרך
--    PostgREST ולשלוח לכל משתמש התראה עם קישור שרירותי.
-- ------------------------------------------------------------

do $$
declare f text;
begin
  foreach f in array array[
    'public.mt_bump_views(uuid)',
    'public.mt_cron_beat()',
    'public.mt_tick()',
    'public.mt_log(uuid, uuid, uuid, text, text, jsonb)',
    'public.mt_notify(uuid, text, uuid, uuid, text, text, text)',
    'public.mt_on_proposal_change()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- mt_auth_profile_id נדרשת למדיניות RLS של משתמשים מחוברים
-- (mt_tenders / mt_proposals / mt_questions / mt_awards) - נשללת מ-anon בלבד.
revoke execute on function public.mt_auth_profile_id() from public, anon;
grant  execute on function public.mt_auth_profile_id() to authenticated, service_role;

-- ------------------------------------------------------------
-- 3) search_path קבוע לפונקציות טריגר (Function Search Path Mutable)
-- ------------------------------------------------------------

alter function public.set_updated_at()         set search_path = public;
alter function public.mt_touch_updated_at()    set search_path = public;
alter function public.mt_validate_transition() set search_path = public;
alter function public.mt_check_total()         set search_path = public;

commit;

-- ------------------------------------------------------------
-- אימות (להרצה נפרדת, לא חלק מה-migration):
-- ------------------------------------------------------------
-- select relname, relrowsecurity from pg_class
--   where relname in ('marketing_slides','site_documents');
-- select proname,
--        has_function_privilege('anon', oid, 'execute')          as anon_x,
--        has_function_privilege('authenticated', oid, 'execute') as auth_x
--   from pg_proc where proname like 'mt_%';
--
-- תוצאה צפויה ב-Security Advisor: 0 errors, 2 warnings
-- (auth יכול להריץ mt_auth_profile_id - מכוון;
--  Leaked Password Protection - זמין רק בתוכנית בתשלום).
