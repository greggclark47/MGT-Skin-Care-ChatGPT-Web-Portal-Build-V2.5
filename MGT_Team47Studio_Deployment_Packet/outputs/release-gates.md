| Gate | Priority | Platforms | Status | Title | Owner | Evidence needed | Evidence on file | Accepted by |
|---|---|---|---|---|---|---|---|---|
| G01 | P0 | web, android, ios | reported | Candidate packet and production gate for the exact commit and image digests | Release authority | Signed gate JSON, image digests, approver, rollback owner |  |  |
| G02 | P0 | web, android, ios | reported | Runtime admission clean with Secret Manager-backed configuration | Platform | Clean preflight and release-readiness output from the target runtime |  |  |
| G03 | P0 | web | open | Stripe live activation: business verification, products and prices, meter, tax, refund, dispute and support settings, webhook secret | Commerce | Stripe dashboard evidence and a redacted runtime configuration check |  |  |
| G04 | P0 | web | reported | Stripe test-mode matrix, then a controlled live smoke, with reconciliation | Commerce and QA | Candidate-bound run log and reconciliation result |  |  |
| G05 | P0 | web, android, ios | reported | Deployed route contract and health endpoints verified | API and platform | Approved route contract and probes through the deployed origin |  |  |
| G06 | P0 | web, android, ios | open | Authenticated Supabase journeys: OAuth, recovery, deletion, replay rejection, two-account isolation, entitlement reconciliation | Data and identity | Two-account evidence packet, SQL and RLS logs, browser and API traces |  |  |
| G07 | P0 | web, android, ios | open | Encrypted off-host backup and isolated restore drill with measured RPO and RTO | Data and operations | Restore report, RPO and RTO, owner sign-off (t47 backup drill gives the record) |  |  |
| G08 | P0 | web, android, ios | open | Approved product catalog and ingredient and claim rules | Content | Content owner sign-off with a source register |  |  |
| G09 | P0 | web, android, ios | open | Named approvers and a signed release authorization | Owner | Signed release record with go/no-go and rollback authority |  |  |
| G10 | P1 | web, android, ios | open | WCAG 2.2 AA audit of the deployed candidate, desktop and mobile | Accessibility | Signed accessibility report with URL and build |  |  |
| G11 | P1 | web, android, ios | reported | Support and incident owners, response target, helpdesk, tested alert receiver | Support | Alert delivery receipt and a first-response drill |  |  |
| G12 | P1 | web, android, ios | open | AI routing approved: models, hosted fallback, consent wording, spend limits, latency and error budgets | AI owner | AI owner decision record and the bake-off report (t47 models bakeoff) |  |  |
| G13 | P1 | web, android, ios | open | Production storage for customer images confirmed with retention and access tests | Storage | Storage owner evidence and a deletion test |  |  |
| G14 | P0 | android | reported | Android: Expo project linked, signed AAB, physical-device acceptance | Mobile | Signed build record and device test notes |  |  |
| G15 | P0 | android | reported | Google Play: listing, Data safety, content rating, screenshots, policy URLs, internal track | Mobile | Internal-track acceptance |  |  |
| G16 | P0 | ios | open | iOS: Apple Developer Program, EAS iOS build, TestFlight device acceptance | Mobile | TestFlight build record and device test notes |  |  |
| G17 | P0 | ios | reported | App Store: listing, App Privacy answers, age rating, screenshots, review notes, account deletion path | Mobile | App Store Connect submission record |  |  |
| G18 | P0 | android, ios | open | Mobile billing route decided: no purchase in app, store billing, or a permitted link-out | Owner and counsel | Owner decision recorded against T&C Appendix C-4 |  |  |
| G19 | P2 | web | open | Retail partner acceptance: authorization, catalog ownership, attribution, settlement, support, data sharing | Retail and GTM | Partner acceptance packet |  |  |
| G20 | P2 | web, android, ios | open | Privacy, terms, AI disclosure, cancellation and refund, and support pages complete on the candidate | Legal | Policy links on the deployed candidate |  |  |
| G21 | P2 | web | open | Load, rate-limit and abuse tests before broad marketing traffic | Platform | Test report |  |  |
| G22 | P2 | web | open | One authoritative runbook reconciling older Cloudflare and GCP documents | Platform | Runbook approved by the platform owner |  |  |
| G23 | P0 | ops | open | Local agent plane qualified: bake-off, OpenClaw audit, injection cases, review queue, encrypted backup | AI owner | Bake-off report, audit report and a verified agent-plane backup |  |  |
| G24 | P1 | web, android, ios | open | D09 v3.9 handoff released by the owner and base build decided (handoff items O-1, N-1, C-9) | Owner | Owner release note replacing the PRELIMINARY status; merchant-of-record and entity-name decisions recorded |  |  |
| G25 | P0 | web, android, ios | open | Optional face scan is off by feature flag, or counsel sign-off is on file | Owner and counsel | Flag state in the deployed configuration, or the signed counsel review (handoff section 7) |  |  |
