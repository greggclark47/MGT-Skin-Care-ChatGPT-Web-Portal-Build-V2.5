-- Path B release controls: durable disclosure evidence and append-only records.
-- This migration is additive and fails closed when historical active-consent rows
-- cannot be reconciled without a reviewed retention decision.

alter table consents add column if not exists captured_at timestamptz;
alter table consents add column if not exists revoked_at timestamptz;
alter table consents add column if not exists source text not null default 'portal';
update consents set captured_at = coalesce(captured_at, granted_at, now()) where captured_at is null;
alter table consents alter column captured_at set not null;

do $$
begin
  if exists (
    select 1 from consents
    where granted = true and revoked_at is null
    group by user_id, consent_type
    having count(*) > 1
  ) then
    raise exception 'Multiple active consent records require reviewed reconciliation before this release';
  end if;
end;
$$;

create unique index if not exists consents_one_active_type_per_user
  on consents (user_id, consent_type)
  where granted = true and revoked_at is null;

alter table consents enable row level security;
drop policy if exists consents_owner_read on consents;
drop policy if exists consents_owner_insert on consents;
drop policy if exists consents_owner_update on consents;
create policy consents_owner_read on consents for select to authenticated using (user_id = auth.uid());
create policy consents_owner_insert on consents for insert to authenticated with check (user_id = auth.uid());
create policy consents_owner_update on consents for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.prevent_mutation() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

do $$
declare
  table_name text;
  trigger_name text;
begin
  foreach table_name in array array['skin_match_answers', 'subscription_events']
  loop
    trigger_name := 'mgt_' || table_name || '_append_only';
    if to_regclass('public.' || table_name) is not null
      and not exists (select 1 from pg_trigger where tgrelid = to_regclass('public.' || table_name) and tgname = trigger_name)
    then
      execute format('create trigger %I before update or delete on public.%I for each row execute function public.prevent_mutation()', trigger_name, table_name);
    end if;
  end loop;
end;
$$;
