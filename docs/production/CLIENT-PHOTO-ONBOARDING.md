# Client photo onboarding and image library

## Current capability

The web portal provides optional photo capture/import during Skin Match review, an image library
on My Skin, and entry from the Anti-Aging Edit. The shared portal also serves the webstore surface.
Android can link customers to `/my-skin` when `EXPO_PUBLIC_PORTAL_URL` is configured.

Supported source files are JPEG, PNG, and WebP up to 8 MB each. The browser converts images to
JPEG, limits the long edge to 2,048 pixels, and thereby removes embedded metadata before saving.
The library keeps up to 12 images (40 MB total) in browser IndexedDB on the current device, under
an opaque per-portal-session storage scope. Customers can view, categorize, and remove images. No
image is required to complete a Skin Match.

## Image guidance

- Front view in soft, even light, camera at eye level, neutral background, and no filter.
- Optional left and right side views with consistent distance and lighting.
- Optional close-up of a single area the customer wants to journal.
- Optional routine inspiration, progress check-in, or product label for personal reference.
- Repeat progress photos with the same lighting, distance, and angle. Do not rely on them to assess
  a medical condition or treatment outcome.
- Avoid including other people, identity documents, or information the customer does not intend to
  keep on the device. Do not submit intimate images.

## Production boundary and next implementation

This is a local-device image library, not server upload. Photos do not sync across browsers,
devices, accounts, the Android app, or retailer pages; they are not sent to MGT or analyzed. The
Android screen links to the portal and does not currently have native image picking. Do not claim
cloud backup, account retention, AI analysis, or cross-device availability.

To enable real cross-device upload, configure a private object-storage bucket and a service that
issues short-lived, per-customer upload/download URLs; persist ownership, purpose, checksum, and
retention metadata in the portal database; enforce per-account quotas and deletion; set bucket CORS
to the approved portal origin; and test authorization, malware/content validation, restore, account
deletion, and consent withdrawal. Add native Android image picking only after the same authenticated
upload API is available. Keep photo analysis disabled unless a separate, informed consent and
reviewed safety flow is implemented.
