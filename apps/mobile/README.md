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

Connected setup guidance, profile preferences, Premium payment setup and client photo organization are available
through the web account center at `/account`. Android opens the personalized overview, profile, payment and image sections
with `EXPO_PUBLIC_PORTAL_URL` (HTTPS in production) until reviewed native modules are connected.
Local image storage uses browser IndexedDB on that device. A non-production Google Drive option may
be enabled in test environments only; it is not production photo sync. Native photo picking and
private production object storage must be configured before promising cross-device image management
or production photo upload. The flow does not analyze images or provide diagnosis.

Skin Match completion consumes the shared v4.345 match-intelligence contract. Android shows core
routine coverage, eligible-candidate count, the first four matching datapoints, the deterministic
ranking boundary, and a portal link for full evidence. Product feedback and reversible future-match
exclusions stay in the secure web portal until a reviewed native account module is connected. Photos
remain outside the matching engine.
