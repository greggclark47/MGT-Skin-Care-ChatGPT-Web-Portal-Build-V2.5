# Team 47 Studio — Research Sources for the v4.0 Handoff

**Version 1.0 · 2026-11-15 · Retrieved 2026-11-15**

> **Status: PRELIMINARY — pending full release.** Prepared for review ahead of any execution. Decisions, routes, wording and figures are subject to change before work begins; nothing here is final until the owner releases it.

Every `[SRC n]`, `[SEC n]` and `[UNVERIFIED]` tag in `HANDOFF-PACKET-v1.1.md` resolves here. **SRC** = primary or official. **SEC** = secondary commentary; counsel confirms before anything is relied on. **UNVERIFIED** = stated in the design but not confirmed in this research pass.

## Primary and official sources

| Tag | Source | What it supports | URL |
|---|---|---|---|
| SRC 1 | FTC, *Policy Statement on Biometric Information and Section 5 of the FTC Act*, 18 May 2023 | Biometric information includes images of facial features; unsubstantiated accuracy or outcome claims and misleading collection statements can be deceptive; assess foreseeable harms before collecting. Non-binding, but shows enforcement posture | https://www.ftc.gov/legal-library/browse/policy-statement-federal-trade-commission-biometric-information-section-5-federal-trade-commission |
| SRC 2 | Illinois BIPA, 740 ILCS 14/10 and 14/15 | "Scan of hand or face geometry" is a biometric identifier; photographs are excluded from the definition; written notice of purpose and term, and a written release, are required before collection; a public retention schedule is required; no profiting from the data | https://www.ilga.gov/documents/legislation/ilcs/documents/074000140k10.htm and http://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=074000140K15 |
| SRC 3 | Illinois Public Act 103-0769 (SB 2979), effective 2 Aug 2024 | "Written release" includes an electronic signature; repeated collection by the same method from the same person is a single violation with at most one recovery | https://ilga.gov/legislation/publicacts/fulltext.asp?Name=103-0769 |
| SRC 4 | 16 CFR Part 255 (FTC Endorsement Guides) and FTC *What People Are Asking* | Affiliate relationships must be disclosed clearly and conspicuously; closer to the recommendation is better; a bare link to a "disclosure" page is not enough | https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255 and https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking |
| SRC 5 | Stripe Docs, *Express Checkout Element* and *Accept a payment* | One-click Apple Pay, Google Pay and Link; the `card` type enables Apple Pay and Google Pay; Link also needs `card`; HTTPS and domain registration in sandbox and live | https://docs.stripe.com/elements/express-checkout-element and https://docs.stripe.com/elements/express-checkout-element/accept-a-payment |
| SRC 6 | Stripe Docs, *Setup Intents API* and *Set up future payments* | `usage` defaults to `off_session`; SetupIntent attaches the method to the Customer; later charges use `off_session=true`; mandate fields; Stripe advises legal review before saving cards for reuse | https://docs.stripe.com/api/setup_intents and https://docs.stripe.com/payments/save-during-payment |
| SRC 7 | Stripe Docs, *Connect: onboard your connected account* (Account Links) | Single-use hosted link; both `return_url` and `refresh_url` required; link expires in minutes; many messaging clients prefetch links and expire them; HTTPS only in live mode; return does not mean onboarding is complete | https://docs.stripe.com/connect/saas/tasks/onboard and https://docs.stripe.com/connect/custom/hosted-onboarding |
| SRC 8 | FIDO Alliance, *Passkeys* and *How Passkeys Work* | Biometric processing stays on the device; the server receives only a public key and signatures, or an assurance that the check passed | https://fidoalliance.org/passkeys/ and https://fidoalliance.org/how-fido-works/ |
| SRC 9 | Apple, *Apple Pay security and privacy overview* | Payment requires Face ID, Touch ID or passcode; merchants receive a device account number and a dynamic code, not the card number | https://support.apple.com/101554 and https://support.apple.com/guide/security/secfbd5c0e54/web |
| SRC 10 | Baymard Institute, product-list and filtering research | Within a filter type, values should combine (OR) and filter types narrow (AND); 15% of benchmarked sites do not allow combining; 28% do not show applied filters in an overview; 62% use unclear filter labels; the average large site is mediocre at best | https://baymard.com/blog/allow-applying-of-multiple-filter-values , https://baymard.com/blog/collections/product-list , https://baymard.com/blog/explain-industry-specific-filters |
| SRC 11 | European Commission, *Transparency obligations under Article 50 AI Act* (FAQ) | Article 50 applies from 2 Aug 2026; chatbots must tell people at the start of the first interaction that they are talking to an AI unless obvious; a grace period to 2 Dec 2026 covers only the Art. 50(2) marking duty for systems already on the market | https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act |
| SRC 12 | South Korea Ministry of Food and Drug Safety figures, via Korea.net (22 May 2026) | 2025 cosmetics exports $11.4B (+11.8%); second-largest exporter behind France ($24.3B); US overtaken to third ($10.8B) | https://www.korea.net/NewsFocus/Business/view?articleId=292940 |
| SRC 13 | US EPA, *UV Index Scale* | UV Index runs 1 to 11+ in bands from low to extreme | https://www.epa.gov/sunsafety/uv-index-scale-1 |

