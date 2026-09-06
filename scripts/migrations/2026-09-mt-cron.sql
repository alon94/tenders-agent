-- ============================================================
-- מיני־מכרז — תזמון. להריץ *אחרי* 2026-09-mt.sql ואחרי שהקוד עלה.
--
-- לפני הרצה, ב-Supabase → Integrations → Vault → Secrets:
--   mt_app_url      = https://tenders-agent.vercel.app   (בלי / בסוף)
--   mt_cron_secret  = אותו ערך כמו MT_CRON_SECRET ב-Vercel
-- הקובץ עצמו לא מכיל סודות ואפשר להריץ אותו שוב (אידמפוטנטי).
-- ============================================================
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;

-- הפעימה + webhook: מעברי סטטוס ב-DB (mt_tick), ואז POST ל-/api/mt/cron
-- שמרוקן את תור המיילים (mailer.dispatchEmailQueue).
create or replace function mt_cron_beat() returns void
language plpgsql security definer set search_path = public as $$
declare app_url text; secret text;
begin
  perform mt_tick();

  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'mt_app_url';
  select decrypted_secret into secret  from vault.decrypted_secrets where name = 'mt_cron_secret';
  if app_url is null or secret is null then
    raise warning 'mt_cron_beat: missing vault secrets (mt_app_url / mt_cron_secret) — skipping webhook';
    return;
  end if;

  perform net.http_post(
    url     := rtrim(app_url, '/') || '/api/mt/cron',
    headers := jsonb_build_object('content-type', 'application/json', 'x-mt-secret', secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 15000);
end $$;

do $$ declare j record;
begin
  for j in select jobid from cron.job where jobname in ('mt-tick','mt_tick') loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

select cron.schedule('mt-tick', '*/5 * * * *', $job$ select public.mt_cron_beat(); $job$);

-- אימות: שורה אחת, active = true
select jobname, schedule, active from cron.job where jobname = 'mt-tick';
-- בדיקה ידנית:  select mt_cron_beat();   select * from cron.job_run_details order by start_time desc limit 5;
--               select id, status_code, error_msg from net._http_response order by id desc limit 5;
