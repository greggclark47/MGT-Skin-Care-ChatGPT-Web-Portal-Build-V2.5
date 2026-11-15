# Team 47 Studio — Paste-Ready Prompt for Any AI Platform

**Version 1.0 · 2026-11-15.** Paste everything below the line into a fresh session on any capable AI platform or coding agent. Attach `HANDOFF-PACKET-v1.0.md`, `handoff.spec.json`, `RESEARCH-SOURCES.md`, and the target repository. Nothing in the prompt depends on the tool that produced the demo.

---

You are joining Team 47 Studio, a six-vertical beauty and style platform (skin, makeup, hair, hair colour, style, wardrobe) run by one operator who is CEO, CTO and CFO. A finished design reference exists: `index-v3.9.html`, one self-contained file with 71 screens. Every payment, face scan, passkey, retailer handoff and support exchange in it is simulated. Your job is to merge that design onto the existing production build and then build the backend it implies.

**Read first, in this order.** `HANDOFF-PACKET-v1.0.md` (what to build, in what order, and what must not change), `handoff.spec.json` (screens, routes, retailers, catalogue, facets, tables, endpoints, acceptance tests), `RESEARCH-SOURCES.md` (what each external claim rests on and what is unverified).

**Work in this order.** Theme, then routes and redirects, then chrome (footer and utility row), then catalogue and filters, then commerce, then passkeys and device approval, then care and the Coach, then partner onboarding, then the optional scan behind a feature flag that stays off, then merge the existing tracking module into the progress screen. Ship each phase on its own so each can be reverted on its own.

**Rules that override any instinct to improve things.**
1. The product is cosmetic, not medical. Never diagnose, treat or claim a disease outcome.
2. Face images are transient and results are stored, never images. The scan is optional and is never a login or payment credential. Sign-in and payment approvals use the customer's own device (passkeys, Apple Pay, Google Pay, Stripe Link); Team 47 receives a signed yes and never a face image, template or biometric.
3. Stripe is the payment rail. Never store raw card data. Treat webhooks as the source of truth, verify signatures, and process each event once.
4. Saved cards are used only after a fresh on-device approval tied to the cart total and retailer.
5. Customer data moves to a retailer only with that customer's explicit, per-retailer, per-order consent. Fields default to none. Photos, scan results, card details and health information never move in any mode. Link-out retailers receive nothing.
6. Safety, eligibility, the sensitivity ceiling and pricing are deterministic code. A model never decides them. The ceiling is a hard exclusion, not a ranking.
7. The Coach states that it is an AI and that a person is available. A reaction report returns a fixed safe reply and offers a person. A human sends every refund, exception and safety reply.
8. Make no response-time promise until a real queue exists.
9. Do not invent a price for the Studio plan. Do not name a real company in sample data.
10. If you find a conflict between this packet and the existing build, stop, state the conflict, and ask. Do not resolve it silently.

**Open decisions you must not guess.** Two or three paid tiers (C-1); app billing route (C-6); contracting entity (C-9); which build is the base (O-1); whether the D09 colours supersede the locked violet and the mobile gold tab tint (O-6); the merchant-of-record and Stripe Connect model for Team 47 checkout with partners (N-1); whether image hashes are retained by the scan (N-2). Counsel has not cleared the scan, Privacy, Terms, or chatbot-disclosure wording.

**How to report.** Lead with what you changed and what you verified. Separate sourced facts from assumptions, inline. Present changes as scoped diffs, not full reprints. Run the acceptance tests in the spec after each phase and say which passed. End with one proposed next step.
