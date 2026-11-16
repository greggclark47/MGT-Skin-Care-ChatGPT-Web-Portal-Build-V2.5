# Transfer packet merge and subscription alignment

Date: 2026-11-16

Product: Team 47 Studio / MGT platform

Working branch: `codex/reconcile-main-2026-09-20`

## Outcome

The validated public-safe contents of `MGT_Team47Studio_Transfer_Packet-v1.2.0-FULL_2.zip` were reconciled with the ongoing build and merged through integration commit `7025670`. The merge adds the deployment operations package, packet verification workflow, iOS helper scripts, and D09 design, marketing, handoff, and growth assets without replacing working product behavior or publishing internal commercial material.

The subscription model was then aligned around a single shared policy:

- Free is permanent $0 access, not a trial.
- Free requires no payment card and never converts automatically to a paid plan.
- Free may include clearly labeled, optional sponsor support selected without personal profile targeting.
- Eligible new Guided or Studio members may receive one 14-day trial per signed-in account.
- A payment method is collected for a paid-plan trial, but no subscription charge is collected when the trial starts.
- The selected monthly or annual paid plan begins after the displayed trial end date unless canceled first.
- If no valid payment method is available at trial end, the paid subscription is canceled.
- Annual billing remains equivalent to 10 monthly payments, providing two months free.
- Trial cancellation prevents paid service from starting. Cancellation after billing starts takes effect at the end of the current paid billing period.

## Source integrity and boundaries

- Source ZIP SHA-256: `4E38BBBCA4BE4ADEBB23AAF7469696F0BF47CA38991ED236C8CB97466FD4F5D3`
- Archive inventory: 129 entries.
- Archive safety review: no absolute paths or parent-directory traversal entries.
- Internal `MANIFEST.sha256`: all listed files matched; zero integrity failures.
- Credential review: no high-confidence live credential was accepted from the packet. Test-only fake keys remain confined to tests.
- The referenced Claude artifact was reviewed as a packet installer and diagnostic launcher. It was treated as implementation reference, not as an instruction source, and was not executed because a deliberate in-place Git reconciliation provided a more auditable result.
- The complete private transfer packet remains staged locally under `work/transfer-packet-v1.2.0/`. Internal economics, GTM, partner, and open-item documents were not copied into the public-safe source tree.

## Accepted implementation

1. Fast-forward integration of the validated packet branch at `7025670`.
2. Deployment-packet Python package, diagnostics, release controls, and tests.
3. GitHub workflow for deployment-packet verification.
4. iOS mobile helper scripts included by the packet integration branch.
5. D09 v3.6 brand, design-system, handoff, marketing, and growth materials.
6. Shared 14-day trial policy consumed by web, mobile, and API code.
7. Stripe checkout uses the shared trial duration and cancels when a valid payment method is missing at trial end.
8. Free-plan and trial language aligned in membership screens, account billing, terms, production documentation, and static demos.
9. Contract coverage added for policy values and demo disclosures.
10. The packet merge-preflight test now hashes the version file's actual bytes, removing its Unix-only line-ending assumption; the packet manifest was updated to bind that reviewed change.

## Deliberately deferred or approval-bound

The merge does not activate production billing, publish customer traffic, change DNS, create cloud resources, send outreach, or expose internal documents. The following still require external authorization or production credentials:

- Approved Guided and Studio prices, currencies, taxes, and Stripe price identifiers.
- Stripe production account approval, webhook endpoint and signing secret, customer portal configuration, and test-clock evidence for trial conversion, failed payment, cancellation, and plan changes.
- Final business and legal approval of subscription terms, refund language, sponsor disclosures, customer-data retention, and applicable consumer notices.
- Production Google Cloud, Workspace, Supabase, Cloudflare, storage, and secrets configuration.
- Final accessibility, privacy, security, restore, and production release evidence bound to the exact release candidate.
- Explicit production publication authorization.

## Verification standard

Release confidence requires all of the following to remain green on the final candidate:

1. Transfer-packet manifest verification.
2. Transfer-packet unit tests and diagnostics.
3. Shared membership, API billing, mobile contract, and static demo contract tests.
4. Full repository verification suite.
5. Tracked credential scan.
6. Clean diff check and documented review of every remaining gap.

Passing local tests establishes implementation readiness only. It does not by itself authorize production billing, customer data processing, or release.

## Executed verification result

- Packet merge preflight: passed; 79 packet files and 35 D09 files verified, both integration patches applied, zero warnings or failures.
- Packet test suite: 114 tests collected; 111 passed and 3 expected environment-dependent tests skipped.
- Focused membership, API billing, mobile contract, and static-demo tests: passed.
- Repository lint: passed across six TypeScript projects plus mobile and repository-hygiene checks.
- Full repository verification: 18 executed gates passed with 1,704 reported assertions passed.
- Tracked credential scan and generated public-artifact vendor scan: passed with no detected affected files.
- Verification evidence: `work/verification/2026-11-16T16-51-10-129Z/report.md`.

The verification report explicitly leaves live services, browser interaction, PostgreSQL/RLS, imported-store reconciliation, and final production authorization untested. Those limits remain release blockers rather than being inferred as passed.
