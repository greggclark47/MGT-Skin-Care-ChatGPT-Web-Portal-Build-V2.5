# Team 47 Studio reviewed agent export control

Date: 2026-11-07
Status: repository implementation complete; no external delivery enabled

## Purpose

This control creates a safe handoff between Team 47 Studio's draft-only AI agents and a later, separately authorized Google Drive, Gmail, social, or retailer workflow. It does not connect to those services and cannot send, publish, scrape, or contact anyone.

## Implemented boundary

1. Customer-care, social, marketing, and retailer agent output remains draft-only.
2. Source provenance accepts at most 20 unique `drive:` references or clean HTTPS URLs. Credential-bearing URLs, query strings, fragments, custom ports, localhost references, control characters, surrounding whitespace, duplicates, and arbitrary reference schemes are rejected.
3. The draft creator may submit the draft for review but cannot approve it. Approval requires a second authenticated operator with an authorized administration or compliance role.
4. Draft, pending-review, rejected, malformed, or missing runs cannot be exported.
5. An approved run exports as `team47studio.agent-review-export.v1` with the reviewed text, bounded provenance references, approval time, and explicit no-side-effect controls.
6. The export omits model/provider details, prompts, creator and reviewer identities, credentials, and customer data.
7. A SHA-256 digest covers the complete export content before the integrity block, allowing a downstream operator to detect changes.
8. The portal operations console now supports bounded draft creation, source-reference entry, submit/review/reject actions, and approved-artifact download. The API supplies only viewer-specific action permissions, so the creator is not shown an approval action and unapproved drafts are not shown an export action.

## Deliberately pending

- Automatic Google Drive or Google Sheets writes
- Gmail draft creation or message sending
- Social publishing or replies
- Retailer contact, lead enrichment, or scraping
- Approval of a replacement model for the blocked GTM strategy agent

Each pending integration requires its own least-privilege credentials, retention decision, consent or lawful-basis review, suppression handling, delivery audit, rollback procedure, and production authorization.

## Verification

The focused API regression verifies unsafe source rejection, pre-approval export denial, independent reviewer enforcement, malformed stored-record rejection, approved export shape, digest recomputation, absence of model/provider and operator identity data, and explicit confirmation that no external action occurred.

Full local verification passed all 19 gates and 1,377/1,377 HTTP, persistence, and release-contract tests after the operator console was added. Evidence: `work/verification/2026-11-08T02-12-46-865Z/report.md`. This is local repository evidence only; it does not approve a model replacement, configure an external delivery integration, deploy a service, or authorize production traffic.
