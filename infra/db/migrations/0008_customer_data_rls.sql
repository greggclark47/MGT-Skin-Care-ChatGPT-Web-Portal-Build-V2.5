-- Complete the customer-data RLS boundary promised by the consolidated schema.
--
-- The application and worker use the reviewed service/database role. Authenticated clients
-- receive owner-scoped read access only; writes continue through the API unless an earlier,
-- explicitly reviewed policy grants them (skin_profiles and consents). Provider payloads,
-- Stripe customer mappings and AI routing logs remain service-only.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'skin_profile_versions',
    'skin_match_sessions',
    'recommendations',
    'routines',
    'routine_adherence',
    'routine_feedback',
    'product_feedback',
    'carts',
    'orders',
    'subscriptions',
    'entitlements',
    'replenishment_predictions',
    'ai_budgets'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists mgt_owner_read on public.%I', table_name);
      execute format(
        'create policy mgt_owner_read on public.%I for select to authenticated using (user_id = auth.uid())',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- These records contain customer identifiers but are implementation details rather than a
-- direct customer read surface. Enabling RLS with no authenticated policy keeps them behind
-- the service/database boundary.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'subscription_events',
    'stripe_customers',
    'llm_routing_log'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
    end if;
  end loop;
end;
$$;

-- Owner relationships for customer data stored on child rows without a user_id column.
alter table skin_match_answers enable row level security;
drop policy if exists mgt_owner_read on skin_match_answers;
create policy mgt_owner_read on skin_match_answers for select to authenticated
  using (exists (
    select 1 from skin_match_sessions
    where skin_match_sessions.id = skin_match_answers.session_id
      and skin_match_sessions.user_id = auth.uid()
  ));

alter table routine_steps enable row level security;
drop policy if exists mgt_owner_read on routine_steps;
create policy mgt_owner_read on routine_steps for select to authenticated
  using (exists (
    select 1 from routines
    where routines.id = routine_steps.routine_id
      and routines.user_id = auth.uid()
  ));

alter table cart_items enable row level security;
drop policy if exists mgt_owner_read on cart_items;
create policy mgt_owner_read on cart_items for select to authenticated
  using (exists (
    select 1 from carts
    where carts.id = cart_items.cart_id
      and carts.user_id = auth.uid()
  ));
