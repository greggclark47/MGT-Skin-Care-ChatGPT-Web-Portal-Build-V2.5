# Client photo onboarding and image library

## Current capability

The web portal provides optional photo capture/import during Skin Match review, an image library
on My Skin, and entry from the Anti-Aging Edit. The shared portal also serves the webstore surface.
Android can link customers to `/my-skin` when `EXPO_PUBLIC_PORTAL_URL` is configured.

Supported source files are JPEG, PNG, and WebP up to 8 MB each. The browser converts images to
JPEG, limits the long edge to 2,048 pixels, and thereby removes embedded metadata before saving.
The default library keeps up to 12 images (40 MB total) in browser IndexedDB on the current device,
under an opaque per-portal-session storage scope. Customers can view, categorize, and remove images.
No image is required to complete a Skin Match. An explicitly selected Google Drive destination is
available only when the non-production API has its test integration configured; this sends the
prepared JPEG to a designated private test folder and keeps per-actor ownership metadata in the
portal store. Test Drive limits are 12 images and 40 MB per actor. The Drive OAuth refresh token
stays server-side, media is proxied through the authenticated portal, and generated Drive filenames
do not contain the customer's original filename or profile data.
Each Drive upload batch also requires a request-scoped consent confirmation in the portal. The
confirmation resets after a successful batch; choosing the Drive destination alone never grants
upload consent.

## Image guidance

- Front view in soft, even light, camera at eye level, neutral background, and no filter.
- Optional left and right side views with consistent distance and lighting.
- Optional close-up of a single area the customer wants to journal.
- Optional routine inspiration, progress check-in, or product label for personal reference.
- Repeat progress photos with the same lighting, distance, and angle. Do not rely on them to assess
  a medical condition or treatment outcome.
- Avoid including other people, identity documents, or information the customer does not intend to
  keep at the selected storage location. Do not submit intimate images.

## Enable the test-only Drive destination

### Supabase Google sign-in boundary

The portal can use Supabase Auth as its Google OAuth boundary for account sign-in. This is a
separate concern from the Google Drive authorization used by the test image destination: ordinary
customer sign-in requests only `openid`, email, and profile identity scopes. It does **not** request
access to a customer's Google Drive, and the portal does not retain Google provider tokens.

1. In the designated Supabase project, enable and configure the Google provider. Add the exact
   portal callback, `https://YOUR-PORTAL-HOST/api/hub/auth/google/callback`, to the Supabase redirect
   allow list. Configure the same approved portal origin in Google and Supabase; do not use a broad
   wildcard callback.
2. In the server-only environment, set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
   `SUPABASE_GOOGLE_OAUTH_ENABLED=true`. The portal generates a one-time PKCE verifier and state for
   each sign-in, exchanges the short-lived code server-side, then creates its own secure portal
   session. OAuth state is consumed once and expires after five minutes.
3. Verify first with a synthetic test account: start Google sign-in, complete the redirect, confirm
   the account is linked, and test the profile-conflict choice. Do not enable Drive scopes merely to
   enable account sign-in.

Supabase Auth does not manage refresh of a Google provider token. For that reason, Google sign-in
must not be repurposed as the app-owned Drive service credential. Keep the Drive grant below
separate, least-privilege, server-only, and limited to the designated MGT test folder.

1. Create or choose a private test folder in the test Google account and enable Google Drive API in
   its Cloud project. Do not use a shared customer or production folder.
2. Configure an OAuth client and refresh token with the least-privilege `drive.file` scope. Use the
   designated private **MGT Skin Care Client Image Test Storage** folder by setting
   `TEST_GOOGLE_DRIVE_FOLDER_ID` to its folder identifier in the isolated test environment. If a
   folder ID is not supplied, the portal creates a private folder with that same name in the OAuth
   user's Drive on the first upload. Never place the client secret or refresh token in web/mobile
   variables, source control, logs, or the demo HTML.
3. Set `CLIENT_IMAGE_DRIVE_TEST_ENABLED=true`, `TEST_GOOGLE_DRIVE_CLIENT_ID`,
   `TEST_GOOGLE_DRIVE_CLIENT_SECRET`, and `TEST_GOOGLE_DRIVE_REFRESH_TOKEN` only in the isolated
   non-production API environment; set `TEST_GOOGLE_DRIVE_FOLDER_ID` to the designated folder.
   The API
   reports the option available only when all values exist and `NODE_ENV` is not `production`.
4. Restart the API. In My Skin, choose “Google Drive private test folder” explicitly, verify the
   connection, and confirm the request-scoped upload consent before taking/uploading an image. Verify list, preview, purpose change, and removal using synthetic
   test images. A failed upload should not leave a usable library entry.
5. Revoke the test OAuth grant and remove test images/folder after verification. Do not upload
   actual customer photos to this test path.

Test Drive image metadata appears in the signed-in account data export without exposing the Drive
file ID. Account deletion remains blocked while test Drive images exist, so the user must remove
them from the image library first; this prevents an identity record from being erased while its
Drive files become unreachable. This test path does not migrate guest images into an account.

The code is configuration-backed but not activated: no OAuth client values, refresh token, folder
ID, or Drive access are stored in this repository. A successful application build does not verify
that the Google account/folder grants the API access.

## Designated-folder controls

The designated folder is private by default and should remain accessible only to the MGT test
Google account and the least-privilege test OAuth client. Do not enable link sharing, retailer
access, external AI access, or customer access. Use synthetic, consent-free test images only.

Set `TEST_GOOGLE_DRIVE_FOLDER_ID` in the server-side test environment, never in the web/mobile
application, a committed `.env` file, source archive, or support ticket. The folder identifier is
an environment reference; the OAuth client secret and refresh token remain secrets. The portal
keeps an actor-scoped record for each successfully uploaded test image, proxies image content only
through an authenticated portal route, and removes the Drive file before its portal record. Verify
create, list, preview, category change, deletion, export, account-deletion blocking, and a manual
Drive restore/recovery exercise before accepting any new storage workflow.

## Production boundary and next implementation

The production default remains local-device storage. The test Drive adapter is hard-disabled when
`NODE_ENV=production` and is not a production image service. Production photos do not yet sync
across browsers, devices, accounts, the Android app, or retailer pages. Android links to the portal
and does not currently have native image picking. Do not claim production cloud backup, account
retention, AI analysis, or cross-device availability.

To enable real production uploads, use a reviewed private object-storage or Drive architecture with
production-specific OAuth/data ownership, short-lived authorization, per-account quotas, retention,
deletion, restore and privacy controls; validate authorization, content safety, backup restore,
account deletion, and consent withdrawal. Add native Android image picking only after the same
authenticated production storage API is approved. Keep photo analysis disabled unless a separate,
informed consent and reviewed safety flow is implemented.
