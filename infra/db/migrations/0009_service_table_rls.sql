-- Defense in depth for public-schema tables that are served only through the MGT API.
-- No authenticated, anonymous or PUBLIC policy is created. The reviewed application role
-- must be the table owner, a superuser or BYPASSRLS; production-audit.mjs verifies that
-- capability without recording the role name.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_audit_log',
    'admin_users',
    'brands',
    'bundle_items',
    'bundles',
    'eval_cases',
    'eval_runs',
    'fulfillment_jobs',
    'fulfillment_partners',
    'ingredient_conflict_rules',
    'ingredient_rules',
    'ingredients',
    'model_configs',
    'partner_feeds',
    'portal_schema_migrations',
    'product_attributes',
    'product_ingredients',
    'products',
    'prompt_versions',
    'subscription_plans',
    'webhook_events'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
    end if;
  end loop;
end;
$$;

-- These schemas are not part of the default browser API surface, but enabling RLS prevents
-- an accidental exposed-schema configuration from turning analytics or approved knowledge
-- into a direct client data source.
do $$
begin
  if to_regclass('analytics.events') is not null then
    alter table analytics.events enable row level security;
  end if;
  if to_regclass('knowledge.objects') is not null then
    alter table knowledge.objects enable row level security;
  end if;
  if to_regclass('knowledge.embeddings') is not null then
    alter table knowledge.embeddings enable row level security;
  end if;
end;
$$;
