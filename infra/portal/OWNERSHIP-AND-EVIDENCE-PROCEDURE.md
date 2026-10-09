# Ownership and evidence integrity — v2.36

Gregg Clark of MGT is the accountable owner for operational configuration, release decisions, support, data, platform, and accessibility. Generated templates use the shared owner definition in `ownership.mjs`. Naming an owner is not an approval, and matching a name does not authenticate a person.

## Drive file identity in v2.36

An uploaded Drive export destination or confirmed Drive receipt must carry an exact string file ID and a matching HTTPS binary-file link on `drive.google.com`. A shared predicate is applied by export validation, receipt creation and receipt revalidation. Recomputing a receipt checksum cannot make a mismatched link acceptable.

The supported archive-link profile is `/file/d/ID`, optionally followed by `/view`, `/preview` or `/edit`, and optionally one `usp=sharing`, `usp=drive_link` or `usp=drivesdk` parameter. Other link forms remain unsupported until explicitly reviewed. Whitespace, arrays/objects, unrelated/lookalike hosts, credentials, explicit ports, escaped paths, dot segments, folders, duplicate/unknown query parameters and fragments are rejected without normalization. IDs are case-sensitive. The literal ID placeholder patterns in the project are rejected.

This checks consistency only: it neither visits the link nor proves existence, access, folder membership, identity of the uploader, remote size/hash, freshness or publication authority. Keep pending destinations pending; never fabricate an ID or construct a replacement URL merely to pass validation. If a real observed link is unsupported, preserve it and review the contract before publication. Existing bundle, archive and byte-count checks remain in force. Live byte readback, destination pinning and complete multi-artifact receipt coverage remain outstanding.

## Evidence reads and receipt inspection in v2.35

Staging handoff, authorization and execution-review JSON is now parsed from the same hygiene-checked buffer that supplies its checksum and byte count. Size changes between the metadata check and read are rejected; malformed-JSON diagnostics omit body excerpts. This is a per-file read guarantee, not a multi-file atomic snapshot or authenticated provenance.

Execution receipts require complete operation and probe inspection metadata: safe local text paths, SHA-256 digests and bounded positive integer byte counts. Two equally empty or malformed records do not count as matching evidence. Receipt references/digests must match exactly, without trimming or coercion. The existing receipt schema is retained: the probe's byte count belongs to the supplied inspection, while the operation's byte count also appears in the receipt. Trusted callers must obtain inspections from actual file reads rather than constructing them from untrusted receipt fields.

See [the Drive reference review](GOOGLE-DRIVE-REVIEW-2026-10-09.md) for the historical v2.22 publication record, destination ambiguity, unavailable live-document review and remaining remote receipt controls. No historical receipt or approval was rewritten.

## Approval-window enforcement in v2.34

Staging authorization schema 1.1 preserves both full approval summaries, their separate artifact references and checksums, the canonical handoff checksum, the exact shared execution window, and the configured approval-age limit. Validation rechecks the decision, owner, approval timestamp and window instead of trusting `pass` labels. The two input files must correspond to the release and platform roles in that order. Extra approval records and extra checks cannot be substituted for the required set.

Evidence timestamps must be real UTC ISO dates ending in `Z`, with seconds or exactly three millisecond digits. Whitespace, offsets, date-only strings, impossible calendar dates and coerced values fail closed. Windows must be positive and at most four hours; approval freshness and future-window checks apply at authorization issuance. Execution uses a start-inclusive, end-exclusive window. The standalone receipt validator requires a valid pending authorization, matching checksum and observed post-execution probe. Historical review may occur after the window closes, but cannot authorize a new out-of-window execution.

Migration: preserve schema 1.0 artifacts unchanged for historical reference. Do not relabel their version or fabricate the missing approval details. For a new operation, obtain actual candidate-bound approvals with a new future shared window; regenerate the authorization through the builder, then collect new execution evidence only after the approved action. A local fixture or generated file is not human approval. Schema 1.0 authorizations cannot pass the new execution-receipt gate.

These are structural and consistency checks, not signature verification. A trusted controller must still authenticate the approver, pin the approved age policy, verify the original artifacts against trusted digests, and atomically consume authorization to prevent replay. No deploy, rollback, traffic switch or remote upload is performed by these validators. Existing five-domain production evidence remains distinct; the two-role staging gate does not replace it.

## Canonical-name enforcement in v2.33

Production preflight requires `RELEASE_OWNER_NAME` and `SUPPORT_OWNER_NAME` to equal `Gregg Clark of MGT` exactly. Ship-packet owners, approvers, reviewers and monitoring owners; staging ledger owners and promotion approvers; pending staging authorization summaries; and production gate owners, approvers and decider use the same policy. Missing names, aliases, whitespace/case changes, arrays and coerced objects are rejected. Validation does not rewrite supplied records or echo invalid submitted names in owner-policy errors.

Every preflight failure now blocks release readiness, even when it has no phase-specific error-prefix mapping. Do not repair old approvals by changing their names: retain the historical record, obtain the actual review, and regenerate candidate-bound evidence/approvals and dependent checksums. Pending and hold decisions stay pending or hold.

This checkpoint implements core local release validators only. Authenticated identity, protected CI bootstrap, runtime admission, full downstream ledger enforcement, persistent authorization consumption, cloud failover and automated backup publication remain implementation work described in [the architecture blueprint](architecture/INC-GOVERNANCE-BLUEPRINT.md).

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
