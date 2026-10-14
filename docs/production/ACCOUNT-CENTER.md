# Connected account center

Build checkpoint: v4.342

The account center is the authenticated customer workspace for shared profile preferences,
Premium subscription handoff, optional image organization, data export, consent, and deletion.

## Connected-services overview

`GET /api/hub/account/overview` gives a signed-in customer one readiness view across account
profile, skin routine, anti-aging progress, beauty/style, saved retailers, optional images,
Premium billing, support, analysis permission, and privacy controls. The response is private and
non-cacheable. It exposes only fixed labels, readiness states, destinations, and customer-owned
counts. It excludes profile answers, product identifiers, support content, image/file identifiers,
billing-provider references, and payment details. Tests cover authentication, account isolation,
safe response headers, expected counts, and explicit sensitive-field redaction.

The portal refreshes the overview after relevant account changes. Shared account profile types,
service-status contracts, and portal paths live in `@mgt/shared` so web and Android do not maintain
separate route or data definitions.

## Stored account preferences

The account profile stores only the fields currently used to organize connected experiences:

- preferred name;
- language/region and IANA time zone;
- US or metric measurements;
- selected MGT service interests;
- routine-reminder and in-portal announcement preferences;
- reduced-motion and higher-contrast preferences; and
- a default image destination.

Writes require a verified account and the latest revision. Concurrent stale writes fail closed.
The profile is included in the customer export and removed by the account-deletion worker.
Medical history, billing address, full card data, and card security codes are not collected in
this profile.

## Payment boundary

The account center reads confirmed Premium subscription status from the existing billing API.
New setup continues through the Plans & Billing page and secure hosted checkout. Existing payment
methods, invoices, address changes, and cancellation are handled through the hosted billing portal.
MGT retains only provider references and webhook-confirmed subscription state. Retail product
purchases, refunds, shipping, and returns remain with the external retailer.

All billing actions remain unavailable when approved prices, terms, provider credentials, or signed
event processing are not configured.

## Image boundary

The account center embeds the existing image library. A user still chooses every image, purpose,
and destination. The saved default destination never uploads a file by itself.

- Device storage uses browser IndexedDB and is not account sync.
- Google Drive is available only when the non-production test integration is explicitly enabled.
- Production image storage remains disabled until a reviewed private storage association, retention
  policy, access controls, and deletion path are implemented.
- Images are not analyzed, diagnosed, or shared with retailers.

## Android alignment

The Android surface opens the account center's service overview, profile, payment, and image
sections through the configured HTTPS portal URL using shared route constants. Native account
editing, billing SDK integration, and image picking are not claimed by this checkpoint and require
separate device and store review before release.
