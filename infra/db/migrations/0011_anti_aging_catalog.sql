-- Anti-aging discovery foundation (AA-01 through AA-05).
-- This migration creates a server-owned catalog namespace for reviewed, read-only
-- educational records. It does not create checkout, booking, payout, or client policies.

create schema if not exists anti_aging;

create table if not exists anti_aging.records (
  id text primary key,
  record_type text not null check (record_type in ('ingredient','product','treatment','provider')),
  slug text not null unique,
  name text not null,
  evidence_level text not null check (evidence_level in ('limited','emerging','moderate','strong')),
  commercial_label text not null check (commercial_label in ('none','sponsored','partner','affiliate')),
  professional_assessment_required boolean not null default false,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  review_status text not null check (review_status in ('draft','in_review','approved','retired')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists anti_aging_records_type_status_idx
  on anti_aging.records (record_type, review_status, updated_at desc);

create table if not exists anti_aging.consent_records (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  purpose text not null check (purpose in (
    'personalization','sensitive_skin_information','treatment_interest','progress_tracking',
    'reminders','provider_handoff','commercial_attribution','photo_analysis'
  )),
  version text not null,
  granted boolean not null,
  captured_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (actor_id, purpose, version)
);

create index if not exists anti_aging_consent_actor_idx on anti_aging.consent_records (actor_id, purpose, captured_at desc);

alter table anti_aging.records enable row level security;
alter table anti_aging.consent_records enable row level security;

comment on schema anti_aging is 'Server-owned reviewed discovery records; not a browser data surface.';
comment on table anti_aging.records is 'Canonical anti-aging ingredients, products, treatments and providers. Public reads are API-mediated and review-gated.';
comment on table anti_aging.consent_records is 'Purpose-scoped consent records for future authenticated features; no consent is implied by browsing.';