**Flag on SRC 12.** An earlier January 2026 estimate gave +12.3% and $11.43B. The May 2026 ministry analysis gives +11.8% and $11.4B. Use the later figure. Both agree the US is Korea's largest export destination at about $2.2B.

## Secondary sources — counsel to confirm

| Tag | Source | Used for | URL |
|---|---|---|---|
| SEC 1 | Duane Morris Class Action Defense blog (Too Faced / Estée Lauder, 2022 and Dior ruling); Cosmetics Business and ID Tech Wire (*Javid v. M.A.C. Cosmetics*, Cook County No. 2025-CH-08774, filed 25 Aug 2025, reported 2026 as proceeding) | Virtual try-on tools have drawn BIPA class actions, with mixed rulings (one dismissed in the defendant's favour). A reported ruling is not a holding on Team 47's design | https://blogs.duanemorris.com/classactiondefense/2022/11/11/illinois-federal-court-rejects-efforts-to-dismiss-bipa-claims-involving-virtual-try-on-technology/ , https://cosmeticsbusiness.com/mac-cosmetics-faces-data-privacy-lawsuit |
| SEC 2 | Faegre Drinker; Seyfarth; Greenberg Traurig (Aug 2024) | Corroborates SRC 3 and notes open questions on retroactive application to pending cases | https://www.faegredrinker.com/en/insights/publications/2024/8/illinois-governor-signs-law-that-limits-damages-recoverable-under-the-biometric-information-privacy-act |
| SEC 3 | Sidley (24 Jun 2026); Cooley (3 Aug 2026); McCann FitzGerald | Corroborates SRC 11 on the Digital Omnibus timeline | https://datamatters.sidley.com/2026/06/24/eu-ai-act-transparency-obligations-preparing-for-compliance-by-2-august-2026/ |
| SEC 4 | Personal Care Insights; Korea Herald | Corroborates SRC 12 and gives the first-half 2026 figure ($7B, +27.3%, provisional) | https://www.personalcareinsights.com/news/south-korea-k-beauty-exports.html |

## Stated in the design, not verified in this pass — re-verify before relying

- Amazon Associates programme terms (the design treats Amazon-type channels as link-out with an affiliate disclosure).
- Costco affiliate programme paying only for membership sign-ups. The design uses it as the reason warehouse clubs are link-out only.
- Texas CUBI and the Washington My Health My Data Act as they apply to a cosmetic face scan.
- California bot-disclosure and companion-chatbot rules.
- The AI Act's reach to Team 47 as a deployer of a third-party model (SRC 11 gives the text; applicability is a legal judgment).
- Stripe agentic-commerce features (not used in the design; mentioned only as a watch item).
- Google Pay's authentication behaviour (the design cites Apple Pay only).
- The per-customer sensitivity ratings (`actives_level`) are a design device, not a published scale.

## Invented names in the demo — trademark clearance required

All eight retailers and every brand in the 24-item catalogue are invented placeholders. None has been checked against any trademark register. Clear every name, or replace each with a real partner under contract, before any public use.
