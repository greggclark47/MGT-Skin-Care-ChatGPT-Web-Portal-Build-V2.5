# MGT Skin Care mobile surface

The mobile Skin Match screen reuses the shared questionnaire, profile conversion, design tokens, and API client from the workspace. Its contract gate runs without requiring a simulator or provider credentials:

```text
pnpm --filter @mgt/mobile test:contract
```

For an Expo development session, configure `EXPO_PUBLIC_API_URL` in the mobile environment before starting Expo. The mobile client must use the same-origin or approved staging API endpoint; it must not receive server-side provider keys.

The contract gate does not claim a device build or store readiness. Those still require an approved Expo toolchain, simulator/device, authentication configuration, and a staging API.

## Android production path

The checked-in `eas.json` is the release boundary for Android only:

- `preview` creates an internal APK for device acceptance testing.
- `production` creates a Play-compatible Android App Bundle and increments the remote version code.
- `android:submit:internal` submits a draft to the internal track; it does not publish to production.

Before an Android build, provide `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_PRIVACY_URL`, and
`EXPO_PUBLIC_TERMS_URL` through the EAS environment or a local, ignored environment file.
Production API and legal URLs must use HTTPS. The app requests no optional Android permissions
and disables cleartext traffic. Complete the Play Console Data safety form from
`PLAY-DATA-SAFETY-DRAFT.md`, then obtain human review of the privacy notice, terms, claims,
support route, target audience, account deletion path, and store listing before submission.

Optional client photo capture and organization is available in the web portal at `/my-skin` and
during Skin Match onboarding. Android can open that portal with `EXPO_PUBLIC_PORTAL_URL` (HTTPS
in production). The current photo library uses browser IndexedDB on that device; it does not
sync to an account, the Android app, or the webstore. Native photo picking and private cloud
object storage must be configured before promising cross-device image management or production
photo upload. The flow does not analyze images or provide diagnosis.
