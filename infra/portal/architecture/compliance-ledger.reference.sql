-- DESIGN REFERENCE ONLY. Not an installed migration or complete authorization system.
-- PostgreSQL syntax. Do not run against production.
-- No secret values, credentials, raw connection strings, customer payloads or signed URLs.
-- Trusted API functions, grants, RLS policies, signatures, time checks and transition
-- predicates described in INC-GOVERNANCE-BLUEPRINT.md remain implementation work.
BEGIN;
CREATE SCHEMA mgt_compliance;
REVOKE ALL ON SCHEMA mgt_compliance FROM PUBLIC;

CREATE DOMAIN mgt_compliance.accountable_name AS text
  CHECK (VALUE = 'Gregg Clark of MGT');
CREATE DOMAIN mgt_compliance.git_sha AS text
  CHECK (VALUE ~ '^[0-9a-f]{40}$');
CREATE DOMAIN mgt_compliance.sha256 AS text
  CHECK (VALUE ~ '^sha256:[0-9a-f]{64}$');
CREATE TYPE mgt_compliance.role_name AS ENUM
  ('release','platform','data','support','accessibility');
CREATE TYPE mgt_compliance.environment_name AS ENUM ('staging','production');
CREATE TYPE mgt_compliance.observation_status AS ENUM ('pending','pass','blocked');
CREATE TYPE mgt_compliance.decision_value AS ENUM ('pending','hold','approve','go');
CREATE TYPE mgt_compliance.destination_name AS ENUM ('github_a','github_b','google_drive');

CREATE TABLE mgt_compliance.entity (
  entity_id uuid PRIMARY KEY,
  legal_name text NOT NULL CHECK (length(legal_name) > 1),
  jurisdiction_ref text NOT NULL,
  corporate_authority_ref text NOT NULL,
  approved_domain_ref text NOT NULL,
  retention_policy_ref text NOT NULL,
  applicability_register_ref text NOT NULL,
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  registered_at timestamptz NOT NULL
);

-- This is an authenticated enrollment binding, not a display-name lookup.
-- Revocation/rotation is an append-only event, never a silent update of identity.
CREATE TABLE mgt_compliance.human_binding (
  binding_id uuid PRIMARY KEY,
  entity_id uuid NOT NULL REFERENCES mgt_compliance.entity,
  issuer_ref text NOT NULL,
  immutable_subject text NOT NULL,
  github_numeric_user_id bigint NOT NULL CHECK (github_numeric_user_id > 0),
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  enrollment_evidence_ref text NOT NULL,
  enrolled_at timestamptz NOT NULL,
  UNIQUE (issuer_ref, immutable_subject)
);

CREATE TABLE mgt_compliance.candidate (
  candidate_id uuid PRIMARY KEY,
  entity_id uuid NOT NULL REFERENCES mgt_compliance.entity,
  repository_id text NOT NULL,
  commit_sha mgt_compliance.git_sha NOT NULL,
  manifest_hash mgt_compliance.sha256 NOT NULL UNIQUE,
  source_archive_hash mgt_compliance.sha256 NOT NULL,
  source_archive_bytes bigint NOT NULL CHECK (source_archive_bytes > 0),
  configuration_hash mgt_compliance.sha256 NOT NULL,
  migration_set_hash mgt_compliance.sha256 NOT NULL,
  policy_hash mgt_compliance.sha256 NOT NULL,
  trusted_workflow_ref text NOT NULL,
  attestation_ref text NOT NULL,
  ai_enabled boolean NOT NULL,
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  registered_at timestamptz NOT NULL
);
-- More than one candidate envelope may share a source SHA after a rebuild.
CREATE TABLE mgt_compliance.candidate_image (
  candidate_id uuid NOT NULL REFERENCES mgt_compliance.candidate,
  component text NOT NULL CHECK (component IN ('node','api','web','edge','local_ai')),
  registry_repository_ref text NOT NULL,
  digest mgt_compliance.sha256 NOT NULL,
  platform_ref text NOT NULL,
  provenance_ref text NOT NULL,
  PRIMARY KEY (candidate_id, component)
);

