-- hub_records is the production portal's server-side document store. It contains sessions,
-- accounts, profiles, consent, support, billing and operations records. Browser clients must
-- never query it directly through the authenticated or anonymous Supabase roles.
--
-- No client policy is created. The API and worker must connect as the reviewed table owner,
-- superuser or BYPASSRLS service role; the production database audit verifies that capability.

ALTER TABLE hub_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_schema_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_records_authenticated_access ON hub_records;
DROP POLICY IF EXISTS hub_records_anonymous_access ON hub_records;


