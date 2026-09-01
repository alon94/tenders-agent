-- Stub של סביבת Supabase להרצה מקומית של המיגרציה (Postgres רגיל):
-- auth.uid(), התפקידים authenticated/anon, ו-business_profiles מינימלי.
-- הרצה: createdb mt_test && psql -d mt_test -f supabase-stub.sql -f ../2026-09-mt.sql -f mt-scenario.sql
-- Supabase-like stub
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $$;
grant usage on schema public to authenticated, anon;
create table business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique, email text, categories text[] default '{}', region text
);
grant select on business_profiles to authenticated;
