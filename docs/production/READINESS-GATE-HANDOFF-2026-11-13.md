# Production readiness gate handoff

Date: 2026-11-13  
Application candidate: `12826d7fec2f5c3cd6c72b41f5eb9483d1a2c334`

The deployed application is live and healthy at the container level. Operational readiness remains intentionally unavailable for `backup_unhealthy` and `catalog_unready`. These are evidence and approval gates; they must not be cleared with sample data, invented records, or configuration-only assertions.

## Encrypted backup and restore gate

Required external operation:

1. Create or identify a fresh encrypted, off-host backup of the production PostgreSQL database.
2. Record the backup completion timestamp, bounded storage identifier, and `sha256:` checksum without placing credentials in the record.
3. Restore that backup into an isolated non-production PostgreSQL target. Never restore over production.
4. Run the structural database audit and application smoke checks against the isolated restored target.
5. Record the restore start/completion time, restored migration version, measured RTO/RPO, and an HTTPS evidence reference.
6. Have the accountable data or compliance operator accept the restore result.
7. Submit the verified evidence through the protected backup-verification workflow or the approved signed attestation receiver.
8. Run the production worker and confirm `backup_unhealthy` clears without exposing the backup location, checksum, or evidence link publicly.

The repository already rejects future timestamps, malformed checksums, non-HTTPS restore evidence, stale evidence, timestamp conflicts, duplicate deliveries with changed content, and unsigned attestation requests.

## Reviewed catalog gate

The production catalog must include at least one eligible product in every required routine slot: cleanser, treatment, moisturizer, and sunscreen.

Each eligible product must be:

- a real non-sample record;
- active and in stock;
- assigned a positive price and merchant identifier;
- assigned normalized ingredient keys;
- created or updated by an authorized catalog editor; and
- independently approved by an SME who did not create or update it.

Every ingredient key used by an active product must have a real non-sample rule with approved status and an independent SME approval. Sample products or draft/sample ingredient rules correctly keep production readiness closed.

Recommended approval order:

1. Import or enter real ingredient rules as drafts.
2. Independently review and approve each ingredient rule.
3. Import or enter real products as non-sample drafts.
4. Confirm merchant, price, stock, slot, and normalized ingredients.
5. Independently approve products only after all referenced ingredient rules are approved.
6. Review the protected catalog-health report until all four required slots have at least one eligible product and no warnings remain.
7. Recheck `/readyz` and a representative Skin Match using a non-customer test account.

## Subscription activation remains separate

Clearing these readiness gates does not authorize billing. Subscription charging remains disabled until all four live Guided/Studio prices, signed webhook configuration, approved terms, and the controlled payment rehearsal are separately complete.