CREATE TABLE mgt_compliance.artifact (
  artifact_id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES mgt_compliance.candidate,
  object_ref text NOT NULL CHECK (object_ref ~ '^evidence/'),
  object_version text NOT NULL,
  content_hash mgt_compliance.sha256 NOT NULL,
  bytes bigint NOT NULL CHECK (bytes > 0),
  media_type text NOT NULL,
  sanitized boolean NOT NULL CHECK (sanitized),
  collector_identity_ref text NOT NULL,
  scanner_attestation_ref text NOT NULL,
  collected_at timestamptz NOT NULL,
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  UNIQUE (artifact_id, candidate_id),
  UNIQUE (object_ref, object_version)
);
-- sanitized=true is only a structural claim; trusted ingestion must verify it.
-- object_ref is an opaque approved-vault reference, not an arbitrary fetch URL.

CREATE TABLE mgt_compliance.handoff (
  handoff_id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES mgt_compliance.candidate,
  environment mgt_compliance.environment_name NOT NULL,
  origin_inventory_ref text NOT NULL,
  evidence_root mgt_compliance.sha256 NOT NULL,
  handoff_hash mgt_compliance.sha256 NOT NULL UNIQUE,
  signature_ref text NOT NULL,
  frozen_at timestamptz NOT NULL,
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  UNIQUE (handoff_id, candidate_id)
);
CREATE TABLE mgt_compliance.role_record (
  record_id uuid PRIMARY KEY,
  handoff_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  role mgt_compliance.role_name NOT NULL,
  artifact_id uuid NOT NULL,
  role_content_hash mgt_compliance.sha256 NOT NULL,
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  reviewer mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  observed_at timestamptz NOT NULL,
  action_code text NOT NULL,
  expected_result_code text NOT NULL,
  actual_result_code text NOT NULL,
  status mgt_compliance.observation_status NOT NULL DEFAULT 'pending',
  rollback_ref text,
  FOREIGN KEY (handoff_id,candidate_id)
    REFERENCES mgt_compliance.handoff(handoff_id,candidate_id),
  FOREIGN KEY (artifact_id,candidate_id)
    REFERENCES mgt_compliance.artifact(artifact_id,candidate_id),
  UNIQUE (handoff_id,role),
  UNIQUE (handoff_id,artifact_id),
  UNIQUE (handoff_id,role_content_hash),
  UNIQUE (record_id,handoff_id,role)
);
-- A corrected observation creates a NEW handoff/evidence set. Failed records remain.

CREATE TABLE mgt_compliance.gate_check (
  check_record_id uuid PRIMARY KEY,
  handoff_id uuid NOT NULL REFERENCES mgt_compliance.handoff,
  check_code text NOT NULL,
  evidence_record_ref text NOT NULL,
  evidence_hash mgt_compliance.sha256 NOT NULL,
  observed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > observed_at),
  status mgt_compliance.observation_status NOT NULL DEFAULT 'pending',
  actual_result_code text NOT NULL,
  collector_identity_ref text NOT NULL,
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  rollback_ref text NOT NULL,
  UNIQUE (handoff_id,check_code)
);
-- Transition functions require the EXACT stage-specific check set, not merely
-- eight arbitrary rows. Known codes and applicability are versioned policy.

CREATE TABLE mgt_compliance.execution_window (
  window_id uuid PRIMARY KEY,
  handoff_id uuid NOT NULL REFERENCES mgt_compliance.handoff,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  CHECK (ends_at > starts_at AND ends_at - starts_at <= interval '4 hours'),
  UNIQUE (window_id,handoff_id)
);
-- Do not put volatile clock_timestamp() rules in CHECK constraints.
-- At issuance start >= authoritative now; at execution start <= now < end.

