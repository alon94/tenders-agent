-- ============================================================
-- מיני־מכרז (mt_*) — מיגרציה ראשית. MVP-1a.
-- מקור: docs/אפיון-טכני-מיני-מכרז.docx (סעיפים 3–4).
--
-- הרצה: Supabase → SQL Editor → הדבקה והרצה כקובץ אחד. אידמפוטנטי ברובו
-- (IF NOT EXISTS / OR REPLACE); enums נוצרים רק אם אינם קיימים.
--
-- החלטת זיהוי: "פרופיל עסקי" מזוהה לכל אורך הסכמה על ידי business_profiles.user_id
-- (auth.users.id). זו העמודה הייחודית שהאפליקציה עובדת איתה (on_conflict=user_id),
-- ולכן buyer_profile_id / bidder_profile_id מפנים אליה ולא לעמודת id.
--
-- החלק המתוזמן (pg_cron + pg_net) נמצא בקובץ נפרד: 2026-09-mt-cron.sql.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 1. טיפוסים ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'mt_tender_status') then
    create type mt_tender_status as enum ('draft','open','evaluating','awarded',
      'no_award','cancelled','expired','completed','archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'mt_engagement_type') then
    create type mt_engagement_type as enum ('one_time','project','retainer','goods');
  end if;
  if not exists (select 1 from pg_type where typname = 'mt_pricing_mode') then
    create type mt_pricing_mode as enum ('fixed','hourly','per_unit','bidder_choice');
  end if;
  if not exists (select 1 from pg_type where typname = 'mt_unit') then
    create type mt_unit as enum ('unit','hour','sqm','month','lump_sum','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'mt_payment_terms') then
    create type mt_payment_terms as enum ('net30','net60','advance_final','milestones','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'mt_req_kind') then
    create type mt_req_kind as enum ('licensed_dealer','insurance','professional_license',
      'years_experience','references','custom');
  end if;
  if not exists (select 1 from pg_type where typname = 'mt_invite_kind') then
    create type mt_invite_kind as enum ('direct','public_link');
  end if;
  if not exists (select 1 from pg_type where typname = 'mt_invite_status') then
    create type mt_invite_status as enum ('sent','opened','registered','submitted','declined','revoked');
  end if;
  if not exists (select 1 from pg_type where typname = 'mt_proposal_status') then
    create type mt_proposal_status as enum ('draft','submitted','withdrawn','won','lost','expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'mt_closed_reason') then
    create type mt_closed_reason as enum ('found_elsewhere','need_cancelled','mistake','no_decision','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'mt_outcome') then
    create type mt_outcome as enum ('engaged','not_engaged','in_progress');
  end if;
end $$;

-- ---------- 2. הרחבת business_profiles (העדפות התראה) ----------
alter table business_profiles
  add column if not exists mt_notify_mode text not null default 'instant'
    check (mt_notify_mode in ('instant','digest','off')),
  add column if not exists mt_quiet_hours boolean not null default false;

-- ---------- 3. טבלאות ליבה ----------
create table if not exists mt_tenders (
  id                  uuid primary key default gen_random_uuid(),
  buyer_profile_id    uuid not null references business_profiles(user_id) on delete restrict,
  created_by_user_id  uuid not null,
  status              mt_tender_status not null default 'draft',
  title               text not null default '' check (char_length(title) <= 90),
  category_ids        text[] not null default '{}' check (cardinality(category_ids) <= 2),
  engagement_type     mt_engagement_type,
  description         text check (char_length(description) <= 3000),
  description_updates jsonb not null default '[]'::jsonb,
  region              text,
  city                text,
  is_remote           boolean not null default false,
  budget_min          numeric(12,2),
  budget_max          numeric(12,2),
  budget_visible      boolean not null default true,
  vat_included        boolean not null default false,
  pricing_mode        mt_pricing_mode not null default 'fixed',
  criteria_weights    jsonb not null default '{"price":50,"delivery":20,"experience":15,"quality":15}'::jsonb,
  payment_terms       mt_payment_terms,
  is_anonymous        boolean not null default false,
  allow_split_award   boolean not null default false,
  deadline_at         timestamptz,
  questions_close_at  timestamptz,
  desired_start_mode  text check (desired_start_mode in ('asap','date','flexible')),
  desired_start       date,
  proposal_validity_days int not null default 30 check (proposal_validity_days between 1 and 365),
  public_link_enabled boolean not null default false,
  public_token        text not null unique default encode(gen_random_bytes(12),'hex'),
  blocked_profile_ids uuid[] not null default '{}',
  source_public_tender_id text,
  extended_once_at    timestamptz,
  closed_reason       mt_closed_reason,
  closed_note         text,
  proposals_count     int not null default 0,
  views_count         int not null default 0,
  published_at        timestamptz,
  closed_at           timestamptz,
  awarded_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint mt_budget_range check (budget_max is null or budget_min is null or budget_max >= budget_min),
  constraint mt_questions_before_deadline check (
    questions_close_at is null or deadline_at is null
    or questions_close_at <= deadline_at - interval '24 hours')
);
create index if not exists mt_tenders_due  on mt_tenders (status, deadline_at);
create index if not exists mt_tenders_mine on mt_tenders (buyer_profile_id, status);
create index if not exists mt_tenders_cats on mt_tenders using gin (category_ids);
create index if not exists mt_tenders_open on mt_tenders (region) where status = 'open';

create table if not exists mt_tender_items (
  id          uuid primary key default gen_random_uuid(),
  tender_id   uuid not null references mt_tenders(id) on delete cascade,
  position    int not null default 0,
  description text not null,
  quantity    numeric(10,2) not null default 1 check (quantity > 0),
  unit        mt_unit not null default 'lump_sum',
  is_optional boolean not null default false
);
create index if not exists mt_items_tender on mt_tender_items (tender_id, position);

create table if not exists mt_tender_requirements (
  id           uuid primary key default gen_random_uuid(),
  tender_id    uuid not null references mt_tenders(id) on delete cascade,
  kind         mt_req_kind not null,
  label        text not null,
  value        jsonb,
  is_mandatory boolean not null default false
);
create index if not exists mt_reqs_tender on mt_tender_requirements (tender_id);

create table if not exists mt_invitations (
  id                 uuid primary key default gen_random_uuid(),
  tender_id          uuid not null references mt_tenders(id) on delete cascade,
  kind               mt_invite_kind not null,
  token              text not null unique default encode(gen_random_bytes(12),'hex'),
  invitee_name       text,
  invitee_email      text,
  invitee_phone      text,
  invitee_profile_id uuid references business_profiles(user_id) on delete set null,
  status             mt_invite_status not null default 'sent',
  sent_at            timestamptz not null default now(),
  opened_at          timestamptz,
  registered_at      timestamptz
);
create index if not exists mt_invites_tender on mt_invitations (tender_id);

create table if not exists mt_questions (
  id                       uuid primary key default gen_random_uuid(),
  tender_id                uuid not null references mt_tenders(id) on delete cascade,
  asker_profile_id         uuid references business_profiles(user_id) on delete set null,
  question_text            text check (char_length(question_text) <= 1500),
  answer_text              text check (char_length(answer_text) <= 3000),
  answered_at              timestamptz,
  is_published             boolean not null default false,
  requires_proposal_update boolean not null default false,
  clarification_number     int,
  created_at               timestamptz not null default now()
);
create index if not exists mt_questions_tender on mt_questions (tender_id, created_at);

create table if not exists mt_proposals (
  id                      uuid primary key default gen_random_uuid(),
  tender_id               uuid not null references mt_tenders(id) on delete cascade,
  bidder_profile_id       uuid not null references business_profiles(user_id) on delete restrict,
  submitted_by_user_id    uuid not null,
  invitation_id           uuid references mt_invitations(id) on delete set null,
  status                  mt_proposal_status not null default 'draft',
  sealed_until            timestamptz not null,
  subtotal                numeric(12,2),
  discount_type           text check (discount_type in ('percent','amount')),
  discount_value          numeric(12,2) not null default 0,
  total                   numeric(12,2),
  vat_included            boolean not null default false,
  delivery_value          int,
  delivery_unit           text check (delivery_unit in ('days','weeks')),
  delivery_date           date,
  validity_days           int not null default 30,
  valid_until             timestamptz,
  experience_text         text check (char_length(experience_text) <= 1000),
  experience_links        text[] not null default '{}',
  notes                   text check (char_length(notes) <= 2000),
  declaration_accepted_at timestamptz,
  weighted_score          numeric(6,2),
  rank                    int,
  buyer_private_note      text,
  buyer_starred           boolean not null default false,
  first_submitted_at      timestamptz,
  last_updated_at         timestamptz,
  withdrawn_at            timestamptz,
  created_at              timestamptz not null default now()
);
create unique index if not exists mt_one_active_proposal
  on mt_proposals (tender_id, bidder_profile_id) where status <> 'withdrawn';
create index if not exists mt_proposals_tender on mt_proposals (tender_id, status);
create index if not exists mt_proposals_mine   on mt_proposals (bidder_profile_id, status);

create table if not exists mt_proposal_items (
  id             uuid primary key default gen_random_uuid(),
  proposal_id    uuid not null references mt_proposals(id) on delete cascade,
  tender_item_id uuid not null references mt_tender_items(id) on delete cascade,
  unit_price     numeric(12,2),
  quantity       numeric(10,2) not null,
  line_total     numeric(12,2),
  is_declined    boolean not null default false,
  unique (proposal_id, tender_item_id)
);

create table if not exists mt_proposal_req_answers (
  proposal_id    uuid not null references mt_proposals(id) on delete cascade,
  requirement_id uuid not null references mt_tender_requirements(id) on delete cascade,
  meets          boolean not null,
  note           text,
  primary key (proposal_id, requirement_id)
);

create table if not exists mt_proposal_revisions (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references mt_proposals(id) on delete cascade,
  revision_no int not null,
  snapshot    jsonb not null,
  created_at  timestamptz not null default now(),
  unique (proposal_id, revision_no)
);

create table if not exists mt_private_clarifications (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references mt_proposals(id) on delete cascade,
  question    text not null,
  asked_at    timestamptz not null default now(),
  answer      text,
  answered_at timestamptz
);

create table if not exists mt_awards (
  id                      uuid primary key default gen_random_uuid(),
  tender_id               uuid not null references mt_tenders(id) on delete cascade,
  proposal_id             uuid not null references mt_proposals(id) on delete cascade,
  tender_item_id          uuid references mt_tender_items(id) on delete cascade,
  message_to_winner       text,
  share_rank_with_others  boolean not null default true,
  awarded_at              timestamptz not null default now(),
  awarded_by_user_id      uuid not null,
  outcome                 mt_outcome,
  outcome_reported_at     timestamptz
);
create unique index if not exists mt_award_scope
  on mt_awards (tender_id, coalesce(tender_item_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------- 4. טבלאות תשתית ----------
create table if not exists mt_attachments (
  id                  uuid primary key default gen_random_uuid(),
  owner_type          text not null check (owner_type in ('tender','proposal','question')),
  owner_id            uuid not null,
  storage_path        text not null,
  file_name           text not null,
  mime                text not null,
  size_bytes          int not null check (size_bytes > 0 and size_bytes <= 15*1024*1024),
  uploaded_by_user_id uuid not null,
  scanned_ok          boolean,
  created_at          timestamptz not null default now()
);
create index if not exists mt_attach_owner on mt_attachments (owner_type, owner_id);

create table if not exists mt_events (
  id            bigint generated always as identity primary key,
  tender_id     uuid not null,
  proposal_id   uuid,
  actor_user_id uuid,
  actor_role    text check (actor_role in ('buyer','bidder','system')),
  event_type    text not null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists mt_events_tender on mt_events (tender_id, created_at);

create table if not exists mt_views (
  tender_id         uuid not null references mt_tenders(id) on delete cascade,
  viewer_key        uuid not null,               -- profile user_id, או uuid של invitation לאורח
  view_date         date not null default current_date,
  invitation_id     uuid,
  primary key (tender_id, viewer_key, view_date)
);

create table if not exists mt_notifications (
  id            bigint generated always as identity primary key,
  user_id       uuid not null,
  type          text not null,
  tender_id     uuid,
  proposal_id   uuid,
  title         text not null,
  body          text,
  link          text,
  channel       text not null default 'in_app' check (channel in ('in_app','email')),
  read_at       timestamptz,
  email_sent_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists mt_notif_user  on mt_notifications (user_id, read_at);
create index if not exists mt_notif_queue on mt_notifications (created_at)
  where channel = 'email' and email_sent_at is null;

create table if not exists mt_reports (
  id               uuid primary key default gen_random_uuid(),
  target_type      text not null check (target_type in ('tender','proposal')),
  target_id        uuid not null,
  reporter_user_id uuid not null,
  reason           text not null,
  note             text,
  status           text not null default 'open' check (status in ('open','dismissed','actioned')),
  resolved_by      uuid,
  created_at       timestamptz not null default now()
);

create table if not exists mt_otp (
  phone      text primary key,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists mt_rate (
  key          text primary key,               -- למשל 'q:<profile>' / 'otp:<phone>' / 'ai:<profile>'
  window_start timestamptz not null default now(),
  count        int not null default 0
);

-- ---------- 5. פונקציות עזר ----------

-- זהות הפרופיל של המשתמש המחובר (= user_id, רק אם קיים לו פרופיל)
create or replace function mt_auth_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from business_profiles where user_id = auth.uid() limit 1;
$$;

create or replace function mt_touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_mt_tenders_touch on mt_tenders;
create trigger trg_mt_tenders_touch before update on mt_tenders
  for each row execute function mt_touch_updated_at();

-- רישום אירוע (משמש טריגרים ו-API)
create or replace function mt_log(p_tender uuid, p_proposal uuid, p_actor uuid, p_role text,
                                  p_type text, p_payload jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into mt_events (tender_id, proposal_id, actor_user_id, actor_role, event_type, payload)
  values (p_tender, p_proposal, p_actor, p_role, p_type, coalesce(p_payload, '{}'::jsonb));
$$;

-- רישום התראה (in_app + email אם המשתמש לא כיבה מייל)
create or replace function mt_notify(p_user uuid, p_type text, p_tender uuid, p_proposal uuid,
                                     p_title text, p_body text, p_link text) returns void
language plpgsql security definer set search_path = public as $$
declare mode text;
begin
  insert into mt_notifications (user_id, type, tender_id, proposal_id, title, body, link, channel)
  values (p_user, p_type, p_tender, p_proposal, p_title, p_body, p_link, 'in_app');
  select coalesce(mt_notify_mode, 'instant') into mode from business_profiles where user_id = p_user;
  if coalesce(mode, 'instant') <> 'off' then
    insert into mt_notifications (user_id, type, tender_id, proposal_id, title, body, link, channel)
    values (p_user, p_type, p_tender, p_proposal, p_title, p_body, p_link, 'email');
  end if;
end $$;

-- מונה הצעות חשוף
create or replace function mt_on_proposal_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare tid uuid := coalesce(new.tender_id, old.tender_id);
begin
  update mt_tenders t set proposals_count = (
    select count(*) from mt_proposals p
    where p.tender_id = tid and p.status in ('submitted','won','lost'))
  where t.id = tid;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_mt_proposal_count on mt_proposals;
create trigger trg_mt_proposal_count
  after insert or update of status or delete on mt_proposals
  for each row execute function mt_on_proposal_change();

-- ולידציית מעברי סטטוס (טבלת המעברים מהאפיון המוצרי, סעיף 3)
create or replace function mt_validate_transition() returns trigger
language plpgsql as $$
declare ok boolean;
begin
  if old.status = new.status then return new; end if;
  ok := (old.status::text, new.status::text) in (
    ('draft','open'), ('draft','archived'),
    ('open','evaluating'), ('open','cancelled'), ('open','expired'),
    ('expired','open'), ('expired','archived'),
    ('evaluating','awarded'), ('evaluating','no_award'),
    ('awarded','completed'), ('no_award','archived'), ('cancelled','archived'),
    ('completed','archived'));
  if not ok then
    raise exception 'mt: illegal transition % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  if new.status = 'open' and old.status = 'draft' then
    if new.deadline_at is null or new.deadline_at < now() + interval '47 hours' then
      raise exception 'mt: deadline must be at least 48h ahead' using errcode = 'check_violation';
    end if;
    if new.deadline_at > now() + interval '31 days' then
      raise exception 'mt: deadline must be within 30 days' using errcode = 'check_violation';
    end if;
    new.published_at := coalesce(new.published_at, now());
    if new.questions_close_at is null then
      new.questions_close_at := new.deadline_at - interval '24 hours';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_mt_transition on mt_tenders;
create trigger trg_mt_transition before update of status on mt_tenders
  for each row execute function mt_validate_transition();

-- total = subtotal - הנחה, valid_until נגזר
create or replace function mt_check_total() returns trigger
language plpgsql as $$
declare expected numeric;
begin
  if new.subtotal is not null then
    expected := case new.discount_type
      when 'percent' then round(new.subtotal * (1 - coalesce(new.discount_value,0)/100), 2)
      when 'amount'  then new.subtotal - coalesce(new.discount_value,0)
      else new.subtotal end;
    if new.total is null then new.total := expected;
    elsif abs(new.total - expected) > 0.01 then
      raise exception 'mt: total % does not match subtotal/discount (expected %)', new.total, expected
        using errcode = 'check_violation';
    end if;
  end if;
  new.valid_until := new.sealed_until + make_interval(days => new.validity_days);
  return new;
end $$;
drop trigger if exists trg_mt_total on mt_proposals;
create trigger trg_mt_total before insert or update on mt_proposals
  for each row execute function mt_check_total();

-- ---------- 6. הפעימה (נקראת מ-pg_cron כל 5 דקות) ----------
-- הערה: התראות ואירועים נרשמים בלולאות (FOR ... PERFORM) ולא ב-CTE של SELECT —
-- CTE שאינו מופנה מהשאילתה הראשית לא מורץ כלל ב-Postgres.
create or replace function mt_tick() returns table (closed int, expired int, no_decision int, completed int)
language plpgsql security definer set search_path = public as $$
declare
  n_closed int := 0; n_expired int := 0; n_nodec int := 0; n_done int := 0;
  tr record; pr record;
begin
  -- א. מועד עבר ויש הצעות -> בבחירה
  for tr in with t as (
      update mt_tenders set status = 'evaluating', closed_at = now()
      where status = 'open' and deadline_at <= now() and proposals_count > 0
      returning id, buyer_profile_id, title, proposals_count)
    select * from t
  loop
    perform mt_notify(tr.buyer_profile_id, 'mt_closed', tr.id, null,
      'המיני־מכרז "' || tr.title || '" נסגר עם ' || tr.proposals_count || ' הצעות',
      'היכנסו להשוות ולבחור.', '/mt/' || tr.id || '/compare');
    for pr in select id, bidder_profile_id from mt_proposals where tender_id = tr.id and status = 'submitted' loop
      perform mt_notify(pr.bidder_profile_id, 'mt_closed_bidder', tr.id, pr.id,
        'המיני־מכרז "' || tr.title || '" נסגר', 'המזמין בוחר בין ההצעות.', '/mt/' || tr.id);
    end loop;
    perform mt_log(tr.id, null, null, 'system', 'mt_closed', jsonb_build_object('proposals_count', tr.proposals_count));
    n_closed := n_closed + 1;
  end loop;

  -- ב. מועד עבר ואין הצעות -> פג
  for tr in with t as (
      update mt_tenders set status = 'expired', closed_at = now()
      where status = 'open' and deadline_at <= now() and proposals_count = 0
      returning id, buyer_profile_id, title)
    select * from t
  loop
    perform mt_notify(tr.buyer_profile_id, 'mt_expired', tr.id, null,
      'לא התקבלו הצעות ל"' || tr.title || '"', 'אפשר להאריך את המועד או לפרסם מחדש.', '/mt/' || tr.id || '/manage');
    perform mt_log(tr.id, null, null, 'system', 'mt_expired');
    n_expired := n_expired + 1;
  end loop;

  -- ג. דירוג לפי מחיר (בסיס לניקוד המשוקלל שמחושב באפליקציה)
  with ranked as (
    select p.id, row_number() over (partition by p.tender_id order by p.total asc nulls last) rn
    from mt_proposals p join mt_tenders t on t.id = p.tender_id
    where t.status = 'evaluating' and p.status = 'submitted' and p.rank is null)
  update mt_proposals p set rank = ranked.rn from ranked where p.id = ranked.id;

  -- ד. תזכורת: 14 יום בבחירה ללא החלטה (פעם אחת)
  for tr in select id, buyer_profile_id, title from mt_tenders t
      where status = 'evaluating' and closed_at < now() - interval '14 days'
        and not exists (select 1 from mt_events e where e.tender_id = t.id and e.event_type = 'mt_reminder_decide')
  loop
    perform mt_notify(tr.buyer_profile_id, 'mt_reminder_decide', tr.id, null,
      'עדיין לא בחרתם ב"' || tr.title || '"', 'המציעים מחכים לתשובה. המיני־מכרז ייסגר אוטומטית בעוד 16 יום.', '/mt/' || tr.id || '/compare');
    perform mt_log(tr.id, null, null, 'system', 'mt_reminder_decide');
  end loop;

  -- ה. 30 יום בבחירה -> נסגר ללא בחירה
  for tr in with t as (
      update mt_tenders set status = 'no_award', closed_reason = 'no_decision'
      where status = 'evaluating' and closed_at < now() - interval '30 days'
      returning id, buyer_profile_id, title)
    select * from t
  loop
    for pr in select id, bidder_profile_id from mt_proposals where tender_id = tr.id and status = 'submitted' loop
      perform mt_notify(pr.bidder_profile_id, 'mt_no_award', tr.id, pr.id,
        'המיני־מכרז "' || tr.title || '" נסגר ללא בחירה', 'תודה על ההצעה.', '/mt');
    end loop;
    update mt_proposals set status = 'lost' where tender_id = tr.id and status = 'submitted';
    perform mt_log(tr.id, null, null, 'system', 'mt_no_award', '{"reason":"no_decision"}'::jsonb);
    n_nodec := n_nodec + 1;
  end loop;

  -- ו. 30 יום אחרי זכייה -> הושלם
  for tr in with t as (
      update mt_tenders set status = 'completed'
      where status = 'awarded' and awarded_at < now() - interval '30 days'
      returning id)
    select * from t
  loop
    n_done := n_done + 1;
  end loop;

  -- ז. תזכורת 24 שעות למועד (פעם אחת)
  for tr in select id, buyer_profile_id, title, proposals_count from mt_tenders t
      where status = 'open' and deadline_at between now() and now() + interval '24 hours'
        and not exists (select 1 from mt_events e where e.tender_id = t.id and e.event_type = 'mt_reminder_24h')
  loop
    perform mt_notify(tr.buyer_profile_id, 'mt_reminder_24h', tr.id, null,
      'עוד 24 שעות לסגירת "' || tr.title || '"', 'עד כה התקבלו ' || tr.proposals_count || ' הצעות.', '/mt/' || tr.id || '/manage');
    perform mt_log(tr.id, null, null, 'system', 'mt_reminder_24h');
  end loop;

  -- ח. ניקוי: טיוטות נטושות 60 יום
  update mt_tenders set status = 'archived'
   where status = 'draft' and updated_at < now() - interval '60 days';

  return query select n_closed, n_expired, n_nodec, n_done;
end $$;

-- ---------- 7. View לשאלות בלי זהות השואל ----------
create or replace view mt_questions_public
with (security_invoker = true) as
  select id, tender_id, question_text, answer_text, answered_at,
         requires_proposal_update, clarification_number, created_at
  from mt_questions
  where is_published;

-- ---------- 8. RLS ----------
-- עיקרון: ללקוח (anon/authenticated) יש SELECT בלבד. כל כתיבה — service role דרך /api/mt/*.
do $$ declare t text;
begin
  foreach t in array array['mt_tenders','mt_tender_items','mt_tender_requirements','mt_invitations',
    'mt_questions','mt_proposals','mt_proposal_items','mt_proposal_req_answers','mt_proposal_revisions',
    'mt_private_clarifications','mt_awards','mt_attachments','mt_events','mt_views','mt_notifications',
    'mt_reports','mt_otp','mt_rate']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

drop policy if exists mt_tenders_select on mt_tenders;
create policy mt_tenders_select on mt_tenders for select to authenticated using (
  deleted_at is null and (
    buyer_profile_id = mt_auth_profile_id()
    or (status in ('open','evaluating','awarded')
        and not (mt_auth_profile_id() = any (blocked_profile_ids)))));

drop policy if exists mt_items_select on mt_tender_items;
create policy mt_items_select on mt_tender_items for select to authenticated
  using (exists (select 1 from mt_tenders t where t.id = tender_id));

drop policy if exists mt_reqs_select on mt_tender_requirements;
create policy mt_reqs_select on mt_tender_requirements for select to authenticated
  using (exists (select 1 from mt_tenders t where t.id = tender_id));

-- שאלות: המזמין רואה הכול (כולל asker); אחרים — רק דרך mt_questions_public (שמסנן is_published)
drop policy if exists mt_questions_select on mt_questions;
create policy mt_questions_select on mt_questions for select to authenticated using (
  (is_published and exists (select 1 from mt_tenders t where t.id = tender_id))
  or exists (select 1 from mt_tenders t where t.id = tender_id and t.buyer_profile_id = mt_auth_profile_id()));

-- לב החיסיון: המזמין רואה הצעות רק אחרי sealed_until
drop policy if exists mt_proposals_select on mt_proposals;
create policy mt_proposals_select on mt_proposals for select to authenticated using (
  bidder_profile_id = mt_auth_profile_id()
  or (now() >= sealed_until
      and status in ('submitted','won','lost','expired')
      and exists (select 1 from mt_tenders t where t.id = tender_id
                  and t.buyer_profile_id = mt_auth_profile_id())));

drop policy if exists mt_pitems_select on mt_proposal_items;
create policy mt_pitems_select on mt_proposal_items for select to authenticated
  using (exists (select 1 from mt_proposals p where p.id = proposal_id));

drop policy if exists mt_preqs_select on mt_proposal_req_answers;
create policy mt_preqs_select on mt_proposal_req_answers for select to authenticated
  using (exists (select 1 from mt_proposals p where p.id = proposal_id));

drop policy if exists mt_awards_select on mt_awards;
create policy mt_awards_select on mt_awards for select to authenticated using (
  exists (select 1 from mt_tenders t where t.id = tender_id and t.buyer_profile_id = mt_auth_profile_id())
  or exists (select 1 from mt_proposals p where p.id = proposal_id and p.bidder_profile_id = mt_auth_profile_id()));

drop policy if exists mt_notif_select on mt_notifications;
create policy mt_notif_select on mt_notifications for select to authenticated
  using (user_id = auth.uid() and channel = 'in_app');

-- הרשאות ברמת התפקיד (Supabase מעניקה ל-authenticated גישה לטבלאות חדשות כברירת מחדל;
-- כאן מוודאים במפורש: SELECT בלבד, ואפס גישה לטבלאות שירות)
grant select on mt_tenders, mt_tender_items, mt_tender_requirements, mt_questions, mt_questions_public,
  mt_proposals, mt_proposal_items, mt_proposal_req_answers, mt_awards, mt_notifications to authenticated;
revoke all on mt_invitations, mt_proposal_revisions, mt_private_clarifications, mt_attachments,
  mt_events, mt_views, mt_reports, mt_otp, mt_rate from authenticated, anon;
revoke all on mt_tenders, mt_tender_items, mt_tender_requirements, mt_questions, mt_questions_public,
  mt_proposals, mt_proposal_items, mt_proposal_req_answers, mt_awards, mt_notifications from anon;
