-- תרחיש מקומי מלא: פרסום, הצעות, טריגרים, RLS לפני/אחרי המועד, mt_tick, זכייה.
-- כל שורה אמורה להסתיים ב-| t (או NOTICE: OK). ראה supabase-stub.sql להרצה.
\set ON_ERROR_STOP on
-- שלושה משתמשים: מזמין, מציע א', מציע ב' (חסום)
insert into business_profiles (user_id, email, categories, region) values
 ('11111111-1111-1111-1111-111111111111','buyer@t.il','{construction}','north'),
 ('22222222-2222-2222-2222-222222222222','bidderA@t.il','{construction}','north'),
 ('33333333-3333-3333-3333-333333333333','bidderB@t.il','{construction}','north');

-- טיוטה -> פרסום
insert into mt_tenders (id, buyer_profile_id, created_by_user_id, title, category_ids, deadline_at, blocked_profile_ids)
values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',
        'שיפוץ משרד','{construction}', now() + interval '5 days', '{}');
insert into mt_tender_items (tender_id, position, description, quantity, unit) values
 ('aaaaaaaa-0000-0000-0000-000000000001',1,'צביעה',4,'unit'),
 ('aaaaaaaa-0000-0000-0000-000000000001',2,'ריצוף',60,'sqm');

-- מעבר לא חוקי חייב להיכשל
do $$ begin
  update mt_tenders set status='awarded' where id='aaaaaaaa-0000-0000-0000-000000000001';
  raise exception 'FAIL: illegal transition allowed';
exception when check_violation then raise notice 'OK illegal transition blocked'; end $$;

-- פרסום עם מועד קצר מדי חייב להיכשל
do $$ begin
  update mt_tenders set status='open', deadline_at = now() + interval '1 hour' where id='aaaaaaaa-0000-0000-0000-000000000001';
  raise exception 'FAIL: short deadline allowed';
exception when check_violation then raise notice 'OK short deadline blocked'; end $$;

update mt_tenders set status='open' where id='aaaaaaaa-0000-0000-0000-000000000001';
select 'published_at set' as chk, published_at is not null and questions_close_at = deadline_at - interval '24 hours' as ok
  from mt_tenders where id='aaaaaaaa-0000-0000-0000-000000000001';

-- הצעות (sealed_until = deadline)
insert into mt_proposals (id, tender_id, bidder_profile_id, submitted_by_user_id, status, sealed_until, subtotal, discount_type, discount_value, validity_days)
select 'bbbbbbbb-0000-0000-0000-000000000001', id, '22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','submitted', deadline_at, 10000, 'percent', 10, 30
  from mt_tenders where id='aaaaaaaa-0000-0000-0000-000000000001';
insert into mt_proposals (id, tender_id, bidder_profile_id, submitted_by_user_id, status, sealed_until, subtotal, total)
select 'bbbbbbbb-0000-0000-0000-000000000002', id, '33333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333','submitted', deadline_at, 8000, 8000
  from mt_tenders where id='aaaaaaaa-0000-0000-0000-000000000001';

select 'total computed' as chk, total = 9000 as ok from mt_proposals where id='bbbbbbbb-0000-0000-0000-000000000001';
select 'proposals_count trigger' as chk, proposals_count = 2 as ok from mt_tenders where id='aaaaaaaa-0000-0000-0000-000000000001';

-- סכום שגוי חייב להיכשל
do $$ begin
  update mt_proposals set total = 1 where id='bbbbbbbb-0000-0000-0000-000000000001';
  raise exception 'FAIL: bad total allowed';
exception when check_violation then raise notice 'OK bad total blocked'; end $$;

-- הצעה שנייה פעילה מאותו מציע חייבת להיכשל
do $$ begin
  insert into mt_proposals (tender_id, bidder_profile_id, submitted_by_user_id, status, sealed_until)
  values ('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','submitted', now()+interval '5 days');
  raise exception 'FAIL: duplicate proposal allowed';
exception when unique_violation then raise notice 'OK duplicate proposal blocked'; end $$;

-- ===== RLS: לפני המועד =====
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', false);
select 'buyer sees own tender' as chk, count(*) = 1 as ok from mt_tenders;
select 'buyer sees 0 proposals before deadline' as chk, count(*) = 0 as ok from mt_proposals;
select 'buyer cannot insert' as chk, false as ok where false; -- ראה בלוק למטה
do $$ begin
  insert into mt_events (tender_id, event_type) values ('aaaaaaaa-0000-0000-0000-000000000001','x');
  raise exception 'FAIL: client insert allowed';
exception when insufficient_privilege then raise notice 'OK client insert blocked'; end $$;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', false);
select 'bidder A sees only own proposal' as chk, count(*) = 1 and bool_and(bidder_profile_id='22222222-2222-2222-2222-222222222222') as ok from mt_proposals;
select 'bidder A sees open tender' as chk, count(*) = 1 as ok from mt_tenders;
select 'bidder A sees items' as chk, count(*) = 2 as ok from mt_tender_items;
select 'bidder cannot read events' as chk, false as ok where false;
do $$ begin
  perform count(*) from mt_events;
  raise exception 'FAIL: events readable';
exception when insufficient_privilege then raise notice 'OK events not readable'; end $$;

reset role;
-- חסימת מציע ב'
update mt_tenders set blocked_profile_ids = '{33333333-3333-3333-3333-333333333333}' where id='aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', false);
select 'blocked bidder sees no tender' as chk, count(*) = 0 as ok from mt_tenders;
reset role;

-- ===== המועד עובר -> mt_tick =====
update mt_tenders set deadline_at = now() - interval '1 minute', questions_close_at = now() - interval '2 days' where id='aaaaaaaa-0000-0000-0000-000000000001';
update mt_proposals set sealed_until = now() - interval '1 minute' where tender_id='aaaaaaaa-0000-0000-0000-000000000001';
select * from mt_tick();
select 'tick -> evaluating' as chk, status = 'evaluating' as ok from mt_tenders where id='aaaaaaaa-0000-0000-0000-000000000001';
select 'rank assigned (cheapest=1)' as chk, rank = 1 as ok from mt_proposals where id='bbbbbbbb-0000-0000-0000-000000000002';
select 'notifications queued' as chk, count(*) >= 3 as ok from mt_notifications;
select 'events logged' as chk, count(*) >= 1 as ok from mt_events where event_type='mt_closed';

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', false);
select 'buyer sees 2 proposals after deadline' as chk, count(*) = 2 as ok from mt_proposals;
select 'buyer sees own in_app notifications' as chk, count(*) >= 1 and bool_and(channel='in_app') as ok from mt_notifications;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', false);
select 'bidder A still sees only own after deadline' as chk, count(*) = 1 as ok from mt_proposals;
reset role;

-- idempotent tick
select 'second tick no-op' as chk, closed = 0 and expired = 0 as ok from mt_tick();

-- זכייה
update mt_tenders set status='awarded', awarded_at = now() where id='aaaaaaaa-0000-0000-0000-000000000001';
select 'award transition ok' as chk, status='awarded' as ok from mt_tenders where id='aaaaaaaa-0000-0000-0000-000000000001';