CREATE TABLE mgt_compliance.role_approval (
  approval_id uuid PRIMARY KEY,
  handoff_id uuid NOT NULL,
  window_id uuid NOT NULL,
  role mgt_compliance.role_name NOT NULL,
  record_id uuid NOT NULL,
  human_binding_id uuid NOT NULL REFERENCES mgt_compliance.human_binding,
  approver mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  decision mgt_compliance.decision_value NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  approval_hash mgt_compliance.sha256 NOT NULL UNIQUE,
  signature_ref text,
  supersedes_approval_id uuid REFERENCES mgt_compliance.role_approval,
  recorded_at timestamptz NOT NULL,
  FOREIGN KEY (window_id,handoff_id)
    REFERENCES mgt_compliance.execution_window(window_id,handoff_id),
  FOREIGN KEY (record_id,handoff_id,role)
    REFERENCES mgt_compliance.role_record(record_id,handoff_id,role),
  CHECK (decision = 'pending' OR (reviewed_at IS NOT NULL AND signature_ref IS NOT NULL)),
  UNIQUE (approval_id,handoff_id,window_id,role)
);
-- Pending -> approved is a NEW signed row, with supersedes link, never UPDATE.
-- Transition functions select exactly one current, unrevoked approval per role,
-- reject branches/duplicates and holds, and validate all signature/identity claims.

CREATE TABLE mgt_compliance.release_decision (
  decision_id uuid PRIMARY KEY,
  handoff_id uuid NOT NULL,
  window_id uuid NOT NULL,
  human_binding_id uuid NOT NULL REFERENCES mgt_compliance.human_binding,
  decider mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  decision mgt_compliance.decision_value NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending','hold','go')),
  decision_hash mgt_compliance.sha256 NOT NULL UNIQUE,
  signature_ref text,
  decided_at timestamptz,
  FOREIGN KEY (window_id,handoff_id)
    REFERENCES mgt_compliance.execution_window(window_id,handoff_id),
  CHECK (decision = 'pending' OR (signature_ref IS NOT NULL AND decided_at IS NOT NULL)),
  UNIQUE (decision_id,handoff_id,window_id)
);

CREATE TABLE mgt_compliance.authorization (
  authorization_id uuid PRIMARY KEY,
  handoff_id uuid NOT NULL,
  window_id uuid NOT NULL,
  production_decision_id uuid,
  authorization_hash mgt_compliance.sha256 NOT NULL UNIQUE,
  nonce_hash mgt_compliance.sha256 NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > issued_at),
  rollback_tuple_ref text NOT NULL,
  operator_action_scope_ref text NOT NULL,
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  FOREIGN KEY (window_id,handoff_id)
    REFERENCES mgt_compliance.execution_window(window_id,handoff_id),
  FOREIGN KEY (production_decision_id,handoff_id,window_id)
    REFERENCES mgt_compliance.release_decision(decision_id,handoff_id,window_id),
  UNIQUE (authorization_id,handoff_id,window_id)
);
CREATE TABLE mgt_compliance.authorization_approval (
  authorization_id uuid NOT NULL,
  handoff_id uuid NOT NULL,
  window_id uuid NOT NULL,
  role mgt_compliance.role_name NOT NULL,
  approval_id uuid NOT NULL,
  PRIMARY KEY (authorization_id,role),
  FOREIGN KEY (authorization_id,handoff_id,window_id)
    REFERENCES mgt_compliance.authorization(authorization_id,handoff_id,window_id),
  FOREIGN KEY (approval_id,handoff_id,window_id,role)
    REFERENCES mgt_compliance.role_approval(approval_id,handoff_id,window_id,role)
);
-- Exactly {release,platform} for staging and all five for production are
-- checked atomically at issuance and execution. FK constraints alone cannot count.
-- Require staging role decision=approve and production role decision=go;
-- the final production release decision must also be go. Pending/hold never qualify.

CREATE TABLE mgt_compliance.revocation (
  revocation_id uuid PRIMARY KEY,
  subject_kind text NOT NULL CHECK (subject_kind IN
    ('identity','candidate','handoff','approval','decision','authorization','policy')),
  subject_id text NOT NULL,
  reason_code text NOT NULL,
  recorded_at timestamptz NOT NULL,
  actor_identity_ref text NOT NULL,
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  evidence_ref text NOT NULL
);

