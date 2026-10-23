-- Behavioral RLS smoke test. Run only against the disposable database created by
-- reset-and-test.sh. All fixtures and temporary grants are rolled back.

begin;

-- reset-and-test.sh recreates these schemas from scratch, so reproduce the minimum
-- Supabase client-role schema access needed to exercise policies rather than merely
-- confirming that a schema-level permission error blocks reads.
grant usage on schema public, auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant select on skin_profiles, skin_match_sessions, skin_match_answers,
  admin_users, hub_records, portal_schema_migrations to authenticated, anon;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'rls-owner@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'rls-other@example.test');

insert into skin_profiles (
  id, user_id, skin_type, primary_concern, sensitivity, current_routine,
  budget_range, rules_version
) values
  ('31111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'dry', 'hydration', 'none', 'basic', 'between_25_50', 'rls-test'),
  ('32222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'oily', 'acne', 'mild', 'basic', 'between_25_50', 'rls-test');

insert into skin_match_sessions (id, user_id, questionnaire_version, rules_version) values
  ('41111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'rls-test', 'rls-test'),
  ('42222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'rls-test', 'rls-test');

insert into skin_match_answers (session_id, question_key, answer_value) values
  ('41111111-1111-4111-8111-111111111111', 'skin_type', '"dry"'::jsonb),
  ('42222222-2222-4222-8222-222222222222', 'skin_type', '"oily"'::jsonb);

insert into admin_users (id, email, roles) values
  ('51111111-1111-4111-8111-111111111111', 'rls-admin@example.test', array['viewer']);
insert into hub_records (scope, id, body) values ('sessions', 'rls-private', '{"private":true}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

do $$
begin
  if (select count(*) from skin_profiles) <> 1 then
    raise exception 'authenticated owner must see exactly one profile';
  end if;
  if exists (select 1 from skin_profiles where user_id = '22222222-2222-4222-8222-222222222222') then
    raise exception 'authenticated owner can see another profile';
  end if;
  if (select count(*) from skin_match_answers) <> 1 then
    raise exception 'authenticated owner must see exactly one related answer';
  end if;
  if exists (select 1 from admin_users) then
    raise exception 'authenticated role can see service-only admin rows';
  end if;
  if exists (select 1 from hub_records) then
    raise exception 'authenticated role can see service-only portal rows';
  end if;
  if exists (select 1 from portal_schema_migrations) then
    raise exception 'authenticated role can see the migration ledger';
  end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
begin
  if exists (select 1 from skin_profiles) or exists (select 1 from skin_match_answers) then
    raise exception 'anonymous role can see customer rows';
  end if;
  if exists (select 1 from admin_users) or exists (select 1 from hub_records) then
    raise exception 'anonymous role can see service-only rows';
  end if;
end;
$$;

reset role;
rollback;
