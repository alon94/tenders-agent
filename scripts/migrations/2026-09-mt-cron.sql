-- ============================================================
-- מיני־מכרז — תזמון. להריץ *אחרי* 2026-09-mt.sql ואחרי שהקוד עלה.
-- דורש: Database → Extensions → pg_cron + pg_net מופעלות.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- כתובת ה-webhook והסוד. להחליף לפני ההרצה. אותו סוד ב-Vercel כ-MT_CRON_SECRET.
alter database postgres set app.settings.mt_cron_url    = 'https://tenders-agent.vercel.app/api/mt/cron';
alter database postgres set app.settings.mt_cron_secret = 'REPLACE_WITH_LONG_RANDOM_SECRET';

-- הפעימה: מעברי סטטוס ב-DB, ואז webhook שמרוקן את תור המיילים.
select cron.unschedule('mt-tick') where exists (select 1 from cron.job where jobname = 'mt-tick');
select cron.schedule('mt-tick', '*/5 * * * *', $job$
  select mt_tick();
  select net.http_post(
    url     := current_setting('app.settings.mt_cron_url'),
    headers := jsonb_build_object('content-type', 'application/json',
                                  'x-mt-secret', current_setting('app.settings.mt_cron_secret')),
    body    := '{}'::jsonb);
$job$);

-- בדיקה ידנית:  select * from mt_tick();   select * from cron.job_run_details order by start_time desc limit 5;