-- Deliberately mutable materialized coordination state, NOT historical evidence.
-- Only a constrained server-side function may lock/update this table.
CREATE TABLE mgt_compliance.deployment_slot (
  target_inventory_ref text PRIMARY KEY,
  current_epoch bigint NOT NULL DEFAULT 0 CHECK (current_epoch >= 0),
  active_execution_id uuid,
  active_candidate_id uuid REFERENCES mgt_compliance.candidate,
  lease_expires_at timestamptz
);
CREATE TABLE mgt_compliance.execution (
  execution_id uuid PRIMARY KEY,
  authorization_id uuid NOT NULL UNIQUE REFERENCES mgt_compliance.authorization,
  target_inventory_ref text NOT NULL REFERENCES mgt_compliance.deployment_slot,
  fence_epoch bigint NOT NULL CHECK (fence_epoch > 0),
  operator_identity_ref text NOT NULL,
  operator mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  nonce_consumed_at timestamptz NOT NULL,
  action_ref text NOT NULL,
  UNIQUE (target_inventory_ref,fence_epoch)
);
CREATE TABLE mgt_compliance.execution_event (
  event_id uuid PRIMARY KEY,
  execution_id uuid NOT NULL REFERENCES mgt_compliance.execution,
  event_code text NOT NULL CHECK (event_code IN
    ('requested','started','observed','succeeded','failed','rollback_requested',
     'rollback_completed','contained','no_mutation','superseded')),
  happened_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  observed_target_generation text,
  result_code text NOT NULL,
  evidence_ref text NOT NULL,
  actor_identity_ref text NOT NULL,
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT'
);
CREATE TABLE mgt_compliance.execution_outbox (
  command_id uuid PRIMARY KEY,
  execution_id uuid NOT NULL REFERENCES mgt_compliance.execution,
  command_code text NOT NULL,
  idempotency_ref text NOT NULL UNIQUE,
  target_inventory_ref text NOT NULL,
  expected_fence_epoch bigint NOT NULL CHECK (expected_fence_epoch > 0),
  created_at timestamptz NOT NULL
);
-- Delivery attempts/outcomes are appended as execution events. Target reconciliation
-- is required after an ambiguous network failure; do not assume exactly-once cloud IO.

CREATE TABLE mgt_compliance.monitor_observation (
  observation_id uuid PRIMARY KEY,
  execution_id uuid NOT NULL REFERENCES mgt_compliance.execution,
  cadence text NOT NULL CHECK (cadence IN ('immediate','15m','1h','24h','7d')),
  due_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  status mgt_compliance.observation_status NOT NULL DEFAULT 'pending',
  target_generation text NOT NULL,
  artifact_ref text NOT NULL,
  artifact_hash mgt_compliance.sha256 NOT NULL,
  collector_identity_ref text NOT NULL,
  monitoring_owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT'
);
-- Allow repeated observations. Final review chooses authentic in-policy records;
-- it cannot overwrite a missed/failed observation or accept future success.

CREATE TABLE mgt_compliance.export_generation (
  export_id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES mgt_compliance.candidate,
  execution_id uuid NOT NULL REFERENCES mgt_compliance.execution,
  predecessor_export_id uuid REFERENCES mgt_compliance.export_generation,
  generation integer NOT NULL CHECK (generation >= 0),
  manifest_hash mgt_compliance.sha256 NOT NULL UNIQUE,
  publication_authorization_ref text NOT NULL,
  frozen_at timestamptz NOT NULL,
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  UNIQUE (execution_id,generation)
);
CREATE TABLE mgt_compliance.export_artifact (
  export_id uuid NOT NULL REFERENCES mgt_compliance.export_generation,
  artifact_kind text NOT NULL CHECK (artifact_kind IN ('source','evidence','git_bundle')),
  file_name text NOT NULL,
  content_hash mgt_compliance.sha256 NOT NULL,
  bytes bigint NOT NULL CHECK (bytes > 0),
  local_vault_ref text NOT NULL,
  PRIMARY KEY (export_id,artifact_kind)
);
CREATE TABLE mgt_compliance.destination_receipt (
  receipt_id uuid PRIMARY KEY,
  export_id uuid NOT NULL,
  artifact_kind text NOT NULL,
  destination mgt_compliance.destination_name NOT NULL,
  provider_account_ref text NOT NULL,
  repository_or_folder_id text NOT NULL,
  remote_object_id text NOT NULL,
  observed_url text NOT NULL,
  observed_candidate_sha mgt_compliance.git_sha NOT NULL,
  observed_file_name text NOT NULL,
  observed_hash mgt_compliance.sha256 NOT NULL,
  observed_bytes bigint NOT NULL CHECK (observed_bytes > 0),
  uploaded_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL CHECK (verified_at >= uploaded_at),
  readback_attestation_ref text NOT NULL,
  receipt_hash mgt_compliance.sha256 NOT NULL UNIQUE,
  owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT',
  FOREIGN KEY (export_id,artifact_kind)
    REFERENCES mgt_compliance.export_artifact(export_id,artifact_kind)
);
-- Each destination's IDs must match its actual observed object. Do NOT require
-- provider IDs or source/evidence archive hashes to equal across different artifacts.

