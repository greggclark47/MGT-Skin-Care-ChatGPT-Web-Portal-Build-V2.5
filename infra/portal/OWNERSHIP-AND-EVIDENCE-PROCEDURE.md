# Ownership and evidence integrity — v2.32

Gregg Clark of MGT is the accountable owner for operational configuration, release decisions, support, data, platform, and accessibility. Generated templates use the shared owner definition in `ownership.mjs`. Naming an owner is not an approval, and matching a name does not authenticate a person.

## Record and validate a decision

1. Identify the exact candidate commit, environment, deployment origin, immutable images, and rollback target. Do not substitute an earlier candidate's evidence.
2. Generate the release/staging/production templates using the existing release tooling. Keep every decision and evidence result pending until the corresponding work and review actually occur.
3. Capture redacted, candidate-specific evidence for hosting, database/migrations/RLS, secret injection, backup/restore, support coverage, accessibility, rollback, and launch. Never put credentials or customer information in source control or release archives.
4. Gregg reviews the evidence for each role. Record the actual decision, timestamp, reviewer, and evidence reference. Each approval's approver must match that role's declared owner; the production decision maker must match the release owner. A hold or missing approval must not be changed automatically.
5. Run local verification and preserve its actual output. The prerequisites generator marks build and test results `not_evaluated`: it does not run those checks. Passing fixture-based tests is not proof of a live deployment.
6. Validate both the source prerequisites and their dependent review, then verify the referenced artifact bytes. A complete review needs all ten unique review records with valid metadata, checksums, positive byte counts, and passing status. Empty, incomplete, altered, and non-ready reviews cannot pass artifact verification.
7. Obtain observed GitHub and Google Drive receipts for the exact candidate. Connection checks and old receipts are not publication evidence for a new candidate.
8. Run the existing final release/production gates. Preserve any blocked status until the required live evidence and explicit owner decision exist. Local verification does not authorize production traffic.

## Migrate earlier prerequisite records

Earlier prerequisite hashes omitted nested content. Do not edit only the checksum or grandfather an old review into the new validation.

1. Preserve the old source, review, and audit trail unchanged.
2. Regenerate prerequisites for the intended commit from the approved environment outside source control:

   ```powershell
   node infra/portal/production-prerequisites.mjs --candidate-commit <40-character-commit> --env-file <approved-environment-file> --output work/production/prerequisites-v2.32.json
   ```

3. Resolve any reported configuration errors using approved configuration. Do not manually relabel a blocked configuration as ready.
4. Recheck all record artifacts and their applicability to this candidate. Supply the ten records defined by `PREREQUISITE_RECORD_IDS`, including actual owners, past review timestamps, `pass` status only after review, and local evidence references.
5. Regenerate the dependent review with a new output filename:

   ```powershell
   node infra/portal/production-prerequisite-review.mjs --prerequisites work/production/prerequisites-v2.32.json --records <reviewed-records-json> --output work/production/prerequisite-review-v2.32.json
   ```

6. Check the generated status and errors; creating a file does not mean it passed. Use `validateProductionPrerequisiteReview` with the new source document and `verifyProductionPrerequisiteReview` against the local artifacts. Regenerate downstream records bound to the previous checksums and rerun their existing gates.

Canonical SHA-256 checksums detect content changes relative to a trusted digest; they are not signatures, identity checks, or protection against an actor who can replace both content and digest. Preserve authenticated approval and publication records separately.