CREATE TABLE mgt_compliance.closeout (
  closeout_id uuid PRIMARY KEY,
  execution_id uuid NOT NULL REFERENCES mgt_compliance.execution,
  final_export_id uuid NOT NULL REFERENCES mgt_compliance.export_generation,
  receipt_set_hash mgt_compliance.sha256 NOT NULL,
  monitoring_set_hash mgt_compliance.sha256 NOT NULL,
  closure_decision_ref text NOT NULL,
  closed_at timestamptz NOT NULL,
  reviewer mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT'
);
-- A validated transition, not this FK alone, requires final_export belongs to this
-- execution and candidate; required GitHub A/B and Drive receipts; all due checks.

CREATE TABLE mgt_compliance.audit_event (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_ref text NOT NULL,
  event_code text NOT NULL,
  subject_record_ref text NOT NULL,
  previous_hash mgt_compliance.sha256,
  event_hash mgt_compliance.sha256 NOT NULL UNIQUE,
  signature_ref text NOT NULL,
  recorded_at timestamptz NOT NULL,
  actor_identity_ref text NOT NULL,
  accountable_owner mgt_compliance.accountable_name NOT NULL DEFAULT 'Gregg Clark of MGT'
);
-- Serialize chain append under a lock; externally anchor signed roots.
-- No free-form JSON payload column is intentionally provided.

CREATE FUNCTION mgt_compliance.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'compliance records are append-only';
END;
$$;

-- No PUBLIC table/function access. RLS is deny-by-default until narrow tested
-- policies are installed. Runtime must not be superuser, owner or BYPASSRLS.
DO $$
DECLARE object_record record;
BEGIN
  FOR object_record IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'mgt_compliance'
  LOOP
    EXECUTE format('ALTER TABLE mgt_compliance.%I ENABLE ROW LEVEL SECURITY', object_record.tablename);
    EXECUTE format('ALTER TABLE mgt_compliance.%I FORCE ROW LEVEL SECURITY', object_record.tablename);
    IF object_record.tablename <> 'deployment_slot' THEN
      EXECUTE format(
        'CREATE TRIGGER reject_change BEFORE UPDATE OR DELETE OR TRUNCATE ON mgt_compliance.%I FOR EACH STATEMENT EXECUTE FUNCTION mgt_compliance.reject_mutation()',
        object_record.tablename);
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON ALL TABLES IN SCHEMA mgt_compliance FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA mgt_compliance FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA mgt_compliance FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA mgt_compliance REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA mgt_compliance REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;

-- REQUIRED, NOT IMPLEMENTED BY THIS REFERENCE:
-- 1. Identity/role-bound APIs with pinned search_path and no arbitrary SQL.
-- 2. Append writers separated from approval, executor, rollback and export writers.
-- 3. Exact role/check completeness and shared bindings under SERIALIZABLE locks.
-- 4. Handoff/approval signature, secret-safe evidence, trusted-time and revocation checks.
-- 5. One-use authority, target-side fencing, reconciliation and independent watchdog.
-- 6. Readback equality of receipts to export artifacts and approved destinations.
-- 7. Legal hold/retention purge via a separate governed offline maintenance role.
-- 8. Tests for privileged bypass. Triggers/RLS cannot defeat a database superuser.
